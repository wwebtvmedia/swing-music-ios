import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Animated, FlatList, Vibration,
} from 'react-native';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { api, getImgUrl } from '../api/client';
import { Track, Album, Artist } from '../types';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { LinearGradient } from 'expo-linear-gradient';

const AVATAR_PALETTES = [
  ['#FB923C', '#EC4899', '#A855F7'],
  ['#3B82F6', '#A855F7', '#EC4899'],
  ['#10B981', '#3B82F6', '#A855F7'],
  ['#EF4444', '#FB923C', '#EC4899'],
  ['#14B8A6', '#22D3EE', '#3B82F6'],
  ['#8B5CF6', '#EC4899', '#FB923C'],
];

function getAvatarColors(name: string): [string, string, string] {
  const idx = Math.abs(name.charCodeAt(0) || 0) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[idx] as [string, string, string];
}

const BROWSE_CATEGORIES = [
  { label: 'Playlists', color: '#1DB954', screen: 'Library' },
  { label: 'Albums', color: '#A855F7', screen: 'Albums' },
  { label: 'Artists', color: '#EC4899', screen: 'Artists' },
  { label: 'Favorites', color: '#EF4444', screen: 'Favorites' },
  { label: 'History', color: '#3B82F6', screen: 'History' },
  { label: 'Folders', color: '#FACC15', screen: 'Folders' },
  { label: 'Stats', color: '#14B8A6', screen: 'Stats' },
];

