import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { api, getImgUrl } from '../api/client';
import { Artist } from '../types';
import { useAuth } from '../context/AuthContext';

export default function ArtistsScreen() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const { baseUrl } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const PAGE = 40;

  const loadArtists = async (reset = false) => {
    const start = reset ? 0 : page * PAGE;
    try {
      const res = await api.getAllArtists(PAGE, start);
      const list: Artist[] = res.items || res.artists || [];
      if (reset) {
        setArtists(list);
        setPage(1);
      } else {
        setArtists(prev => [...prev, ...list]);
        setPage(p => p + 1);
      }
      setHasMore(list.length === PAGE);
    } catch (e) {
      console.error('Artists fetch error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadArtists(true); }, []);

  const thumb = (path?: string) => getImgUrl(baseUrl, path, 'medium');

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Artists</Text>
        <View style={{ width: 28 }} />
      </View>

      <FlatList
        data={artists}
        keyExtractor={(item, i) => item.artisthash || `${i}`}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        onEndReached={() => hasMore && loadArtists()}
        onEndReachedThreshold={0.3}
        renderItem={({ item }) => (
          <View style={styles.row}>
            {item.image ? (
              <Image source={{ uri: thumb(item.image) }} style={styles.circle} />
            ) : (
              <View style={[styles.circle, { backgroundColor: '#282828', justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="person" size={26} color="#535353" />
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.sub}>Artist</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16,
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  circle: { width: 56, height: 56, borderRadius: 28 },
  name: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sub: { color: '#b3b3b3', fontSize: 13, marginTop: 2 },
});
