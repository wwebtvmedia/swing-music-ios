import React, { createContext, useState, useEffect, useRef, useContext } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import TrackPlayer, {
  Capability,
  Event,
  RepeatMode as PlayerRepeatMode,
  State,
  usePlaybackState,
  useProgress,
  useIsPlaying,
  AppKilledPlaybackBehavior,
} from 'react-native-track-player';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  sleepTimerMinutesLeft: number | null;
  audioQuality: 'low' | 'medium' | 'high';
  playTrack: (track: Track, newQueue?: Track[]) => Promise<void>;
  togglePlay: () => Promise<void>;
  playNext: () => void;
  playPrev: (force?: boolean) => void;
  seekTo: (ratio: number) => Promise<void>;
  seekToPosition: (positionMs: number) => Promise<void>;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  toggleTrackFavorite: () => Promise<void>;
  setSleepTimer: (minutes: number | null) => void;
  setAudioQuality: (quality: 'low' | 'medium' | 'high') => Promise<void>;
  volume: number;
  setVolume: (val: number) => Promise<void>;
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
  sleepTimerMinutesLeft: null,
  audioQuality: 'medium',
  volume: 1,
  playTrack: async () => {},
  togglePlay: async () => {},
  playNext: async () => {},
  playPrev: async () => {},
  seekTo: async () => {},
  seekToPosition: async () => {},
  toggleRepeat: () => {},
  toggleShuffle: () => {},
  toggleTrackFavorite: async () => {},
  setSleepTimer: () => {},
  setAudioQuality: async () => {},
  setVolume: async () => {},
});

