import 'react-native-url-polyfill/auto';
import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomTabNavigator from './src/navigation/BottomTabNavigator';
import BottomPlayer from './src/components/BottomPlayer';
import LoginScreen from './src/screens/LoginScreen';
import { View, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { PlayerProvider, usePlayer } from './src/context/PlayerContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from './src/theme/colors';
import { useState, useEffect } from 'react';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_BAR_HEIGHT = 49;
export const navigationRef = createNavigationContainerRef<any>();

function FloatingPlayer() {
  const { currentTrack } = usePlayer();
  const insets = useSafeAreaInsets();
  const [currentRouteName, setCurrentRouteName] = useState<string | null>(null);

  useEffect(() => {
    const checkState = () => {
      if (!navigationRef.isReady()) return;
      const state = navigationRef.getRootState();
      if (!state) return;
      let route = state.routes[state.index];
      while (route && route.state && typeof route.state.index === 'number') {
        route = (route.state.routes as any)[route.state.index];
      }
      setCurrentRouteName(route ? route.name : null);
    };

    checkState();

    const unsubscribe = navigationRef.addListener('state', checkState);
    return unsubscribe;
  }, []);

  if (!currentTrack) return null;

  // Hide the mini-player when Player, Lyrics, or Queue modals are open
  if (currentRouteName === 'Player' || currentRouteName === 'Lyrics' || currentRouteName === 'Queue') {
    return null;
  }

  // Position above the tab bar + safe area bottom padding
  const bottomOffset = TAB_BAR_HEIGHT + insets.bottom;

  return (
    <TouchableOpacity
      style={[styles.floatingPlayer, { bottom: bottomOffset }]}
      activeOpacity={0.95}
      onPress={() => {
        if (navigationRef.isReady()) {
          navigationRef.navigate('Player' as any);
        }
      }}
    >
      <BottomPlayer />
    </TouchableOpacity>
  );
}

function NavigationWrapper() {
  const { accessToken, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="light" />
      {accessToken ? (
        <View style={styles.appRoot}>
          <BottomTabNavigator />
          <FloatingPlayer />
        </View>
      ) : (
        <LoginScreen />
      )}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <PlayerProvider>
            <NavigationWrapper />
          </PlayerProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appRoot: {
    flex: 1,
    backgroundColor: '#000',
  },
  floatingPlayer: {
    position: 'absolute',
    bottom: 49,
    left: 0,
    right: 0,
  },
});
