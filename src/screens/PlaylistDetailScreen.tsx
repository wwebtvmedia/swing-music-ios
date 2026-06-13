import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, Platform, TextInput, Animated, Vibration, Alert, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { api, getImgUrl } from '../api/client';
import { Track, Playlist } from '../types';
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

const renderSkeletonRow = () => (
  <View style={styles.trackRow}>
    <View style={styles.trackLeft}>
      <SkeletonItem style={{ width: 48, height: 48, borderRadius: 4 }} />
      <View style={{ flex: 1, marginLeft: 12, gap: 6 }}>
        <SkeletonItem style={{ width: '60%', height: 14, borderRadius: 4 }} />
        <SkeletonItem style={{ width: '40%', height: 11, borderRadius: 4 }} />
      </View>
    </View>
  </View>
);

export default function PlaylistDetailScreen() {
  const route = useRoute<any>();
  const initialPlaylist: Playlist = route.params?.playlist;

  // ─── Core state ───────────────────────────────────────────────────────────
  const [playlist, setPlaylist] = useState<Playlist>(initialPlaylist);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── Context ──────────────────────────────────────────────────────────────
  const { baseUrl } = useAuth();
  const { playTrack, currentTrack, isPlaying, togglePlay, shuffleMode, toggleShuffle } = usePlayer();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  // ─── Track options sheet ──────────────────────────────────────────────────
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // ─── Add-to-playlist sheet ────────────────────────────────────────────────
  const [plSelectorVisible, setPlSelectorVisible] = useState(false);
  const [allPlaylists, setAllPlaylists] = useState<Playlist[]>([]);
  const [loadingAllPl, setLoadingAllPl] = useState(false);
  // Cache playlists once loaded for this screen session
  const playlistsCached = useRef(false);

  // ─── Manage sheet (Edit / Delete) ────────────────────────────────────────
  const [manageVisible, setManageVisible] = useState(false);

  // ─── Edit modal ───────────────────────────────────────────────────────────
  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editImageUri, setEditImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ─── Toast ────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  // ─── Load tracks ──────────────────────────────────────────────────────────
  const loadTracks = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const res = await api.getPlaylistTracks(id);
      const arr = Array.isArray(res) ? res : (res?.tracks || res?.items || []);
      setTracks(arr);
    } catch (e) {
      console.error('getPlaylistTracks error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount only (id never changes)
  useEffect(() => {
    if (initialPlaylist?.id) loadTracks(initialPlaylist.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Lazy-load all playlists once ────────────────────────────────────────
  const ensurePlaylists = useCallback(async () => {
    if (playlistsCached.current) return;
    setLoadingAllPl(true);
    try {
      const res = await api.getAllPlaylists();
      const arr = Array.isArray(res) ? res : (res?.data || res?.items || []);
      setAllPlaylists(arr);
      playlistsCached.current = true;
    } catch (e) {
      console.error('getAllPlaylists error', e);
    } finally {
      setLoadingAllPl(false);
    }
  }, []);

  // ─── Computed ─────────────────────────────────────────────────────────────
  const isThisPlaying = isPlaying && tracks.some(t => t.trackhash === currentTrack?.trackhash);
  const artUrl = playlist?.image || playlist?.thumb;

  const thumb = (path?: string) => getImgUrl(baseUrl, path, 'medium');
  const plImg = (path?: string) => getImgUrl(baseUrl, path, 'playlist');

  // ─── Playback ─────────────────────────────────────────────────────────────
  const handlePlayTrack = async (track: Track) => {
    Vibration.vibrate(12);
    await playTrack(track, tracks);
    navigation.navigate('Player');
  };

  const handlePlayAll = async () => {
    if (tracks.length === 0) return;
    Vibration.vibrate(15);
    if (isThisPlaying) { togglePlay(); return; }
    
    let firstTrack = tracks[0];
    if (shuffleMode) {
      const randomIdx = Math.floor(Math.random() * tracks.length);
      firstTrack = tracks[randomIdx];
    }
    
    await playTrack(firstTrack, tracks);
    navigation.navigate('Player');
  };

  // ─── Track options ────────────────────────────────────────────────────────
  const openOptions = (track: Track, index: number) => {
    setSelectedTrack(track);
    setSelectedIndex(index);
    setOptionsVisible(true);
  };

  const handleAddToPlaylist = () => {
    setOptionsVisible(false);
    ensurePlaylists();
    setPlSelectorVisible(true);
  };

  const selectPlaylist = async (pl: Playlist) => {
    if (!selectedTrack?.trackhash) return;
    setPlSelectorVisible(false);
    try {
      await api.addTrackToPlaylist(pl.id, selectedTrack.trackhash);
      showToast(`Added to ${pl.name}`);
    } catch (e: any) {
      showToast(e?.status === 409 ? `Already in ${pl.name}` : `Could not add to ${pl.name}`);
    }
  };

  const handleRemove = async () => {
    if (!selectedTrack?.trackhash || selectedIndex === null || !playlist?.id) return;
    setOptionsVisible(false);
    try {
      await api.removeTrackFromPlaylist(playlist.id, selectedTrack.trackhash, selectedIndex);
      setTracks(prev => prev.filter((_, i) => i !== selectedIndex));
      showToast('Removed from playlist');
    } catch {
      showToast('Could not remove track');
    }
  };

  // ─── Edit playlist ────────────────────────────────────────────────────────
  const openEdit = () => {
    setManageVisible(false);
    setEditName(playlist.name || '');
    setEditImageUri(null);
    setEditVisible(true);
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission denied', 'Please grant library permissions to pick an image.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (!res.canceled && res.assets && res.assets.length > 0) {
      setEditImageUri(res.assets[0].uri);
    }
  };

  const saveEdit = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      let updated = { ...playlist, name: editName.trim() };
      const uploadRes = await api.updatePlaylist(playlist.id, updated.name, editImageUri || undefined);
      if (uploadRes && uploadRes.image) {
        updated.image = uploadRes.image;
      }
      setPlaylist(updated);
      setEditVisible(false);
      showToast('Playlist updated');
    } catch (e) {
      console.error('saveEdit error', e);
      showToast('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete playlist ──────────────────────────────────────────────────────
  const handleDelete = async () => {
    setManageVisible(false);
    try {
      await api.deletePlaylist(playlist.id);
    } catch {
      // Server cleanup may crash but deletion is committed — ignore
    } finally {
      navigation.goBack();
    }
  };

  // ─── Render track row (memoized via inline keyExtractor) ──────────────────
  const renderTrack = useCallback(({ item, index }: { item: Track; index: number }) => (
    <TouchableOpacity style={styles.trackRow} onPress={() => handlePlayTrack(item)} activeOpacity={0.7}>
      {item.image ? (
        <Image source={{ uri: thumb(item.image) }} style={styles.trackThumb} transition={150} />
      ) : (
        <View style={[styles.trackThumb, styles.trackThumbFallback]}>
          <Ionicons name="musical-note" size={18} color="#535353" />
        </View>
      )}
      <View style={styles.trackInfo}>
        <Text style={styles.trackTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.trackSub} numberOfLines={1}>
          {item.artists?.map(a => a.name).join(', ') || item.album || ''}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => openOptions(item, index)}
        style={styles.dotsBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="ellipsis-vertical" size={20} color="#b3b3b3" />
      </TouchableOpacity>
    </TouchableOpacity>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [tracks, baseUrl]);

  // ─── Header component for FlatList ───────────────────────────────────────
  const ListHeader = (
    <LinearGradient colors={['rgba(59,130,246,0.5)', colors.background]} style={styles.gradientHeader}>
      <View style={styles.headerTopRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setManageVisible(true)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.artContainer}>
        {artUrl ? (
          <Image source={{ uri: plImg(artUrl) }} style={styles.art} transition={150} />
        ) : (
          <View style={[styles.art, styles.artFallback]}>
            <Ionicons name="musical-notes" size={48} color="#535353" />
          </View>
        )}
      </View>

      <Text style={styles.playlistName} numberOfLines={2}>{playlist?.name || 'Playlist'}</Text>
      <Text style={styles.playlistSub}>{tracks.length} songs</Text>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.actionIconBtn}
          onPress={toggleShuffle}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="shuffle" size={26} color={shuffleMode ? colors.primary : '#b3b3b3'} />
          {shuffleMode && <View style={styles.activeDot} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.playBtn, isThisPlaying && styles.playBtnActive]}
          onPress={handlePlayAll}
        >
          <Ionicons name={isThisPlaying ? 'pause' : 'play'} size={28} color="#000" />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );

  // ─── Empty state ──────────────────────────────────────────────────────────
  const ListEmpty = (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>This playlist is empty</Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ─── Main list — FlatList for performance ─── */}
      <FlatList
        data={loading ? [1, 2, 3, 4, 5] as any : tracks}
        keyExtractor={(item, i) => loading ? String(i) : (item.trackhash || String(i))}
        renderItem={loading ? renderSkeletonRow : renderTrack}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={15}
        windowSize={10}
        initialNumToRender={12}
      />

      {/* ─── Track Options Sheet ─── */}
      <Modal visible={optionsVisible} transparent animationType="slide" onRequestClose={() => setOptionsVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOptionsVisible(false)}>
          <View style={[styles.sheet, { paddingBottom: Platform.OS === 'ios' ? 36 : 24 }]}>
            {selectedTrack && (
              <>
                <View style={styles.sheetHeader}>
                  {selectedTrack.image ? (
                    <Image source={{ uri: thumb(selectedTrack.image) }} style={styles.sheetArt} />
                  ) : (
                    <View style={[styles.sheetArt, { backgroundColor: '#282828', justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="musical-note" size={20} color="#535353" />
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={styles.sheetTitle} numberOfLines={1}>{selectedTrack.title}</Text>
                    <Text style={styles.sheetSub} numberOfLines={1}>
                      {selectedTrack.artists?.map(a => a.name).join(', ') || selectedTrack.album || ''}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <TouchableOpacity style={styles.sheetRow} onPress={handleAddToPlaylist}>
                  <Ionicons name="add-circle-outline" size={24} color="#fff" />
                  <Text style={styles.sheetRowText}>Add to another playlist</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.sheetRow} onPress={handleRemove}>
                  <Ionicons name="trash-outline" size={24} color="#ff4444" />
                  <Text style={[styles.sheetRowText, { color: '#ff4444' }]}>Remove from this playlist</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Add to Playlist Selector ─── */}
      <Modal visible={plSelectorVisible} transparent animationType="slide" onRequestClose={() => setPlSelectorVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setPlSelectorVisible(false)}>
          <View style={[styles.sheet, { maxHeight: '70%', paddingBottom: Platform.OS === 'ios' ? 36 : 24 }]}>
            <Text style={styles.sheetSectionTitle}>Add to playlist</Text>
            <View style={styles.divider} />
            {loadingAllPl ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 24 }} />
            ) : (
              <FlatList
                data={allPlaylists.filter(p => p.id !== playlist.id)}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.sheetRow} onPress={() => selectPlaylist(item)}>
                    <Ionicons name="musical-notes-outline" size={22} color="#fff" />
                    <Text style={styles.sheetRowText}>{item.name}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>No other playlists found</Text>}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Manage Playlist (Edit / Delete) ─── */}
      <Modal visible={manageVisible} transparent animationType="slide" onRequestClose={() => setManageVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setManageVisible(false)}>
          <View style={[styles.sheet, { paddingBottom: Platform.OS === 'ios' ? 36 : 24 }]}>
            <Text style={styles.sheetSectionTitle}>Playlist options</Text>
            <View style={styles.divider} />

            <TouchableOpacity style={styles.sheetRow} onPress={openEdit}>
              <Ionicons name="create-outline" size={24} color="#fff" />
              <Text style={styles.sheetRowText}>Edit playlist info</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetRow} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={24} color="#ff4444" />
              <Text style={[styles.sheetRowText, { color: '#ff4444' }]}>Delete playlist</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Edit Details Modal ─── */}
      <Modal visible={editVisible} transparent animationType="slide" onRequestClose={() => setEditVisible(false)}>
        <View style={styles.editContainer}>
          <Text style={styles.editTitle}>Edit Playlist</Text>

          <TouchableOpacity style={styles.editArtBtn} onPress={pickImage} disabled={saving}>
            {editImageUri ? (
              <Image source={{ uri: editImageUri }} style={styles.editArtPreview} />
            ) : artUrl ? (
              <Image source={{ uri: plImg(artUrl) }} style={styles.editArtPreview} />
            ) : (
              <View style={[styles.editArtPreview, { backgroundColor: '#282828', justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="camera" size={32} color="#fff" />
              </View>
            )}
            <Text style={styles.changeArtLabel}>Tap to change artwork</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            value={editName}
            onChangeText={setEditName}
            placeholder="Playlist name"
            placeholderTextColor="rgba(255,255,255,0.4)"
            editable={!saving}
          />

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.editBtn, styles.editBtnCancel]}
              onPress={() => setEditVisible(false)}
              disabled={saving}
            >
              <Text style={styles.btnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.editBtn, styles.editBtnSave, !editName.trim() && { opacity: 0.5 }]}
              onPress={saveEdit}
              disabled={saving || !editName.trim()}
            >
              {saving ? <ActivityIndicator size="small" color="#000" /> : <Text style={[styles.btnText, { color: '#000' }]}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Toast Notification ─── */}
      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  gradientHeader: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, alignItems: 'center' },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 12 },
  artContainer: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 12,
  },
  art: { width: 170, height: 170, borderRadius: 4 },
  artFallback: { backgroundColor: '#282828', width: 170, height: 170, borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
  playlistName: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 20, textAlign: 'center' },
  playlistSub: { color: '#b3b3b3', fontSize: 13, marginTop: 4, marginBottom: 16 },

  actionRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginTop: 12 },
  actionIconBtn: { alignItems: 'center', justifyContent: 'center', width: 40, height: 40 },
  activeDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary, marginTop: 4 },
  playBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  playBtnActive: { backgroundColor: '#fff' },

  trackRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  trackLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  trackThumb: { width: 48, height: 48, borderRadius: 4 },
  trackThumbFallback: { backgroundColor: '#282828', justifyContent: 'center', alignItems: 'center' },
  trackInfo: { flex: 1, marginLeft: 12 },
  trackTitle: { color: '#fff', fontSize: 15, fontWeight: '500' },
  trackSub: { color: '#b3b3b3', fontSize: 12, marginTop: 2 },
  dotsBtn: { padding: 4 },

  empty: { padding: 48, alignItems: 'center' },
  emptyText: { color: '#b3b3b3', fontSize: 14 },

  // Bottom sheets
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1c1c1c', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 16 },
  sheetArt: { width: 50, height: 50, borderRadius: 4 },
  sheetTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  sheetSub: { color: '#b3b3b3', fontSize: 13, marginTop: 2 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 12 },
  sheetSectionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 14 },
  sheetRowText: { color: '#fff', fontSize: 15, fontWeight: '500' },

  // Edit modal
  editContainer: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', padding: 24 },
  editTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 24 },
  editArtBtn: { alignItems: 'center', marginBottom: 28 },
  editArtPreview: { width: 150, height: 150, borderRadius: 8 },
  changeArtLabel: { color: colors.primary, fontSize: 13, fontWeight: '600', marginTop: 12 },
  textInput: {
    backgroundColor: '#282828', color: '#fff',
    borderRadius: 8, padding: 14, fontSize: 16,
    marginBottom: 28, borderWidth: 1, borderColor: '#3e3e3e',
  },
  btnRow: { flexDirection: 'row', gap: 12 },
  editBtn: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center' },
  editBtnCancel: { backgroundColor: '#282828' },
  editBtnSave: { backgroundColor: colors.primary },
  btnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },

  // Toast
  toast: {
    position: 'absolute', bottom: Platform.OS === 'ios' ? 100 : 80,
    alignSelf: 'center', backgroundColor: colors.primary,
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
  },
  toastText: { color: '#000', fontSize: 13, fontWeight: 'bold' },
});
