import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import LibraryScreen from '../screens/LibraryScreen';
import PlayerScreen from '../screens/PlayerScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import PlaylistDetailScreen from '../screens/PlaylistDetailScreen';
import QueueScreen from '../screens/QueueScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ArtistsScreen from '../screens/ArtistsScreen';
import AlbumsScreen from '../screens/AlbumsScreen';
import LyricsScreen from '../screens/LyricsScreen';
import HistoryScreen from '../screens/HistoryScreen';
import FoldersScreen from '../screens/FoldersScreen';
import StatsScreen from '../screens/StatsScreen';

import { colors } from '../theme/colors';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Stack for the Home Tab
const HomeStack = createNativeStackNavigator();
function HomeNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeRoot" component={HomeScreen} />
      <HomeStack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} />
      <HomeStack.Screen name="Settings" component={SettingsScreen} />
      <HomeStack.Screen name="Artists" component={ArtistsScreen} />
      <HomeStack.Screen name="Albums" component={AlbumsScreen} />
      <HomeStack.Screen name="History" component={HistoryScreen} />
      <HomeStack.Screen name="Folders" component={FoldersScreen} />
      <HomeStack.Screen name="Stats" component={StatsScreen} />
      <HomeStack.Screen name="Favorites" component={FavoritesScreen} />
    </HomeStack.Navigator>
  );
}

// Stack for the Search Tab
const SearchStack = createNativeStackNavigator();
function SearchNavigator() {
  return (
    <SearchStack.Navigator screenOptions={{ headerShown: false }}>
      <SearchStack.Screen name="SearchRoot" component={SearchScreen} />
      <SearchStack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} />
      <SearchStack.Screen name="Settings" component={SettingsScreen} />
      <SearchStack.Screen name="Artists" component={ArtistsScreen} />
      <SearchStack.Screen name="Albums" component={AlbumsScreen} />
      <SearchStack.Screen name="History" component={HistoryScreen} />
      <SearchStack.Screen name="Folders" component={FoldersScreen} />
      <SearchStack.Screen name="Stats" component={StatsScreen} />
      <SearchStack.Screen name="Favorites" component={FavoritesScreen} />
    </SearchStack.Navigator>
  );
}

// Stack for the Library Tab
const LibraryStack = createNativeStackNavigator();
function LibraryNavigator() {
  return (
    <LibraryStack.Navigator screenOptions={{ headerShown: false }}>
      <LibraryStack.Screen name="LibraryRoot" component={LibraryScreen} />
      <LibraryStack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} />
      <LibraryStack.Screen name="Settings" component={SettingsScreen} />
      <LibraryStack.Screen name="Artists" component={ArtistsScreen} />
      <LibraryStack.Screen name="Albums" component={AlbumsScreen} />
      <LibraryStack.Screen name="History" component={HistoryScreen} />
      <LibraryStack.Screen name="Folders" component={FoldersScreen} />
      <LibraryStack.Screen name="Stats" component={StatsScreen} />
      <LibraryStack.Screen name="Favorites" component={FavoritesScreen} />
    </LibraryStack.Navigator>
  );
}

function HomeTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const iconMap: Record<string, { active: any; inactive: any }> = {
            Home:    { active: 'home',    inactive: 'home-outline' },
            Search:  { active: 'search',  inactive: 'search-outline' },
            Library: { active: 'library', inactive: 'library-outline' },
          };
          const icons = iconMap[route.name] || { active: 'help-circle', inactive: 'help-circle-outline' };
          return <Ionicons name={focused ? icons.active : icons.inactive} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.bottomNavActive,
        tabBarInactiveTintColor: colors.bottomNavInactive,
        tabBarStyle: {
          backgroundColor: colors.bottomNavBackground,
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const },
      })}
    >
      <Tab.Screen name="Home" component={HomeNavigator} />
      <Tab.Screen name="Search" component={SearchNavigator} />
      <Tab.Screen name="Library" component={LibraryNavigator} />
    </Tab.Navigator>
  );
}

export default function BottomTabNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* Root tabs containing nested stacks */}
      <Stack.Screen name="MainTabs" component={HomeTabs} />

      {/* ─── Modals (slide from bottom) ─── */}
      <Stack.Screen name="Player" component={PlayerScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="Queue" component={QueueScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="Lyrics" component={LyricsScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack.Navigator>
  );
}
