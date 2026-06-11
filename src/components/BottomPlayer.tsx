import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';

export default function BottomPlayer() {
  const { currentTrack, isPlaying, togglePlay, position, duration } = usePlayer();
  const { baseUrl } = useAuth();

  if (!currentTrack) {
    return null;
  }

  const getImageUrl = (path?: string) => {
    if (!path) return undefined;
    if (path.startsWith('http')) return path;
    const sanitizedBaseUrl = baseUrl?.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${sanitizedBaseUrl}/img/thumbnail/${path}`;
  };

  const progress = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <View style={styles.container}>
      <View style={styles.innerContainer}>
        {currentTrack.image ? (
          <Image source={{ uri: getImageUrl(currentTrack.image) }} style={styles.albumArt} />
        ) : (
          <View style={styles.albumArt} />
        )}
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>{currentTrack.title}</Text>
          <Text style={styles.artist} numberOfLines={1}>
            {Array.isArray(currentTrack.artists)
              ? currentTrack.artists.map(a => a?.name).filter(Boolean).join(', ')
              : (currentTrack.artist || 'Unknown Artist')}
          </Text>
        </View>
        <TouchableOpacity style={styles.iconButton}>
          <Ionicons name="heart-outline" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={togglePlay}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={26} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>
      <View style={styles.progressBarBackground}>
        <View style={[styles.progressBarFill, { width: `${progress}%` as any }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#282828',
    borderRadius: 8,
    marginHorizontal: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  innerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  albumArt: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: '#535353',
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  artist: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  iconButton: {
    padding: 8,
    marginLeft: 4,
  },
  progressBarBackground: {
    height: 2,
    backgroundColor: '#404040',
    width: '100%',
  },
  progressBarFill: {
    height: 2,
    backgroundColor: colors.primary,
  },
});
