import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function MedicineScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Today's Medicine</Text>
      <Text style={styles.hint}>Tap "Taken" when you take your medicine.</Text>

      {/* Placeholder reminder card */}
      <View style={styles.reminderCard}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name="pill" size={28} color="#085041" />
        </View>
        <View style={styles.reminderInfo}>
          <Text style={styles.medicineName}>No reminders yet</Text>
          <Text style={styles.medicineDetail}>
            Your family can add medicine reminders for you.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F7F3' },
  content: { padding: 20 },
  heading: { fontSize: 28, fontWeight: '700', color: '#04342C' },
  hint: { fontSize: 18, color: '#0F6E56', marginTop: 4, marginBottom: 24 },
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DAD7CE',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E1F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderInfo: { flex: 1, gap: 4 },
  medicineName: { fontSize: 20, fontWeight: '700', color: '#04342C' },
  medicineDetail: { fontSize: 16, color: '#0F6E56' },
});
