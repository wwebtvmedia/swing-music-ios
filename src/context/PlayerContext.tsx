import React, { createContext, useState, useEffect, useRef, useContext } from 'react';
import TrackPlayer, {
  Capability,
  Event,
  RepeatMode as PlayerRepeatMode,
  State,
  useActiveTrack,
  usePlaybackState,
  useProgress,
  useIsPlaying,
  AppKilledPlaybackBehavior,
} from 'react-native-track-player';
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
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [shuffleMode, setShuffleMode] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  const { baseUrl, accessToken } = useAuth();

  const activeTrack = useActiveTrack();
  const progress = useProgress();
  const { playing } = useIsPlaying();
  const isPlaying = !!playing;

  const loggedCurrentTrack = useRef<string | null>(null);

  // Setup player on mount
  useEffect(() => {
    let isMounted = true;
    const setup = async () => {
      try {
        await TrackPlayer.setupPlayer({});
        await TrackPlayer.updateOptions({
          android: {
            appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
          },
          capabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
            Capability.SkipToPrevious,
            Capability.SeekTo,
          ],
          compactCapabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
            Capability.SkipToPrevious,
          ],
        });
        if (isMounted) {
          setIsPlayerReady(true);
        }
      } catch (e) {
        // Player might already be setup
        if (isMounted) {
          setIsPlayerReady(true);
        }
      }
    };
    setup();
    return () => {
      isMounted = false;
    };
  }, []);

  // Listen for track changes to update the current queue index
  useEffect(() => {
    const subscription = TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, async (event) => {
      if (event.index !== undefined && event.index !== null) {
        setQueueIndex(event.index);
      }
    });
    return () => {
      subscription.remove();
    };
  }, []);

  // Convert progress (seconds) to milliseconds for backwards compatibility with UI
  const position = Math.floor((progress.position || 0) * 1000);
  const duration = Math.floor((progress.duration || 0) * 1000);

  // Find or construct currentTrack matching UI type format
  const currentTrack = activeTrack
    ? queue.find(t => t.trackhash === activeTrack.id) || ({
        trackhash: activeTrack.id,
        title: activeTrack.title,
        album: activeTrack.album || undefined,
        duration: activeTrack.duration,
        filepath: (activeTrack as any).filepath,
        image: (activeTrack as any).image,
        artists: (activeTrack as any).artists,
        artist: activeTrack.artist || undefined,
        is_favorite: (activeTrack as any).is_favorite,
      } as Track)
    : null;

  // Log track play history after playing for 5 seconds
  useEffect(() => {
    if (
      isPlaying &&
      position >= 5000 &&
      currentTrack?.trackhash &&
      loggedCurrentTrack.current !== currentTrack.trackhash
    ) {
      loggedCurrentTrack.current = currentTrack.trackhash;
      api.logTrackPlayed(
        currentTrack.trackhash,
        Math.floor(position / 1000),
        `tr:${currentTrack.trackhash}`
      ).catch((err) => console.error('Failed to log history:', err));
    }
  }, [isPlaying, position, currentTrack]);

  const buildStreamUrl = (track: Track) => {
    if (!baseUrl || !track.trackhash || !track.filepath) return null;
    const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const encodedFilePath = encodeURIComponent(track.filepath);
    return `${base}/file/${track.trackhash}/legacy?filepath=${encodedFilePath}`;
  };

  const getImageUrl = (path?: string) => {
    if (!path) return undefined;
    if (path.startsWith('http')) return path;
    const sanitizedBaseUrl = baseUrl?.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${sanitizedBaseUrl}/img/thumbnail/${path}`;
  };

  const mapToPlayerTrack = (track: Track) => {
    return {
      id: track.trackhash || '',
      url: buildStreamUrl(track) || '',
      title: track.title || 'Unknown Title',
      artist: Array.isArray(track.artists)
        ? track.artists.map(a => a?.name).filter(Boolean).join(', ')
        : (track.artist || 'Unknown Artist'),
      artwork: getImageUrl(track.image),
      duration: track.duration,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      trackhash: track.trackhash,
      is_favorite: track.is_favorite,
      filepath: track.filepath,
      album: track.album,
      artists: track.artists,
      image: track.image,
    };
  };

  const playAtIndex = async (index: number, targetQueue: Track[]) => {
    if (!isPlayerReady || index < 0 || index >= targetQueue.length) return;
    try {
      await TrackPlayer.reset();
      await TrackPlayer.add(targetQueue.map(t => mapToPlayerTrack(t)));
      await TrackPlayer.skip(index);
      await TrackPlayer.play();
      setQueueIndex(index);
    } catch (error) {
      console.error('Error playing track at index:', error);
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
        try {
          await TrackPlayer.skip(idx);
          await TrackPlayer.play();
          setQueueIndex(idx);
        } catch (e) {
          // If skip fails, reset and load queue
          await playAtIndex(idx, queue);
        }
      } else {
        const newQ = [track];
        setQueue(newQ);
        await playAtIndex(0, newQ);
      }
    }
  };

  const togglePlay = async () => {
    if (!isPlayerReady) return;
    try {
      if (isPlaying) {
        await TrackPlayer.pause();
      } else {
        await TrackPlayer.play();
      }
    } catch (e) {
      console.error('Error toggling play state:', e);
    }
  };

  const playNext = async () => {
    if (!isPlayerReady) return;
    try {
      await TrackPlayer.skipToNext();
      await TrackPlayer.play();
    } catch (e) {
      // End of queue or failed skip, handle repeatMode
      if (repeatMode === 'all' && queue.length > 0) {
        try {
          await TrackPlayer.skip(0);
          await TrackPlayer.play();
          setQueueIndex(0);
        } catch (err) {
          console.error('Failed to skip to start:', err);
        }
      }
    }
  };

  const playPrev = async () => {
    if (!isPlayerReady) return;
    try {
      const currentPos = (await TrackPlayer.getProgress()).position;
      if (currentPos > 3) {
        await TrackPlayer.seekTo(0);
      } else {
        await TrackPlayer.skipToPrevious();
        await TrackPlayer.play();
      }
    } catch (e) {
      // Ignore skip errors
    }
  };

  const seekTo = async (ratio: number) => {
    if (!isPlayerReady) return;
    try {
      const currentProgress = await TrackPlayer.getProgress();
      const pos = ratio * currentProgress.duration;
      await TrackPlayer.seekTo(pos);
    } catch (e) {
      console.error('Error in seekTo:', e);
    }
  };

  const seekToPosition = async (positionMs: number) => {
    if (!isPlayerReady) return;
    try {
      await TrackPlayer.seekTo(positionMs / 1000);
    } catch (e) {
      console.error('Error in seekToPosition:', e);
    }
  };

  const toggleRepeat = async () => {
    let nextMode: RepeatMode = 'off';
    let playerMode = PlayerRepeatMode.Off;

    if (repeatMode === 'off') {
      nextMode = 'all';
      playerMode = PlayerRepeatMode.Queue;
    } else if (repeatMode === 'all') {
      nextMode = 'one';
      playerMode = PlayerRepeatMode.Track;
    } else {
      nextMode = 'off';
      playerMode = PlayerRepeatMode.Off;
    }

    setRepeatMode(nextMode);
    try {
      await TrackPlayer.setRepeatMode(playerMode);
    } catch (e) {
      console.error('Error setting repeat mode:', e);
    }
  };

  const toggleShuffle = async () => {
    if (!shuffleMode && queue.length > 0) {
      const currentItem = queue[queueIndex];
      const rest = queue.filter((_, i) => i !== queueIndex);
      const shuffled = rest.sort(() => Math.random() - 0.5);
      const newQ = [currentItem, ...shuffled];
      setQueue(newQ);
      setQueueIndex(0);
      try {
        await TrackPlayer.reset();
        await TrackPlayer.add(newQ.map(t => mapToPlayerTrack(t)));
        await TrackPlayer.play();
      } catch (e) {
        console.error('Error shuffling queue:', e);
      }
    }
    setShuffleMode(prev => !prev);
  };

  const toggleTrackFavorite = async () => {
    if (!currentTrack || !currentTrack.trackhash) return;
    const nextVal = !currentTrack.is_favorite;
    try {
      await api.toggleFavorite(currentTrack.trackhash, nextVal);
      setQueue(prev =>
        prev.map(t => (t.trackhash === currentTrack.trackhash ? { ...t, is_favorite: nextVal } : t))
      );
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        queue,
        queueIndex,
        isPlaying,
        position,
        duration,
        repeatMode,
        shuffleMode,
        playTrack,
        togglePlay,
        playNext,
        playPrev,
        seekTo,
        seekToPosition,
        toggleRepeat,
        toggleShuffle,
        toggleTrackFavorite,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};
