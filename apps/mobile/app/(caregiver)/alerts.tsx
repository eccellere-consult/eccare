import { View, Text, ScrollView, StyleSheet } from 'react-native';

export default function AlertsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.emptyState}>
        <Text style={styles.emptyEmoji}>🔔</Text>
        <Text style={styles.emptyTitle}>No alerts</Text>
        <Text style={styles.emptyText}>
          SOS alerts, missed medicine reminders, and check-in requests will appear here.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F0' },
  content: { padding: 20, flex: 1, justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 24, fontWeight: '700', color: '#212121', marginBottom: 8 },
  emptyText: { fontSize: 18, color: '#546E7A', textAlign: 'center', lineHeight: 28, paddingHorizontal: 20 },
});
