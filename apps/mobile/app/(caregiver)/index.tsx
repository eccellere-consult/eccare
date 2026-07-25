import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const quickActions = [
  { icon: 'pill', family: 'mci' as const, label: 'Add Medicine' },
  { icon: 'calendar', family: 'ion' as const, label: 'Book Appointment' },
  { icon: 'document-text', family: 'ion' as const, label: 'Health Note' },
];

export default function CaregiverDashboard() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Elder status card */}
      <View style={styles.statusCard}>
        <View style={styles.statusIconWrap}>
          <Ionicons name="person" size={26} color="#085041" />
        </View>
        <View style={styles.statusInfo}>
          <Text style={styles.elderName}>Your Elder</Text>
          <Text style={styles.statusText}>No alerts today</Text>
        </View>
        <TouchableOpacity style={styles.callButton} accessibilityLabel="Call elder">
          <Ionicons name="call" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Quick actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActions}>
        {quickActions.map(({ icon, family, label }) => (
          <TouchableOpacity key={label} style={styles.quickAction}>
            {family === 'mci' ? (
              <MaterialCommunityIcons name={icon as any} size={24} color="#085041" />
            ) : (
              <Ionicons name={icon as any} size={24} color="#085041" />
            )}
            <Text style={styles.quickLabel}>{label}</Text>
          </TouchableOpacity>
        ))}
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
          <Text style={[styles.summaryValue, { color: '#3B6D11' }]}>All clear</Text>
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
  container: { flex: 1, backgroundColor: '#F8F7F3' },
  content: { padding: 20, gap: 20 },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#E1F5EE',
    borderWidth: 1,
    borderColor: '#9FE1CB',
  },
  statusIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#9FE1CB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusInfo: { flex: 1 },
  elderName: { fontSize: 20, fontWeight: '700', color: '#04342C' },
  statusText: { fontSize: 15, color: '#0F6E56', marginTop: 2 },
  callButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#085041',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#04342C' },
  quickActions: { flexDirection: 'row', gap: 12 },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DAD7CE',
    gap: 8,
  },
  quickLabel: { fontSize: 13, fontWeight: '600', color: '#04342C', textAlign: 'center' },
  summaryCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DAD7CE',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  summaryLabel: { fontSize: 15, fontWeight: '600', color: '#04342C' },
  summaryValue: { fontSize: 15, color: '#0F6E56' },
  divider: { height: 1, backgroundColor: '#E1F5EE', marginVertical: 4 },
  emptyActivity: {
    padding: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DAD7CE',
    alignItems: 'center',
  },
  emptyText: { fontSize: 15, color: '#0F6E56', textAlign: 'center', lineHeight: 24 },
});
