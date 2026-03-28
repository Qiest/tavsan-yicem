import { API_BASE } from '../config/api';

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

// Bu fonksiyon MUTLAKA bir buton tıklamasından çağrılmalı.
// useEffect içinde çağrılırsa Safari izin popup'ı göstermez.
export async function registerPush(role: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push desteklenmiyor');
    return false;
  }

  try {
    // VAPID public key al
    const res = await fetch(`${API_BASE}/api/push/vapid-public-key`);
    const { publicKey } = await res.json();

    // Service worker kaydet
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    // Mevcut subscription var mı kontrol et
    let subscription = await reg.pushManager.getSubscription();

    if (!subscription) {
      // Yoksa yeni oluştur — bu satır Safari'de popup açar,
      // o yüzden mutlaka kullanıcı tap'inden sonra çağrılmalı
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    // Backend'e kaydet
    await fetch(`${API_BASE}/api/push/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription, role }),
    });

    return true;
  } catch (e) {
    console.log('Push register error:', e);
    return false;
  }
}
