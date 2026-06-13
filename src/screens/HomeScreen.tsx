import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, RefreshControl, Animated, Vibration,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { api, getImgUrl } from '../api/client';
import { Track, Playlist } from '../types';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';

const { width: W } = Dimensions.get('window');
const CARD_W = (W - 48) / 2;
const CAROUSEL_W = 148;

const AVATAR_PALETTES = [
  ['#FB923C', '#EC4899', '#A855F7'],
  ['#3B82F6', '#A855F7', '#EC4899'],
  ['#10B981', '#3B82F6', '#A855F7'],
  ['#EF4444', '#FB923C', '#EC4899'],
  ['#14B8A6', '#22D3EE', '#3B82F6'],
  ['#8B5CF6', '#EC4899', '#FB923C'],
];

function getAvatarColors(name: string): [string, string, string] {
  const idx = Math.abs(name.charCodeAt(0)) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[idx] as [string, string, string];
}

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

export function SkeletonLoader({ insets }: { insets: any }) {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]} showsVerticalScrollIndicator={false}>
        {/* Top bar skeleton */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <SkeletonItem style={{ width: 32, height: 32, borderRadius: 16, marginRight: 16 }} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <SkeletonItem style={{ width: 56, height: 32, borderRadius: 16 }} />
            <SkeletonItem style={{ width: 68, height: 32, borderRadius: 16 }} />
          </View>
        </View>

        {/* 2x4 Grid skeleton */}
        <View style={[styles.grid, { marginBottom: 24 }]}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <View key={n} style={[styles.gridItem, { overflow: 'hidden' }]}>
              <SkeletonItem style={{ width: 56, height: 56 }} />
              <View style={{ flex: 1, paddingHorizontal: 8, gap: 4 }}>
                <SkeletonItem style={{ width: '80%', height: 12, borderRadius: 4 }} />
              </View>
            </View>
          ))}
        </View>

        {/* Playlists Carousel skeleton */}
        <SkeletonItem style={{ width: 140, height: 22, marginBottom: 16, borderRadius: 4 }} />
        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 32 }}>
          {[1, 2].map((n) => (
            <View key={n} style={{ width: 148, gap: 8 }}>
              <SkeletonItem style={{ width: 148, height: 148, borderRadius: 4 }} />
              <SkeletonItem style={{ width: '80%', height: 12, borderRadius: 4 }} />
            </View>
          ))}
        </View>

        {/* History Carousel skeleton */}
        <SkeletonItem style={{ width: 100, height: 22, marginBottom: 16, borderRadius: 4 }} />
        <View style={{ flexDirection: 'row', gap: 16 }}>
          {[1, 2].map((n) => (
            <View key={n} style={{ width: 148, gap: 8 }}>
              <SkeletonItem style={{ width: 148, height: 148, borderRadius: 4 }} />
              <SkeletonItem style={{ width: '80%', height: 12, borderRadius: 4 }} />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export default function HomeScreen() {
  const [recentTracks, setRecentTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'All' | 'Music'>('All');
  const { baseUrl, username } = useAuth();
  const { playTrack } = usePlayer();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const displayName = username || 'Swing';
  const avatarColors = getAvatarColors(displayName);

  const fetchData = useCallback(async () => {
    try {
      const [recentRes, playlistRes] = await Promise.all([
        api.getRecentlyPlayedTracks(15).catch(err => { console.error('Home: recently played tracks error', err); return null; }),
        api.getAllPlaylists().catch(err => { console.error('Home: playlists error', err); return null; }),
      ]);
      const recentArray = Array.isArray(recentRes) ? recentRes : (recentRes?.tracks || recentRes?.items || []);
      const playlistArray = Array.isArray(playlistRes) ? playlistRes : (playlistRes?.data || playlistRes?.items || []);

      setRecentTracks(recentArray);
      setPlaylists(playlistArray);
    } catch (e) {
      console.error('Home fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const thumb = (path?: string) => getImgUrl(baseUrl, path, 'medium');
  const playlistImg = (path?: string) => getImgUrl(baseUrl, path, 'playlist');

  const handlePlayTrack = async (track: Track) => {
    Vibration.vibrate(12);
    await playTrack(track, recentTracks);
    navigation.navigate('Player');
  };

  const gridTiles = [
    { key: 'liked',    title: 'Liked Songs', image: null, icon: 'heart',    color: '#5E5CE6', isLiked: true,   onPress: () => { Vibration.vibrate(12); navigation.navigate('Favorites'); } },
    ...recentTracks.slice(0, 5).map((t, i) => ({
      key: `r${i}`,
      title: t.title || 'Unknown',
      image: thumb(t.image),
      icon: null, color: 'transparent', isLiked: false,
      onPress: () => handlePlayTrack(t),
    })),
    { key: 'artists', title: 'Artists',     image: null, icon: 'person',   color: '#E22134', isLiked: false,  onPress: () => { Vibration.vibrate(12); navigation.navigate('Artists'); } },
    { key: 'albums',  title: 'Albums',      image: null, icon: 'disc',     color: '#40C8E0', isLiked: false,  onPress: () => { Vibration.vibrate(12); navigation.navigate('Albums'); } },
    { key: 'history', title: 'History',     image: null, icon: 'time',     color: '#FFD60A', isLiked: false,  onPress: () => { Vibration.vibrate(12); navigation.navigate('History'); } },
  ].slice(0, 8);

  if (loading) {
    return <SkeletonLoader insets={insets} />;
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(59,130,246,0.35)', colors.background]}
        style={[styles.topGradient, { height: 220 + insets.top }]}
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Top Bar: Avatar + Tabs ─── */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => { Vibration.vibrate(10); navigation.navigate('Settings'); }}>
            <LinearGradient colors={avatarColors} style={styles.avatar}>
              <Text style={styles.avatarText}>{displayName[0]?.toUpperCase() || 'S'}</Text>
            </LinearGradient>
          </TouchableOpacity>
          <View style={styles.pills}>
            {(['All', 'Music'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.pill, activeTab === tab && styles.pillActive]}
                onPress={() => { Vibration.vibrate(10); setActiveTab(tab); }}
              >
                <Text style={[styles.pillText, activeTab === tab && styles.pillTextActive]}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ─── 2×4 Spotify Grid ─── */}
        <View style={styles.grid}>
          {gridTiles.map((tile, i) => (
            <TouchableOpacity key={tile.key} style={styles.gridItem} onPress={tile.onPress} activeOpacity={0.75}>
              {tile.image ? (
                <Image source={{ uri: tile.image }} style={styles.gridThumb} transition={150} />
              ) : tile.isLiked ? (
                <LinearGradient colors={['#450E74', '#C4B2F3']} style={styles.gridThumb}>
                  <Ionicons name="heart" size={22} color="#fff" />
                </LinearGradient>
              ) : (
                <View style={[
                  styles.gridThumb,
                  {
                    backgroundColor: tile.color && tile.color !== 'transparent' ? tile.color + '22' : 'rgba(255,255,255,0.05)',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }
                ]}>
                  <Ionicons
                    name={(tile as any).icon || 'musical-note'}
                    size={22}
                    color={tile.color && tile.color !== 'transparent' ? tile.color : '#fff'}
                  />
                </View>
              )}
              <Text style={styles.gridLabel} numberOfLines={2}>{tile.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ─── Your Playlists Carousel ─── */}
        {playlists.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Playlists</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
              {playlists.map((pl, i) => (
                <TouchableOpacity
                  key={pl.id || i}
                  style={styles.carouselItem}
                  onPress={() => { Vibration.vibrate(12); navigation.navigate('PlaylistDetail', { playlist: pl }); }}
                >
                  {(pl.image || pl.thumb) ? (
                    <Image source={{ uri: playlistImg(pl.image || pl.thumb) }} style={[styles.carouselArt, { borderRadius: 4 }]} transition={150} />
                  ) : (
                    <View style={[styles.carouselArt, { backgroundColor: '#282828', justifyContent: 'center', alignItems: 'center', borderRadius: 4 }]}>
                      <Ionicons name="list" size={32} color="#535353" />
                    </View>
                  )}
                  <Text style={styles.carouselTitle} numberOfLines={1}>{pl.name}</Text>
                  <Text style={styles.carouselSub} numberOfLines={1}>Playlist</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ─── History Carousel ─── */}
        {recentTracks.length > 0 && (
          <View style={[styles.section, { marginBottom: 120 }]}>
            <Text style={styles.sectionTitle}>History</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
              {recentTracks.map((track, i) => (
                <TouchableOpacity key={track.trackhash || i} style={styles.carouselItem} onPress={() => handlePlayTrack(track)}>
                  {track.image ? (
                    <Image source={{ uri: thumb(track.image) }} style={styles.carouselArt} transition={150} />
                  ) : (
                    <View style={[styles.carouselArt, { backgroundColor: '#282828', justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="musical-note" size={32} color="#535353" />
                    </View>
                  )}
                  <Text style={styles.carouselTitle} numberOfLines={1}>{track.title}</Text>
                  <Text style={styles.carouselSub} numberOfLines={2}>
                    {track.artists?.map(a => a.name).join(', ') || track.album || ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0 },
  scrollContent: { paddingHorizontal: 16 },

  // Top bar
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  pills: { flexDirection: 'row', gap: 8 },
  pill: { backgroundColor: '#282828', borderRadius: 32, paddingHorizontal: 16, paddingVertical: 8 },
  pillActive: { backgroundColor: colors.primary },
  pillText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  pillTextActive: { color: '#000' },

  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  gridItem: {
    width: CARD_W, height: 56,
    backgroundColor: '#282828', borderRadius: 4,
    flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
  },
  gridThumb: { width: 56, height: 56, justifyContent: 'center', alignItems: 'center' },
  gridLabel: { flex: 1, color: '#fff', fontWeight: 'bold', fontSize: 12, paddingHorizontal: 8 },

  // Carousel
  section: { marginTop: 28 },
  sectionTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  carousel: { paddingRight: 16, gap: 16 },
  carouselItem: { width: CAROUSEL_W },
  carouselArt: { width: CAROUSEL_W, height: CAROUSEL_W, borderRadius: 2 },
  carouselTitle: { color: '#fff', fontSize: 13, fontWeight: '600', marginTop: 10, marginBottom: 4 },
  carouselSub: { color: '#b3b3b3', fontSize: 12 },

  // Skeleton
  skeletonRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
});
