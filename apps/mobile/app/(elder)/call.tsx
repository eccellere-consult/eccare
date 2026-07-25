import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';

export default function CallScreen() {
  function handleCall(name: string, phone: string) {
    Alert.alert(`Call ${name}?`, `Dial ${phone}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes, Call', onPress: () => Linking.openURL(`tel:${phone}`) },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Your Family</Text>
      <Text style={styles.hint}>Tap a name to call them.</Text>

      {/* Placeholder — will be populated from API */}
      <View style={styles.emptyState}>
        <Text style={styles.emptyEmoji}>👨‍👩‍👧‍👦</Text>
        <Text style={styles.emptyText}>
          No family contacts added yet.{'\n'}Ask your family to set this up for you.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F0' },
  content: { padding: 20 },
  heading: { fontSize: 28, fontWeight: '700', color: '#212121' },
  hint: { fontSize: 20, color: '#546E7A', marginTop: 4, marginBottom: 24 },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 20, color: '#546E7A', textAlign: 'center', lineHeight: 30 },
});
