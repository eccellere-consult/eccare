import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';

export default function DoctorScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Doctor & Health</Text>

      <TouchableOpacity style={styles.actionCard} activeOpacity={0.7}>
        <Text style={styles.actionEmoji}>📞</Text>
        <View style={styles.actionText}>
          <Text style={styles.actionTitle}>Call Doctor</Text>
          <Text style={styles.actionDesc}>Call your saved doctor</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionCard} activeOpacity={0.7}>
        <Text style={styles.actionEmoji}>📅</Text>
        <View style={styles.actionText}>
          <Text style={styles.actionTitle}>Appointments</Text>
          <Text style={styles.actionDesc}>View upcoming visits</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionCard} activeOpacity={0.7}>
        <Text style={styles.actionEmoji}>📋</Text>
        <View style={styles.actionText}>
          <Text style={styles.actionTitle}>Health Notes</Text>
          <Text style={styles.actionDesc}>Notes from your family</Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F0' },
  content: { padding: 20, gap: 16 },
  heading: { fontSize: 28, fontWeight: '700', color: '#212121', marginBottom: 8 },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#B0BEC5',
    minHeight: 80,
  },
  actionEmoji: { fontSize: 32 },
  actionText: { flex: 1 },
  actionTitle: { fontSize: 22, fontWeight: '700', color: '#212121' },
  actionDesc: { fontSize: 18, color: '#546E7A', marginTop: 2 },
});
