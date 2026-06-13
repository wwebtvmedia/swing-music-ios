import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, Modal, Platform, ScrollView, Alert, ActivityIndicator, Vibration, Animated, PanResponder,
} from 'react-native';
import { Image } from 'expo-image';
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

const GRADIENT_COLORS = [
  ['#4C4C4C', '#121212'],
  ['#1D3557', '#121212'],
  ['#2A9D8F', '#121212'],
  ['#E76F51', '#121212'],
  ['#264653', '#121212'],
  ['#D62828', '#121212'],
  ['#8338EC', '#121212'],
  ['#0077B6', '#121212'],
  ['#0096C7', '#121212'],
  ['#7B2CBF', '#121212'],
  ['#9D4EDD', '#121212'],
  ['#C77DFF', '#121212'],
  ['#E63946', '#121212'],
  ['#F77F00', '#121212'],
  ['#FCBF49', '#121212'],
  ['#E07A5F', '#121212'],
];

function getDynamicGradientColors(hash?: string): [string, string] {
  if (!hash) return ['#4C4C4C', '#121212'];
  let sum = 0;
  for (let i = 0; i < hash.length; i++) {
    sum += hash.charCodeAt(i);
  }
  const idx = sum % GRADIENT_COLORS.length;
  return GRADIENT_COLORS[idx] as [string, string];
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

export default function PlayerScreen() {
  const {
    currentTrack, isPlaying, togglePlay,
    position, duration, seekTo,
    playNext, playPrev,
    repeatMode, shuffleMode,
    toggleRepeat, toggleShuffle,
    queue, queueIndex,
    toggleTrackFavorite,
    sleepTimerMinutesLeft, setSleepTimer,
    volume, setVolume,
  } = usePlayer();
  const { baseUrl } = useAuth();
  const navigation = useNavigation<any>();

  const [optionsVisible, setOptionsVisible] = useState(false);
  const [playlistsVisible, setPlaylistsVisible] = useState(false);
  const [sleepTimerVisible, setSleepTimerVisible] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [slidingValue, setSlidingValue] = useState<number | null>(null);

  const [optimisticTrack, setOptimisticTrack] = useState<any>(null);
  const swipeX = useRef(new Animated.Value(0)).current;
  const swipeOpacity = useRef(new Animated.Value(1)).current;
  const [dragDirection, setDragDirection] = useState<'left' | 'right' | null>(null);
  const dragDirectionRef = useRef<'left' | 'right' | null>(null);
  const slidingUpdateRef = useRef(0);

  const handleSliding = (val: number) => {
    const now = Date.now();
    if (now - slidingUpdateRef.current > 60) {
      setSlidingValue(val);
      slidingUpdateRef.current = now;
    }
  };

  // Update dynamic state reference to prevent stale closures inside PanResponder
  const stateRef = useRef<any>({});
  useEffect(() => {
    stateRef.current = {
      currentTrack,
      queue,
      queueIndex,
      dragDirection,
      playNext,
      playPrev,
      handleNextWithAnim,
      handlePrevWithAnim,
    };
  });

  useEffect(() => {
    const id = swipeX.addListener((value) => {
      let nextDir: 'left' | 'right' | null = null;
      if (value.value < -15) {
        nextDir = 'left';
      } else if (value.value > 15) {
        nextDir = 'right';
      }
      if (dragDirectionRef.current !== nextDir) {
        dragDirectionRef.current = nextDir;
        setDragDirection(nextDir);
      }
    });
    return () => {
      swipeX.removeListener(id);
    };
  }, []);

  const handleNextWithAnim = () => {
    const activeTrack = stateRef.current.currentTrack;
    const activeQueue = stateRef.current.queue;
    const activeIndex = stateRef.current.queueIndex;

    let nextTrack = null;
    if (activeQueue && activeQueue.length > 0) {
      const idx = activeQueue.findIndex((t: any) => t.trackhash === activeTrack?.trackhash);
      const activeIdx = idx >= 0 ? idx : activeIndex;
      const nextIdx = (activeIdx + 1) % activeQueue.length;
      nextTrack = activeQueue[nextIdx];
    }

    Animated.parallel([
      Animated.timing(swipeX, {
        toValue: -W - 100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(swipeOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      })
    ]).start(() => {
      if (nextTrack) setOptimisticTrack(nextTrack);
      stateRef.current.playNext();
    });
  };

  const handlePrevWithAnim = () => {
    const activeTrack = stateRef.current.currentTrack;
    const activeQueue = stateRef.current.queue;
    const activeIndex = stateRef.current.queueIndex;

    let prevTrack = null;
    if (activeQueue && activeQueue.length > 0) {
      const idx = activeQueue.findIndex((t: any) => t.trackhash === activeTrack?.trackhash);
      const activeIdx = idx >= 0 ? idx : activeIndex;
      const prevIdx = (activeIdx - 1 + activeQueue.length) % activeQueue.length;
      prevTrack = activeQueue[prevIdx];
    }

    Animated.parallel([
      Animated.timing(swipeX, {
        toValue: W + 100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(swipeOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      })
    ]).start(() => {
      if (prevTrack) setOptimisticTrack(prevTrack);
      stateRef.current.playPrev(true);
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 30;
      },
      onPanResponderMove: (_, gestureState) => {
        swipeX.setValue(gestureState.dx);
        const opacity = Math.max(0.6, 1 - Math.abs(gestureState.dx) / 400);
        swipeOpacity.setValue(opacity);
      },
      onPanResponderRelease: (_, gestureState) => {
        const threshold = 100;
        if (gestureState.dx < -threshold) {
          Vibration.vibrate(12);
          stateRef.current.handleNextWithAnim();
        } else if (gestureState.dx > threshold) {
          Vibration.vibrate(12);
          stateRef.current.handlePrevWithAnim();
        } else {
          Animated.parallel([
            Animated.spring(swipeX, {
              toValue: 0,
              tension: 50,
              friction: 7,
              useNativeDriver: true,
            }),
            Animated.timing(swipeOpacity, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            })
          ]).start();
        }
      },
    })
  ).current;

  const prevTrackHash = useRef(currentTrack?.trackhash);
  useEffect(() => {
    if (prevTrackHash.current !== currentTrack?.trackhash) {
      prevTrackHash.current = currentTrack?.trackhash;
      setOptimisticTrack(null);
      swipeX.setValue(0);
      swipeOpacity.setValue(1);
      dragDirectionRef.current = null;
      setDragDirection(null);
    }
  }, [currentTrack]);

  useEffect(() => {
    if (optimisticTrack) {
      swipeX.setValue(0);
      swipeOpacity.setValue(1);
    }
  }, [optimisticTrack]);

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

  if (!currentTrack) {
    return (
      <View style={{ flex: 1, backgroundColor: '#121212' }}>
        <LinearGradient colors={['#333333', '#121212']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.container}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => { Vibration.vibrate(10); navigation.goBack(); }} style={{ padding: 6 }}>
              <Ionicons name="chevron-down" size={28} color="#fff" />
            </TouchableOpacity>
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Text style={styles.topBarSub}>PLAYING FROM LIBRARY</Text>
              <SkeletonItem style={{ width: 80, height: 12, borderRadius: 4 }} />
            </View>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.artWrapper}>
            <View style={styles.artContainer}>
              <SkeletonItem style={styles.art} />
            </View>
          </View>

          <View style={styles.bottomSection}>
            <View style={styles.infoRow}>
              <View style={{ flex: 1, gap: 6 }}>
                <SkeletonItem style={{ width: '60%', height: 22, borderRadius: 4 }} />
                <SkeletonItem style={{ width: '40%', height: 16, borderRadius: 4 }} />
              </View>
              <Ionicons name="heart-outline" size={26} color="#535353" />
            </View>

            <View style={styles.seekContainer}>
              <SkeletonItem style={{ width: '100%', height: 4, borderRadius: 2, marginVertical: 14 }} />
              <View style={styles.timeRow}>
                <Text style={styles.time}>0:00</Text>
                <Text style={styles.time}>0:00</Text>
              </View>
            </View>

            <View style={styles.controls}>
              <Ionicons name="shuffle" size={24} color="#535353" />
              <Ionicons name="play-skip-back" size={28} color="#535353" />
              <View style={styles.playBtn}>
                <Ionicons name="play" size={30} color="#121212" />
              </View>
              <Ionicons name="play-skip-forward" size={28} color="#535353" />
              <Ionicons name="repeat" size={24} color="#535353" />
            </View>

            <View style={styles.extras}>
              <Ionicons name="musical-notes-outline" size={22} color="#535353" />
              <Ionicons name="timer-outline" size={22} color="#535353" />
              <Ionicons name="menu-outline" size={24} color="#535353" />
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const progress = duration > 0 ? position / duration : 0;
  const displayProgress = slidingValue !== null ? slidingValue : (isNaN(progress) ? 0 : progress);
  const displayPosition = slidingValue !== null ? Math.floor(slidingValue * duration) : position;

  const trackToUse = optimisticTrack || currentTrack;
  const imageUrl = trackToUse ? getImgUrl(baseUrl, trackToUse.image, 'large') : null;

  const rotate = swipeX.interpolate({
    inputRange: [-W, 0, W],
    outputRange: ['-12deg', '0deg', '12deg'],
    extrapolate: 'clamp',
  });

  const nextScale = swipeX.interpolate({
    inputRange: [-W, 0, W],
    outputRange: [1, 0.9, 1],
    extrapolate: 'clamp',
  });

  const nextOpacity = swipeX.interpolate({
    inputRange: [-W, 0, W],
    outputRange: [1, 0.6, 1],
    extrapolate: 'clamp',
  });

  let bottomTrack = null;
  if (queue && queue.length > 0) {
    const idx = queue.findIndex(t => t.trackhash === currentTrack?.trackhash);
    const activeIdx = idx >= 0 ? idx : queueIndex;
    if (dragDirection === 'right') {
      const prevIdx = (activeIdx - 1 + queue.length) % queue.length;
      bottomTrack = queue[prevIdx];
    } else {
      const nextIdx = (activeIdx + 1) % queue.length;
      bottomTrack = queue[nextIdx];
    }
  }
  const bottomImageUrl = bottomTrack ? getImgUrl(baseUrl, bottomTrack.image, 'large') : null;

  const repeatColor = repeatMode !== 'off' ? colors.primary : '#b3b3b3';
  const shuffleColor = shuffleMode ? colors.primary : '#b3b3b3';
  const gradientColors = getDynamicGradientColors(trackToUse?.trackhash);

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }}>
      {/* ─── Top Bar ─── */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-down" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.topBarSub}>NOW PLAYING</Text>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {trackToUse?.album || 'Swing Music'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setOptionsVisible(true)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.mainContent}>
        {/* ─── Album Art with Swipe Gestures ─── */}
        <View style={styles.artWrapper}>
          <View style={{ width: W - 72, height: W - 72, position: 'relative', justifyContent: 'center', alignItems: 'center' }}>
            {/* Bottom Card */}
            {bottomImageUrl && (
              <Animated.View
                style={[
                  styles.artContainer,
                  {
                    position: 'absolute',
                    width: W - 72,
                    height: W - 72,
                    transform: [{ scale: nextScale }],
                    opacity: nextOpacity,
                    zIndex: 1,
                  }
                ]}
              >
                <Image
                  source={{ uri: bottomImageUrl }}
                  style={styles.art}
                  contentFit="cover"
                />
              </Animated.View>
            )}

            {/* Top Card */}
            <Animated.View
              {...panResponder.panHandlers}
              style={[
                styles.artContainer,
                {
                  position: 'absolute',
                  width: W - 72,
                  height: W - 72,
                  transform: [
                    { translateX: swipeX },
                    { rotate: rotate },
                  ],
                  opacity: swipeOpacity,
                  zIndex: 2,
                }
              ]}
            >
              {imageUrl ? (
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.art}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View style={[styles.art, styles.artFallback]}>
                  <Ionicons name="musical-notes" size={80} color="#535353" />
                </View>
              )}
            </Animated.View>
          </View>
        </View>

        {/* ─── Control & Info Section ─── */}
        <View style={styles.bottomSection}>
          {/* ─── Track Info + Heart ─── */}
          <View style={styles.infoRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.trackTitle} numberOfLines={1}>{trackToUse?.title}</Text>
              <Text style={styles.trackArtist} numberOfLines={1}>
                {Array.isArray(trackToUse?.artists)
                  ? trackToUse.artists.map((a: any) => a?.name).filter(Boolean).join(', ')
                  : (trackToUse?.artist || trackToUse?.album || '')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                Vibration.vibrate(12);
                toggleTrackFavorite();
              }}
              style={{ padding: 8 }}
            >
              <Ionicons
                name={trackToUse?.is_favorite ? 'heart' : 'heart-outline'}
                size={26}
                color={trackToUse?.is_favorite ? colors.primary : '#b3b3b3'}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.seekContainer}>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              value={displayProgress}
              minimumTrackTintColor="#fff"
              maximumTrackTintColor="#535353"
              thumbTintColor="#fff"
              onValueChange={handleSliding}
              onSlidingStart={(val) => {
                setSlidingValue(val);
              }}
              onSlidingComplete={async (val) => {
                await seekTo(val);
                setTimeout(() => {
                  setSlidingValue(null);
                }, 1000);
              }}
            />
            <View style={styles.timeRow}>
              <Text style={styles.time}>{formatMs(displayPosition)}</Text>
              <Text style={styles.time}>{formatMs(duration)}</Text>
            </View>
          </View>

          {/* ─── Main Controls ─── */}
          <View style={styles.controls}>
            <TouchableOpacity onPress={toggleShuffle} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="shuffle" size={24} color={shuffleColor} />
              {shuffleMode && <View style={styles.activeDot} />}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Vibration.vibrate(12);
                handlePrevWithAnim();
              }}
              style={styles.ctrlBtn}
            >
              <Ionicons name="play-skip-back" size={32} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Vibration.vibrate(12);
                togglePlay();
              }}
              style={styles.playBtn}
            >
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={36} color="#000" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Vibration.vibrate(12);
                handleNextWithAnim();
              }}
              style={styles.ctrlBtn}
            >
              <Ionicons name="play-skip-forward" size={32} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity onPress={toggleRepeat} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons
                name="repeat"
                size={24}
                color={repeatColor}
              />
              {repeatMode === 'one' && (
                <View style={styles.repeatOneBadge}>
                  <Text style={styles.repeatOneText}>1</Text>
                </View>
              )}
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

            {sleepTimerMinutesLeft !== null && (
              <TouchableOpacity
                onPress={() => setSleepTimerVisible(true)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Ionicons name="time-outline" size={16} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: 'bold' }}>
                  {sleepTimerMinutesLeft}m
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => navigation.navigate('Queue')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="list" size={22} color="#b3b3b3" />
            </TouchableOpacity>
          </View>

          {/* ─── Volume Control ─── */}
          <View style={styles.volumeContainer}>
            <Ionicons name="volume-low" size={18} color="#b3b3b3" />
            <Slider
              style={styles.volumeSlider}
              minimumValue={0}
              maximumValue={1}
              value={volume}
              minimumTrackTintColor="#fff"
              maximumTrackTintColor="rgba(255,255,255,0.2)"
              thumbTintColor="#fff"
              onValueChange={setVolume}
            />
            <Ionicons name="volume-high" size={18} color="#b3b3b3" />
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
                  {Array.isArray(currentTrack.artists)
                    ? currentTrack.artists.map(a => a?.name).filter(Boolean).join(', ')
                    : (currentTrack.artist || '')}
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

              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => {
                  setOptionsVisible(false);
                  setSleepTimerVisible(true);
                }}
              >
                <Ionicons name="time" size={22} color="#fff" />
                <Text style={styles.menuRowText}>Sleep Timer</Text>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity style={styles.menuCloseBtn} onPress={() => setOptionsVisible(false)}>
              <Text style={styles.menuCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Sleep Timer Selection Modal ─── */}
      <Modal
        visible={sleepTimerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSleepTimerVisible(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setSleepTimerVisible(false)}
        >
          <View style={styles.menuContainer}>
            <View style={styles.playlistSelectorHeader}>
              <Text style={styles.playlistSelectorTitle}>Sleep Timer</Text>
            </View>

            <View style={styles.menuDivider} />

            <ScrollView style={styles.playlistListScroll}>
              {sleepTimerMinutesLeft !== null && (
                <TouchableOpacity
                  style={styles.playlistSelectRow}
                  onPress={() => {
                    setSleepTimer(null);
                    setSleepTimerVisible(false);
                  }}
                >
                  <Ionicons name="stop-circle" size={20} color="#ff4444" />
                  <Text style={[styles.playlistSelectText, { color: '#ff4444' }]}>Turn off timer</Text>
                </TouchableOpacity>
              )}

              {[5, 10, 15, 30, 45, 60].map((mins) => (
                <TouchableOpacity
                  key={mins}
                  style={styles.playlistSelectRow}
                  onPress={() => {
                    setSleepTimer(mins);
                    setSleepTimerVisible(false);
                  }}
                >
                  <Ionicons name="time-outline" size={20} color="#b3b3b3" />
                  <Text style={styles.playlistSelectText}>{mins} minutes</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.menuCloseBtn} onPress={() => setSleepTimerVisible(false)}>
              <Text style={styles.menuCloseText}>Cancel</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
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
    position: 'absolute', bottom: -6,
  },
  repeatOneBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: colors.background, borderRadius: 8,
    width: 14, height: 14, justifyContent: 'center', alignItems: 'center',
  },
  repeatOneText: {
    color: colors.primary, fontSize: 10, fontWeight: 'bold',
  },

  extras: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 36,
    marginTop: 4,
    marginBottom: 8,
  },

  volumeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 12,
    marginTop: 8,
  },
  volumeSlider: {
    flex: 1,
    height: 30,
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
