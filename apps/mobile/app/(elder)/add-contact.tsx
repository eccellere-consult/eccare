import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../lib/api';

export default function AddContactScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim() || phone.trim().length < 10 || !relationship.trim()) {
      Alert.alert('Missing details', 'Please fill in name, a 10-digit phone number, and relationship.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/emergency/contacts', {
        name: name.trim(),
        phone: phone.trim(),
        relationship: relationship.trim(),
      });
      router.back();
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Priya Sharma"
          placeholderTextColor="#B0BEC5"
          autoFocus
        />

        <Text style={styles.label}>Phone number</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="9876543210"
          placeholderTextColor="#B0BEC5"
        />

        <Text style={styles.label}>Relationship</Text>
        <TextInput
          style={styles.input}
          value={relationship}
          onChangeText={setRelationship}
          placeholder="Daughter"
          placeholderTextColor="#B0BEC5"
        />

        <TouchableOpacity
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save Contact'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F7F3' },
  content: { padding: 24, gap: 8 },
  label: { fontSize: 18, fontWeight: '700', color: '#052E36', marginTop: 16, marginBottom: 8 },
  input: {
    fontSize: 20,
    color: '#052E36',
    borderWidth: 1,
    borderColor: '#DAD7CE',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  button: {
    backgroundColor: '#0B5563',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 32,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
