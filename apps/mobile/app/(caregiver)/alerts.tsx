import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function AlertsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.emptyState}>
        <View style={styles.iconWrap}>
          <Ionicons name="notifications" size={40} color="#0B5563" />
        </View>
        <Text style={styles.emptyTitle}>No alerts</Text>
        <Text style={styles.emptyText}>
          SOS alerts, missed medicine reminders, and check-in requests will appear here.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F7F3' },
  content: { padding: 20, flex: 1, justifyContent: 'center' },
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