export const usePlayer = () => useContext(PlayerContext);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<Track[]>([]);
  const [originalQueue, setOriginalQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [shuffleMode, setShuffleMode] = useState(false);

  const [activeTrackState, setActiveTrackState] = useState<any>(null);

  const syncActiveTrack = async () => {
    try {
      const track = await TrackPlayer.getActiveTrack();
      if (track) {
        setActiveTrackState(track);
        const idx = queue.findIndex(t => t.trackhash === track.trackhash);
        if (idx >= 0 && queueIndex !== idx) {
          setQueueIndex(idx);
        }
      } else {
        setActiveTrackState(null);
      }
    } catch (e) {
      // ignore
    }
  };

  const syncActiveTrackRef = useRef(syncActiveTrack);
  useEffect(() => {
    syncActiveTrackRef.current = syncActiveTrack;
  });

  // Sync on mount, AppState change, and periodic intervals
  useEffect(() => {
    syncActiveTrackRef.current();

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        syncActiveTrackRef.current();
      }
    };

    const appStateSub = AppState.addEventListener('change', handleAppStateChange);
    const interval = setInterval(() => {
      syncActiveTrackRef.current();
    }, 1000);

    return () => {
      appStateSub.remove();
      clearInterval(interval);
    };
  }, []);

  // Listen to native active track changed event
  useEffect(() => {
    const sub = TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, (event) => {
      console.log('PlaybackActiveTrackChanged event:', event);
      if (event.track) {
        setActiveTrackState(event.track);
        const trackhash = (event.track as any).trackhash;
        if (trackhash) {
          const idx = queue.findIndex(t => t.trackhash === trackhash);
          if (idx >= 0) {
            setQueueIndex(idx);
          }
        } else if (event.index !== undefined && event.index !== null) {
          setQueueIndex(event.index);
        }
      } else {
        setActiveTrackState(null);
        if (event.index !== undefined && event.index !== null) {
          setQueueIndex(event.index);
        }
      }
    });
    return () => sub.remove();
  }, [queue]);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [sleepTimerMinutesLeft, setSleepTimerMinutesLeft] = useState<number | null>(null);
  const [audioQuality, setAudioQualityState] = useState<'low' | 'medium' | 'high'>('medium');
  const [volume, setVolumeState] = useState(1);

  const sleepTimerId = useRef<any>(null);

  const { baseUrl, accessToken } = useAuth();

  const progress = useProgress();
  const [isPlaying, setIsPlaying] = useState(false);

  // Sync state explicitly to avoid the buggy useIsPlaying hook
  useEffect(() => {
    const fetchState = async () => {
      try {
        const state = await TrackPlayer.getPlaybackState();
        setIsPlaying(state.state === State.Playing || state.state === State.Buffering);
      } catch (e) {
        console.warn('Failed to fetch playback state during init:', e);
      }
    };
    fetchState();
    
    const sub = TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
      setIsPlaying(event.state === State.Playing || event.state === State.Buffering);
    });
    return () => sub.remove();
  }, []);

  const loggedCurrentTrack = useRef<string | null>(null);

  // Setup player on mount
  useEffect(() => {
    let isMounted = true;
    const setup = async () => {
      try {
        await TrackPlayer.setupPlayer({});
        const storedVol = await AsyncStorage.getItem('playerVolume');
        if (storedVol) {
          const volNum = parseFloat(storedVol);
          if (!isNaN(volNum)) {
            setVolumeState(volNum);
            await TrackPlayer.setVolume(volNum);
          }
        }
      } catch (e) {
        // Player might already be setup
      }

      // ALWAYS update options, even if already setup, to reconnect the JS bridge capabilities
      try {
        await TrackPlayer.updateOptions({
          android: {
            appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
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
      } catch (e) {
        console.error('Error updating options:', e);
      }

      // Restore queue and modes
      try {
        const storedShuffle = await AsyncStorage.getItem('playerShuffleMode');
        if (storedShuffle) setShuffleMode(JSON.parse(storedShuffle));
        
        const storedRepeat = await AsyncStorage.getItem('playerRepeatMode');
        if (storedRepeat) {
          setRepeatMode(storedRepeat as RepeatMode);
          let playerMode = PlayerRepeatMode.Off;
          if (storedRepeat === 'all') playerMode = PlayerRepeatMode.Queue;
          else if (storedRepeat === 'one') playerMode = PlayerRepeatMode.Track;
          await TrackPlayer.setRepeatMode(playerMode);
        }

        const storedQueue = await AsyncStorage.getItem('playerQueue');
        const storedOriginalQueue = await AsyncStorage.getItem('playerOriginalQueue');
        const storedQueueIndex = await AsyncStorage.getItem('playerQueueIndex');

        if (storedQueue && isMounted) {
          const parsedQueue = JSON.parse(storedQueue);
          setQueue(parsedQueue);
          if (storedOriginalQueue) setOriginalQueue(JSON.parse(storedOriginalQueue));
          
          let qIdx = 0;
          if (storedQueueIndex) {
            qIdx = parseInt(storedQueueIndex, 10);
            setQueueIndex(qIdx);
          }

          // Check if TrackPlayer is empty (it might be still running in background though!)
          const nativeQueue = await TrackPlayer.getQueue();
          if (nativeQueue.length === 0 && parsedQueue.length > 0) {
            await TrackPlayer.add(parsedQueue.map((t: Track) => mapToPlayerTrack(t)));
            await TrackPlayer.skip(qIdx);
          }
        }
      } catch (e) {
        console.error('Failed to restore player state:', e);
      }

      if (isMounted) {
        setIsPlayerReady(true);
      }
    };
    setup();

    // Bootstrap persisted audio quality
    AsyncStorage.getItem('audioQuality').then(val => {
      if (val === 'low' || val === 'medium' || val === 'high') {
        setAudioQualityState(val);
      }
    });

    return () => {
      isMounted = false;
      if (sleepTimerId.current) {
        clearInterval(sleepTimerId.current);
      }
    };
  }, []);

  // Save state to AsyncStorage when it changes
  useEffect(() => {
    AsyncStorage.setItem('playerQueue', JSON.stringify(queue));
  }, [queue]);

  useEffect(() => {
    AsyncStorage.setItem('playerOriginalQueue', JSON.stringify(originalQueue));
  }, [originalQueue]);

  useEffect(() => {
    AsyncStorage.setItem('playerQueueIndex', queueIndex.toString());
  }, [queueIndex]);

  useEffect(() => {
    AsyncStorage.setItem('playerShuffleMode', JSON.stringify(shuffleMode));
  }, [shuffleMode]);

  useEffect(() => {
    AsyncStorage.setItem('playerRepeatMode', repeatMode);
  }, [repeatMode]);

  // Listen for track errors
  useEffect(() => {
    const errorSubscription = TrackPlayer.addEventListener(Event.PlaybackError, (event) => {
      console.error('PlaybackError event:', event);
    });
    
    return () => {
      errorSubscription.remove();
    };
  }, []);

  // Convert progress (seconds) to milliseconds for backwards compatibility with UI
  const position = Math.floor((progress.position || 0) * 1000);
  const duration = Math.floor((progress.duration || 0) * 1000);

  // Synced current track using activeTrackState as source of truth, falling back to queueIndex
  const currentTrack = activeTrackState
    ? (queue.find(t => t.trackhash === activeTrackState.trackhash) || (activeTrackState as unknown as Track))
    : (queue[queueIndex] || null);

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

  // Prefetch lyrics for the next track in the queue when the current track changes
  useEffect(() => {
    const nextTrack = queue[queueIndex + 1];
    if (nextTrack && nextTrack.trackhash) {
      const prefetch = async () => {
        const cacheKey = `lyrics_cache_${nextTrack.trackhash}`;
        try {
          const cached = await AsyncStorage.getItem(cacheKey);
          if (cached) return; // Already in cache
        } catch {}

        const artistName = Array.isArray(nextTrack.artists)
          ? nextTrack.artists.map(a => a?.name).filter(Boolean).join(', ')
          : (nextTrack.artist || '');
        const trackName = nextTrack.title || '';
        const albumName = nextTrack.album || '';
        const durationSec = nextTrack.duration || 0;

        try {
          let url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(trackName)}&artist_name=${encodeURIComponent(artistName)}`;
          if (albumName) url += `&album_name=${encodeURIComponent(albumName)}`;
          if (durationSec > 0) url += `&duration=${Math.floor(durationSec)}`;

          let res = await fetch(url).then(r => r.ok ? r.json() : null);
          if (!res) {
            const searchUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(trackName)}&artist_name=${encodeURIComponent(artistName)}`;
            const searchRes = await fetch(searchUrl).then(r => r.ok ? r.json() : null);
            if (Array.isArray(searchRes) && searchRes.length > 0) {
              res = searchRes[0];
            }
          }
          if (!res) return;

          const LRC_TAG = /\[(\d+):(\d+)(?:[.:](\d+))?\]/;
          const parseLrc = (raw: string) => {
            if (!raw || !raw.trim()) return [];
            const lines = raw.split('\n');
            const out = [];
            for (const line of lines) {
              const match = line.match(LRC_TAG);
              if (!match) continue;
              const text = line.replace(/\[\d+:\d+(?:[.:]\d+)?\]/g, '').trim();
              const min = parseInt(match[1], 10);
              const sec = parseInt(match[2], 10);
              const msStr = match[3] || '0';
              let ms = 0;
              if (msStr.length === 2) ms = parseInt(msStr, 10) * 10;
              else if (msStr.length === 3) ms = parseInt(msStr, 10);
              else ms = parseInt(msStr.padEnd(3, '0').slice(0, 3), 10);
              out.push({ time: min * 60000 + sec * 1000 + ms, text });
            }
            return out.sort((a, b) => a.time - b.time);
          };

          let lyricsData = { synced: [], plain: '' };
          if (res.syncedLyrics && typeof res.syncedLyrics === 'string' && res.syncedLyrics.trim().length > 0) {
            lyricsData = { synced: parseLrc(res.syncedLyrics) as any, plain: res.plainLyrics || '' };
          } else if (res.plainLyrics && typeof res.plainLyrics === 'string') {
            lyricsData = { synced: [], plain: res.plainLyrics };
          }

          if (lyricsData.synced.length > 0 || lyricsData.plain.length > 0) {
            await AsyncStorage.setItem(cacheKey, JSON.stringify(lyricsData));
            console.log(`Prefetched lyrics for next track: ${trackName}`);
          }
        } catch (e) {
          console.error('Prefetch lyrics error:', e);
        }
      };
      prefetch();
    }
  }, [currentTrack, queue, queueIndex]);

  const buildStreamUrl = (track: Track) => {
    if (!baseUrl || !track.trackhash) return 'http://127.0.0.1/dummy.mp3';
    const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const qualityParam = `quality=${audioQuality}`;
    if (track.filepath) {
      const encodedFilePath = encodeURIComponent(track.filepath);
      return `${base}/file/${track.trackhash}/legacy?filepath=${encodedFilePath}&${qualityParam}`;
    }
    return `${base}/file/${track.trackhash}?${qualityParam}`;
  };

  const getImageUrl = (path?: string) => {
    if (!path) return undefined;
    if (path.startsWith('http')) return path;
    const sanitizedBaseUrl = baseUrl?.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${sanitizedBaseUrl}/img/thumbnail/${path}`;
  };

  const mapToPlayerTrack = (track: Track) => {
    return {
      id: track.trackhash || `fallback-${Date.now()}-${Math.random()}`,
      url: buildStreamUrl(track) || 'http://127.0.0.1/dummy.mp3',
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
    if (!isPlayerReady) {
      console.warn('Player not ready during playAtIndex, attempting setup');
      try {
        await TrackPlayer.setupPlayer({});
        setIsPlayerReady(true);
      } catch (e) {
        console.warn('Player setup during playAtIndex failed or already setup', e);
        setIsPlayerReady(true);
      }
    }
    if (index < 0 || index >= targetQueue.length) return;
    try {
      await TrackPlayer.reset();
      await TrackPlayer.add(targetQueue.map(t => mapToPlayerTrack(t)));
      await TrackPlayer.skip(index);

      // Re-apply repeat mode since reset() clears it
      let playerMode = PlayerRepeatMode.Off;
      if (repeatMode === 'all') playerMode = PlayerRepeatMode.Queue;
      else if (repeatMode === 'one') playerMode = PlayerRepeatMode.Track;
      await TrackPlayer.setRepeatMode(playerMode);

      await TrackPlayer.play();
      setIsPlaying(true);
      setQueueIndex(index);
    } catch (error) {
      console.error('Error playing track at index:', error);
    }
  };

  const playTrack = async (track: Track, newQueue?: Track[]) => {
    if (newQueue) {
      setOriginalQueue(newQueue);
      
      if (shuffleMode) {
        // Find the chosen track
        const idx = newQueue.findIndex(t => t.trackhash === track.trackhash);
        const actualIdx = idx >= 0 ? idx : 0;
        const chosenTrack = newQueue[actualIdx];
        
        // Shuffle the rest
        const others = newQueue.filter((_, i) => i !== actualIdx);
        const shuffledOthers = [...others].sort(() => Math.random() - 0.5);
        
        const shuffledQueue = [chosenTrack, ...shuffledOthers];
        setQueue(shuffledQueue);
        await playAtIndex(0, shuffledQueue);
      } else {
        setQueue(newQueue);
        const idx = newQueue.findIndex(t => t.trackhash === track.trackhash);
        await playAtIndex(idx >= 0 ? idx : 0, newQueue);
      }
    } else {
      const idx = queue.findIndex(t => t.trackhash === track.trackhash);
      if (idx >= 0) {
        try {
          await TrackPlayer.skip(idx);
          await TrackPlayer.play();
          setIsPlaying(true);
          setQueueIndex(idx);
        } catch (e) {
          // If skip fails, reset and load queue
          await playAtIndex(idx, queue);
        }
      } else {
        const newQ = [track];
        setQueue(newQ);
        setOriginalQueue(newQ);
        await playAtIndex(0, newQ);
      }
    }
  };

  const ensureReady = async () => {
    if (!isPlayerReady) {
      try {
        await TrackPlayer.setupPlayer({});
        setIsPlayerReady(true);
      } catch (e) {
        setIsPlayerReady(true);
      }
    }
  };

  const togglePlay = async () => {
    try {
      const state = await TrackPlayer.getPlaybackState();
      const isActuallyPlaying = state.state === State.Playing || state.state === State.Buffering;
      
      console.log('togglePlay clicked. isActuallyPlaying:', isActuallyPlaying, 'isPlayerReady:', isPlayerReady);
      
      if (isActuallyPlaying) {
        console.log('Attempting TrackPlayer.pause()');
        await TrackPlayer.pause();
        console.log('TrackPlayer.pause() completed');
        setIsPlaying(false);
      } else {
        console.log('Attempting TrackPlayer.play()');
        await TrackPlayer.play();
        console.log('TrackPlayer.play() completed');
        setIsPlaying(true);
      }
    } catch (e) {
      console.error('togglePlay error:', e);
    }
  };

  const playNext = async () => {
    await ensureReady();
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
          console.error('Error looping queue:', err);
        }
      } else {
        console.error('Failed to skip to next:', e);
      }
    }
  };

  const playPrev = async (force: boolean = false) => {
    await ensureReady();
    try {
      if (!force && position > 3000) {
        await TrackPlayer.seekTo(0);
      } else if (queueIndex === 0 && queue.length > 0) {
        await TrackPlayer.skip(queue.length - 1);
        await TrackPlayer.play();
        setQueueIndex(queue.length - 1);
      } else {
        await TrackPlayer.skipToPrevious();
        await TrackPlayer.play();
      }
    } catch (e) {
      console.error('Error skipping to previous:', e);
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
    AsyncStorage.setItem('playerRepeatMode', nextMode);
    try {
      await TrackPlayer.setRepeatMode(playerMode);
    } catch (e) {
      console.error('Error setting repeat mode:', e);
    }
  };

  const toggleShuffle = async () => {
    const newMode = !shuffleMode;
    setShuffleMode(newMode);
    AsyncStorage.setItem('playerShuffleMode', JSON.stringify(newMode));

    if (!currentTrack) return;

    setTimeout(async () => {
      try {
        const currentTrackIndex = await TrackPlayer.getActiveTrackIndex();
        if (currentTrackIndex !== undefined && currentTrackIndex !== null) {
          if (newMode && queue.length > 0) {
            // Enable shuffle: keep items up to current unchanged, shuffle subsequent
            const prefix = queue.slice(0, queueIndex + 1);
            const suffix = queue.slice(queueIndex + 1);
            const shuffledSuffix = [...suffix].sort(() => Math.random() - 0.5);
            const newQ = [...prefix, ...shuffledSuffix];

            setQueue(newQ);

            const queueInPlayer = await TrackPlayer.getQueue();
            const removeIndices = [];
            for (let i = currentTrackIndex + 1; i < queueInPlayer.length; i++) {
              removeIndices.push(i);
            }
            if (removeIndices.length > 0) {
              await TrackPlayer.remove(removeIndices);
            }
            if (shuffledSuffix.length > 0) {
              await TrackPlayer.add(shuffledSuffix.map(t => mapToPlayerTrack(t)));
            }
          } else if (!newMode && queue.length > 0) {
            // Disable shuffle: restore suffix from originalQueue
            const origIdx = originalQueue.findIndex(t => t.trackhash === currentTrack.trackhash);
            const prefix = queue.slice(0, queueIndex + 1);
            const suffix = origIdx >= 0 ? originalQueue.slice(origIdx + 1) : [];
            const newQ = [...prefix, ...suffix];

            setQueue(newQ);

            const queueInPlayer = await TrackPlayer.getQueue();
            const removeIndices = [];
            for (let i = currentTrackIndex + 1; i < queueInPlayer.length; i++) {
              removeIndices.push(i);
            }
            if (removeIndices.length > 0) {
              await TrackPlayer.remove(removeIndices);
            }
            if (suffix.length > 0) {
              await TrackPlayer.add(suffix.map(t => mapToPlayerTrack(t)));
            }
          }
        }
      } catch (e) {
        console.error('Error toggling shuffle mode:', e);
      }
    }, 10);
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

  const setSleepTimer = (minutes: number | null) => {
    if (sleepTimerId.current) {
      clearInterval(sleepTimerId.current);
      sleepTimerId.current = null;
    }
    setSleepTimerMinutesLeft(minutes);

    if (minutes !== null && minutes > 0) {
      let timeLeft = minutes;
      sleepTimerId.current = setInterval(() => {
        timeLeft -= 1;
        if (timeLeft <= 0) {
          TrackPlayer.pause();
          setIsPlaying(false);
          setSleepTimerMinutesLeft(null);
          if (sleepTimerId.current) {
            clearInterval(sleepTimerId.current);
            sleepTimerId.current = null;
          }
        } else {
          setSleepTimerMinutesLeft(timeLeft);
        }
      }, 60000);
    }
  };

  const setAudioQuality = async (quality: 'low' | 'medium' | 'high') => {
    setAudioQualityState(quality);
    try {
      await AsyncStorage.setItem('audioQuality', quality);
    } catch (e) {
      console.error('Failed to save audio quality setting:', e);
    }
  };

  const setVolume = async (val: number) => {
    setVolumeState(val);
    try {
      await TrackPlayer.setVolume(val);
      await AsyncStorage.setItem('playerVolume', val.toString());
    } catch (e) {
      console.error('Failed to save volume:', e);
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
        sleepTimerMinutesLeft,
        audioQuality,
        volume,
        playTrack,
        togglePlay,
        playNext,
        playPrev,
        seekTo,
        seekToPosition,
        toggleRepeat,
        toggleShuffle,
        toggleTrackFavorite,
        setSleepTimer,
        setAudioQuality,
        setVolume,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};
