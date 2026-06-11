import React, { createContext, useState, useEffect, useRef, useContext } from 'react';
import { Audio } from 'expo-av';
import { useAuth } from './AuthContext';
import { Track } from '../types';
import { api } from '../api/client';

export type RepeatMode = 'off' | 'all' | 'one';

interface PlayerContextType {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  position: number;
  duration: number;
  repeatMode: RepeatMode;
  shuffleMode: boolean;
  playTrack: (track: Track, newQueue?: Track[]) => Promise<void>;
  togglePlay: () => Promise<void>;
  playNext: () => Promise<void>;
  playPrev: () => Promise<void>;
  seekTo: (ratio: number) => Promise<void>;
  seekToPosition: (positionMs: number) => Promise<void>;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  toggleTrackFavorite: () => Promise<void>;
}

const PlayerContext = createContext<PlayerContextType>({
  currentTrack: null,
  queue: [],
  queueIndex: 0,
  isPlaying: false,
  position: 0,
  duration: 0,
  repeatMode: 'off',
  shuffleMode: false,
  playTrack: async () => {},
  togglePlay: async () => {},
  playNext: async () => {},
  playPrev: async () => {},
  seekTo: async () => {},
  seekToPosition: async () => {},
  toggleRepeat: () => {},
  toggleShuffle: () => {},
  toggleTrackFavorite: async () => {},
});

export const usePlayer = () => useContext(PlayerContext);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [shuffleMode, setShuffleMode] = useState(false);
  const { baseUrl, accessToken } = useAuth();
  const soundRef = useRef<Audio.Sound | null>(null);
  const currentTrackHashRef = useRef<string | null>(null);
  const loggedCurrentTrack = useRef(false);

  useEffect(() => {
    Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  }, []);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const onPlaybackStatusUpdate = (status: any) => {
    if (!status.isLoaded) return;
    setPosition(status.positionMillis || 0);
    setDuration(status.durationMillis || 0);
    setIsPlaying(status.isPlaying || false);

    // Log to history after playing for 5 seconds (backend minimum duration is 5s)
    if (status.isPlaying && status.positionMillis >= 5000 && !loggedCurrentTrack.current) {
      loggedCurrentTrack.current = true;
      const hash = currentTrackHashRef.current;
      if (hash) {
        api.logTrackPlayed(hash, Math.floor(status.positionMillis / 1000), `tr:${hash}`);
      }
    }

    if (status.didJustFinish) {
      handleTrackEnd();
    }
  };

  const handleTrackEnd = async () => {
    if (repeatMode === 'one') {
      if (soundRef.current) {
        await soundRef.current.setPositionAsync(0);
        await soundRef.current.playAsync();
      }
    } else if (queueIndex < queue.length - 1) {
      await playAtIndex(queueIndex + 1);
    } else if (repeatMode === 'all' && queue.length > 0) {
      await playAtIndex(0);
    }
  };

  const buildStreamUrl = (track: Track) => {
    if (!baseUrl || !track.trackhash || !track.filepath) return null;
    const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const encodedFilePath = encodeURIComponent(track.filepath);
    return `${base}/file/${track.trackhash}/legacy?filepath=${encodedFilePath}`;
  };

  const playAtIndex = async (index: number, trackQueue?: Track[]) => {
    const targetQueue = trackQueue || queue;
    if (index < 0 || index >= targetQueue.length) return;
    const track = targetQueue[index];
    const uri = buildStreamUrl(track);
    if (!uri) return;

    // Unload previous sound
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      setSound(null);
    }

    try {
      const { sound: newSound } = await Audio.Sound.createAsync(
        {
          uri,
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );

      soundRef.current = newSound;
      setSound(newSound);
      setCurrentTrack(track);
      setQueueIndex(index);
      setIsPlaying(true);
      currentTrackHashRef.current = track.trackhash || null;
      loggedCurrentTrack.current = false;
    } catch (error) {
      console.error('Error playing track:', error);
    }
  };

  const playTrack = async (track: Track, newQueue?: Track[]) => {
    if (newQueue) {
      setQueue(newQueue);
      const idx = newQueue.findIndex(t => t.trackhash === track.trackhash);
      await playAtIndex(idx >= 0 ? idx : 0, newQueue);
    } else {
      const idx = queue.findIndex(t => t.trackhash === track.trackhash);
      if (idx >= 0) {
        await playAtIndex(idx);
      } else {
        const newQ = [track];
        setQueue(newQ);
        await playAtIndex(0, newQ);
      }
    }
  };

  const togglePlay = async () => {
    if (!soundRef.current) return;
    const status = await soundRef.current.getStatusAsync();
    if (!status.isLoaded) return;
    if (status.isPlaying) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
    } else {
      await soundRef.current.playAsync();
      setIsPlaying(true);
    }
  };

  const playNext = async () => {
    if (queueIndex < queue.length - 1) {
      await playAtIndex(queueIndex + 1);
    } else if (repeatMode === 'all') {
      await playAtIndex(0);
    }
  };

  const playPrev = async () => {
    if (position > 3000) {
      // If more than 3s played, restart current track
      await soundRef.current?.setPositionAsync(0);
    } else if (queueIndex > 0) {
      await playAtIndex(queueIndex - 1);
    }
  };

  const seekTo = async (ratio: number) => {
    if (!soundRef.current || duration === 0) return;
    const posMs = ratio * duration;
    await soundRef.current.setPositionAsync(posMs);
  };

  const seekToPosition = async (positionMs: number) => {
    if (!soundRef.current) return;
    await soundRef.current.setPositionAsync(positionMs);
  };

  const toggleRepeat = () => {
    setRepeatMode(prev => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  };

  const toggleShuffle = () => {
    if (!shuffleMode && queue.length > 0) {
      const currentItem = queue[queueIndex];
      const rest = queue.filter((_, i) => i !== queueIndex);
      const shuffled = rest.sort(() => Math.random() - 0.5);
      const newQ = [currentItem, ...shuffled];
      setQueue(newQ);
      setQueueIndex(0);
    }
    setShuffleMode(prev => !prev);
  };

  const toggleTrackFavorite = async () => {
    if (!currentTrack || !currentTrack.trackhash) return;
    const nextVal = !currentTrack.is_favorite;
    try {
      await api.toggleFavorite(currentTrack.trackhash, nextVal);
      setCurrentTrack(prev => prev ? { ...prev, is_favorite: nextVal } : null);
      setQueue(prev => prev.map(t => t.trackhash === currentTrack.trackhash ? { ...t, is_favorite: nextVal } : t));
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  return (
    <PlayerContext.Provider value={{
      currentTrack, queue, queueIndex, isPlaying,
      position, duration, repeatMode, shuffleMode,
      playTrack, togglePlay, playNext, playPrev,
      seekTo, seekToPosition, toggleRepeat, toggleShuffle,
      toggleTrackFavorite,
    }}>
      {children}
    </PlayerContext.Provider>
  );
};
