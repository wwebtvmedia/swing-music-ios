import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, RefreshControl, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { api, getImgUrl } from '../api/client';
import { Track } from '../types';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';

export default function HistoryScreen() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { baseUrl } = useAuth();
  const { playTrack } = usePlayer();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const fetchData = useCallback(async () => {
    try {
      const res = await api.getRecentlyPlayedTracks(100);
      const trackArray = Array.isArray(res) ? res : (res?.tracks || res?.items || []);
      setTracks(trackArray);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const thumb = (path?: string) => getImgUrl(baseUrl, path, 'medium');

  const handlePlay = async (track: Track) => {
    await playTrack(track, tracks);
    navigation.navigate('Player');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>History</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Section header card */}
      <View style={styles.heroCard}>
        <View style={[styles.heroIcon, { backgroundColor: 'rgba(59,130,246,0.18)' }]}>
          <Ionicons name="time" size={24} color={colors.primary} />
        </View>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={styles.heroTitle}>Listening History</Text>
          <Text style={styles.heroSub}>Recently played tracks</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(item, i) => item.trackhash || `${i}`}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="time-outline" size={48} color={colors.primary} />
              <Text style={styles.emptyTitle}>No history yet</Text>
              <Text style={styles.emptySub}>Start listening to build your history</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.trackRow} onPress={() => handlePlay(item)} activeOpacity={0.7}>
              {item.image ? (
                <Image source={{ uri: thumb(item.image) }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]}>
                  <Ionicons name="musical-note" size={18} color="#535353" />
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.trackTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.trackSub} numberOfLines={1}>
                  {item.artists?.map(a => a.name).join(', ') || item.album || ''}
                </Text>
              </View>
              <Ionicons name="ellipsis-vertical" size={18} color="#535353" />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  heroCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 20,
    backgroundColor: '#1a1a1a', borderRadius: 16,
    padding: 16,
  },
  heroIcon: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  heroTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  heroSub: { color: '#b3b3b3', fontSize: 13, marginTop: 2 },
  trackRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a1a1a', borderRadius: 10,
    padding: 10, marginBottom: 8,
  },
  thumb: { width: 48, height: 48, borderRadius: 8 },
  thumbPlaceholder: { backgroundColor: '#282828', justifyContent: 'center', alignItems: 'center' },
  trackTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  trackSub: { color: '#b3b3b3', fontSize: 12, marginTop: 2 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 16 },
  emptySub: { color: '#b3b3b3', fontSize: 14, marginTop: 8 },
});
