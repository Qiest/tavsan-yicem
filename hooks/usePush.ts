import { useEffect } from 'react';
import { Platform } from 'react-native';
import { API_BASE } from '../config/api';
import { storage } from '../app/_layout';

export async function registerPush(role: string) {
  if (Platform.OS !== 'web') return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    // VAPID public key al
    const res = await fetch(`${API_BASE}/api/push/vapid-public-key`);
    const { publicKey } = await res.json();

    // Service worker kaydet
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    // İzin iste
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    // Push subscription oluştur
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    // Backend'e kaydet
    await fetch(`${API_BASE}/api/push/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription, role }),
    });
  } catch (e) {
    console.log('Push register error:', e);
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
