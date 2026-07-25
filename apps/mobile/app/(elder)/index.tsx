import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

const actions = [
  {
    route: '/(elder)/call' as const,
    title: 'Call Family',
    emoji: '📞',
    color: '#00796B',
    bg: '#E0F2F1',
  },
  {
    route: '/(elder)/medicine' as const,
    title: 'Medicine',
    emoji: '💊',
    color: '#2E7D32',
    bg: '#E8F5E9',
  },
  {
    route: '/(elder)/doctor' as const,
    title: 'Doctor',
    emoji: '🩺',
    color: '#00796B',
    bg: '#E0F2F1',
  },
  {
    route: '/(elder)/food' as const,
    title: 'Food',
    emoji: '🍽️',
    color: '#F57F17',
    bg: '#FFF8E1',
  },
  {
    route: '/(elder)/emergency' as const,
    title: 'Need Help',
    emoji: '🆘',
    color: '#F9A825',
    bg: '#FFF8E1',
  },
];

export default function ElderHome() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.greeting}>Hello</Text>
        <Text style={styles.subtitle}>What do you need?</Text>

        <View style={styles.grid}>
          {actions.map(({ route, title, emoji, color, bg }) => (
            <TouchableOpacity
              key={route}
              style={[styles.actionCard, { backgroundColor: bg, borderColor: color }]}
              activeOpacity={0.7}
              onPress={() => router.push(route)}
              accessibilityRole="button"
              accessibilityLabel={title}
            >
              <Text style={styles.actionEmoji}>{emoji}</Text>
              <Text style={[styles.actionTitle, { color }]}>{title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Floating Emergency SOS Button */}
      <TouchableOpacity
        style={styles.sosButton}
        activeOpacity={0.8}
        onPress={() => router.push('/(elder)/emergency')}
        accessibilityRole="button"
        accessibilityLabel="Emergency SOS"
      >
        <Text style={styles.sosText}>SOS</Text>
      </TouchableOpacity>

      {/* Floating Voice Button */}
      <TouchableOpacity
        style={styles.voiceButton}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Speak to EC"
      >
        <Text style={styles.voiceEmoji}>🎤</Text>
        <Text style={styles.voiceLabel}>Speak</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  content: {
    padding: 20,
    paddingBottom: 160,
  },
  greeting: {
    fontSize: 36,
    fontWeight: '700',
    color: '#212121',
  },
  subtitle: {
    fontSize: 22,
    color: '#546E7A',
    marginTop: 4,
    marginBottom: 24,
  },
  grid: {
    gap: 16,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderRadius: 20,
    borderWidth: 2,
    minHeight: 80,
  },
  actionEmoji: {
    fontSize: 36,
  },
  actionTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  sosButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#C62828',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#C62828',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  sosText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  voiceButton: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -50,
    width: 100,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#00796B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    elevation: 6,
    shadowColor: '#004D40',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  voiceEmoji: {
    fontSize: 24,
  },
  voiceLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
