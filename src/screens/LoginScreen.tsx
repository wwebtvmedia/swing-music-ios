import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Animated, Keyboard,
  ScrollView, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { fetchServerUsers, loginUser, normalizeUrl, ServerUser } from '../api/auth';

const { width: W } = Dimensions.get('window');

// ─── Avatar gradient palettes (same as Android) ─────────────────────────────
const PALETTES: [string, string, string][] = [
  ['#FB923C', '#EC4899', '#A855F7'],
  ['#3B82F6', '#A855F7', '#EC4899'],
  ['#A855F7', '#EC4899', '#F472B6'],
  ['#10B981', '#3B82F6', '#A855F7'],
  ['#EF4444', '#FB923C', '#EC4899'],
  ['#14B8A6', '#22D3EE', '#3B82F6'],
  ['#FACC15', '#FB923C', '#EF4444'],
  ['#8B5CF6', '#EC4899', '#FB923C'],
];
function paletteFor(name: string): [string, string, string] {
  const hash = Math.abs(name.split('').reduce((a, c) => a + c.charCodeAt(0), 0));
  return PALETTES[hash % PALETTES.length];
}

type Step = 'url' | 'picker' | 'password';

export default function LoginScreen() {
  const { login } = useAuth();

  const [step, setStep] = useState<Step>('url');
  const [url, setUrl] = useState('');
  const [users, setUsers] = useState<ServerUser[]>([]);
  const [pickedUser, setPickedUser] = useState<ServerUser | null>(null);
  const [password, setPassword] = useState('');
  const [pwVisible, setPwVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const slideAnim = useRef(new Animated.Value(0)).current;

  // Animate to next step
  const animateTo = (nextStep: Step) => {
    const dir = nextStep === 'url' ? -1 : 1;
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: -W * dir * 0.08, duration: 160, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
    setStep(nextStep);
  };

  // Step 1: Connect to server
  const handleContinue = async () => {
    if (!url.trim()) { setError('Please enter a server URL'); return; }
    setError('');
    setLoading(true);
    Keyboard.dismiss();
    try {
      const normalized = normalizeUrl(url.trim());
      const fetched = await fetchServerUsers(normalized);
      setUrl(normalized);
      setUsers(fetched);
      animateTo('picker');
    } catch (e: any) {
      setError(e.message || 'Could not reach server');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Pick a user
  const handlePickUser = (user: ServerUser) => {
    setPickedUser(user);
    setPassword('');
    setError('');
    animateTo('password');
  };

  // Step 3: Login with password
  const handleLogin = async () => {
    if (!password.trim()) { setError('Please enter your password'); return; }
    setError('');
    setLoading(true);
    Keyboard.dismiss();
    try {
      const result = await loginUser(url, pickedUser!.username, password);
      if (result?.accessToken) {
        await login(result.accessToken, url, pickedUser!.username);
      } else {
        setError('Invalid response from server');
      }
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Back handler
  const handleBack = () => {
    setError('');
    if (step === 'password') { animateTo('picker'); }
    else if (step === 'picker') { setUsers([]); animateTo('url'); }
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        {step !== 'url' && (
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <Ionicons name="chevron-back" size={28} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        )}

        {/* Logo */}
        <View style={styles.logoRow}>
          <View style={styles.logoIcon}>
            <Ionicons name="musical-notes" size={28} color="#1DB954" />
          </View>
          <Text style={styles.logoText}>Swing Music</Text>
        </View>

        <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
          {/* ──────────────── STEP 1: URL ──────────────── */}
          {step === 'url' && (
            <View style={styles.pane}>
              <Text style={styles.paneTitle}>Connect to server</Text>
              <Text style={styles.paneSub}>Enter the URL of your Swing Music server</Text>

              <View style={styles.inputRow}>
                <Ionicons name="globe-outline" size={20} color="rgba(255,255,255,0.4)" style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.textInput}
                  placeholder="http://192.168.1.x:1970"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={url}
                  onChangeText={t => { setUrl(t); setError(''); }}
                  autoCapitalize="none"
                  keyboardType="url"
                  returnKeyType="go"
                  onSubmitEditing={handleContinue}
                  autoFocus
                />
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.btnDisabled]}
                onPress={handleContinue}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>Continue</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ──────────────── STEP 2: USER PICKER ──────────────── */}
          {step === 'picker' && (
            <View style={styles.pane}>
              <Text style={styles.paneTitle}>Welcome back</Text>
              <Text style={styles.paneSub} numberOfLines={1}>{url.replace(/\/$/, '')}</Text>

              {/* Users grid – 3 per row, avatar + name */}
              <View style={styles.usersGrid}>
                {users.map(user => {
                  const colors = paletteFor(user.username);
                  const initials = (user.firstname?.[0] || user.username[0] || '?').toUpperCase();
                  return (
                    <TouchableOpacity
                      key={user.id || user.username}
                      style={styles.userTile}
                      onPress={() => handlePickUser(user)}
                      activeOpacity={0.75}
                    >
                      <LinearGradient
                        colors={colors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.userAvatar}
                      >
                        <Text style={styles.userInitial}>{initials}</Text>
                      </LinearGradient>
                      <Text style={styles.userName} numberOfLines={1}>
                        {user.firstname && user.lastname
                          ? `${user.firstname} ${user.lastname}`
                          : user.username}
                      </Text>
                      <Text style={styles.userHandle} numberOfLines={1}>@{user.username}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {users.length === 0 && (
                <Text style={styles.emptySub}>No users found on this server</Text>
              )}

              <TouchableOpacity onPress={() => { setUsers([]); animateTo('url'); }}>
                <Text style={styles.linkText}>Use a different server</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ──────────────── STEP 3: PASSWORD ──────────────── */}
          {step === 'password' && pickedUser && (
            <View style={styles.pane}>
              {/* User avatar */}
              <LinearGradient
                colors={paletteFor(pickedUser.username)}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.bigAvatar}
              >
                <Text style={styles.bigInitial}>
                  {(pickedUser.firstname?.[0] || pickedUser.username[0] || '?').toUpperCase()}
                </Text>
              </LinearGradient>

              <Text style={styles.paneTitle}>
                {pickedUser.firstname && pickedUser.lastname
                  ? `${pickedUser.firstname} ${pickedUser.lastname}`
                  : pickedUser.username}
              </Text>
              <Text style={styles.paneSub}>{url.replace(/\/$/, '')}</Text>

              {/* Password input */}
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={20} color="rgba(255,255,255,0.4)" style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Password"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={password}
                  onChangeText={t => { setPassword(t); setError(''); }}
                  secureTextEntry={!pwVisible}
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                  autoFocus
                />
                <TouchableOpacity onPress={() => setPwVisible(!pwVisible)}>
                  <Ionicons
                    name={pwVisible ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="rgba(255,255,255,0.45)"
                  />
                </TouchableOpacity>
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.btnDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>Log in</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => { setPickedUser(null); animateTo('picker'); }}>
                <Text style={styles.linkText}>Choose another user</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#121212' },
  scroll: { flexGrow: 1, alignItems: 'center', paddingTop: 60, paddingBottom: 40 },

  backBtn: { position: 'absolute', top: 8, left: 16, zIndex: 10, padding: 8 },

  logoRow: { alignItems: 'center', marginBottom: 48 },
  logoIcon: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(29,185,84,0.15)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  logoText: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '600', letterSpacing: 1 },

  pane: { width: W * 0.88, alignItems: 'center' },

  paneTitle: { color: '#fff', fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 6 },
  paneSub: { color: 'rgba(255,255,255,0.45)', fontSize: 13, textAlign: 'center', marginBottom: 32, maxWidth: 280 },

  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#2A2A2A', borderRadius: 50,
    paddingHorizontal: 20, height: 54,
    width: '100%', marginBottom: 14,
  },
  textInput: { flex: 1, color: '#fff', fontSize: 15 },

  errorText: { color: '#EF4444', fontSize: 13, textAlign: 'center', marginBottom: 12, fontWeight: '500' },

  primaryBtn: {
    backgroundColor: '#1DB954', borderRadius: 50,
    height: 54, width: '100%',
    justifyContent: 'center', alignItems: 'center',
    marginTop: 4, marginBottom: 20,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },

  linkText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 4, textDecorationLine: 'underline' },

  // Users grid
  usersGrid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    gap: 16, marginBottom: 32,
  },
  userTile: { width: 96, alignItems: 'center' },
  userAvatar: {
    width: 88, height: 88, borderRadius: 44,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  userInitial: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  userName: { color: '#fff', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  userHandle: { color: 'rgba(255,255,255,0.45)', fontSize: 11, textAlign: 'center', marginTop: 2 },

  emptySub: { color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 24 },

  // Password step
  bigAvatar: {
    width: 96, height: 96, borderRadius: 48,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  bigInitial: { color: '#fff', fontSize: 38, fontWeight: 'bold' },
});
