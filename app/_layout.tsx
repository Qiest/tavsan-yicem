import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';

// Web'de localStorage, native'de AsyncStorage kullan
export const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
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

// Layout sadece Stack tanımlıyor, yönlendirme her ekranda kendi içinde
export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="login"   options={{ gestureEnabled: false }} />
      <Stack.Screen name="gallery" options={{ gestureEnabled: false }} />
      <Stack.Screen name="manage"  options={{ gestureEnabled: false }} />
    </Stack>
  );
}
