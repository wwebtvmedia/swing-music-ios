import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { api, getImgUrl } from '../api/client';
import { Album } from '../types';
import { useAuth } from '../context/AuthContext';

const { width: W } = Dimensions.get('window');
const ITEM_W = (W - 48) / 2;

export default function AlbumsScreen() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const { baseUrl } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const PAGE = 30;

  const loadAlbums = async (reset = false) => {
    const start = reset ? 0 : page * PAGE;
    try {
      const res = await api.getAllAlbums(PAGE, start);
      const list: Album[] = res.items || res.albums || [];
      if (reset) {
        setAlbums(list);
        setPage(1);
      } else {
        setAlbums(prev => [...prev, ...list]);
        setPage(p => p + 1);
      }
      setHasMore(list.length === PAGE);
    } catch (e) {
      console.error('Albums fetch error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAlbums(true); }, []);

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
        <Text style={styles.headerTitle}>Albums</Text>
        <View style={{ width: 28 }} />
      </View>

      <FlatList
        data={albums}
        keyExtractor={(item, i) => item.albumhash || `${i}`}
        numColumns={2}
        columnWrapperStyle={{ gap: 16, marginBottom: 24 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        onEndReached={() => hasMore && loadAlbums()}
        onEndReachedThreshold={0.3}
        renderItem={({ item }) => (
          <View style={{ width: ITEM_W }}>
            {item.image ? (
              <Image source={{ uri: thumb(item.image) }} style={styles.art} />
            ) : (
              <View style={[styles.art, { backgroundColor: '#282828', justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="disc" size={40} color="#535353" />
              </View>
            )}
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.sub} numberOfLines={1}>
              {item.albumartists?.map(a => a.name).join(', ') || ''}
              {item.year ? ` • ${item.year}` : ''}
            </Text>
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
  art: { width: ITEM_W, height: ITEM_W, borderRadius: 4 },
  title: { color: '#fff', fontSize: 14, fontWeight: '600', marginTop: 8 },
  sub: { color: '#b3b3b3', fontSize: 12, marginTop: 2 },
});
