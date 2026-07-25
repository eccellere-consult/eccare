import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';

export default function CaregiverDashboard() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Elder status card */}
      <View style={styles.statusCard}>
        <Text style={styles.statusEmoji}>👤</Text>
        <View style={styles.statusInfo}>
          <Text style={styles.elderName}>Your Elder</Text>
          <Text style={styles.statusText}>No alerts today</Text>
        </View>
        <TouchableOpacity style={styles.callButton} accessibilityLabel="Call elder">
          <Text style={styles.callEmoji}>📞</Text>
        </TouchableOpacity>
      </View>

      {/* Quick actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickAction}>
          <Text style={styles.quickEmoji}>💊</Text>
          <Text style={styles.quickLabel}>Add Medicine</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickAction}>
          <Text style={styles.quickEmoji}>📅</Text>
          <Text style={styles.quickLabel}>Book Appointment</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickAction}>
          <Text style={styles.quickEmoji}>📝</Text>
          <Text style={styles.quickLabel}>Health Note</Text>
        </TouchableOpacity>
      </View>

      {/* Today's summary */}
      <Text style={styles.sectionTitle}>Today</Text>
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Medicines</Text>
          <Text style={styles.summaryValue}>No reminders set</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Appointments</Text>
          <Text style={styles.summaryValue}>None today</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>SOS Alerts</Text>
          <Text style={[styles.summaryValue, { color: '#2E7D32' }]}>All clear</Text>
        </View>
      </View>

      {/* Recent activity */}
      <Text style={styles.sectionTitle}>Recent Activity</Text>
      <View style={styles.emptyActivity}>
        <Text style={styles.emptyText}>No activity yet.{'\n'}Activity will appear here once your elder starts using EC.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F0' },
  content: { padding: 20, gap: 20 },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#E0F2F1',
    borderWidth: 2,
    borderColor: '#00796B',
  },
  statusEmoji: { fontSize: 40 },
  statusInfo: { flex: 1 },
  elderName: { fontSize: 22, fontWeight: '700', color: '#212121' },
  statusText: { fontSize: 16, color: '#546E7A', marginTop: 2 },
  callButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00796B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callEmoji: { fontSize: 22 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#212121' },
  quickActions: { flexDirection: 'row', gap: 12 },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B0BEC5',
    gap: 8,
  },
  quickEmoji: { fontSize: 28 },
  quickLabel: { fontSize: 14, fontWeight: '600', color: '#212121', textAlign: 'center' },
  summaryCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B0BEC5',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  summaryLabel: { fontSize: 16, fontWeight: '600', color: '#212121' },
  summaryValue: { fontSize: 16, color: '#546E7A' },
  divider: { height: 1, backgroundColor: '#E0F2F1', marginVertical: 4 },
  emptyActivity: {
    padding: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B0BEC5',
    alignItems: 'center',
  },
  emptyText: { fontSize: 16, color: '#546E7A', textAlign: 'center', lineHeight: 24 },
});
