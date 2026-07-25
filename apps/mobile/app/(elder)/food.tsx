import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const items = [
  { icon: 'nutrition' as const, title: 'Healthy Options', desc: 'Good food ideas for today' },
  { icon: 'alarm' as const, title: 'Meal Reminders', desc: 'Never miss a meal' },
];

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
        <Ionicons name="restaurant" size={44} color="#854F0B" style={styles.mainIcon} />
        <Text style={styles.mainTitle}>I Need Food</Text>
        <Text style={styles.mainDesc}>Your family will help arrange a meal</Text>
      </TouchableOpacity>

      {items.map(({ icon, title, desc }) => (
        <TouchableOpacity key={title} style={styles.actionCard} activeOpacity={0.7}>
          <View style={styles.iconWrap}>
            <Ionicons name={icon} size={26} color="#085041" />
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
  mainAction: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 20,
    backgroundColor: '#FAEEDA',
    minHeight: 120,
    justifyContent: 'center',
  },
  mainIcon: { marginBottom: 8 },
  mainTitle: { fontSize: 24, fontWeight: '700', color: '#633806' },
  mainDesc: { fontSize: 16, color: '#854F0B', marginTop: 4, textAlign: 'center' },
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
