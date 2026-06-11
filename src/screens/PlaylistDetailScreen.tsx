import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  Image, TouchableOpacity, Modal, Platform, TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { api, getImgUrl } from '../api/client';
import { Track, Playlist } from '../types';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';

export default function PlaylistDetailScreen() {
  const route = useRoute<any>();
  const initialPlaylist: Playlist = route.params?.playlist;

  // ─── Core state ───────────────────────────────────────────────────────────
  const [playlist, setPlaylist] = useState<Playlist>(initialPlaylist);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── Context ──────────────────────────────────────────────────────────────
  const { baseUrl } = useAuth();
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
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
    await playTrack(track, tracks);
    navigation.navigate('Player');
  };

  const handlePlayAll = async () => {
    if (tracks.length === 0) return;
    if (isThisPlaying) { togglePlay(); return; }
    await playTrack(tracks[0], tracks);
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

  const handleToggleFavorite = async () => {
    if (!selectedTrack?.trackhash) return;
    const next = !selectedTrack.is_favorite;
    try {
      await api.toggleFavorite(selectedTrack.trackhash, next);
      setTracks(prev => prev.map(t =>
        t.trackhash === selectedTrack.trackhash ? { ...t, is_favorite: next } : t
      ));
      setSelectedTrack(prev => prev ? { ...prev, is_favorite: next } : null);
      showToast(next ? 'Added to Liked Songs' : 'Removed from Liked Songs');
    } catch {
      showToast('Could not update');
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
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length) {
      setEditImageUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!editName.trim()) { showToast('Name cannot be empty'); return; }
    setSaving(true);
    try {
      await api.updatePlaylist(playlist.id, editName.trim(), editImageUri || undefined);
      // Update local state manually — don't trust the server response shape
      setPlaylist(prev => ({
        ...prev,
        name: editName.trim(),
        // Only update image ref if a new one was uploaded
        // (server will update the path; we keep old artUrl to avoid flicker)
      }));
      setEditVisible(false);
      setEditImageUri(null);
      showToast('Playlist updated');
    } catch (e) {
      console.error('updatePlaylist error', e);
      showToast('Failed to update playlist');
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
        <Image source={{ uri: thumb(item.image) }} style={styles.trackThumb} />
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
          <Image source={{ uri: plImg(artUrl) }} style={styles.art} />
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
          style={[styles.playBtn, isThisPlaying && styles.playBtnActive]}
          onPress={handlePlayAll}
        >
          <Ionicons name={isThisPlaying ? 'pause' : 'play'} size={28} color="#000" />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );

  // ─── Empty state ──────────────────────────────────────────────────────────
  const ListEmpty = loading ? (
    <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
  ) : (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>This playlist is empty</Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ─── Main list — FlatList for performance ─── */}
      <FlatList
        data={loading ? [] : tracks}
        keyExtractor={(item, i) => item.trackhash || String(i)}
        renderItem={renderTrack}
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
                    <Image source={{ uri: getImgUrl(baseUrl, selectedTrack.image, 'medium') }} style={styles.sheetArt} />
                  ) : (
                    <View style={[styles.sheetArt, styles.artFallback]}>
                      <Ionicons name="musical-notes" size={20} color="#535353" />
                    </View>
                  )}
                  <View style={styles.sheetHeaderInfo}>
                    <Text style={styles.sheetTitle} numberOfLines={1}>{selectedTrack.title}</Text>
                    <Text style={styles.sheetSub} numberOfLines={1}>
                      {selectedTrack.artists?.map(a => a.name).join(', ') || ''}
                    </Text>
                  </View>
                </View>
                <View style={styles.divider} />

                <TouchableOpacity style={styles.sheetRow} onPress={handleToggleFavorite}>
                  <Ionicons
                    name={selectedTrack.is_favorite ? 'heart' : 'heart-outline'}
                    size={22}
                    color={selectedTrack.is_favorite ? colors.primary : '#fff'}
                  />
                  <Text style={styles.sheetRowText}>
                    {selectedTrack.is_favorite ? 'Remove from Liked Songs' : 'Like'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.sheetRow} onPress={handleAddToPlaylist}>
                  <Ionicons name="add-circle-outline" size={22} color="#fff" />
                  <Text style={styles.sheetRowText}>Add to playlist</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.sheetRow} onPress={handleRemove}>
                  <Ionicons name="trash-outline" size={22} color="#ff4444" />
                  <Text style={[styles.sheetRowText, { color: '#ff4444' }]}>Remove from this playlist</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setOptionsVisible(false)}>
              <Text style={styles.closeTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Add to Playlist Selector ─── */}
      <Modal visible={plSelectorVisible} transparent animationType="slide" onRequestClose={() => setPlSelectorVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setPlSelectorVisible(false)}>
          <View style={[styles.sheet, { paddingBottom: Platform.OS === 'ios' ? 36 : 24 }]}>
            <Text style={styles.selectorTitle}>Add to playlist</Text>
            <View style={styles.divider} />
            {loadingAllPl ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 32 }} />
            ) : (
              <FlatList
                data={allPlaylists}
                keyExtractor={pl => String(pl.id)}
                style={{ maxHeight: 300 }}
                renderItem={({ item: pl }) => (
                  <TouchableOpacity style={styles.sheetRow} onPress={() => selectPlaylist(pl)}>
                    <Ionicons name="musical-notes-outline" size={20} color="#b3b3b3" />
                    <Text style={styles.sheetRowText}>{pl.name}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>No playlists found.</Text>}
              />
            )}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setPlSelectorVisible(false)}>
              <Text style={styles.closeTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Manage Sheet (Edit / Delete) ─── */}
      <Modal visible={manageVisible} transparent animationType="slide" onRequestClose={() => setManageVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setManageVisible(false)}>
          <View style={[styles.sheet, { paddingBottom: Platform.OS === 'ios' ? 36 : 24 }]}>
            <View style={styles.sheetHeader}>
              {artUrl ? (
                <Image source={{ uri: plImg(artUrl) }} style={styles.sheetArt} />
              ) : (
                <View style={[styles.sheetArt, styles.artFallback]}>
                  <Ionicons name="musical-notes" size={20} color="#535353" />
                </View>
              )}
              <View style={styles.sheetHeaderInfo}>
                <Text style={styles.sheetTitle} numberOfLines={1}>{playlist?.name}</Text>
                <Text style={styles.sheetSub}>{tracks.length} songs</Text>
              </View>
            </View>
            <View style={styles.divider} />

            <TouchableOpacity style={styles.sheetRow} onPress={openEdit}>
              <Ionicons name="pencil-outline" size={22} color="#fff" />
              <Text style={styles.sheetRowText}>Edit playlist</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetRow} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={22} color="#ff4444" />
              <Text style={[styles.sheetRowText, { color: '#ff4444' }]}>Delete playlist</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setManageVisible(false)}>
              <Text style={styles.closeTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Edit Playlist Modal ─── */}
      <Modal visible={editVisible} animationType="slide" onRequestClose={() => setEditVisible(false)}>
        <View style={[styles.editContainer, { paddingTop: insets.top }]}>
          {/* Navbar */}
          <View style={styles.editNav}>
            <TouchableOpacity onPress={() => { setEditVisible(false); setEditImageUri(null); }}>
              <Text style={styles.editCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.editTitle}>Edit playlist</Text>
            {saving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <TouchableOpacity onPress={handleSave}>
                <Text style={styles.editSave}>Save</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Cover picker */}
          <TouchableOpacity onPress={pickImage} style={styles.editImgWrap}>
            {editImageUri ? (
              <Image source={{ uri: editImageUri }} style={styles.editImg} />
            ) : artUrl ? (
              <Image source={{ uri: plImg(artUrl) }} style={styles.editImg} />
            ) : (
              <View style={[styles.editImg, styles.artFallback]}>
                <Ionicons name="musical-notes" size={64} color="#535353" />
              </View>
            )}
            <View style={styles.editImgOverlay}>
              <Ionicons name="camera" size={24} color="#fff" />
              <Text style={styles.editImgLabel}>Change Image</Text>
            </View>
          </TouchableOpacity>

          {/* Name input */}
          <View style={styles.editInputWrap}>
            <Text style={styles.editInputLabel}>PLAYLIST NAME</Text>
            <TextInput
              style={styles.editInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Give your playlist a name"
              placeholderTextColor="#7a7a7a"
              selectionColor={colors.primary}
              autoFocus
            />
          </View>
        </View>
      </Modal>

      {/* ─── Toast ─── */}
      {toast !== null && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // ─── Header gradient ───────────────────────────────────────────────────
  gradientHeader: { padding: 16, paddingBottom: 24, alignItems: 'center' },
  headerTopRow: {
    width: '100%', flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
  },
  artContainer: { marginVertical: 24 },
  art: { width: 200, height: 200, borderRadius: 4 },
  artFallback: { backgroundColor: '#282828', justifyContent: 'center', alignItems: 'center' },
  playlistName: { color: '#fff', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  playlistSub: { color: '#b3b3b3', fontSize: 14, marginBottom: 16 },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', width: '100%' },
  playBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  playBtnActive: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 12, elevation: 8 },

  // ─── Track rows ───────────────────────────────────────────────────────
  trackRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  trackThumb: { width: 48, height: 48, borderRadius: 4 },
  trackThumbFallback: { backgroundColor: '#282828', justifyContent: 'center', alignItems: 'center' },
  trackInfo: { flex: 1, marginLeft: 12 },
  trackTitle: { color: '#fff', fontSize: 15, fontWeight: '500' },
  trackSub: { color: '#b3b3b3', fontSize: 13, marginTop: 2 },
  dotsBtn: { padding: 8 },

  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#b3b3b3', fontSize: 15, textAlign: 'center', padding: 24 },

  // ─── Bottom sheets ────────────────────────────────────────────────────
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1c1c1c',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 16, paddingHorizontal: 20,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sheetArt: { width: 52, height: 52, borderRadius: 4 },
  sheetHeaderInfo: { marginLeft: 14, flex: 1 },
  sheetTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  sheetSub: { color: '#b3b3b3', fontSize: 13 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 8 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 16 },
  sheetRowText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  closeBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 8, backgroundColor: '#282828', borderRadius: 24 },
  closeTxt: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  selectorTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold', textAlign: 'center', paddingBottom: 16 },

  // ─── Edit modal ───────────────────────────────────────────────────────
  editContainer: { flex: 1, backgroundColor: '#121212' },
  editNav: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#282828',
  },
  editCancel: { color: '#fff', fontSize: 16 },
  editTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  editSave: { color: colors.primary, fontSize: 16, fontWeight: 'bold' },
  editImgWrap: {
    width: 180, height: 180, borderRadius: 12,
    overflow: 'hidden', alignSelf: 'center',
    marginTop: 36, marginBottom: 32,
    elevation: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 6,
  },
  editImg: { width: '100%', height: '100%' },
  editImgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  editImgLabel: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginTop: 4 },
  editInputWrap: { paddingHorizontal: 24, marginBottom: 24 },
  editInputLabel: { color: '#b3b3b3', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.8, marginBottom: 8 },
  editInput: {
    backgroundColor: '#282828', color: '#fff',
    borderRadius: 8, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, fontWeight: '500',
  },

  // ─── Toast ───────────────────────────────────────────────────────────
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
