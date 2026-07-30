import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, borderRadius } from '@ec/design-tokens';
import { api } from '../../lib/api';
import { getPinUserId, getStoredUser, setStoredSession, logout } from '../../lib/auth';

export default function PinLoginScreen() {
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getStoredUser().then((user) => setName(user?.name ?? null));
  }, []);

  async function handleUnlock() {
    const userId = await getPinUserId();
    if (!userId) {
      router.replace('/(auth)/login');
      return;
    }
    if (pin.length < 4) return;

    setLoading(true);
    try {
      const data = await api.post('/auth/pin-login', { userId, pin });
      await setStoredSession(data.token, data.user);
      router.replace(data.user.role === 'caregiver' ? '/(caregiver)' : '/(elder)');
    } catch {
      Alert.alert('Incorrect PIN', 'Please try again.');
      setPin('');
    } finally {
      setLoading(false);
    }
  }

  async function handleUseEmailInstead() {
    await logout();
    router.replace('/(auth)/login');
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo}>EC</Text>
        <Text style={styles.heading}>{name ? `Welcome back, ${name}` : 'Enter your PIN'}</Text>
        <TextInput
          style={styles.pinInput}
          value={pin}
          onChangeText={setPin}
          keyboardType="number-pad"
          maxLength={6}
          secureTextEntry
          placeholder="••••"
          placeholderTextColor={colors.disabled}
          autoFocus
          accessibilityLabel="PIN"
        />
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleUnlock}
          disabled={loading}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{loading ? 'Checking...' : 'Unlock'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipLink} onPress={handleUseEmailInstead}>
          <Text style={styles.skipText}>Use email and password instead</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: 'center', padding: spacing['2xl'] },
  logo: {
    fontSize: 48,
    fontWeight: '900',
    color: colors.primary.main,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing['2xl'],
  },
  pinInput: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    textAlign: 'center',
    letterSpacing: 12,
    marginBottom: spacing['2xl'],
  },
  button: {
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.surface,
  },
  skipLink: { marginTop: spacing.xl, alignItems: 'center' },
  skipText: { fontSize: 16, color: colors.primary.main, fontWeight: '600' },
});
