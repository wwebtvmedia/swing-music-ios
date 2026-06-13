import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, Platform, Modal, TextInput, KeyboardAvoidingView, Animated, Vibration, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { api, getImgUrl } from '../api/client';
import { Playlist, Track } from '../types';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

function SkeletonLoader({ insets, displayName, avatarColors }: { insets: any; displayName: string; avatarColors: any }) {
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Header Skeleton */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <LinearGradient colors={avatarColors} style={styles.avatar}>
              <Text style={styles.avatarText}>{displayName[0].toUpperCase()}</Text>
            </LinearGradient>
            <Text style={styles.headerTitle}>Your Library</Text>
          </View>
          <View style={styles.headerRight}>
            <SkeletonItem style={{ width: 22, height: 22, borderRadius: 11 }} />
            <SkeletonItem style={{ width: 22, height: 22, borderRadius: 11, marginLeft: 16 }} />
          </View>
        </View>

        {/* Filter Chips Skeleton */}
        <View style={styles.chips}>
          {[1, 2, 3].map((i) => (
            <SkeletonItem key={i} style={{ width: 80, height: 32, borderRadius: 20 }} />
          ))}
        </View>

        {/* List Items Skeleton */}
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <View key={i} style={styles.listItem}>
            <SkeletonItem style={styles.listThumb} />
            <View style={[styles.listText, { gap: 6 }]}>
              <SkeletonItem style={{ width: '60%', height: 16, borderRadius: 4 }} />
              <SkeletonItem style={{ width: '30%', height: 12, borderRadius: 4 }} />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export default function LibraryScreen() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [favorites, setFavorites] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'Playlists' | 'Artists' | 'Albums'>('Playlists');
  const { baseUrl, username } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const displayName = username || 'Swing';
  const avatarColors = getAvatarColors(displayName);

  const fetchData = useCallback(async () => {
    try {
      // First try to load from cache
      const cachedPl = await AsyncStorage.getItem('library_playlists');
      const cachedFav = await AsyncStorage.getItem('library_favorites');
      if (cachedPl) setPlaylists(JSON.parse(cachedPl));
      if (cachedFav) setFavorites(JSON.parse(cachedFav));
      if (cachedPl || cachedFav) setLoading(false);
      
      const [plRes, favRes] = await Promise.all([
        api.getAllPlaylists(),
        api.getFavoriteTracks(100),
      ]);
      const plArray = Array.isArray(plRes) ? plRes : (plRes?.data || plRes?.items || []);
      const favArray = Array.isArray(favRes) ? favRes : (favRes?.tracks || favRes?.items || []);
      
      setPlaylists(plArray);
      setFavorites(favArray);
      
      // Save to cache
      AsyncStorage.setItem('library_playlists', JSON.stringify(plArray));
      AsyncStorage.setItem('library_favorites', JSON.stringify(favArray));
    } catch (e) {
      console.error('Library fetch error', e);
      if (playlists.length === 0) setPlaylists([]);
      if (favorites.length === 0) setFavorites([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refresh every time the screen comes into focus (after create/edit/delete)
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const playlistImg = (path?: string) => getImgUrl(baseUrl, path, 'playlist');

  const [modalVisible, setModalVisible] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [creating, setCreating] = useState(false);

  // Delete playlist
  const [deleteSheetVisible, setDeleteSheetVisible] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<any>(null);

  const handleCreatePlaylist = () => {
    Vibration.vibrate(10);
    setPlaylistName('');
    setModalVisible(true);
  };

  const submitCreatePlaylist = async () => {
    if (!playlistName.trim()) {
      Alert.alert('Error', 'Please enter a playlist name.');
      return;
    }
    setCreating(true);
    try {
      await api.createPlaylist(playlistName.trim());
      setModalVisible(false);
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', 'Could not create playlist');
    } finally {
      setCreating(false);
    }
  };

  const handleLongPressPlaylist = (pl: any) => {
    Vibration.vibrate(15);
    setSelectedPlaylist(pl);
    setDeleteSheetVisible(true);
  };

  const confirmDeletePlaylist = async () => {
    if (!selectedPlaylist) return;
    const idToRemove = selectedPlaylist.id;
    // Close sheet immediately for snappy UX
    setDeleteSheetVisible(false);
    setSelectedPlaylist(null);
    try {
      await api.deletePlaylist(idToRemove);
    } catch (e) {
      // Server may return 500 from cleanup even when deletion succeeded — ignore.
    } finally {
      // Always remove from local list: deletion is always applied server-side.
      setPlaylists(prev => prev.filter(p => p.id !== idToRemove));
    }
  };

  if (loading) {
    return <SkeletonLoader insets={insets} displayName={displayName} avatarColors={avatarColors} />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* ─── Header ─── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { Vibration.vibrate(10); navigation.navigate('Settings'); }} style={styles.headerLeft} activeOpacity={0.75}>
            <LinearGradient colors={avatarColors} style={styles.avatar}>
              <Text style={styles.avatarText}>{displayName[0].toUpperCase()}</Text>
            </LinearGradient>
            <Text style={styles.headerTitle}>Your Library</Text>
          </TouchableOpacity>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => navigation.navigate('Search')}>
              <Ionicons name="search" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCreatePlaylist} style={{ marginLeft: 16 }}>
              <Ionicons name="add" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── Filter Chips ─── */}
        <View style={styles.chips}>
          {(['Playlists', 'Artists', 'Albums'] as const).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, activeFilter === f && styles.chipActive]}
              onPress={() => {
                Vibration.vibrate(10);
                setActiveFilter(f);
                if (f === 'Artists') navigation.navigate('Artists');
                if (f === 'Albums') navigation.navigate('Albums');
              }}
            >
              <Text style={[styles.chipText, activeFilter === f && styles.chipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ─── Liked Songs Card ─── */}
        <TouchableOpacity style={styles.listItem} onPress={() => { Vibration.vibrate(10); navigation.navigate('Favorites'); }}>
          <LinearGradient colors={['#450E74', '#C4B2F3']} style={styles.listThumb}>
            <Ionicons name="heart" size={28} color="#fff" />
          </LinearGradient>
          <View style={styles.listText}>
            <Text style={styles.listTitle}>Liked Songs</Text>
            <Text style={styles.listSub}>Playlist • {favorites.length} songs</Text>
          </View>
        </TouchableOpacity>

        {/* ─── Folders Card ─── */}
        <TouchableOpacity style={styles.listItem} onPress={() => { Vibration.vibrate(10); navigation.navigate('Folders'); }}>
          <View style={[styles.listThumb, { backgroundColor: '#282828' }]}>
            <Ionicons name="folder-open" size={28} color={colors.primary} />
          </View>
          <View style={styles.listText}>
            <Text style={styles.listTitle}>Folders</Text>
            <Text style={styles.listSub}>Storage directories</Text>
          </View>
        </TouchableOpacity>

        {/* ─── History Card ─── */}
        <TouchableOpacity style={styles.listItem} onPress={() => { Vibration.vibrate(10); navigation.navigate('History'); }}>
          <View style={[styles.listThumb, { backgroundColor: '#282828' }]}>
            <Ionicons name="time" size={28} color="#A855F7" />
          </View>
          <View style={styles.listText}>
            <Text style={styles.listTitle}>History</Text>
            <Text style={styles.listSub}>Recently played tracks</Text>
          </View>
        </TouchableOpacity>

        {/* ─── Stats Card ─── */}
        <TouchableOpacity style={styles.listItem} onPress={() => { Vibration.vibrate(10); navigation.navigate('Stats'); }}>
          <View style={[styles.listThumb, { backgroundColor: '#282828' }]}>
            <Ionicons name="bar-chart" size={28} color="#FACC15" />
          </View>
          <View style={styles.listText}>
            <Text style={styles.listTitle}>Stats</Text>
            <Text style={styles.listSub}>Library statistics</Text>
          </View>
        </TouchableOpacity>

        {/* ─── Playlists ─── */}
        {playlists.map((pl, i) => (
          <TouchableOpacity
            key={pl.id || i}
            style={styles.listItem}
            onPress={() => { Vibration.vibrate(10); navigation.navigate('PlaylistDetail', { playlist: pl }); }}
            onLongPress={() => handleLongPressPlaylist(pl)}
            delayLongPress={400}
          >
            <View style={[styles.listThumb, { overflow: 'hidden' }]}>
              {(pl.image || pl.thumb) ? (
                <Image source={{ uri: playlistImg(pl.image || pl.thumb) }} style={{ width: 64, height: 64 }} transition={150} />
              ) : (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#282828' }}>
                  <Ionicons name="musical-notes" size={24} color={colors.primary} />
                </View>
              )}
            </View>
            <View style={styles.listText}>
              <Text style={styles.listTitle}>{pl.name}</Text>
              <Text style={styles.listSub}>Playlist • {pl.count || pl.trackcount || 0} songs</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ─── Delete Playlist Bottom Sheet ─── */}
      <Modal
        visible={deleteSheetVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setDeleteSheetVisible(false)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setDeleteSheetVisible(false)}
        >
          <View style={[styles.sheetContainer, { paddingBottom: Platform.OS === 'ios' ? 36 : 24 }]}>
            {selectedPlaylist && (
              <View style={styles.sheetHeader}>
                <View style={[styles.sheetThumb, { overflow: 'hidden' }]}>
                  {(selectedPlaylist.image || selectedPlaylist.thumb) ? (
                    <Image source={{ uri: playlistImg(selectedPlaylist.image || selectedPlaylist.thumb) }} style={{ width: 48, height: 48 }} transition={150} />
                  ) : (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#282828' }}>
                      <Ionicons name="musical-notes" size={22} color={colors.primary} />
                    </View>
                  )}
                </View>
                <View style={{ marginLeft: 14, flex: 1 }}>
                  <Text style={styles.sheetTitle} numberOfLines={1}>{selectedPlaylist.name}</Text>
                  <Text style={styles.sheetSub}>Playlist</Text>
                </View>
              </View>
            )}
            <View style={styles.sheetDivider} />
            <TouchableOpacity style={styles.sheetRow} onPress={confirmDeletePlaylist}>
              <Ionicons name="trash-outline" size={22} color="#ff4444" />
              <Text style={[styles.sheetRowText, { color: '#ff4444' }]}>Delete playlist</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setDeleteSheetVisible(false)}>
              <Text style={styles.sheetCloseTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.spotifyModalOverlay}
        >
          <View style={styles.spotifyModalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.spotifyModalContent}>
            <Text style={styles.spotifyModalTitle}>Give your playlist a name.</Text>

            <TextInput
              style={styles.spotifyModalInput}
              placeholder="My Playlist"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={playlistName}
              onChangeText={setPlaylistName}
              autoCapitalize="words"
              autoCorrect={true}
              autoFocus={true}
              selectionColor="#1DB954"
            />

            <TouchableOpacity
              style={[
                styles.spotifyCreateButton,
                { backgroundColor: playlistName.trim() ? '#1DB954' : '#282828' }
              ]}
              onPress={submitCreatePlaylist}
              disabled={creating || !playlistName.trim()}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={[
                  styles.spotifyCreateButtonText,
                  { color: playlistName.trim() ? '#000' : '#888' }
                ]}>Create</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.spotifyCancelButton}
              onPress={() => setModalVisible(false)}
              disabled={creating}
            >
              <Text style={styles.spotifyCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },

  // Delete sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheetContainer: {
    backgroundColor: '#1c1c1c', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 16, paddingHorizontal: 20,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sheetThumb: { width: 48, height: 48, borderRadius: 4 },
  sheetTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  sheetSub: { color: '#b3b3b3', fontSize: 13 },
  sheetDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 12 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 16 },
  sheetRowText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  sheetCloseBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 8, backgroundColor: '#282828', borderRadius: 24 },
  sheetCloseTxt: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  chips: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  chip: { backgroundColor: '#282828', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: '#000' },

  listItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  listThumb: { width: 64, height: 64, borderRadius: 4, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  listText: { marginLeft: 16, flex: 1 },
  listTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  listSub: { color: '#b3b3b3', fontSize: 13 },

  // Spotify Modal styles
  spotifyModalOverlay: {
    flex: 1,
    backgroundColor: '#121212',
    paddingHorizontal: 24,
  },
  spotifyModalHeader: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginTop: Platform.OS === 'ios' ? 40 : 10,
  },
  spotifyModalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  spotifyModalTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 40,
  },
  spotifyModalInput: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 12,
    marginBottom: 40,
  },
  spotifyCreateButton: {
    width: 160,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  spotifyCreateButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  spotifyCancelButton: {
    paddingVertical: 12,
  },
  spotifyCancelButtonText: {
    color: '#b3b3b3',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
