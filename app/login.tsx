import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Animated,
  Dimensions, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { API_BASE } from '../config/api';
import { storage } from './_layout';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const router   = useRouter();
  const [pw, setPw]        = useState('');
  const [err, setErr]      = useState('');
  const [loading, setLoad] = useState(false);
  const [checking, setChecking] = useState(true);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const heartBeat = useRef(new Animated.Value(1)).current;

  // Zaten giriş yapılmışsa direkt gallery'e gönder
  useEffect(() => {
    (async () => {
      const role = await storage.getItem('role');
      if (role) {
        router.replace('/gallery');
      } else {
        setChecking(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (checking) return;
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 1200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 900,  useNativeDriver: true, delay: 200 }),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(heartBeat, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(heartBeat, { toValue: 1,    duration: 600, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [checking]);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8,   duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleLogin = async () => {
    if (!pw.trim()) return;
    setLoad(true);
    setErr('');
    try {
      const res  = await fetch(`${API_BASE}/api/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password: pw }),
      });
      const data = await res.json();
      if (res.ok) {
        await storage.setItem('role', data.role);
        router.replace('/gallery');
      } else {
        throw new Error(data.detail || 'Hatalı şifre 💔');
      }
    } catch (e: any) {
      if (pw === '280126') {
        await storage.setItem('role', 'user');
        router.replace('/gallery');
      } else if (pw === 'ec280126') {
        await storage.setItem('role', 'admin');
        router.replace('/gallery');
      } else {
        setErr('Yanlış şifre şapşal tavşan! 🐰');
        setPw('');
        shake();
      }
    } finally {
      setLoad(false);
    }
  };

  if (checking) return <View style={{ flex: 1, backgroundColor: '#fff0f3' }} />;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#ff8fa3', '#ffb3c1', '#ffd6e0', '#fff0f3']}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      {[...Array(8)].map((_, i) => (
        <View key={i} style={[styles.petal, {
          top:   Math.sin(i * 137.5) * height * 0.4 + height * 0.4,
          left:  (i / 8) * width,
          opacity: 0.12 + (i % 3) * 0.06,
          width:  20 + (i % 4) * 18,
          height: 20 + (i % 4) * 18,
        }]} />
      ))}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.inner}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], alignItems: 'center' }}>
          <Animated.Text style={[styles.heart, { transform: [{ scale: heartBeat }] }]}>🐰</Animated.Text>
          <Text style={styles.title}>Şapşal Tavşan</Text>
          <Text style={styles.subtitle}>Our little secret world 🌸</Text>
          <Animated.View style={[styles.card, { transform: [{ translateX: shakeAnim }] }]}>
            <Text style={styles.cardLabel}>Enter your secret key</Text>
            <TextInput
              style={styles.input}
              value={pw}
              onChangeText={setPw}
              placeholder="••••••"
              placeholderTextColor="#ffb3c1"
              secureTextEntry
              autoCapitalize="none"
              onSubmitEditing={handleLogin}
              returnKeyType="go"
            />
            {!!err && <Text style={styles.error}>{err}</Text>}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient colors={['#ff8fa3', '#ff6b8a']} style={styles.buttonGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.buttonText}>{loading ? 'Opening...' : 'Open our album ✨'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
          <Text style={styles.hint}>Made with love, just for you 💕</Text>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#fff0f3' },
  inner:          { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  petal:          { position: 'absolute', borderRadius: 999, backgroundColor: '#ff8fa3' },
  heart:          { fontSize: 64, marginBottom: 12 },
  title:          { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 34, color: '#c9184a', fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  subtitle:       { fontSize: 15, color: '#ff6b8a', marginBottom: 32, fontStyle: 'italic', letterSpacing: 0.5 },
  card:           { backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 24, padding: 28, width: Math.min(width - 48, 380), shadowColor: '#ff8fa3', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 },
  cardLabel:      { fontSize: 13, color: '#ff6b8a', textAlign: 'center', marginBottom: 14, letterSpacing: 1, textTransform: 'uppercase' },
  input:          { borderWidth: 1.5, borderColor: '#ffb3c1', borderRadius: 14, padding: 14, fontSize: 20, color: '#c9184a', textAlign: 'center', backgroundColor: '#fff8f9', letterSpacing: 6 },
  error:          { color: '#e63946', fontSize: 13, textAlign: 'center', marginTop: 10 },
  button:         { marginTop: 18, borderRadius: 14, overflow: 'hidden' },
  buttonDisabled: { opacity: 0.6 },
  buttonGrad:     { paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  buttonText:     { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.5 },
  hint:           { marginTop: 28, fontSize: 13, color: '#ff8fa3', fontStyle: 'italic' },
});
