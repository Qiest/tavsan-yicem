import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Platform, Image,
  KeyboardAvoidingView, ActivityIndicator, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { storage } from './_layout';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { API_BASE, mediaUrl } from '../config/api';

interface Memory {
  id:       string;
  caption:  string;
  date:     string;
  fileId:   string;
  fileType: string;
}

export default function ManageScreen() {
  const router = useRouter();
  const [role, setRole]         = useState('');
  const [memories, setMemories] = useState<Memory[]>([]);
  const [caption, setCaption]   = useState('');
  const [date,    setDate]      = useState('');
  const [file,    setFile]      = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading,   setLoading]   = useState(false);

  useEffect(() => {
    (async () => {
      const r = await storage.getItem('role');
      if (r !== 'admin') {
        router.replace('/gallery');
        return;
      }
      setRole(r);
      loadMemories();
    })();
  }, []);

  const loadMemories = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/api/memories`);
      const data = await res.json();
      setMemories(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const pickFile = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality:    0.85,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets.length > 0) {
      setFile(result.assets[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) { Alert.alert('Please select a file first!'); return; }
    setUploading(true);
    try {
      const form = new FormData();
      const ext  = file.uri.split('.').pop() || 'jpg';
      const mime = file.type === 'video' ? `video/${ext}` : `image/${ext}`;

      if (Platform.OS === 'web') {
        const response = await fetch(file.uri);
        const blob = await response.blob();
        form.append('file', new Blob([blob], { type: mime }), `upload.${ext}`);
      } else {
        // @ts-ignore
        form.append('file', { uri: file.uri, name: `upload.${ext}`, type: mime });
      }
      form.append('caption', caption);
      form.append('date', date || new Date().toISOString());

      // Content-Type header set etme - tarayici boundary otomatik ekler
      const res = await fetch(`${API_BASE}/api/memories`, {
        method: 'POST',
        body:   form,
      });
      if (!res.ok) throw new Error('Upload failed');
      setFile(null);
      setCaption('');
      setDate('');
      Alert.alert('✨ Memory added!', 'Your moment has been saved.');
      loadMemories();
    } catch (e: any) {
      Alert.alert('Upload error', e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete memory?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await fetch(`${API_BASE}/api/memories/${id}`, { method: 'DELETE' });
          loadMemories();
        },
      },
    ]);
  };

  const handleLogout = async () => {
    await storage.clear();
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#ff6b8a', '#ffb3c1']} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Gallery</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>✦ Manage</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Upload Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Add a New Memory</Text>

            <TouchableOpacity style={styles.picker} onPress={pickFile} activeOpacity={0.8}>
              {file ? (
                <Image source={{ uri: file.uri }} style={styles.preview} resizeMode="cover" />
              ) : (
                <View style={styles.pickerPlaceholder}>
                  <Text style={styles.pickerIcon}>📷</Text>
                  <Text style={styles.pickerText}>Tap to pick photo or video</Text>
                </View>
              )}
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="Caption (optional)..."
              placeholderTextColor="#ffb3c1"
              value={caption}
              onChangeText={setCaption}
              multiline
            />

            <TextInput
              style={styles.input}
              placeholder="Date (YYYY-MM-DD, optional)"
              placeholderTextColor="#ffb3c1"
              value={date}
              onChangeText={setDate}
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
            />

            <TouchableOpacity
              style={[styles.uploadBtn, uploading && styles.uploadBtnDisabled]}
              onPress={handleUpload}
              disabled={uploading}
              activeOpacity={0.8}
            >
              <LinearGradient colors={['#ff8fa3', '#ff6b8a']} style={styles.uploadBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {uploading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.uploadBtnText}>Upload Memory ✨</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Existing Memories */}
          <Text style={styles.sectionTitle}>All Memories ({memories.length})</Text>

          {loading && <ActivityIndicator color="#ff8fa3" style={{ marginTop: 12 }} />}

          {memories.map(m => (
            <View key={m.id} style={styles.memoryRow}>
              <Image source={{ uri: mediaUrl(m.fileId) }} style={styles.memThumb} resizeMode="cover" />
              <View style={styles.memInfo}>
                <Text style={styles.memCaption} numberOfLines={2}>{m.caption || '(no caption)'}</Text>
                <Text style={styles.memDate}>{m.date ? new Date(m.date).toLocaleDateString('tr-TR') : ''}</Text>
                <Text style={styles.memType}>{m.fileType}</Text>
              </View>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(m.id)}>
                <Text style={styles.deleteText}>🗑</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#fff8f9' },
  header:           { paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingBottom: 16, paddingHorizontal: 16 },
  headerRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle:      { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  backBtn:          { padding: 4 },
  backText:         { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '600' },
  logoutBtn:        { padding: 4 },
  logoutText:       { color: 'rgba(255,255,255,0.9)', fontSize: 13 },
  scroll:           { padding: 16, paddingBottom: 48 },
  card:             { backgroundColor: '#fff', borderRadius: 20, padding: 18, shadowColor: '#ff8fa3', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4, marginBottom: 24 },
  cardTitle:        { fontSize: 16, fontWeight: '700', color: '#c9184a', marginBottom: 14 },
  picker:           { backgroundColor: '#fff0f3', borderRadius: 14, height: 160, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 14, borderWidth: 1.5, borderColor: '#ffd6e0', borderStyle: 'dashed' },
  preview:          { width: '100%', height: '100%' },
  pickerPlaceholder:{ alignItems: 'center' },
  pickerIcon:       { fontSize: 32, marginBottom: 8 },
  pickerText:       { color: '#ffb3c1', fontSize: 14 },
  input:            { borderWidth: 1.5, borderColor: '#ffd6e0', borderRadius: 12, padding: 12, fontSize: 14, color: '#c9184a', marginBottom: 12, backgroundColor: '#fff8f9' },
  uploadBtn:        { borderRadius: 14, overflow: 'hidden' },
  uploadBtnDisabled: { opacity: 0.6 },
  uploadBtnGrad:    { paddingVertical: 14, alignItems: 'center' },
  uploadBtnText:    { color: '#fff', fontWeight: '700', fontSize: 15 },
  sectionTitle:     { fontSize: 15, fontWeight: '700', color: '#c9184a', marginBottom: 12 },
  memoryRow:        { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 10, marginBottom: 10, alignItems: 'center', shadowColor: '#ffb3c1', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 2 },
  memThumb:         { width: 60, height: 60, borderRadius: 10, backgroundColor: '#ffd6e0' },
  memInfo:          { flex: 1, paddingHorizontal: 12 },
  memCaption:       { fontSize: 13, color: '#3a0010', fontWeight: '600' },
  memDate:          { fontSize: 11, color: '#ff8fa3', marginTop: 2 },
  memType:          { fontSize: 10, color: '#ffb3c1', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  deleteBtn:        { padding: 8 },
  deleteText:       { fontSize: 18 },
});
