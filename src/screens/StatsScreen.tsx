import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Vibration,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { api } from '../api/client';

interface StatsData {
  totalArtists: number;
  totalAlbums: number;
  totalTracks: number;
  totalFavorites: number;
  topArtist: string;
}

function formatNum(n: number): string {
  if (n < 1000) return `${n}`;
  return n.toString().split('').reverse().join('').match(/.{1,3}/g)!.join(' ').split('').reverse().join('');
}

const STAT_TILES = [
  { key: 'totalArtists', label: 'ARTISTS', icon: 'person' as const, color: '#EC4899' },
  { key: 'totalAlbums', label: 'ALBUMS', icon: 'disc' as const, color: '#A855F7' },
  { key: 'totalTracks', label: 'TRACKS', icon: 'musical-note' as const, color: '#1DB954' },
  { key: 'totalFavorites', label: 'LIKED', icon: 'heart' as const, color: '#14B8A6' },
];

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

function SkeletonLoader() {
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
      {/* Hero Card Skeleton */}
      <SkeletonItem style={[styles.heroCard, { height: 130 }]} />

      {/* Grid Skeleton */}
      <View style={styles.grid}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.tile}>
            <SkeletonItem style={{ width: 36, height: 36, borderRadius: 12, marginBottom: 4 }} />
            <SkeletonItem style={{ width: '60%', height: 22, borderRadius: 4 }} />
            <SkeletonItem style={{ width: '40%', height: 10, borderRadius: 4 }} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export default function StatsScreen() {
  const [stats, setStats] = useState<StatsData>({
    totalArtists: 0, totalAlbums: 0, totalTracks: 0, totalFavorites: 0, topArtist: '',
  });
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const load = async () => {
      try {
        const [artistRes, albumRes, statsRes, favRes] = await Promise.all([
          api.getArtistsCount().catch(e => { console.error(e); return null; }),
          api.getAlbumsCount().catch(e => { console.error(e); return null; }),
          api.getStats().catch(e => { console.error(e); return null; }),
          api.getFavoriteTracks(1).catch(e => { console.error(e); return null; }),
        ]);

        let totalTracks = 0;
        if (statsRes?.stats) {
          const trackCountItem = statsRes.stats.find((item: any) => item.cssclass === 'trackcount');
          if (trackCountItem) {
            const countStr = String(trackCountItem.value).replace(/[^0-9]/g, '');
            totalTracks = parseInt(countStr, 10) || 0;
          }
        }

        setStats({
          totalArtists: artistRes?.total || artistRes?.count || (artistRes?.items || []).length || 0,
          totalAlbums: albumRes?.total || albumRes?.count || (albumRes?.items || []).length || 0,
          totalTracks,
          totalFavorites: favRes?.total || (favRes?.items || favRes?.tracks || []).length || 0,
          topArtist: '',
        });
      } catch (e) {
        console.error('Stats error', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const combined = stats.totalArtists + stats.totalAlbums;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            Vibration.vibrate(10);
            navigation.goBack();
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Stats</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <SkeletonLoader />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
          {/* Hero card */}
          <LinearGradient
            colors={['rgba(236,72,153,0.28)', 'rgba(168,85,247,0.22)', 'rgba(20,184,166,0.18)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <Text style={styles.heroLabel}>STATS</Text>
            <Text style={styles.heroTitle}>Your Music Library</Text>
            <View style={styles.heroBadge}>
              <View style={styles.greenDot} />
              <Text style={styles.heroCount}>{formatNum(combined)} items tracked</Text>
            </View>
          </LinearGradient>

          {/* Stat tiles grid */}
          <View style={styles.grid}>
            {STAT_TILES.map(tile => {
              const value = stats[tile.key as keyof StatsData];
              return (
                <View key={tile.key} style={styles.tile}>
                  <View style={[styles.tileIcon, { backgroundColor: `${tile.color}25` }]}>
                    <Ionicons name={tile.icon} size={18} color={tile.color} />
                  </View>
                  <Text style={styles.tileValue}>{formatNum(Number(value))}</Text>
                  <Text style={styles.tileLabel}>{tile.label}</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },

  heroCard: {
    borderRadius: 24, padding: 24, marginBottom: 20,
    gap: 8,
  },
  heroLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.5 },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: 'bold', lineHeight: 30 },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1DB954' },
  heroCount: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '500' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    width: '47%',
    backgroundColor: '#1a1a1a', borderRadius: 20, padding: 16, gap: 6,
  },
  tileIcon: {
    width: 36, height: 36, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  tileValue: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  tileLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.8 },
});
