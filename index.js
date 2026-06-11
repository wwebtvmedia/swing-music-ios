import { registerRootComponent } from 'expo';
import TrackPlayer from 'react-native-track-player';
import App from './App';
import { playbackService } from './service';

// Register the main app component
registerRootComponent(App);

// Register the background playback service
TrackPlayer.registerPlaybackService(() => playbackService);
