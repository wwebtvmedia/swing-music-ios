import React, { createContext, useState, useEffect, useContext } from 'react';
import * as SecureStore from 'expo-secure-store';

interface AuthContextType {
  accessToken: string | null;
  baseUrl: string | null;
  username: string;
  isLoading: boolean;
  login: (token: string, url: string, username?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  accessToken: null,
  baseUrl: null,
  username: '',
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load tokens when app starts
    const bootstrapAsync = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync('accessToken');
        const storedBaseUrl = await SecureStore.getItemAsync('baseUrl');
        const storedUsername = await SecureStore.getItemAsync('username');

        if (storedToken && storedBaseUrl) {
          setAccessToken(storedToken);
          setBaseUrl(storedBaseUrl);
          setUsername(storedUsername || '');
        }
      } catch (e) {
        console.error('Restoring token failed', e);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrapAsync();
  }, []);

  const login = async (token: string, url: string, user?: string) => {
    try {
      await SecureStore.setItemAsync('accessToken', token);
      await SecureStore.setItemAsync('baseUrl', url);
      if (user) await SecureStore.setItemAsync('username', user);
      setAccessToken(token);
      setBaseUrl(url);
      if (user) setUsername(user);
    } catch (e) {
      console.error('Storing token failed', e);
    }
  };

  const logout = async () => {
    try {
      await SecureStore.deleteItemAsync('accessToken');
      setAccessToken(null);
    } catch (e) {
      console.error('Deleting token failed', e);
    }
  };

  return (
    <AuthContext.Provider value={{ accessToken, baseUrl, username, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
