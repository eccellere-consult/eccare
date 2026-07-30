import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '@ec/design-tokens';

const AMBULANCE_NUMBER = '108';

const actions = [
  { route: '/(elder)/call' as const, title: 'Call Family', icon: 'call' as const },
  { route: '/(elder)/dial-pad' as const, title: 'Dial Pad', icon: 'keypad' as const },
  { route: '/(elder)/medicine' as const, title: 'Medicine', icon: 'pill' as const },
  { route: '/(elder)/speak' as const, title: 'Speak to EC', icon: 'mic' as const },
];

const comingSoon = [
  { title: 'Social', icon: 'chatbubbles' as const },
  { title: 'Daily Services', icon: 'construct' as const },
  { title: 'Shopping', icon: 'cart' as const },
];

function TileIcon({ name, size, color }: { name: string; size: number; color: string }) {
  if (name === 'pill') {
    return <MaterialCommunityIcons name={name} size={size} color={color} />;
  }
  return <Ionicons name={name as any} size={size} color={color} />;
}

export default function ElderHome() {
  const router = useRouter();

  function handleAmbulance() {
    Alert.alert('Call Ambulance?', `This will dial ${AMBULANCE_NUMBER} right away.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes, Call', style: 'destructive', onPress: () => Linking.openURL(`tel:${AMBULANCE_NUMBER}`) },
    ]);
  }

  function handleComingSoon(title: string) {
    Alert.alert(`${title} — Coming Soon`, `We're working on ${title.toLowerCase()}. It will be available in a future update.`);
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={22} color={colors.primary.main} />
          </View>
          <View>
            <Text style={styles.greeting}>Hello</Text>
            <Text style={styles.subtitle}>What do you need?</Text>
          </View>
        </View>

        <View style={styles.grid}>
          {actions.map(({ route, title, icon }) => (
            <TouchableOpacity
              key={route}
              style={styles.actionCard}
              activeOpacity={0.7}
              onPress={() => router.push(route)}
              accessibilityRole="button"
              accessibilityLabel={title}
            >
              <TileIcon name={icon} size={34} color={colors.primary.main} />
              <Text style={styles.actionTitle}>{title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.emergencyBar}
          activeOpacity={0.8}
          onPress={() => router.push('/(elder)/emergency')}
          accessibilityRole="button"
          accessibilityLabel="Need help now"
        >
          <Ionicons name="warning" size={26} color={colors.emergency.light} />
          <Text style={styles.emergencyText}>Need Help Now</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.ambulanceBar}
          activeOpacity={0.8}
          onPress={handleAmbulance}
          accessibilityRole="button"
          accessibilityLabel="Call ambulance"
        >
          <MaterialCommunityIcons name="ambulance" size={24} color={colors.emergency.main} />
          <Text style={styles.ambulanceText}>Call Ambulance</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>More Services</Text>
        <View style={styles.comingSoonRow}>
          {comingSoon.map(({ title, icon }) => (
            <TouchableOpacity
              key={title}
              style={styles.comingSoonCard}
              activeOpacity={0.7}
              onPress={() => handleComingSoon(title)}
              accessibilityRole="button"
              accessibilityLabel={`${title}, coming soon`}
            >
              <Ionicons name={icon} size={26} color={colors.disabled} />
              <Text style={styles.comingSoonTitle}>{title}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Soon</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing['3xl'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing['2xl'],
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 18,
    color: colors.textSecondary,
    marginTop: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  actionCard: {
    flexBasis: '46%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary.light,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.md,
    minHeight: 120,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  emergencyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.emergency.main,
    borderRadius: borderRadius.xl,
    minHeight: 72,
    paddingVertical: spacing.lg,
  },
  emergencyText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.emergency.light,
  },
  ambulanceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.emergency.light,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.emergency.main,
    minHeight: 56,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  ambulanceText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.emergency.main,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: spacing['3xl'],
    marginBottom: spacing.md,
  },
  comingSoonRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  comingSoonCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    minHeight: 96,
  },
  comingSoonTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  badge: {
    backgroundColor: colors.disabled,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
});
