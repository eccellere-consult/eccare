import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
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
  speakBg: '#854F0B',
  speakText: '#FAEEDA',
};

const actions = [
  { route: '/(elder)/call' as const, title: 'Call Family', icon: 'call' as const },
  { route: '/(elder)/medicine' as const, title: 'Medicine', icon: 'pill' as const },
  { route: '/(elder)/doctor' as const, title: 'Doctor', icon: 'stethoscope' as const },
  { route: '/(elder)/food' as const, title: 'Food', icon: 'restaurant' as const },
];

function TileIcon({ name, size, color }: { name: string; size: number; color: string }) {
  if (name === 'pill' || name === 'stethoscope') {
    return <MaterialCommunityIcons name={name} size={size} color={color} />;
  }
  return <Ionicons name={name as any} size={size} color={color} />;
}

export default function ElderHome() {
  const router = useRouter();

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