interface SearchResults {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
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

function SkeletonLoader() {
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20 }} showsVerticalScrollIndicator={false}>
      <SkeletonItem style={{ width: 120, height: 22, marginBottom: 16, borderRadius: 4 }} />
      {[1, 2, 3].map((n) => (
        <View key={n} style={styles.skeletonRow}>
          <SkeletonItem style={{ width: 52, height: 52, borderRadius: 4 }} />
          <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
            <SkeletonItem style={{ width: '60%', height: 16, borderRadius: 4 }} />
            <SkeletonItem style={{ width: '40%', height: 12, borderRadius: 4 }} />
          </View>
        </View>
      ))}

      <SkeletonItem style={{ width: 100, height: 22, marginTop: 32, marginBottom: 16, borderRadius: 4 }} />
      <View style={{ flexDirection: 'row', gap: 16 }}>
        {[1, 2].map((n) => (
          <View key={n} style={{ width: 140, gap: 8 }}>
            <SkeletonItem style={{ width: 140, height: 140, borderRadius: 4 }} />
            <SkeletonItem style={{ width: '80%', height: 14, borderRadius: 4 }} />
            <SkeletonItem style={{ width: '50%', height: 10, borderRadius: 4 }} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({ tracks: [], albums: [], artists: [] });
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const { baseUrl, username } = useAuth();
  const { playTrack } = usePlayer();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const displayName = username || 'Swing';
  const avatarColors = getAvatarColors(displayName);

  const thumb = (path?: string) => getImgUrl(baseUrl, path, 'medium');

  useEffect(() => {
    AsyncStorage.getItem('recentSearches').then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setRecentSearches(parsed);
          }
        } catch {}
      }
    });
  }, []);

  const saveSearchQuery = useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const next = [trimmed, ...prev.filter((s) => s !== trimmed)].slice(0, 5);
      AsyncStorage.setItem('recentSearches', JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const clearRecentSearches = async () => {
    Vibration.vibrate(10);
    setRecentSearches([]);
    await AsyncStorage.removeItem('recentSearches').catch(() => {});
  };

  const removeSearchQuery = (q: string) => {
    Vibration.vibrate(8);
    setRecentSearches((prev) => {
      const next = prev.filter((s) => s !== q);
      AsyncStorage.setItem('recentSearches', JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults({ tracks: [], albums: [], artists: [] }); return; }
    setLoading(true);
    try {
      const [trackRes, albumRes, artistRes] = await Promise.all([
        api.searchTracks(q, 4),
        api.searchAlbums(q, 4),
        api.searchArtists(q, 4),
      ]);
      setResults({
        tracks: trackRes.tracks || trackRes.items || [],
        albums: albumRes.albums || albumRes.items || [],
        artists: artistRes.artists || artistRes.items || [],
      });
      setHasSearched(true);
      saveSearchQuery(q);
    } catch (e) {
      console.error('Search error', e);
    } finally {
      setLoading(false);
    }
  }, [saveSearchQuery]);

  const handleClear = () => {
    Vibration.vibrate(10);
    setQuery('');
    setResults({ tracks: [], albums: [], artists: [] });
    setHasSearched(false);
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if (query.trim()) {
        runSearch(query);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  const handlePlayTrack = async (track: Track) => {
    Vibration.vibrate(12);
    await playTrack(track, results.tracks);
    navigation.navigate('Player');
  };

  const noResults = hasSearched && query.trim() &&
    results.tracks.length === 0 && results.albums.length === 0 && results.artists.length === 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { Vibration.vibrate(10); navigation.navigate('Settings'); }}>
          <LinearGradient colors={avatarColors} style={styles.avatar}>
            <Text style={styles.avatarText}>{displayName[0]?.toUpperCase() || 'S'}</Text>
          </LinearGradient>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search</Text>
      </View>

      {/* ─── Search Input ─── */}
      <View style={styles.inputWrapper}>
        <Ionicons name="search" size={20} color="#000" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.input}
          placeholder="What do you want to listen to?"
          placeholderTextColor="rgba(0,0,0,0.55)"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={handleClear}
            style={{ padding: 6, marginRight: -6 }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={20} color="#000" />
          </TouchableOpacity>
        )}
      </View>

      {/* ─── Content ─── */}
      {loading ? (
        <SkeletonLoader />
      ) : noResults ? (
        <View style={styles.noResults}>
          <Ionicons name="search-outline" size={64} color="#535353" />
          <Text style={styles.noResultsTitle}>No results for "{query}"</Text>
          <Text style={styles.noResultsSub}>Try searching for something else.</Text>
        </View>
      ) : !query.trim() ? (
        /* ─── Browse All grid ─── */
        <ScrollView contentContainerStyle={styles.browseGrid} showsVerticalScrollIndicator={false}>
          {recentSearches.length > 0 && (
            <View style={styles.recentContainer}>
              <View style={styles.recentHeader}>
                <Text style={styles.recentTitle}>Recent searches</Text>
                <TouchableOpacity onPress={clearRecentSearches}>
                  <Text style={styles.clearAllBtn}>Clear all</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.recentList}>
                {recentSearches.map((item, idx) => (
                  <View key={idx} style={styles.recentRow}>
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                      onPress={() => {
                        setQuery(item);
                        runSearch(item);
                      }}
                    >
                      <Ionicons name="time-outline" size={18} color="#b3b3b3" />
                      <Text style={styles.recentText} numberOfLines={1}>{item}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => removeSearchQuery(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="close" size={16} color="#b3b3b3" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          <Text style={[styles.browseTitle, recentSearches.length > 0 && { marginTop: 24 }]}>Browse all</Text>
          <View style={styles.grid}>
            {BROWSE_CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.label}
                style={[styles.catCard, { backgroundColor: cat.color }]}
                onPress={() => navigation.navigate(cat.screen)}
              >
                <Text style={styles.catLabel}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : (
        /* ─── Search Results ─── */
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          {/* Tracks */}
          {results.tracks.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Tracks</Text>
              </View>
              {results.tracks.map((track, i) => (
                <TouchableOpacity key={track.trackhash || i} style={styles.trackRow} onPress={() => handlePlayTrack(track)}>
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
                  <Ionicons name="ellipsis-vertical" size={18} color="#b3b3b3" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Albums horizontal carousel */}
          {results.albums.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Albums</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}>
                {results.albums.map((album, i) => (
                  <View key={album.albumhash || i} style={{ width: 140 }}>
                    {album.image ? (
                      <Image source={{ uri: thumb(album.image) }} style={styles.carouselArt} transition={150} />
                    ) : (
                      <View style={[styles.carouselArt, { backgroundColor: '#282828', justifyContent: 'center', alignItems: 'center' }]}>
                        <Ionicons name="disc" size={40} color="#535353" />
                      </View>
                    )}
                    <Text style={styles.carouselTitle} numberOfLines={1}>{album.title}</Text>
                    <Text style={styles.carouselSub} numberOfLines={1}>
                      {album.albumartists?.map(a => a.name).join(', ') || ''}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Artists horizontal carousel */}
          {results.artists.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Artists</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}>
                {results.artists.map((artist, i) => (
                  <View key={artist.artisthash || i} style={{ width: 100, alignItems: 'center' }}>
                    {artist.image ? (
                      <Image source={{ uri: thumb(artist.image) }} style={styles.artistCircle} transition={150} />
                    ) : (
                      <View style={[styles.artistCircle, { backgroundColor: '#282828', justifyContent: 'center', alignItems: 'center' }]}>
                        <Ionicons name="person" size={36} color="#535353" />
                      </View>
                    )}
                    <Text style={[styles.carouselTitle, { textAlign: 'center' }]} numberOfLines={1}>{artist.name}</Text>
                    <Text style={[styles.carouselSub, { textAlign: 'center' }]}>Artist</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },

  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 8,
    marginHorizontal: 16, marginBottom: 16,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  input: { flex: 1, color: '#000', fontSize: 15, fontWeight: '500' },

  section: { marginBottom: 8 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8,
  },
  sectionTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },

  trackRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  trackThumb: { width: 52, height: 52, borderRadius: 4 },
  trackTitle: { color: '#fff', fontSize: 15, fontWeight: '500' },
  trackSub: { color: '#b3b3b3', fontSize: 13, marginTop: 2 },

  carouselArt: { width: 140, height: 140, borderRadius: 4 },
  carouselTitle: { color: '#fff', fontSize: 13, fontWeight: '600', marginTop: 10, marginBottom: 2 },
  carouselSub: { color: '#b3b3b3', fontSize: 12 },
  artistCircle: { width: 100, height: 100, borderRadius: 50 },

  // Browse grid
  browseGrid: { paddingHorizontal: 16, paddingBottom: 120 },
  browseTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  catCard: {
    width: '47%', height: 90, borderRadius: 8,
    justifyContent: 'flex-end', padding: 12, overflow: 'hidden',
  },
  catLabel: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  noResults: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  noResultsTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 20, textAlign: 'center' },
  noResultsSub: { color: '#b3b3b3', fontSize: 14, marginTop: 8, textAlign: 'center' },

  // Recent Searches
  recentContainer: { marginBottom: 12 },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  recentTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  clearAllBtn: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  recentList: { gap: 12 },
  recentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  recentText: { color: '#fff', fontSize: 15, fontWeight: '500' },

  // Skeleton
  skeletonRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
});
