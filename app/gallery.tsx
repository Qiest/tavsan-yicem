import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Dimensions, RefreshControl, Modal, Image, Platform,
  StatusBar, Animated, TextInput, Linking, ScrollView,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useRouter } from 'expo-router';
import { storage } from './_layout';
import { LinearGradient } from 'expo-linear-gradient';
import { useLoveCounter } from '../hooks/useLoveCounter';
import { API_BASE, mediaUrl } from '../config/api';
import { registerPush } from '../hooks/usePush';
import * as ImagePicker from 'expo-image-picker';

// Spotify/YouTube linkinden embed URL üret
function getEmbedUrl(url: string): string | null {
  if (!url) return null;
  // Spotify track
  const spotifyMatch = url.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
  if (spotifyMatch) return `https://open.spotify.com/embed/track/${spotifyMatch[1]}`;
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  return null;
}

const { width } = Dimensions.get('window');
const CARD_GAP  = 10;
const NUM_COLS  = 2;
const CARD_SIZE = (width - 24 - CARD_GAP) / NUM_COLS;

interface Memory {
  id:       string;
  caption:  string;
  date:     string;
  fileId:   string;
  fileType: string;
}

interface Comment {
  id:        string;
  text:      string;
  role:      string;
  createdAt: string;
}

// ── Counter Widget ────────────────────────────────────────────────────────────
function CounterUnit({ value, label }: { value: number; label: string }) {
  return (
    <View style={cs.unit}>
      <Text style={cs.value}>{String(value).padStart(2, '0')}</Text>
      <Text style={cs.label}>{label}</Text>
    </View>
  );
}

