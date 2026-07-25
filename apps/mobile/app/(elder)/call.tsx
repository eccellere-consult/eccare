import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function CallScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Your Family</Text>
      <Text style={styles.hint}>Tap a name to call them.</Text>

      {/* Placeholder — will be populated from API */}
      <View style={styles.emptyState}>
        <View style={styles.emptyIconWrap}>
          <Ionicons name="people" size={40} color="#085041" />
        </View>
        <Text style={styles.emptyText}>
          No family contacts added yet.{'\n'}Ask your family to set this up for you.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F7F3' },
  content: { padding: 20 },
  heading: { fontSize: 28, fontWeight: '700', color: '#04342C' },
  hint: { fontSize: 18, color: '#0F6E56', marginTop: 4, marginBottom: 24 },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#E1F5EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyText: { fontSize: 18, color: '#0F6E56', textAlign: 'center', lineHeight: 28 },
});
