import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function RemindersScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.addButton} accessibilityLabel="Add medicine reminder">
        <Ionicons name="add" size={22} color="#FFFFFF" />
        <Text style={styles.addText}>Add Medicine Reminder</Text>
      </TouchableOpacity>

      <View style={styles.emptyState}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name="pill" size={40} color="#0B5563" />
        </View>
        <Text style={styles.emptyTitle}>No reminders set</Text>
        <Text style={styles.emptyText}>
          Add medicine reminders for your elder. They'll receive notifications at the scheduled times.
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