function LoveHeader({
  role, onLogout, onManage, onEnableNotif, notifEnabled,
}: {
  role: string;
  onLogout: () => void;
  onManage: () => void;
  onEnableNotif: () => void;
  notifEnabled: boolean;
}) {
  const { days, hours, minutes, seconds } = useLoveCounter();
  const fadeIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeIn }}>
      <LinearGradient colors={['#ff6b8a', '#ffb3c1', '#ffd6e0']} style={cs.header}>
        <Text style={cs.headerTitle}>Tavşan 🐰</Text>
        <Text style={cs.headerPoem}>Every second with you is a memory I keep forever</Text>

        <View style={cs.counterRow}>
          <CounterUnit value={days}    label="days"    />
          <Text style={cs.sep}>:</Text>
          <CounterUnit value={hours}   label="hours"   />
          <Text style={cs.sep}>:</Text>
          <CounterUnit value={minutes} label="min"     />
          <Text style={cs.sep}>:</Text>
          <CounterUnit value={seconds} label="sec"     />
        </View>
        <Text style={cs.headerSub}>of us ❤️ since Jan 28, 2026</Text>

        <View style={cs.headerActions}>
          {role === 'admin' && (
            <TouchableOpacity style={cs.chip} onPress={onManage}>
              <Text style={cs.chipText}>✦ Manage</Text>
            </TouchableOpacity>
          )}
          {/* BİLDİRİM BUTONU — Safari için mutlaka buton tıklaması lazım */}
          {!notifEnabled && (
            <TouchableOpacity style={[cs.chip, cs.chipNotif]} onPress={onEnableNotif}>
              <Text style={cs.chipText}>🔔 Bildirimleri Aç</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[cs.chip, cs.chipGhost]} onPress={onLogout}>
            <Text style={[cs.chipText, { color: '#c9184a' }]}>Log out</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

// ── Memory Card ───────────────────────────────────────────────────────────────
function MemoryCard({ item, onPress }: { item: Memory; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn  = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true }).start();

  const dateLabel = item.date
    ? new Date(item.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={ms.card}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        <Image source={{ uri: mediaUrl(item.fileId) }} style={ms.thumb} resizeMode="cover" />
        {item.fileType === 'video' && (
          <View style={ms.playBadge}><Text style={ms.playIcon}>▶</Text></View>
        )}
        <LinearGradient colors={['transparent', 'rgba(201,24,74,0.75)']} style={ms.overlay} />
        {!!item.caption && (
          <Text style={ms.caption} numberOfLines={2}>{item.caption}</Text>
        )}
        {!!dateLabel && <Text style={ms.date}>{dateLabel}</Text>}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Full-screen Viewer ────────────────────────────────────────────────────────
function MediaViewer({ memory, role, onClose }: { memory: Memory | null; role: string; onClose: () => void }) {
  const [comments,    setComments]    = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [sending,     setSending]     = useState(false);

  useEffect(() => {
    if (memory) loadComments();
  }, [memory]);

  const loadComments = async () => {
    if (!memory) return;
    try {
      const res  = await fetch(`${API_BASE}/api/memories/${memory.id}/comments`);
      const data = await res.json();
      setComments(Array.isArray(data) ? data : []);
    } catch (e) {}
  };

  const handleSendComment = async () => {
    if (!commentText.trim() || !memory) return;
    setSending(true);
    try {
      await fetch(`${API_BASE}/api/memories/${memory.id}/comments`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text: commentText, role }),
      });
      setCommentText('');
      loadComments();
    } catch (e) {} finally { setSending(false); }
  };

  if (!memory) return null;
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={vw.container}>
        <TouchableOpacity style={vw.close} onPress={onClose}>
          <Text style={vw.closeText}>✕</Text>
        </TouchableOpacity>

        {memory.fileType === 'video' ? (
          <Video
            source={{ uri: mediaUrl(memory.fileId) }}
            style={vw.image}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay
          />
        ) : (
          <Image
            source={{ uri: mediaUrl(memory.fileId) }}
            style={vw.image}
            resizeMode="contain"
          />
        )}

        {!!memory.caption && (
          <View style={vw.captionBox}>
            <Text style={vw.captionText}>{memory.caption}</Text>
            {!!memory.date && (
              <Text style={vw.dateText}>
                {new Date(memory.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            )}
          </View>
        )}

        {/* Yorumlar */}
        <View style={vw.commentSection}>
          <ScrollView style={vw.commentList} keyboardShouldPersistTaps="handled">
            {comments.map(c => (
              <View key={c.id} style={[vw.commentBubble, c.role === role && vw.commentBubbleSelf]}>
                <Text style={vw.commentRole}>{c.role === 'admin' ? '🦊' : '🐰'}</Text>
                <Text style={vw.commentText}>{c.text}</Text>
                {role === 'admin' && (
                  Platform.OS === 'web' ? (
                    <button
                      onClick={async () => {
                        if (!window.confirm('Yorumu sil?')) return;
                        await fetch(`${API_BASE}/api/memories/${memory.id}/comments/${c.id}`, { method: 'DELETE' });
                        loadComments();
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'rgba(255,255,255,0.4)', padding: 4 }}
                    >✕</button>
                  ) : (
                    <TouchableOpacity onPress={async () => {
                      await fetch(`${API_BASE}/api/memories/${memory.id}/comments/${c.id}`, { method: 'DELETE' });
                      loadComments();
                    }}>
                      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>✕</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            ))}
          </ScrollView>
          <View style={vw.commentInput}>
            <TextInput
              style={vw.commentInputText}
              placeholder="Yorum yaz..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={commentText}
              onChangeText={setCommentText}
              onSubmitEditing={handleSendComment}
              returnKeyType="send"
            />
            <TouchableOpacity onPress={handleSendComment} disabled={sending} style={vw.commentSendBtn}>
              <Text style={vw.commentSendText}>{sending ? '...' : '↑'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Gallery Screen ────────────────────────────────────────────────────────────
export default function GalleryScreen() {
  const router = useRouter();
  const [role,           setRole]          = useState('user');
  const [memories,       setMemories]      = useState<Memory[]>([]);
  const [refreshing,     setRefresh]       = useState(false);
  const [selected,       setSelected]      = useState<Memory | null>(null);
  const [status,         setStatus]        = useState({ emoji: '🐰', text: '' });
  const [song,           setSong]          = useState({ url: '', title: '' });
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showSongModal,   setShowSongModal]   = useState(false);
  const [newEmoji,        setNewEmoji]     = useState('');
  const [newText,         setNewText]      = useState('');
  const [newSongUrl,      setNewSongUrl]   = useState('');
  const [newSongTitle,    setNewSongTitle] = useState('');
  // Bildirim izni verildi mi?
  const [notifEnabled,    setNotifEnabled] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile,      setUploadFile]   = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [uploadCaption,   setUploadCaption] = useState('');
  const [uploading,       setUploading]    = useState(false);

  useEffect(() => {
    (async () => {
      const r = await storage.getItem('role');
      if (!r) {
        router.replace('/login');
        return;
      }
      setRole(r);
      loadMemories();
      loadStatus();
      loadSong();

      // Bildirim zaten verilmişse butonu gizle
      if (Platform.OS === 'web' && 'Notification' in window) {
        setNotifEnabled(Notification.permission === 'granted');
      }
    })();
  }, []);

  // Kullanıcı "Bildirimleri Aç" butonuna tıkladığında çağrılır
  // Safari bu yüzden buton tıklamasına ihtiyaç duyar
  const handleEnableNotif = async () => {
    const success = await registerPush(role);
    if (success) setNotifEnabled(true);
  };

  const loadStatus = async () => {
    try {
      const res  = await fetch(`${API_BASE}/api/status`);
      const data = await res.json();
      setStatus({ emoji: data.emoji || '🐰', text: data.text || '' });
    } catch (e) {}
  };

  const loadSong = async () => {
    try {
      const res  = await fetch(`${API_BASE}/api/song`);
      const data = await res.json();
      setSong({ url: data.url || '', title: data.title || '' });
    } catch (e) {}
  };

  const handleSaveStatus = async () => {
    try {
      await fetch(`${API_BASE}/api/status`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ emoji: newEmoji || status.emoji, text: newText, role }),
      });
      setStatus({ emoji: newEmoji || status.emoji, text: newText });
      setShowStatusModal(false);
    } catch (e) {}
  };

  const handleSaveSong = async () => {
    if (!newSongUrl.trim()) return;
    try {
      await fetch(`${API_BASE}/api/song`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url: newSongUrl, title: newSongTitle, role }),
      });
      setSong({ url: newSongUrl, title: newSongTitle });
      setShowSongModal(false);
    } catch (e) {}
  };

  const handlePickUpload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets.length > 0) {
      setUploadFile(result.assets[0]);
    }
  };

  const handleUserUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const form = new FormData();
      const ext  = uploadFile.uri.split('.').pop() || 'jpg';
      const mime = `image/${ext}`;
      if (Platform.OS === 'web') {
        const response = await fetch(uploadFile.uri);
        const blob = await response.blob();
        form.append('file', new Blob([blob], { type: mime }), `upload.${ext}`);
      } else {
        // @ts-ignore
        form.append('file', { uri: uploadFile.uri, name: `upload.${ext}`, type: mime });
      }
      form.append('caption', uploadCaption);
      await fetch(`${API_BASE}/api/user/memories`, { method: 'POST', body: form });
      setUploadFile(null);
      setUploadCaption('');
      setShowUploadModal(false);
      loadMemories();
    } catch (e) {} finally { setUploading(false); }
  };

  const loadMemories = useCallback(async () => {
    setRefresh(true);
    try {
      const res  = await fetch(`${API_BASE}/api/memories`);
      const data = await res.json();
      setMemories(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('load memories error', e);
    } finally {
      setRefresh(false);
    }
  }, []);

  const handleLogout = async () => {
    await storage.clear();
    router.replace('/login');
  };

  const handleManage = () => router.push('/manage');

  const renderItem = ({ item }: { item: Memory }) => (
    <MemoryCard item={item} onPress={() => setSelected(item)} />
  );

  const embedUrl = song.url ? getEmbedUrl(song.url) : null;

  const STATUS_EMOJIS = ['😭', '😍', '🥰', '💕', '😴', '🥱', '🌸', '✨', '💔', '🧡'];

  return (
    <View style={gs.container}>
      <StatusBar barStyle="light-content" />

      {/* Mod Seçici Modal */}
      <Modal visible={showStatusModal} transparent animationType="slide" onRequestClose={() => setShowStatusModal(false)}>
        <View style={md.overlay}>
          <View style={md.card}>
            <Text style={md.title}>Modunu Güncelle</Text>
            <View style={md.emojiRow}>
              {STATUS_EMOJIS.map(e => (
                <TouchableOpacity key={e} onPress={() => setNewEmoji(e)} style={[md.emojiBtn, newEmoji === e && md.emojiBtnActive]}>
                  <Text style={md.emojiText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={md.input}
              placeholder="Kısa mesaj (opsiyonel)"
              placeholderTextColor="#ffb3c1"
              value={newText}
              onChangeText={setNewText}
            />
            <TouchableOpacity style={md.saveBtn} onPress={handleSaveStatus}>
              <Text style={md.saveBtnText}>Kaydet ✨</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowStatusModal(false)}>
              <Text style={md.cancelText}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Günün Şarkısı Modal */}
      <Modal visible={showSongModal} transparent animationType="slide" onRequestClose={() => setShowSongModal(false)}>
        <View style={md.overlay}>
          <View style={md.card}>
            <Text style={md.title}>🎵 Günün Şarkısı</Text>
            <TextInput
              style={md.input}
              placeholder="Spotify veya YouTube linki"
              placeholderTextColor="#ffb3c1"
              value={newSongUrl}
              onChangeText={setNewSongUrl}
              autoCapitalize="none"
            />
            <TextInput
              style={md.input}
              placeholder="Şarkı adı (opsiyonel)"
              placeholderTextColor="#ffb3c1"
              value={newSongTitle}
              onChangeText={setNewSongTitle}
            />
            <TouchableOpacity style={md.saveBtn} onPress={handleSaveSong}>
              <Text style={md.saveBtnText}>Paylaş 🎵</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowSongModal(false)}>
              <Text style={md.cancelText}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Esma Upload Modal */}
      <Modal visible={showUploadModal} transparent animationType="slide" onRequestClose={() => setShowUploadModal(false)}>
        <View style={md.overlay}>
          <View style={md.card}>
            <Text style={md.title}>📸 Anı Ekle</Text>
            <TouchableOpacity style={sw.uploadPicker} onPress={handlePickUpload}>
              {uploadFile ? (
                <Image source={{ uri: uploadFile.uri }} style={{ width: '100%', height: 160, borderRadius: 12 }} resizeMode="cover" />
              ) : (
                <Text style={{ color: '#ffb3c1', fontSize: 14 }}>Fotoğraf seç</Text>
              )}
            </TouchableOpacity>
            <TextInput
              style={md.input}
              placeholder="Açıklama (opsiyonel)"
              placeholderTextColor="#ffb3c1"
              value={uploadCaption}
              onChangeText={setUploadCaption}
            />
            <TouchableOpacity style={[md.saveBtn, uploading && { opacity: 0.6 }]} onPress={handleUserUpload} disabled={uploading}>
              <Text style={md.saveBtnText}>{uploading ? 'Yükleniyor...' : 'Yükle ✨'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowUploadModal(false)}>
              <Text style={md.cancelText}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <FlatList
        data={memories}
        keyExtractor={m => m.id}
        renderItem={renderItem}
        numColumns={NUM_COLS}
        columnWrapperStyle={gs.row}
        contentContainerStyle={gs.list}
        ListHeaderComponent={
          <>
            <LoveHeader
              role={role}
              onLogout={handleLogout}
              onManage={handleManage}
              onEnableNotif={handleEnableNotif}
              notifEnabled={notifEnabled}
            />
            {/* Mod Widget */}
            <TouchableOpacity
              style={sw.statusCard}
              onPress={() => { setNewEmoji(status.emoji); setNewText(status.text); setShowStatusModal(true); }}
              activeOpacity={0.8}
            >
              <Text style={sw.statusEmoji}>{status.emoji}</Text>
              <View style={sw.statusInfo}>
                <Text style={sw.statusLabel}>Şu anki mod</Text>
                {!!status.text && <Text style={sw.statusText}>{status.text}</Text>}
              </View>
              <Text style={sw.statusEdit}>✏️</Text>
            </TouchableOpacity>
            {/* Günün Şarkısı Widget */}
            <View style={sw.songCard}>
              <View style={sw.songInfo}>
                <Text style={sw.songLabel}>🎵 Günün Şarkısı</Text>
                {song.url ? (
                  <TouchableOpacity onPress={() => Linking.openURL(song.url)}>
                    <Text style={sw.songTitle} numberOfLines={1}>{song.title || song.url}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={sw.songEmpty}>Henüz şarkı seçilmedi</Text>
                )}
              </View>
              <TouchableOpacity
                style={sw.songBtn}
                onPress={() => { setNewSongUrl(song.url); setNewSongTitle(song.title); setShowSongModal(true); }}
              >
                <Text style={sw.songBtnText}>Seç</Text>
              </TouchableOpacity>
            </View>
            {/* Embed Player - sadece web'de ve link varsa */}
            {embedUrl && Platform.OS === 'web' && (
              <View style={sw.embedCard}>
                <iframe
                  src={embedUrl}
                  width="100%"
                  height={embedUrl.includes('spotify') ? '80' : '120'}
                  frameBorder="0"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  style={{ borderRadius: 12, display: 'block' }}
                />
              </View>
            )}
            {/* Esma'nın Fotoğraf Yükleme Butonu */}
            {role === 'user' && (
              <TouchableOpacity style={sw.uploadCard} onPress={() => setShowUploadModal(true)}>
                <Text style={sw.uploadIcon}>📸</Text>
                <Text style={sw.uploadText}>Anı Ekle</Text>
              </TouchableOpacity>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={gs.empty}>
            <Text style={gs.emptyIcon}>📷</Text>
            <Text style={gs.emptyText}>No memories yet…{'\n'}Add your first one! 🌸</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadMemories} tintColor="#ff8fa3" />
        }
        showsVerticalScrollIndicator={false}
      />
      <MediaViewer memory={selected} role={role} onClose={() => setSelected(null)} />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const cs = StyleSheet.create({
  header:      { paddingTop: Platform.OS === 'ios' ? 56 : 40, paddingBottom: 24, paddingHorizontal: 20, alignItems: 'center' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
  headerPoem:  { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontStyle: 'italic', marginTop: 4, textAlign: 'center' },
  counterRow:  { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 4 },
  unit:        { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, minWidth: 52 },
  value:       { fontSize: 24, fontWeight: '800', color: '#fff' },
  label:       { fontSize: 10, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  sep:         { fontSize: 22, fontWeight: '800', color: 'rgba(255,255,255,0.6)', marginTop: -4 },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 8, fontStyle: 'italic' },
  headerActions:  { flexDirection: 'row', gap: 10, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' },
  chip:        { backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  chipGhost:   { backgroundColor: 'rgba(255,255,255,0.5)' },
  chipNotif:   { backgroundColor: 'rgba(255,255,255,0.95)' },
  chipText:    { fontSize: 13, fontWeight: '600', color: '#c9184a' },
});

const ms = StyleSheet.create({
  card:      { width: CARD_SIZE, height: CARD_SIZE * 1.2, borderRadius: 16, overflow: 'hidden', backgroundColor: '#ffd6e0', shadowColor: '#ff8fa3', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  thumb:     { width: '100%', height: '100%' },
  overlay:   { ...StyleSheet.absoluteFillObject },
  caption:   { position: 'absolute', bottom: 22, left: 8, right: 8, fontSize: 12, color: '#fff', fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  date:      { position: 'absolute', bottom: 6, left: 8, fontSize: 10, color: 'rgba(255,255,255,0.75)' },
  playBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 12, width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  playIcon:  { fontSize: 11, color: '#c9184a', marginLeft: 2 },
});

const gs = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff8f9' },
  list:      { paddingBottom: 32 },
  row:       { paddingHorizontal: 12, gap: CARD_GAP, marginBottom: CARD_GAP },
  empty:     { alignItems: 'center', paddingTop: 48, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#ff8fa3', textAlign: 'center', lineHeight: 24, fontStyle: 'italic' },
});

const sw = StyleSheet.create({
  statusCard:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 12, marginTop: 10, borderRadius: 16, padding: 14, shadowColor: '#ff8fa3', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 3 },
  statusEmoji: { fontSize: 32, marginRight: 12 },
  statusInfo:  { flex: 1 },
  statusLabel: { fontSize: 11, color: '#ffb3c1', textTransform: 'uppercase', letterSpacing: 0.5 },
  statusText:  { fontSize: 14, color: '#c9184a', fontWeight: '600', marginTop: 2 },
  statusEdit:  { fontSize: 16 },
  songCard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff0f3', marginHorizontal: 12, marginTop: 8, marginBottom: 4, borderRadius: 16, padding: 14 },
  songInfo:    { flex: 1 },
  songLabel:   { fontSize: 11, color: '#ff8fa3', textTransform: 'uppercase', letterSpacing: 0.5 },
  songTitle:   { fontSize: 14, color: '#c9184a', fontWeight: '600', marginTop: 2, textDecorationLine: 'underline' },
  songEmpty:   { fontSize: 13, color: '#ffb3c1', fontStyle: 'italic', marginTop: 2 },
  songBtn:     { backgroundColor: '#ff8fa3', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  songBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  songOpen:    { fontSize: 13, color: '#ff6b8a', fontWeight: '600', marginTop: 4 },
  uploadCard:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ff6b8a', marginHorizontal: 12, marginTop: 8, marginBottom: 4, borderRadius: 16, padding: 14, gap: 8 },
  uploadIcon:  { fontSize: 20 },
  uploadText:  { color: '#fff', fontWeight: '700', fontSize: 15 },
  uploadPicker: { backgroundColor: '#fff0f3', borderRadius: 12, height: 160, justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 1.5, borderColor: '#ffd6e0', borderStyle: 'dashed' as any },
  embedCard:   { marginHorizontal: 12, marginTop: 0, marginBottom: 8, borderRadius: 12, overflow: 'hidden' as any },
});

const md = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  card:           { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  title:          { fontSize: 18, fontWeight: '800', color: '#c9184a', marginBottom: 16, textAlign: 'center' },
  emojiRow:       { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 16 },
  emojiBtn:       { width: 48, height: 48, borderRadius: 12, backgroundColor: '#fff0f3', justifyContent: 'center', alignItems: 'center' },
  emojiBtnActive: { backgroundColor: '#ffb3c1', borderWidth: 2, borderColor: '#ff6b8a' },
  emojiText:      { fontSize: 24 },
  input:          { borderWidth: 1.5, borderColor: '#ffd6e0', borderRadius: 12, padding: 12, fontSize: 14, color: '#c9184a', marginBottom: 12, backgroundColor: '#fff8f9' },
  saveBtn:        { backgroundColor: '#ff6b8a', borderRadius: 14, padding: 15, alignItems: 'center', marginBottom: 12 },
  saveBtnText:    { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelText:     { color: '#ff8fa3', textAlign: 'center', fontSize: 14 },
});

const vw = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#0a0005' },
  close:          { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 32, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  closeText:      { color: '#fff', fontSize: 18, fontWeight: '600' },
  image:          { width: '100%', height: '55%', marginTop: 60 },
  captionBox:     { backgroundColor: 'rgba(201,24,74,0.85)', padding: 12, paddingHorizontal: 20 },
  captionText:    { color: '#fff', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  dateText:       { color: 'rgba(255,255,255,0.8)', fontSize: 11, textAlign: 'center', marginTop: 2 },
  commentSection: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  commentList:    { flex: 1 },
  commentBubble:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 10 },
  commentBubbleSelf: { backgroundColor: 'rgba(201,24,74,0.2)' },
  commentRole:    { fontSize: 16 },
  commentText:    { color: '#fff', fontSize: 13, flex: 1, lineHeight: 18 },
  commentInput:   { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 30 : 10, gap: 8 },
  commentInputText: { flex: 1, color: '#fff', fontSize: 14, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  commentSendBtn: { backgroundColor: '#ff6b8a', borderRadius: 20, width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  commentSendText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
