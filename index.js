import { registerRootComponent } from 'expo';
import TrackPlayer from 'react-native-track-player';
import App from './App';
// Register the main app component
registerRootComponent(App);

// Register the background playback service
TrackPlayer.registerPlaybackService(() => require('./service'));
