import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Vibration,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { getImgUrl } from '../api/client';
import { Track } from '../types';

export default function QueueScreen() {
  const { queue, queueIndex, currentTrack, playTrack } = usePlayer();
  const { baseUrl } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const thumb = (path?: string) => getImgUrl(baseUrl, path, 'medium');

  const nextUpData = queue.slice(queueIndex + 1);

  const ListHeader = () => (
    <>
      {/* Now Playing */}
      <Text style={styles.sectionLabel}>NOW PLAYING</Text>
      {currentTrack && (
        <View style={[styles.trackRow, styles.nowPlaying]}>
          {currentTrack.image ? (
            <Image
              source={{ uri: thumb(currentTrack.image) }}
              style={styles.thumb}
              transition={150}
            />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder]}>
              <Ionicons name="musical-note" size={18} color="#535353" />
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.trackTitle, { color: colors.primary }]} numberOfLines={1}>{currentTrack.title}</Text>
            <Text style={styles.trackSub} numberOfLines={1}>
              {Array.isArray(currentTrack.artists)
                ? currentTrack.artists.map(a => a?.name).filter(Boolean).join(', ')
                : (currentTrack.artist || '')}
            </Text>
          </View>
          <Ionicons name="volume-high" size={18} color={colors.primary} />
        </View>
      )}

      {nextUpData.length > 0 && (
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>NEXT UP</Text>
      )}
    </>
  );

  const renderTrackItem = ({ item: track, index }: { item: Track; index: number }) => (
    <TouchableOpacity
      style={styles.trackRow}
      onPress={() => {
        Vibration.vibrate(12);
        playTrack(track, queue);
        navigation.navigate('Player');
      }}
    >
      {track.image ? (
        <Image
          source={{ uri: thumb(track.image) }}
          style={styles.thumb}
          transition={150}
        />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Ionicons name="musical-note" size={18} color="#535353" />
        </View>
      )}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
        <Text style={styles.trackSub} numberOfLines={1}>
          {Array.isArray(track.artists)
            ? track.artists.map(a => a?.name).filter(Boolean).join(', ')
            : (track.artist || '')}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { Vibration.vibrate(10); navigation.goBack(); }}>
          <Ionicons name="chevron-down" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Queue</Text>
        <View style={{ width: 28 }} />
      </View>

      <FlatList
        data={nextUpData}
        keyExtractor={(item, index) => item.trackhash || String(index)}
        ListHeaderComponent={ListHeader}
        renderItem={renderTrackItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={10}
        ListEmptyComponent={
          nextUpData.length === 0 && !currentTrack ? (
            <Text style={styles.empty}>No songs in queue</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16,
  },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  list: { paddingHorizontal: 16, paddingBottom: 60 },
  sectionLabel: { color: '#b3b3b3', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 12 },
  nowPlaying: { backgroundColor: '#1a1a1a', borderRadius: 8, padding: 8 },
  trackRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  thumb: { width: 48, height: 48, borderRadius: 4 },
  thumbPlaceholder: { backgroundColor: '#282828', justifyContent: 'center', alignItems: 'center' },
  trackTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  trackSub: { color: '#b3b3b3', fontSize: 12, marginTop: 2 },
  empty: { color: '#b3b3b3', textAlign: 'center', marginTop: 60, fontSize: 15 },
});
