import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { usePlayer } from '../context/PlayerContext';
import { Track } from '../types';

interface LyricLine {
  time: number; // ms
  text: string;
}

interface LyricsData {
  synced: LyricLine[];
  plain: string;
}

const LRC_TAG = /\[(\d+):(\d+)(?:[.:](\d+))?\]/;

function parseLrc(raw: string): LyricLine[] {
  if (!raw || !raw.trim()) return [];
  const lines = raw.split('\n');
  const out: LyricLine[] = [];

  for (const line of lines) {
    const match = line.match(LRC_TAG);
    if (!match) continue;
    
    // Clean tag prefix and get lyric text
    const text = line.replace(/\[\d+:\d+(?:[.:]\d+)?\]/g, '').trim();
    const min = parseInt(match[1], 10);
    const sec = parseInt(match[2], 10);
    const msStr = match[3] || '0';
    let ms = 0;
    
    if (msStr.length === 2) {
      ms = parseInt(msStr, 10) * 10;
    } else if (msStr.length === 3) {
      ms = parseInt(msStr, 10);
    } else {
      ms = parseInt(msStr.padEnd(3, '0').slice(0, 3), 10);
    }
    
    const time = min * 60000 + sec * 1000 + ms;
    out.push({ time, text });
  }

  return out.sort((a, b) => a.time - b.time);
}

async function fetchLyrics(track?: Track | null): Promise<LyricsData> {
  if (!track || !track.trackhash) return { synced: [], plain: '' };
  
  const cacheKey = `lyrics_cache_${track.trackhash}`;
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && (parsed.synced || parsed.plain)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load lyrics from cache', e);
  }

  const artistName = track.artists?.map(a => a.name).join(', ') || '';
  const trackName = track.title || '';
  const albumName = track.album || '';
  const durationSec = track.duration || 0;

  try {
    // 1. Try exact match from lrclib
    let url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(trackName)}&artist_name=${encodeURIComponent(artistName)}`;
    if (albumName) url += `&album_name=${encodeURIComponent(albumName)}`;
    if (durationSec > 0) url += `&duration=${Math.floor(durationSec)}`;

    let res = await fetch(url).then(r => r.ok ? r.json() : null);

    // 2. Fallback to search if exact match fails
    if (!res) {
      const searchUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(trackName)}&artist_name=${encodeURIComponent(artistName)}`;
      const searchRes = await fetch(searchUrl).then(r => r.ok ? r.json() : null);
      if (Array.isArray(searchRes) && searchRes.length > 0) {
        res = searchRes[0];
      }
    }

    if (!res) return { synced: [], plain: '' };

    let lyricsData: LyricsData = { synced: [], plain: '' };

    // Synced lyrics: parse lrclib syncedLyrics
    if (res.syncedLyrics && typeof res.syncedLyrics === 'string' && res.syncedLyrics.trim().length > 0) {
      const synced = parseLrc(res.syncedLyrics);
      lyricsData = { synced, plain: res.plainLyrics || '' };
    } else if (res.plainLyrics && typeof res.plainLyrics === 'string') {
      // Plain text lyrics
      lyricsData = { synced: [], plain: res.plainLyrics };
    }

    if (lyricsData.synced.length > 0 || lyricsData.plain.length > 0) {
      try {
        await AsyncStorage.setItem(cacheKey, JSON.stringify(lyricsData));
      } catch (e) {
        console.error('Failed to save lyrics to cache', e);
      }
    }

    return lyricsData;
  } catch (e) {
    console.error('Fetch lyrics error', e);
    return { synced: [], plain: '' };
  }
}

export default function LyricsScreen() {
  const { currentTrack, position, seekToPosition } = usePlayer();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [lyrics, setLyrics] = useState<LyricsData>({ synced: [], plain: '' });
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);
  const lineRefs = useRef<number[]>([]);

  useEffect(() => {
    setLoading(true);
    lineRefs.current = [];
    setLyrics({ synced: [], plain: '' });
    fetchLyrics(currentTrack).then(data => {
      setLyrics(data);
      setLoading(false);
    });
  }, [currentTrack]);

  // Find current line based on position (ms)
  const currentIndex = lyrics.synced.length > 0
    ? lyrics.synced.reduce((best, line, i) => {
        return line.time <= position ? i : best;
      }, -1)
    : -1;

  // Auto-scroll to current line
  useEffect(() => {
    if (currentIndex >= 0 && lineRefs.current[currentIndex] !== undefined) {
      scrollRef.current?.scrollTo({ y: lineRefs.current[currentIndex] - 80, animated: true });
    }
  }, [currentIndex]);

  const hasContent = lyrics.synced.length > 0 || lyrics.plain.length > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#4C4C4C', '#121212']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6 }}>
          <Ionicons name="chevron-down" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerSub}>LYRICS</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {currentTrack?.title || 'No track playing'}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: 160 }]}
        showsVerticalScrollIndicator={false}
      >
        {!currentTrack ? (
          <View style={styles.empty}>
            <Ionicons name="musical-note-outline" size={48} color={colors.primary} />
            <Text style={styles.emptyTitle}>No track playing</Text>
            <Text style={styles.emptySub}>Play a song to see its lyrics</Text>
          </View>
        ) : loading ? (
          <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 60 }} />
        ) : !hasContent ? (
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={48} color={colors.primary} />
            <Text style={styles.emptyTitle}>No lyrics found</Text>
            <Text style={styles.emptySub}>Lyrics not available for this track</Text>
            <Text style={styles.provider}>Powered by LrcLib & Swing Music</Text>
          </View>
        ) : lyrics.synced.length > 0 ? (
          lyrics.synced.map((line, i) => {
            const isCurrent = i === currentIndex;
            return (
              <Text
                key={i}
                style={[
                  styles.lyricLine,
                  isCurrent && styles.lyricCurrent,
                  !isCurrent && styles.lyricDimmed,
                ]}
                onLayout={e => { lineRefs.current[i] = e.nativeEvent.layout.y; }}
                onPress={() => seekToPosition(line.time)}
              >
                {line.text || '♪'}
              </Text>
            );
          })
        ) : (
          <Text style={styles.plainLyrics}>{lyrics.plain}</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16,
  },
  headerSub: { color: '#b3b3b3', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  headerTitle: { color: '#fff', fontSize: 13, fontWeight: '600', maxWidth: 200 },
  content: { paddingHorizontal: 24, paddingTop: 24 },
  lyricLine: {
    fontSize: 28, fontWeight: 'bold',
    lineHeight: 40, marginBottom: 24,
    color: '#fff',
  },
  lyricCurrent: { color: '#fff', opacity: 1 },
  lyricDimmed: { opacity: 0.38 },
  plainLyrics: { color: 'rgba(255,255,255,0.85)', fontSize: 18, lineHeight: 28, fontWeight: 'bold' },
  empty: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 16 },
  emptySub: { color: '#b3b3b3', fontSize: 14, textAlign: 'center', marginTop: 8 },
  provider: { color: '#535353', fontSize: 12, marginTop: 16 },
});
