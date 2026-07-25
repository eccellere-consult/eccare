import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';

export default function ContactsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.addButton} accessibilityLabel="Add emergency contact">
        <Text style={styles.addIcon}>+</Text>
        <Text style={styles.addText}>Add Emergency Contact</Text>
      </TouchableOpacity>

      <View style={styles.emptyState}>
        <Text style={styles.emptyEmoji}>👥</Text>
        <Text style={styles.emptyTitle}>No contacts yet</Text>
        <Text style={styles.emptyText}>
          Add emergency contacts for your elder. These contacts will be notified during SOS events.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F0' },
  content: { padding: 20, gap: 20 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#00796B',
  },
  addIcon: { fontSize: 24, fontWeight: '700', color: '#FFFFFF' },
  addText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 24, fontWeight: '700', color: '#212121', marginBottom: 8 },
  emptyText: { fontSize: 18, color: '#546E7A', textAlign: 'center', lineHeight: 28, paddingHorizontal: 20 },
});
