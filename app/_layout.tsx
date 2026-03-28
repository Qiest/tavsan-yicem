import { useEffect, useRef } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';

// Web'de localStorage, native'de AsyncStorage kullan
export const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    return AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      await AsyncStorage.setItem(key, value);
    }
  },
  clear: async (): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.clear();
    } else {
      await AsyncStorage.clear();
    }
  },
};

export default function RootLayout() {
  const router      = useRouter();
  const appState    = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    // Native (iOS/Android): arka plana alınınca oturumu kapat
    if (Platform.OS !== 'web') {
      const sub = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
        if (
          appState.current === 'active' &&
          (nextState === 'background' || nextState === 'inactive')
        ) {
          await storage.clear();
        }
        appState.current = nextState;
      });
      return () => sub.remove();
    }

    // Web: sekme/pencere kapatılınca oturumu kapat
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        await storage.clear();
      }
    };

    // Web: tarayıcı kapanınca oturumu kapat
    const handleBeforeUnload = () => {
      localStorage.clear();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="login"   options={{ gestureEnabled: false }} />
      <Stack.Screen name="gallery" options={{ gestureEnabled: false }} />
      <Stack.Screen name="manage"  options={{ gestureEnabled: false }} />
    </Stack>
  );
}
