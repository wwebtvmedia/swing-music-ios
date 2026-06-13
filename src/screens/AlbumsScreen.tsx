import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions, Animated, Vibration,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { api, getImgUrl } from '../api/client';
import { Album } from '../types';
import { useAuth } from '../context/AuthContext';

const { width: W } = Dimensions.get('window');
const ITEM_W = (W - 48) / 2;

const SkeletonItem = ({ style }: { style: any }) => {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return <Animated.View style={[{ backgroundColor: '#282828' }, style, { opacity }]} />;
};

function SkeletonLoader({ insets }: { insets: any }) {
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <SkeletonItem style={{ width: 28, height: 28, borderRadius: 14 }} />
        <SkeletonItem style={{ width: 100, height: 22, borderRadius: 4 }} />
        <View style={{ width: 28 }} />
      </View>
      <View style={{ flex: 1, paddingHorizontal: 16 }}>
        <FlatList
          data={[1, 2, 3, 4, 5, 6]}
          numColumns={2}
          keyExtractor={(item) => String(item)}
          columnWrapperStyle={{ gap: 16, marginBottom: 24 }}
          renderItem={() => (
            <View style={{ width: ITEM_W }}>
              <SkeletonItem style={styles.art} />
              <SkeletonItem style={{ width: '70%', height: 14, borderRadius: 4, marginTop: 8 }} />
              <SkeletonItem style={{ width: '40%', height: 11, borderRadius: 4, marginTop: 4 }} />
            </View>
          )}
        />
      </View>
    </View>
  );
}

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
    return <SkeletonLoader insets={insets} />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            Vibration.vibrate(10);
            navigation.goBack();
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
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
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={8}
        renderItem={({ item }) => (
          <View style={{ width: ITEM_W }}>
            {item.image ? (
              <Image source={{ uri: thumb(item.image) }} style={styles.art} transition={150} />
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
