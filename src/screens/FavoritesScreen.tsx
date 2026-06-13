import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Vibration,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { api, getImgUrl } from '../api/client';
import { Track } from '../types';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';

const SkeletonItem = ({ style }: { style: any }) => {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return <Animated.View style={[{ backgroundColor: '#282828' }, style, { opacity }]} />;
};

function SkeletonLoader({ insets }: { insets: any }) {
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Header Skeleton */}
        <View style={styles.gradientHeader}>
          <SkeletonItem style={{ width: 40, height: 28, borderRadius: 4, marginBottom: 16 }} />
          <View style={styles.artRow}>
            <SkeletonItem style={{ width: 100, height: 100, borderRadius: 4 }} />
            <View style={[styles.artInfo, { gap: 8 }]}>
              <SkeletonItem style={{ width: 120, height: 24, borderRadius: 4 }} />
              <SkeletonItem style={{ width: 60, height: 14, borderRadius: 4 }} />
            </View>
          </View>
          <View style={styles.actionRow}>
            <SkeletonItem style={{ width: 120, height: 24, borderRadius: 4 }} />
            <SkeletonItem style={{ width: 56, height: 56, borderRadius: 28 }} />
          </View>
        </View>

        {/* Tracks List Skeleton */}
        {[1, 2, 3, 4, 5].map((n) => (
          <View key={n} style={styles.trackRow}>
            <View style={styles.trackLeft}>
              <SkeletonItem style={{ width: 48, height: 48, borderRadius: 4 }} />
              <View style={{ flex: 1, marginLeft: 12, gap: 6 }}>
                <SkeletonItem style={{ width: '60%', height: 14, borderRadius: 4 }} />
                <SkeletonItem style={{ width: '40%', height: 12, borderRadius: 4 }} />
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export default function FavoritesScreen() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const { baseUrl } = useAuth();
  const { playTrack, shuffleMode, toggleShuffle } = usePlayer();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    api.getFavoriteTracks(200).then(res => {
      const trackArray = Array.isArray(res) ? res : (res?.tracks || res?.items || []);
      setTracks(trackArray);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const thumb = (path?: string) => getImgUrl(baseUrl, path, 'medium');

  const handlePlay = async (track: Track, idx: number) => {
    Vibration.vibrate(12);
    await playTrack(track, tracks);
    navigation.navigate('Player');
  };

  const handlePlayAll = async () => {
    if (tracks.length === 0) return;
    Vibration.vibrate(15);
    let firstTrack = tracks[0];
    if (shuffleMode) {
      const randomIdx = Math.floor(Math.random() * tracks.length);
      firstTrack = tracks[randomIdx];
    }
    await playTrack(firstTrack, tracks);
    navigation.navigate('Player');
  };

  if (loading) {
    return <SkeletonLoader insets={insets} />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* ─── Gradient Header ─── */}
        <LinearGradient colors={['rgba(69,14,116,0.85)', colors.background]} style={styles.gradientHeader}>
          <TouchableOpacity onPress={() => { Vibration.vibrate(10); navigation.goBack(); }} style={{ marginBottom: 16 }}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>

          <View style={styles.artRow}>
            <LinearGradient colors={['#450E74', '#C4B2F3']} style={styles.artBox}>
              <Ionicons name="heart" size={48} color="#fff" />
            </LinearGradient>
            <View style={styles.artInfo}>
              <Text style={styles.artTitle}>Liked Songs</Text>
              <Text style={styles.artSub}>{tracks.length} songs</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <Ionicons name="arrow-down-circle-outline" size={28} color="#aaa" />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24 }}>
              <TouchableOpacity
                style={styles.actionIconBtn}
                onPress={toggleShuffle}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="shuffle" size={26} color={shuffleMode ? colors.primary : '#b3b3b3'} />
                {shuffleMode && <View style={styles.activeDot} />}
              </TouchableOpacity>
              <TouchableOpacity style={styles.playBtn} onPress={handlePlayAll}>
                <Ionicons name="play" size={28} color="#000" />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        {/* ─── Track List ─── */}
        {tracks.map((track, i) => (
          <TouchableOpacity key={track.trackhash || i} style={styles.trackRow} onPress={() => handlePlay(track, i)}>
            <View style={styles.trackLeft}>
              {track.image ? (
                <Image source={{ uri: thumb(track.image) }} style={styles.trackThumb} transition={150} />
              ) : (
                <View style={[styles.trackThumb, { backgroundColor: '#282828', justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="musical-note" size={18} color="#535353" />
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                <Text style={styles.trackSub} numberOfLines={1}>
                  {track.artists?.map(a => a.name).join(', ') || track.album || ''}
                </Text>
              </View>
            </View>
            <Ionicons name="heart" size={18} color="#E22134" />
          </TouchableOpacity>
        ))}

        {tracks.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="heart-outline" size={48} color="#E22134" />
            <Text style={styles.emptyTitle}>No liked songs yet</Text>
            <Text style={styles.emptySub}>Save songs by tapping the heart icon</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },

  gradientHeader: { padding: 16, paddingBottom: 24 },
  artRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  artBox: { width: 100, height: 100, borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
  artInfo: { marginLeft: 16 },
  artTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  artSub: { color: '#b3b3b3', fontSize: 13, marginTop: 4 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionIconBtn: { alignItems: 'center', justifyContent: 'center', width: 40, height: 40 },
  activeDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary, marginTop: 4 },
  playBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
  },

  trackRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  trackLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  trackThumb: { width: 48, height: 48, borderRadius: 4 },
  trackTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  trackSub: { color: '#b3b3b3', fontSize: 12, marginTop: 2 },

  empty: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 16 },
  emptySub: { color: '#b3b3b3', fontSize: 14, textAlign: 'center', marginTop: 8 },
});
