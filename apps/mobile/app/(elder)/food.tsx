import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';

export default function FoodScreen() {
  function handleFoodRequest() {
    Alert.alert(
      'Request Food?',
      'Your family will be notified to help with food.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, Request', onPress: () => Alert.alert('Done', 'Your family has been notified.') },
      ],
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Food & Meals</Text>

      <TouchableOpacity
        style={styles.mainAction}
        activeOpacity={0.7}
        onPress={handleFoodRequest}
        accessibilityLabel="Request food help"
      >
        <Text style={styles.mainEmoji}>🍽️</Text>
        <Text style={styles.mainTitle}>I Need Food</Text>
        <Text style={styles.mainDesc}>Your family will help arrange a meal</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionCard} activeOpacity={0.7}>
        <Text style={styles.actionEmoji}>🥗</Text>
        <View style={styles.actionText}>
          <Text style={styles.actionTitle}>Healthy Options</Text>
          <Text style={styles.actionDesc}>Good food ideas for today</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionCard} activeOpacity={0.7}>
        <Text style={styles.actionEmoji}>⏰</Text>
        <View style={styles.actionText}>
          <Text style={styles.actionTitle}>Meal Reminders</Text>
          <Text style={styles.actionDesc}>Never miss a meal</Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F0' },
  content: { padding: 20, gap: 16 },
  heading: { fontSize: 28, fontWeight: '700', color: '#212121', marginBottom: 8 },
  mainAction: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 20,
    backgroundColor: '#FFF8E1',
    borderWidth: 2,
    borderColor: '#F57F17',
    minHeight: 120,
    justifyContent: 'center',
  },
  mainEmoji: { fontSize: 48, marginBottom: 8 },
  mainTitle: { fontSize: 26, fontWeight: '700', color: '#F57F17' },
  mainDesc: { fontSize: 18, color: '#546E7A', marginTop: 4, textAlign: 'center' },
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
