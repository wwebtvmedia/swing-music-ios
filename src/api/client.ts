import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const normalizeUrl = (raw: string): string => {
  let url = raw.trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = 'http://' + url;
  if (!url.endsWith('/')) url = url + '/';
  return url;
};

const getBase = async (): Promise<string> => {
  const raw = await SecureStore.getItemAsync('baseUrl');
  if (!raw) throw new Error('Base URL not set');
  return normalizeUrl(raw);
};

const getToken = async (): Promise<string | null> => {
  return SecureStore.getItemAsync('accessToken');
};

export const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
  const baseUrl = await getBase();
  const accessToken = await getToken();
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint.slice(1) : endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    let errBody = '';
    try {
      errBody = await response.text();
    } catch {}
    console.error(`API Error ${response.status} on ${url}:`, errBody);
    if (response.status === 401) throw new Error('Unauthorized');
    const errorObj = new Error(`API Error: ${response.status}`);
    (errorObj as any).status = response.status;
    (errorObj as any).body = errBody;
    throw errorObj;
  }
  return response.json();
};

// Build correct image URL
export const getImgUrl = (
  baseUrl: string | null,
  path?: string | null,
  type: 'small' | 'medium' | 'large' | 'playlist' | 'thumbnail' | 'artist' = 'small'
): string | undefined => {
  if (!path || !baseUrl) return undefined;
  if (path.startsWith('http')) return path;
  const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  switch (type) {
    case 'small':
    case 'thumbnail':
      return `${base}img/thumbnail/small/${path}`;
    case 'medium':
      return `${base}img/thumbnail/medium/${path}`;
    case 'large':
      return `${base}img/thumbnail/${path}`;
    case 'playlist':
      return `${base}img/playlist/${path}`;
    case 'artist':
      return `${base}img/thumbnail/medium/${path}`;
    default:
      return `${base}img/thumbnail/small/${path}`;
  }
};

export const api = {
  // Home
  getRecentlyPlayedTracks: async (limit = 15, start = 0): Promise<any> => {
    try {
      const res = await fetchApi(`playlists/recentlyplayed?limit=${limit}`);
      return {
        tracks: res?.tracks || [],
        total: res?.tracks?.length || 0,
      };
    } catch (e) {
      console.error('getRecentlyPlayedTracks error', e);
      return { tracks: [], total: 0 };
    }
  },
  getTopArtists: (limit = 10, start = 0) =>
    fetchApi(`getall/artists?limit=${limit}&start=${start}&sortby=playcount&reverse=1`),

  // Library
  getAllPlaylists: () => fetchApi('playlists?no_images=false'),
  getFavoriteTracks: (limit = 200, start = 0) =>
    fetchApi(`favorites/tracks?limit=${limit}&start=${start}`),

  // Search
  searchTracks: (q: string, limit = 20) =>
    fetchApi(`search?q=${encodeURIComponent(q)}&itemtype=tracks&limit=${limit}`),
  searchAlbums: (q: string, limit = 10) =>
    fetchApi(`search?q=${encodeURIComponent(q)}&itemtype=albums&limit=${limit}`),
  searchArtists: (q: string, limit = 10) =>
    fetchApi(`search?q=${encodeURIComponent(q)}&itemtype=artists&limit=${limit}`),
  getTopSearchResults: (q: string, limit = 5) =>
    fetchApi(`search?q=${encodeURIComponent(q)}&limit=${limit}`),

  // Playlist detail
  getPlaylistTracks: (playlistId: number) =>
    fetchApi(`playlists/${playlistId}?limit=10000`),
  createPlaylist: (name: string) =>
    fetchApi('playlists/new', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  addTrackToPlaylist: (playlistId: number, trackHash: string) =>
    fetchApi(`playlists/${playlistId}/add`, {
      method: 'POST',
      body: JSON.stringify({ itemtype: 'tracks', itemhash: trackHash }),
    }),
  removeTrackFromPlaylist: (playlistId: number, trackHash: string, index: number) =>
    fetchApi(`playlists/${playlistId}/remove-tracks`, {
      method: 'POST',
      body: JSON.stringify({ tracks: [{ trackhash: trackHash, index }] }),
    }),
  deletePlaylist: async (playlistId: number) => {
    const baseUrl = await getBase();
    const accessToken = await getToken();
    const url = `${baseUrl}playlists/${playlistId}/delete`;
    const headers: Record<string, string> = {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    };
    const response = await fetch(url, { method: 'DELETE', headers });
    if (!response.ok) {
      let errBody = '';
      try { errBody = await response.text(); } catch {}
      console.error(`API Error ${response.status} on ${url}:`, errBody);
      const e: any = new Error(`API Error: ${response.status}`);
      e.status = response.status;
      throw e;
    }
    return response.json().catch(() => ({}));
  },
  addFolderToPlaylist: (playlistId: number, folderPath: string) =>
    fetchApi(`playlists/${playlistId}/add`, {
      method: 'POST',
      body: JSON.stringify({ itemtype: 'folder', itemhash: folderPath, sortoptions: {} }),
    }),

  // Stats
  getStats: () => fetchApi('logger/stats'),
  getArtistsCount: () => fetchApi('getall/artists?limit=1'),
  getAlbumsCount: () => fetchApi('getall/albums?limit=1'),
  getAllAlbums: (limit = 20, start = 0) =>
    fetchApi(`getall/albums?limit=${limit}&start=${start}&sortby=created&reverse=1`),
  getAllArtists: (limit = 20, start = 0) =>
    fetchApi(`getall/artists?limit=${limit}&start=${start}&sortby=created&reverse=1`),

  // Track actions
  toggleFavorite: (trackhash: string, add: boolean) =>
    fetchApi(add ? 'favorites/add' : 'favorites/remove', {
      method: 'POST',
      body: JSON.stringify({ hash: trackhash, type: 'track' }),
    }),
  logTrackPlayed: (trackhash: string, duration: number, source: string = '') =>
    fetchApi('logger/track/log', {
      method: 'POST',
      body: JSON.stringify({
        trackhash,
        duration,
        timestamp: Math.floor(Date.now() / 1000),
        source,
      }),
    }).catch(() => {}), // Silently fail

  // Auth/Users
  createUser: (username: string, password: string) =>
    fetchApi('auth/profile/create', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  updatePlaylist: async (playlistId: number, name: string, imageUri?: string) => {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('settings', JSON.stringify({
      has_gif: false,
      banner_pos: 50,
      square_img: false,
      pinned: false
    }));

    if (imageUri) {
      const filename = imageUri.split('/').pop() || 'cover.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;
      formData.append('image', {
        uri: Platform.OS === 'ios' ? imageUri.replace('file://', '') : imageUri,
        name: filename,
        type,
      } as any);
    }

    const baseUrl = await getBase();
    const accessToken = await getToken();
    const url = `${baseUrl}playlists/${playlistId}/update`;

    const headers: Record<string, string> = {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      'Content-Type': 'multipart/form-data',
    };

    const response = await fetch(url, {
      method: 'PUT',
      body: formData,
      headers,
    });

    if (!response.ok) {
      let errBody = '';
      try {
        errBody = await response.text();
      } catch {}
      console.error(`API Error ${response.status} on ${url}:`, errBody);
      const errorObj = new Error(`API Error: ${response.status}`);
      (errorObj as any).status = response.status;
      (errorObj as any).body = errBody;
      throw errorObj;
    }
    return response.json();
  },
};
