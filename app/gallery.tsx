import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Dimensions, RefreshControl, Modal, Image, Platform,
  StatusBar, Animated,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useRouter } from 'expo-router';
import { storage } from './_layout';
import { LinearGradient } from 'expo-linear-gradient';
import { useLoveCounter } from '../hooks/useLoveCounter';
import { API_BASE, mediaUrl } from '../config/api';

const { width } = Dimensions.get('window');
const CARD_GAP   = 10;
const NUM_COLS   = 2;
const CARD_SIZE  = (width - 24 - CARD_GAP) / NUM_COLS;

interface Memory {
  id:       string;
  caption:  string;
  date:     string;
  fileId:   string;
  fileType: string;
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

function LoveHeader({ role, onLogout, onManage }: { role: string; onLogout: () => void; onManage: () => void }) {
  const { days, hours, minutes, seconds } = useLoveCounter();
  const fadeIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeIn }}>
      <LinearGradient colors={['#ff6b8a', '#ffb3c1', '#ffd6e0']} style={cs.header}>
        <Text style={cs.headerTitle}>🐰 Şapşal Tavşan</Text>
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

  const dateLabel = item.date ? new Date(item.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={ms.card}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        <Image
          source={{ uri: mediaUrl(item.fileId) }}
          style={ms.thumb}
          resizeMode="cover"
        />
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
function MediaViewer({ memory, onClose }: { memory: Memory | null; onClose: () => void }) {
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
      </View>
    </Modal>
  );
}

// ── Gallery Screen ────────────────────────────────────────────────────────────
export default function GalleryScreen() {
  const router = useRouter();
  const [role,      setRole]     = useState('user');
  const [memories,  setMemories] = useState<Memory[]>([]);
  const [refreshing, setRefresh] = useState(false);
  const [selected,   setSelected] = useState<Memory | null>(null);
  const [status,     setStatus]   = useState({ emoji: '🐰', text: '' });
  const [song,       setSong]     = useState({ url: '', title: '' });
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showSongModal,   setShowSongModal]   = useState(false);
  const [newEmoji,   setNewEmoji]   = useState('');
  const [newText,    setNewText]    = useState('');
  const [newSongUrl,  setNewSongUrl]  = useState('');
  const [newSongTitle, setNewSongTitle] = useState('');

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
      // Push bildirim kaydı
      registerPush(r);
    })();
  }, []);

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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji: newEmoji || status.emoji, text: newText, role }),
      });
      setStatus({ emoji: newEmoji || status.emoji, text: newText });
      setShowStatusModal(false);
    } catch (e) {}
  };

  const handleSaveSong = async () => {
    if (!newSongUrl.trim()) return;
    try {
      await fetch(`${API_BASE}/api/song`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newSongUrl, title: newSongTitle, role }),
      });
      setSong({ url: newSongUrl, title: newSongTitle });
      setShowSongModal(false);
    } catch (e) {}
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

  const STATUS_EMOJIS = ['🐰', '😍', '🥰', '💕', '😴', '🎵', '🌸', '✨', '💔', '🤍'];

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

      <FlatList
        data={memories}
        keyExtractor={m => m.id}
        renderItem={renderItem}
        numColumns={NUM_COLS}
        columnWrapperStyle={gs.row}
        contentContainerStyle={gs.list}
        ListHeaderComponent={
          <>
            <LoveHeader role={role} onLogout={handleLogout} onManage={handleManage} />
            {/* Mod Widget */}
            <TouchableOpacity style={sw.statusCard} onPress={() => { setNewEmoji(status.emoji); setNewText(status.text); setShowStatusModal(true); }} activeOpacity={0.8}>
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
              <TouchableOpacity style={sw.songBtn} onPress={() => { setNewSongUrl(song.url); setNewSongTitle(song.title); setShowSongModal(true); }}>
                <Text style={sw.songBtnText}>Seç</Text>
              </TouchableOpacity>
            </View>
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
      <MediaViewer memory={selected} onClose={() => setSelected(null)} />
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
  headerActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  chip:        { backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  chipGhost:   { backgroundColor: 'rgba(255,255,255,0.5)' },
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
});

const md = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  card:         { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  title:        { fontSize: 18, fontWeight: '800', color: '#c9184a', marginBottom: 16, textAlign: 'center' },
  emojiRow:     { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 16 },
  emojiBtn:     { width: 48, height: 48, borderRadius: 12, backgroundColor: '#fff0f3', justifyContent: 'center', alignItems: 'center' },
  emojiBtnActive: { backgroundColor: '#ffb3c1', borderWidth: 2, borderColor: '#ff6b8a' },
  emojiText:    { fontSize: 24 },
  input:        { borderWidth: 1.5, borderColor: '#ffd6e0', borderRadius: 12, padding: 12, fontSize: 14, color: '#c9184a', marginBottom: 12, backgroundColor: '#fff8f9' },
  saveBtn:      { backgroundColor: '#ff6b8a', borderRadius: 14, padding: 15, alignItems: 'center', marginBottom: 12 },
  saveBtnText:  { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelText:   { color: '#ff8fa3', textAlign: 'center', fontSize: 14 },
});

const vw = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0a0005', justifyContent: 'center' },
  close:       { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 32, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  closeText:   { color: '#fff', fontSize: 18, fontWeight: '600' },
  image:       { width: '100%', height: '75%' },
  captionBox:  { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(201,24,74,0.85)', padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20 },
  captionText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  dateText:    { color: 'rgba(255,255,255,0.8)', fontSize: 12, textAlign: 'center', marginTop: 4 },
});
