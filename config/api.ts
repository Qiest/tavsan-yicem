import { Platform } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// EN GÜNCEL RENDER URL: Uygulaman artık bu adrese bağlı.
// ─────────────────────────────────────────────────────────────────────────────
export const API_BASE = 'https://tilkiseviyortavsan-1-2.onrender.com'; 

export const mediaUrl = (fileId: string) => `${API_BASE}/api/media/${fileId}`;