import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, Modal, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { getImgUrl, api } from '../api/client';
import { Playlist } from '../types';

const { width: W } = Dimensions.get('window');

const formatMs = (ms: number) => {
  if (!ms || isNaN(ms)) return '0:00';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
};

export default function PlayerScreen() {
  const {
    currentTrack, isPlaying, togglePlay,
    position, duration, seekTo,
    playNext, playPrev,
    repeatMode, shuffleMode,
    toggleRepeat, toggleShuffle,
    queue, queueIndex,
    toggleTrackFavorite,
  } = usePlayer();
  const { baseUrl } = useAuth();
  const navigation = useNavigation<any>();

  const [optionsVisible, setOptionsVisible] = useState(false);
  const [playlistsVisible, setPlaylistsVisible] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);

  const fetchPlaylists = async () => {
    setLoadingPlaylists(true);
    try {
      const res = await api.getAllPlaylists();
      const plArray = Array.isArray(res) ? res : (res?.data || res?.items || []);
      setPlaylists(plArray);
    } catch (e) {
      console.error('Failed to load playlists', e);
    } finally {
      setLoadingPlaylists(false);
    }
  };

  const handleAddToPlaylistOption = () => {
    setOptionsVisible(false);
    fetchPlaylists();
    setPlaylistsVisible(true);
  };

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => {
      setToastVisible(false);
    }, 2000);
  };

  const selectPlaylist = async (playlistId: number) => {
    if (!currentTrack || !currentTrack.trackhash) return;
    try {
      await api.addTrackToPlaylist(playlistId, currentTrack.trackhash);
      const targetPl = playlists.find(p => p.id === playlistId);
      const playlistName = targetPl ? targetPl.name : 'playlist';
      setPlaylistsVisible(false);
      showToast(`Added to ${playlistName}`);
    } catch (e: any) {
      setPlaylistsVisible(false);
      const targetPl = playlists.find(p => p.id === playlistId);
      const playlistName = targetPl ? targetPl.name : 'playlist';
      if (e.status === 409) {
        showToast(`Already in ${playlistName}`);
      } else {
        showToast(`Could not add to ${playlistName}`);
      }
    }
  };

  if (!currentTrack) return null;

  const progress = duration > 0 ? position / duration : 0;
  const imageUrl = getImgUrl(baseUrl, currentTrack.image, 'large');

  const repeatColor = repeatMode !== 'off' ? colors.primary : '#b3b3b3';
  const shuffleColor = shuffleMode ? colors.primary : '#b3b3b3';

  return (
    <SafeAreaView style={styles.container}>
      {/* ─── Top Bar ─── */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-down" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.topBarSub}>NOW PLAYING</Text>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {currentTrack.album || 'Swing Music'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setOptionsVisible(true)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.mainContent}>
        {/* ─── Album Art ─── */}
        <View style={styles.artWrapper}>
          <View style={styles.artContainer}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.art} resizeMode="cover" />
            ) : (
              <View style={[styles.art, styles.artFallback]}>
                <Ionicons name="musical-notes" size={80} color="#535353" />
              </View>
            )}
          </View>
        </View>

        {/* ─── Control & Info Section ─── */}
        <View style={styles.bottomSection}>
          {/* ─── Track Info + Heart ─── */}
          <View style={styles.infoRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.trackTitle} numberOfLines={1}>{currentTrack.title}</Text>
              <Text style={styles.trackArtist} numberOfLines={1}>
                {currentTrack.artists?.map(a => a.name).join(', ') || currentTrack.album || ''}
              </Text>
            </View>
            <TouchableOpacity onPress={toggleTrackFavorite} style={{ padding: 8 }}>
              <Ionicons
                name={currentTrack.is_favorite ? 'heart' : 'heart-outline'}
                size={26}
                color={currentTrack.is_favorite ? colors.primary : '#b3b3b3'}
              />
            </TouchableOpacity>
          </View>

          {/* ─── Seekbar ─── */}
          <View style={styles.seekContainer}>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              value={isNaN(progress) ? 0 : progress}
              minimumTrackTintColor="#fff"
              maximumTrackTintColor="#535353"
              thumbTintColor="#fff"
              onSlidingComplete={(val) => seekTo(val)}
            />
            <View style={styles.timeRow}>
              <Text style={styles.time}>{formatMs(position)}</Text>
              <Text style={styles.time}>{formatMs(duration)}</Text>
            </View>
          </View>

          {/* ─── Main Controls ─── */}
          <View style={styles.controls}>
            <TouchableOpacity onPress={toggleShuffle} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="shuffle" size={24} color={shuffleColor} />
              {shuffleMode && <View style={styles.activeDot} />}
            </TouchableOpacity>

            <TouchableOpacity onPress={playPrev} style={styles.ctrlBtn}>
              <Ionicons name="play-skip-back" size={32} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity onPress={togglePlay} style={styles.playBtn}>
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={36} color="#000" />
            </TouchableOpacity>

            <TouchableOpacity onPress={playNext} style={styles.ctrlBtn}>
              <Ionicons name="play-skip-forward" size={32} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity onPress={toggleRepeat} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons
                name={repeatMode === 'one' ? 'repeat' : 'repeat'}
                size={24}
                color={repeatColor}
              />
              {repeatMode !== 'off' && <View style={[styles.activeDot, { backgroundColor: repeatColor }]} />}
            </TouchableOpacity>
          </View>

          {/* ─── Bottom extras: lyrics / queue ─── */}
          <View style={styles.extras}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Lyrics')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="text" size={22} color="#b3b3b3" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('Queue')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="list" size={22} color="#b3b3b3" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ─── Track Options Modal (Spotify Style) ─── */}
      <Modal
        visible={optionsVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setOptionsVisible(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setOptionsVisible(false)}
        >
          <View style={styles.menuContainer}>
            {/* Track Info Header */}
            <View style={styles.menuHeader}>
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={styles.menuArt} />
              ) : (
                <View style={[styles.menuArt, { backgroundColor: '#282828', justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="musical-notes" size={24} color="#b3b3b3" />
                </View>
              )}
              <View style={styles.menuHeaderInfo}>
                <Text style={styles.menuTitle} numberOfLines={1}>{currentTrack.title}</Text>
                <Text style={styles.menuArtist} numberOfLines={1}>
                  {currentTrack.artists?.map(a => a.name).join(', ') || ''}
                </Text>
              </View>
            </View>

            <View style={styles.menuDivider} />

            {/* Menu Options */}
            <ScrollView style={styles.menuList}>
              <TouchableOpacity
                style={styles.menuRow}
                onPress={async () => {
                  setOptionsVisible(false);
                  await toggleTrackFavorite();
                }}
              >
                <Ionicons
                  name={currentTrack.is_favorite ? 'heart' : 'heart-outline'}
                  size={22}
                  color={currentTrack.is_favorite ? colors.primary : '#fff'}
                />
                <Text style={styles.menuRowText}>
                  {currentTrack.is_favorite ? 'Remove from Liked Songs' : 'Like'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuRow}
                onPress={handleAddToPlaylistOption}
              >
                <Ionicons name="add-circle-outline" size={22} color="#fff" />
                <Text style={styles.menuRowText}>Add to playlist</Text>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity style={styles.menuCloseBtn} onPress={() => setOptionsVisible(false)}>
              <Text style={styles.menuCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Playlist Selection Modal ─── */}
      <Modal
        visible={playlistsVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setPlaylistsVisible(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setPlaylistsVisible(false)}
        >
          <View style={styles.menuContainer}>
            <View style={styles.playlistSelectorHeader}>
              <Text style={styles.playlistSelectorTitle}>Add to playlist</Text>
            </View>

            <View style={styles.menuDivider} />

            {loadingPlaylists ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 32 }} />
            ) : (
              <ScrollView style={styles.playlistListScroll}>
                {playlists.map((pl) => (
                  <TouchableOpacity
                    key={pl.id}
                    style={styles.playlistSelectRow}
                    onPress={() => selectPlaylist(pl.id)}
                  >
                    <Ionicons name="musical-notes-outline" size={20} color="#b3b3b3" />
                    <Text style={styles.playlistSelectText}>{pl.name}</Text>
                  </TouchableOpacity>
                ))}
                {playlists.length === 0 && (
                  <Text style={styles.noPlaylistsText}>No playlists found.</Text>
                )}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.menuCloseBtn} onPress={() => setPlaylistsVisible(false)}>
              <Text style={styles.menuCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {toastVisible && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  mainContent: { flex: 1, justifyContent: 'space-between' },
  artWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bottomSection: { width: '100%', paddingBottom: Platform.OS === 'ios' ? 16 : 24 },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
  },
  topBarSub: { color: '#b3b3b3', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  topBarTitle: { color: '#fff', fontSize: 13, fontWeight: '600', maxWidth: W * 0.5 },

  artContainer: {
    alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.55, shadowRadius: 22, elevation: 14,
  },
  art: { width: W - 72, height: W - 72, borderRadius: 10 },
  artFallback: { backgroundColor: '#282828', justifyContent: 'center', alignItems: 'center' },

  infoRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 28, marginBottom: 12,
  },
  trackTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  trackArtist: { color: '#b3b3b3', fontSize: 16 },

  seekContainer: { paddingHorizontal: 28, marginBottom: 16 },
  slider: { width: '100%', height: 32 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  time: { color: '#b3b3b3', fontSize: 12 },

  controls: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28, marginTop: 12, marginBottom: 20,
  },
  ctrlBtn: { padding: 8 },
  playBtn: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#fff', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12,
    elevation: 8,
  },
  activeDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: colors.primary,
    alignSelf: 'center', marginTop: 3,
  },

  extras: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 36,
    marginTop: 4,
  },

  // Menu / Bottom Sheet styles
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: '#1c1c1c',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingHorizontal: 20,
    maxHeight: '80%',
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  menuArt: {
    width: 50,
    height: 50,
    borderRadius: 4,
  },
  menuHeaderInfo: {
    marginLeft: 14,
    flex: 1,
  },
  menuTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  menuArtist: {
    color: '#b3b3b3',
    fontSize: 13,
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 12,
  },
  menuList: {
    maxHeight: 280,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 16,
  },
  menuRowText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  menuCloseBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 8,
    backgroundColor: '#282828',
    borderRadius: 24,
  },
  menuCloseText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  playlistSelectorHeader: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  playlistSelectorTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  playlistListScroll: {
    maxHeight: 280,
  },
  playlistSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  playlistSelectText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  noPlaylistsText: {
    color: '#b3b3b3',
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 24,
  },
  toastContainer: {
    position: 'absolute',
    bottom: 80,
    left: 24,
    right: 24,
    backgroundColor: '#2e2e2e',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 9999,
  },
  toastText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
