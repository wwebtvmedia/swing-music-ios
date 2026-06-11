export interface TrackArtist {
  artisthash: string;
  name: string;
  image?: string;
}

export interface Track {
  album?: string;
  albumartists?: TrackArtist[];
  albumhash?: string;
  artists?: TrackArtist[];
  artist?: string;
  bitrate?: number;
  duration?: number;
  filepath?: string;
  folder?: string;
  image?: string;
  is_favorite?: boolean;
  title?: string;
  trackhash?: string;
  disc?: number;
  track?: number;
}

export interface Artist {
  artisthash: string;
  name: string;
  image?: string;
  trackcount?: number;
  albumcount?: number;
  playcount?: number;
}

export interface Album {
  albumhash: string;
  title: string;
  albumartists: TrackArtist[];
  image?: string;
  year?: number;
  trackcount?: number;
  duration?: number;
}

export interface Playlist {
  id: number;
  name: string;
  image?: string;
  thumb?: string;
  trackcount?: number;
  count?: number;
}

export interface User {
  username: string;
  firstname?: string;
  lastname?: string;
  image?: string;
  roles?: string[];
}
