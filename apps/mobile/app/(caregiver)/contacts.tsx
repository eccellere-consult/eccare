import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ContactsScreen() {
  function handleAddPress() {
    Alert.alert(
      'Coming soon',
      'Linking your account to an elder is not set up yet. Once family linking is available, you\'ll be able to manage their contacts here.',
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity
        style={styles.addButton}
        onPress={handleAddPress}
        accessibilityLabel="Add emergency contact"
      >
        <Ionicons name="add" size={22} color="#FFFFFF" />
        <Text style={styles.addText}>Add Emergency Contact</Text>
      </TouchableOpacity>

      <View style={styles.emptyState}>
        <View style={styles.iconWrap}>
          <Ionicons name="people" size={40} color="#0B5563" />
        </View>
        <Text style={styles.emptyTitle}>No contacts yet</Text>
        <Text style={styles.emptyText}>
          Add emergency contacts for your elder. These contacts will be notified during SOS events.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F7F3' },
  content: { padding: 20, gap: 20 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#0B5563',
  },
  addText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#E1F2F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#052E36', marginBottom: 8 },
  emptyText: { fontSize: 16, color: '#0E6B78', textAlign: 'center', lineHeight: 26, paddingHorizontal: 20 },
});
