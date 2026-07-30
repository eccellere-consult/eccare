import { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '@ec/design-tokens';
import { api } from '../../lib/api';

interface Contact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

export default function CallScreen() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get('/emergency/contacts');
      setContacts(data);
    } catch {
      // Not logged in yet, or offline — show empty state rather than an error screen
      setContacts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function handleCall(name: string, phone: string) {
    Alert.alert(`Call ${name}?`, `Dial ${phone}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes, Call', onPress: () => Linking.openURL(`tel:${phone}`) },
    ]);
  }

  function handleRemove(contact: Contact) {
    Alert.alert(`Remove ${contact.name}?`, 'They will no longer be notified during an emergency.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/emergency/contacts/${contact.id}`);
            setContacts((prev) => prev.filter((c) => c.id !== contact.id));
          } catch (err) {
            Alert.alert('Could not remove', err instanceof Error ? err.message : 'Please try again.');
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary.main} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
        />
      }
    >
      <Text style={styles.heading}>Your Family</Text>
      <Text style={styles.hint}>Tap a name to call them. Hold a name to remove it.</Text>

      {contacts.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="people" size={40} color={colors.primary.main} />
          </View>
          <Text style={styles.emptyText}>
            No family contacts added yet.{'\n'}Ask your family to set this up for you.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {contacts.map((contact) => (
            <TouchableOpacity
              key={contact.id}
              style={styles.contactCard}
              activeOpacity={0.7}
              onPress={() => handleCall(contact.name, contact.phone)}
              onLongPress={() => handleRemove(contact)}
              accessibilityRole="button"
              accessibilityLabel={`Call ${contact.name}`}
            >
              <View style={styles.contactAvatar}>
                <Text style={styles.contactInitial}>{contact.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactRelation}>{contact.relationship}</Text>
              </View>
              <View style={styles.callIconWrap}>
                <Ionicons name="call" size={22} color={colors.surface} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={styles.addButton}
        activeOpacity={0.7}
        onPress={() => router.push('/(elder)/add-contact')}
        accessibilityRole="button"
        accessibilityLabel="Add a family contact"
      >
        <Ionicons name="add" size={22} color={colors.primary.main} />
        <Text style={styles.addButtonText}>Add a Contact</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: spacing.xl },
  heading: { fontSize: 28, fontWeight: '700', color: colors.text },
  hint: { fontSize: 18, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing['2xl'] },
  emptyState: { alignItems: 'center', paddingVertical: spacing['4xl'] },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyText: { fontSize: 18, color: colors.textSecondary, textAlign: 'center', lineHeight: 28 },
  list: { gap: spacing.lg },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 80,
  },
  contactAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInitial: { fontSize: 22, fontWeight: '700', color: colors.primary.main },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 20, fontWeight: '700', color: colors.text },
  contactRelation: { fontSize: 15, color: colors.textSecondary, marginTop: 2 },
  callIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary.main,
    borderStyle: 'dashed',
  },
  addButtonText: { fontSize: 17, fontWeight: '700', color: colors.primary.main },
});
