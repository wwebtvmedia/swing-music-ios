import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  Modal, ScrollView, Platform, Animated, Vibration,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { api, fetchApi, getImgUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { Track, Playlist } from '../types';

interface FolderItem {
  name: string;
  path: string;
  trackcount?: number;
  is_sym?: boolean;
}

type CombinedItem =
  | { id: string; type: 'folder'; folder: FolderItem }
  | { id: string; type: 'track'; track: Track };

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
    <View style={{ flex: 1, paddingHorizontal: 16 }}>
      <FlatList
        data={[1, 2, 3, 4, 5, 6, 7]}
        keyExtractor={(item) => String(item)}
        renderItem={() => (
          <View style={styles.trackRow}>
            <SkeletonItem style={{ width: 44, height: 44, borderRadius: 8 }} />
            <View style={{ flex: 1, marginLeft: 16, gap: 6 }}>
              <SkeletonItem style={{ width: '60%', height: 16, borderRadius: 4 }} />
              <SkeletonItem style={{ width: '35%', height: 12, borderRadius: 4 }} />
            </View>
          </View>
        )}
      />
    </View>
  );
}

export default function FoldersScreen() {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('$home');
  const [loading, setLoading] = useState(true);
  const [pathStack, setPathStack] = useState<string[]>([]);
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { playTrack } = usePlayer();
  const { baseUrl } = useAuth();

  // Add-to-playlist sheet state
  const [sheetVisible, setSheetVisible] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<FolderItem | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [addingToPlaylist, setAddingToPlaylist] = useState(false);

  // Toast
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2200);
  };

  const thumbUrl = (path?: string) => getImgUrl(baseUrl, path, 'medium');

  const loadFolder = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const res = await fetchApi('folder', {
        method: 'POST',
        body: JSON.stringify({
          folder: path,
          tracks_only: false,
          limit: 200,
          start: 0
        })
      });
      const folderList = Array.isArray(res.folders) ? res.folders : (res.foldersDto || []);
      const trackList = Array.isArray(res.tracks) ? res.tracks : (res.tracksDto || []);
      setFolders(folderList);
      setTracks(trackList);
    } catch (e) {
      console.error('Folders error', e);
      setFolders([]);
      setTracks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFolder(currentPath); }, [currentPath]);

  const navigateInto = (folder: FolderItem) => {
    Vibration.vibrate(10);
    setPathStack(prev => [...prev, currentPath]);
    setCurrentPath(folder.path);
  };

  const navigateBack = () => {
    Vibration.vibrate(10);
    if (pathStack.length === 0) {
      navigation.goBack();
      return;
    }
    const prev = pathStack[pathStack.length - 1];
    setPathStack(stack => stack.slice(0, -1));
    setCurrentPath(prev);
  };

  const handlePlayTrack = async (track: Track) => {
    Vibration.vibrate(12);
    await playTrack(track, tracks);
    navigation.navigate('Player');
  };

  // Long press on a folder → open "add to playlist" sheet
  const handleLongPressFolder = async (folder: FolderItem) => {
    Vibration.vibrate(15);
    setSelectedFolder(folder);
    setSheetVisible(true);
    setLoadingPlaylists(true);
    try {
      const res = await api.getAllPlaylists();
      const plArray = Array.isArray(res) ? res : (res?.data || res?.items || []);
      setPlaylists(plArray);
    } catch (e) {
      setPlaylists([]);
    } finally {
      setLoadingPlaylists(false);
    }
  };

  const handleAddFolderToPlaylist = async (playlist: Playlist) => {
    if (!selectedFolder) return;
    setAddingToPlaylist(true);
    try {
      await api.addFolderToPlaylist(playlist.id, selectedFolder.path);
      setSheetVisible(false);
      showToast(`Added to "${playlist.name}"`);
    } catch (e) {
      setSheetVisible(false);
      showToast('Could not add to playlist');
    } finally {
      setAddingToPlaylist(false);
    }
  };

  const folderName = currentPath === '$home'
    ? 'Folders'
    : currentPath.split('/').filter(Boolean).pop() || 'Folders';

  const combinedData: CombinedItem[] = [
    ...folders.map(f => ({ id: `folder-${f.path}`, type: 'folder' as const, folder: f })),
    ...tracks.map(t => ({ id: `track-${t.trackhash}`, type: 'track' as const, track: t })),
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={navigateBack} style={{ padding: 6 }}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{folderName}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Breadcrumb path */}
      {currentPath !== '$home' && (
        <Text style={styles.breadcrumb} numberOfLines={1}>{currentPath}</Text>
      )}

      {loading ? (
        <SkeletonLoader />
      ) : (
        <FlatList
          data={combinedData}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          removeClippedSubviews={true}
          maxToRenderPerBatch={15}
          windowSize={6}
          initialNumToRender={12}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="folder-open-outline" size={48} color={colors.primary} />
              <Text style={styles.emptyTitle}>Empty folder</Text>
            </View>
          }
          renderItem={({ item }) => {
            if (item.type === 'folder') {
              const folder = item.folder;
              return (
                <TouchableOpacity
                  style={styles.folderRow}
                  onPress={() => navigateInto(folder)}
                  onLongPress={() => handleLongPressFolder(folder)}
                  delayLongPress={400}
                  activeOpacity={0.7}
                >
                  <View style={styles.folderIcon}>
                    <Ionicons name="folder" size={24} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 16 }}>
                    <Text style={styles.folderName} numberOfLines={1}>{folder.name}</Text>
                    {folder.trackcount !== undefined && (
                      <Text style={styles.folderSub}>{folder.trackcount} tracks</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#535353" />
                </TouchableOpacity>
              );
            } else {
              const track = item.track;
              return (
                <TouchableOpacity style={styles.trackRow} onPress={() => handlePlayTrack(track)} activeOpacity={0.7}>
                  {track.image ? (
                    <Image source={{ uri: thumbUrl(track.image) }} style={styles.trackThumb} transition={150} />
                  ) : (
                    <View style={[styles.trackThumb, { backgroundColor: '#282828', justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="musical-note" size={20} color="#535353" />
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 16 }}>
                    <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                    <Text style={styles.trackSub} numberOfLines={1}>
                      {track.artists?.map(a => a.name).join(', ') || track.album || ''}
                    </Text>
                  </View>
                  <Ionicons name="play-circle-outline" size={22} color={colors.primary} />
                </TouchableOpacity>
              );
            }
          }}
        />
      )}

      {/* ─── Add Folder to Playlist Bottom Sheet ─── */}
      <Modal
        visible={sheetVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSheetVisible(false)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setSheetVisible(false)}
        >
          <View style={[styles.sheetContainer, { paddingBottom: Platform.OS === 'ios' ? 36 : 24 }]}>
            {/* Header */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetFolderIcon}>
                <Ionicons name="folder" size={26} color={colors.primary} />
              </View>
              <View style={{ marginLeft: 14, flex: 1 }}>
                <Text style={styles.sheetTitle} numberOfLines={1}>
                  {selectedFolder?.name}
                </Text>
                <Text style={styles.sheetSub}>Add all tracks to playlist</Text>
              </View>
            </View>

            <View style={styles.sheetDivider} />

            {/* Playlist list */}
            {loadingPlaylists || addingToPlaylist ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 32 }} />
            ) : playlists.length === 0 ? (
              <Text style={styles.emptyPlaylists}>No playlists found.</Text>
            ) : (
              <ScrollView style={styles.playlistScroll}>
                {playlists.map(pl => (
                  <TouchableOpacity
                    key={pl.id}
                    style={styles.playlistRow}
                    onPress={() => handleAddFolderToPlaylist(pl)}
                  >
                    <Ionicons name="musical-notes-outline" size={20} color="#b3b3b3" />
                    <Text style={styles.playlistRowText}>{pl.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setSheetVisible(false)}>
              <Text style={styles.sheetCloseTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Toast ─── */}
      {toastVisible && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
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
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  breadcrumb: { color: '#535353', fontSize: 11, paddingHorizontal: 16, marginBottom: 12 },
  folderRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a1a1a', borderRadius: 10,
    padding: 14, marginBottom: 8,
  },
  folderIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(29,185,84,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  folderName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  folderSub: { color: '#b3b3b3', fontSize: 12, marginTop: 2 },
  trackRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a1a1a', borderRadius: 10,
    padding: 12, marginBottom: 8,
  },
  trackThumb: { width: 44, height: 44, borderRadius: 6 },
  trackTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  trackSub: { color: '#b3b3b3', fontSize: 12, marginTop: 2 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { color: '#b3b3b3', fontSize: 16, marginTop: 16 },

  // Bottom sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheetContainer: {
    backgroundColor: '#1c1c1c', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 16, paddingHorizontal: 20, maxHeight: '80%',
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sheetFolderIcon: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: 'rgba(29,185,84,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  sheetTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  sheetSub: { color: '#b3b3b3', fontSize: 13 },
  sheetDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 12 },
  playlistScroll: { maxHeight: 280 },
  playlistRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 14 },
  playlistRowText: { color: '#fff', fontSize: 15, fontWeight: '500', flex: 1 },
  emptyPlaylists: { color: '#b3b3b3', fontSize: 14, textAlign: 'center', marginVertical: 24 },
  sheetCloseBtn: {
    alignItems: 'center', paddingVertical: 14, marginTop: 8,
    backgroundColor: '#282828', borderRadius: 24,
  },
  sheetCloseTxt: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  // Toast
  toast: {
    position: 'absolute', bottom: 80, left: 24, right: 24,
    backgroundColor: '#2e2e2e', borderRadius: 8,
    paddingVertical: 14, paddingHorizontal: 20,
    alignItems: 'center', elevation: 10, zIndex: 9999,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 8,
  },
  toastText: { color: '#fff', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
});
