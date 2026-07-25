import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const items = [
  { icon: 'stethoscope', family: 'mci' as const, title: 'Call Doctor', desc: 'Call your saved doctor' },
  { icon: 'calendar', family: 'ion' as const, title: 'Appointments', desc: 'View upcoming visits' },
  { icon: 'document-text', family: 'ion' as const, title: 'Health Notes', desc: 'Notes from your family' },
];

export default function DoctorScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Doctor & Health</Text>

      {items.map(({ icon, family, title, desc }) => (
        <TouchableOpacity key={title} style={styles.actionCard} activeOpacity={0.7}>
          <View style={styles.iconWrap}>
            {family === 'mci' ? (
              <MaterialCommunityIcons name={icon as any} size={26} color="#085041" />
            ) : (
              <Ionicons name={icon as any} size={26} color="#085041" />
            )}
          </View>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>{title}</Text>
            <Text style={styles.actionDesc}>{desc}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F7F3' },
  content: { padding: 20, gap: 16 },
  heading: { fontSize: 28, fontWeight: '700', color: '#04342C', marginBottom: 8 },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DAD7CE',
    minHeight: 80,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E1F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { flex: 1 },
  actionTitle: { fontSize: 20, fontWeight: '700', color: '#04342C' },
  actionDesc: { fontSize: 16, color: '#0F6E56', marginTop: 2 },
});
