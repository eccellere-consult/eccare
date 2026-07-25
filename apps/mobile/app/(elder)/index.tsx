import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const colors = {
  bg: '#F8F7F3',
  tileBg: '#E1F2F4',
  avatarBg: '#A8DCE3',
  iconColor: '#0B5563',
  titleColor: '#052E36',
  subtitleColor: '#0E6B78',
  emergencyBg: '#A32D2D',
  emergencyText: '#FCEBEB',
  ambulanceBg: '#FCEBEB',
  ambulanceBorder: '#A32D2D',
  ambulanceText: '#A32D2D',
  speakBg: '#854F0B',
  speakText: '#FAEEDA',
  mutedBg: '#EDEBE4',
  mutedIcon: '#8A897F',
  mutedText: '#5C5B54',
  badgeBg: '#DAD7CE',
  badgeText: '#5C5B54',
};

const AMBULANCE_NUMBER = '108';

const actions = [
  { route: '/(elder)/call' as const, title: 'Call Family', icon: 'call' as const },
  { route: '/(elder)/medicine' as const, title: 'Medicine', icon: 'pill' as const },
  { route: '/(elder)/doctor' as const, title: 'Doctor', icon: 'stethoscope' as const },
  { route: '/(elder)/food' as const, title: 'Food', icon: 'restaurant' as const },
];

const comingSoon = [
  { title: 'Social', icon: 'chatbubbles' as const },
  { title: 'Daily Services', icon: 'construct' as const },
  { title: 'Shopping', icon: 'cart' as const },
];

function TileIcon({ name, size, color }: { name: string; size: number; color: string }) {
  if (name === 'pill' || name === 'stethoscope') {
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
            <Ionicons name="person" size={22} color={colors.iconColor} />
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
              <TileIcon name={icon} size={34} color={colors.iconColor} />
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
          <Ionicons name="warning" size={26} color={colors.emergencyText} />
          <Text style={styles.emergencyText}>Need Help Now</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.ambulanceBar}
          activeOpacity={0.8}
          onPress={handleAmbulance}
          accessibilityRole="button"
          accessibilityLabel="Call ambulance"
        >
          <MaterialCommunityIcons name="ambulance" size={24} color={colors.ambulanceText} />
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
              <Ionicons name={icon} size={26} color={colors.mutedIcon} />
              <Text style={styles.comingSoonTitle}>{title}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Soon</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Floating Voice Button */}
      <TouchableOpacity
        style={styles.voiceButton}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Speak to EC"
      >
        <Ionicons name="mic" size={24} color={colors.speakText} />
        <Text style={styles.voiceLabel}>Speak</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.avatarBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.titleColor,
  },
  subtitle: {
    fontSize: 18,
    color: colors.subtitleColor,
    marginTop: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 16,
  },
  actionCard: {
    flexBasis: '46%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.tileBg,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 12,
    minHeight: 120,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.titleColor,
    textAlign: 'center',
  },
  emergencyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.emergencyBg,
    borderRadius: 20,
    minHeight: 72,
    paddingVertical: 16,
  },
  emergencyText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.emergencyText,
  },
  ambulanceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.ambulanceBg,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.ambulanceBorder,
    minHeight: 56,
    paddingVertical: 12,
    marginTop: 12,
  },
  ambulanceText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ambulanceText,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.subtitleColor,
    marginTop: 28,
    marginBottom: 12,
  },
  comingSoonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  comingSoonCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.mutedBg,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 8,
    minHeight: 96,
  },
  comingSoonTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.mutedText,
    textAlign: 'center',
  },
  badge: {
    backgroundColor: colors.badgeBg,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.badgeText,
  },
  voiceButton: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -55,
    width: 110,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.speakBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 6,
    shadowColor: colors.speakBg,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  voiceLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.speakText,
  },
});
