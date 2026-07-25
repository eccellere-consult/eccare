import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';

export default function MedicineScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Today's Medicine</Text>
      <Text style={styles.hint}>Tap "Taken" when you take your medicine.</Text>

      {/* Placeholder reminder card */}
      <View style={styles.reminderCard}>
        <View style={styles.reminderInfo}>
          <Text style={styles.medicineName}>💊 No reminders yet</Text>
          <Text style={styles.medicineDetail}>
            Your family can add medicine reminders for you.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F0' },
  content: { padding: 20 },
  heading: { fontSize: 28, fontWeight: '700', color: '#212121' },
  hint: { fontSize: 20, color: '#546E7A', marginTop: 4, marginBottom: 24 },
  reminderCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#B0BEC5',
  },
  reminderInfo: { gap: 8 },
  medicineName: { fontSize: 22, fontWeight: '700', color: '#212121' },
  medicineDetail: { fontSize: 18, color: '#546E7A' },
});
