import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, Modal, TextInput, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { colors } from '../theme/colors';
import { api } from '../api/client';

const AVATAR_PALETTES = [
  ['#FB923C', '#EC4899', '#A855F7'],
  ['#3B82F6', '#A855F7', '#EC4899'],
  ['#A855F7', '#EC4899', '#F472B6'],
  ['#10B981', '#3B82F6', '#A855F7'],
  ['#EF4444', '#FB923C', '#EC4899'],
  ['#14B8A6', '#22D3EE', '#3B82F6'],
  ['#FACC15', '#FB923C', '#EF4444'],
  ['#8B5CF6', '#EC4899', '#FB923C'],
];
function getAvatarColors(name: string): [string, string, string] {
  const idx = Math.abs(name.charCodeAt(0) || 0) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[idx] as [string, string, string];
}

interface QuickAction { label: string; icon: any; color: string; onPress: () => void; }
interface SettingsRow  { title: string; sub: string; icon: any; color: string; onPress: () => void; }

export default function SettingsScreen() {
  const { logout, baseUrl, username } = useAuth();
  const { audioQuality, setAudioQuality } = usePlayer();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const displayName = username || 'Swing';
  const avatarColors = getAvatarColors(displayName);
  const serverUrl = (baseUrl || '').replace(/\/$/, '');

  const quickActions: QuickAction[] = [
    { label: 'Search',   icon: 'search',        color: '#3B82F6', onPress: () => navigation.navigate('Search') },
    { label: 'Stats',    icon: 'bar-chart',     color: '#14B8A6', onPress: () => navigation.navigate('Stats') },
    { label: 'History',  icon: 'time',          color: '#A855F7', onPress: () => navigation.navigate('History') },
    { label: 'Lyrics',   icon: 'text',          color: '#FB923C', onPress: () => navigation.navigate('Lyrics') },
  ];

  const librarySection: SettingsRow[] = [
    { title: 'Folders',  sub: 'Browse your music directories', icon: 'folder',      color: '#3B82F6', onPress: () => navigation.navigate('Folders') },
    { title: 'Albums',   sub: 'View all albums',               icon: 'disc',        color: '#A855F7', onPress: () => navigation.navigate('Albums') },
    { title: 'Artists',  sub: 'View all artists',              icon: 'person',      color: '#EC4899', onPress: () => navigation.navigate('Artists') },
    { title: 'Stats',    sub: 'Library statistics',            icon: 'bar-chart',   color: '#FACC15', onPress: () => navigation.navigate('Stats') },
  ];

  const audioSection: SettingsRow[] = [
    { title: 'Audio Quality', sub: `Streaming bitrate: ${audioQuality.toUpperCase()}`, icon: 'radio-outline', color: '#FB923C', onPress: () => {
        Alert.alert(
          'Select Audio Quality',
          'Choose streaming bitrate quality:',
          [
            { text: 'Low (96kbps)', onPress: () => setAudioQuality('low') },
            { text: 'Medium (192kbps)', onPress: () => setAudioQuality('medium') },
            { text: 'High (320kbps)', onPress: () => setAudioQuality('high') },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      }
    },
    { title: 'Lyrics',      sub: 'Synced & plain lyrics',    icon: 'text',          color: '#EC4899', onPress: () => navigation.navigate('Lyrics') },
    { title: 'History',     sub: 'Recently played tracks',   icon: 'time',          color: '#14B8A6', onPress: () => navigation.navigate('History') },
    { title: 'Now Playing', sub: 'Playback & audio',         icon: 'play-circle',   color: '#14B8A6', onPress: () => navigation.navigate('Player') },
  ];

  const [modalVisible, setModalVisible] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreateUser = () => {
    setNewUsername('');
    setNewPassword('');
    setModalVisible(true);
  };

  const submitCreateUser = async () => {
    if (!newUsername.trim() || !newPassword.trim()) {
      Alert.alert('Error', 'Please fill in both fields.');
      return;
    }
    setCreating(true);
    try {
      await api.createUser(newUsername.trim(), newPassword.trim());
      setModalVisible(false);
      Alert.alert('Success', `Profile for "${newUsername.trim()}" created successfully!`);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to create profile. Ensure you are an administrator.');
    } finally {
      setCreating(false);
    }
  };

  const accountSection: SettingsRow[] = [
    { title: 'Create Profile', sub: 'Create a new user on this server', icon: 'person-add-outline', color: '#10B981', onPress: handleCreateUser },
    { title: 'Log Out', sub: 'Sign out of your account', icon: 'log-out-outline', color: '#EF4444', onPress: logout },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Settings</Text>

        {/* ─── Hero Card ─── */}
        <View style={styles.heroCard}>
          <LinearGradient colors={avatarColors} style={styles.heroAvatar}>
            <Text style={styles.heroAvatarText}>{displayName[0]?.toUpperCase() || 'U'}</Text>
          </LinearGradient>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={styles.heroName}>{displayName}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.45)" />
        </View>

        {/* Server URL chip */}
        {serverUrl ? (
          <View style={styles.serverChip}>
            <View style={styles.greenDot} />
            <Text style={styles.serverUrl} numberOfLines={1}>{serverUrl}</Text>
          </View>
        ) : null}

        {/* ─── Quick Actions ─── */}
        <View style={styles.quickRow}>
          {quickActions.map(a => (
            <TouchableOpacity key={a.label} style={styles.quickItem} onPress={a.onPress}>
              <View style={[styles.quickIcon, { backgroundColor: `${a.color}28` }]}>
                <Ionicons name={a.icon} size={18} color={a.color} />
              </View>
              <Text style={styles.quickLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ─── Library Section ─── */}
        <Text style={styles.sectionLabel}>LIBRARY</Text>
        <GroupedCard items={librarySection} />

        {/* ─── Audio Section ─── */}
        <Text style={styles.sectionLabel}>AUDIO</Text>
        <GroupedCard items={audioSection} />

        {/* ─── Account Section ─── */}
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <GroupedCard items={accountSection} />

        {/* App version */}
        <Text style={styles.version}>Swing Music v1.0.0</Text>
      </ScrollView>

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Create Profile</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Username"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={newUsername}
              onChangeText={setNewUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              style={styles.modalInput}
              placeholder="Password"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setModalVisible(false)}
                disabled={creating}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={submitCreateUser}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.modalButtonText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function GroupedCard({ items }: { items: SettingsRow[] }) {
  return (
    <View style={styles.card}>
      {items.map((item, idx) => (
        <React.Fragment key={item.title}>
          <TouchableOpacity style={styles.settingsRow} onPress={item.onPress} activeOpacity={0.7}>
            <View style={[styles.rowIcon, { backgroundColor: `${item.color}28` }]}>
              <Ionicons name={item.icon} size={20} color={item.color} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowSub}>{item.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.35)" />
          </TouchableOpacity>
          {idx < items.length - 1 && <View style={styles.divider} />}
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  pageTitle: { color: '#fff', fontSize: 32, fontWeight: 'bold', paddingHorizontal: 16, marginBottom: 20 },

  heroCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: '#1a1a1a', borderRadius: 20, padding: 16,
  },
  heroAvatar: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  heroAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: 28 },
  heroName: { color: '#fff', fontWeight: 'bold', fontSize: 20 },

  serverChip: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 24,
    backgroundColor: '#1a1a1a', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1DB954', marginRight: 10 },
  serverUrl: { color: 'rgba(255,255,255,0.8)', fontSize: 12, flex: 1 },

  quickRow: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 24, gap: 8,
  },
  quickItem: {
    flex: 1, backgroundColor: '#1a1a1a', borderRadius: 20,
    paddingVertical: 14, alignItems: 'center', gap: 6,
  },
  quickIcon: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  quickLabel: { color: '#fff', fontSize: 11, fontWeight: '500' },

  sectionLabel: {
    color: '#b3b3b3', fontSize: 11, fontWeight: 'bold', letterSpacing: 1,
    marginHorizontal: 16, marginBottom: 8, marginTop: 4,
  },
  card: {
    marginHorizontal: 16, marginBottom: 20,
    backgroundColor: '#1a1a1a', borderRadius: 20, overflow: 'hidden',
  },
  settingsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  rowIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  rowTitle: { color: '#fff', fontWeight: '600', fontSize: 15 },
  rowSub: { color: '#b3b3b3', fontSize: 12, marginTop: 1 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginLeft: 70 },

  version: { color: '#535353', fontSize: 12, textAlign: 'center', marginTop: 8 },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#1e1e1e',
    borderRadius: 20,
    padding: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#282828',
    borderRadius: 10,
    color: '#fff',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: 'bold',
  },
  modalButtonTextCancel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
