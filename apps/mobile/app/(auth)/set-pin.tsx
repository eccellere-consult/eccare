import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, spacing, borderRadius } from '@ec/design-tokens';
import { api } from '../../lib/api';
import { setPinUserId } from '../../lib/auth';

export default function SetPinScreen() {
  const router = useRouter();
  const { userId, role } = useLocalSearchParams<{ userId: string; role: string }>();
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);

  function goHome() {
    router.replace(role === 'caregiver' ? '/(caregiver)' : '/(elder)');
  }

  function handleContinue() {
    if (pin.length < 4) {
      Alert.alert('PIN too short', 'Choose a PIN with 4 to 6 digits.');
      return;
    }
    setStep('confirm');
  }

  async function handleConfirm() {
    if (confirmPin !== pin) {
      Alert.alert("PINs don't match", 'Enter the same PIN both times.');
      setConfirmPin('');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/set-pin', { pin });
      if (userId) await setPinUserId(userId);
      goHome();
    } catch (err) {
      Alert.alert('Could not save PIN', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.heading}>
          {step === 'enter' ? 'Choose a PIN' : 'Enter it again'}
        </Text>
        <Text style={styles.subtext}>
          {step === 'enter'
            ? "You'll use this instead of your password to open EC on this phone."
            : 'Just to make sure you typed it correctly.'}
        </Text>
        <TextInput
          style={styles.pinInput}
          value={step === 'enter' ? pin : confirmPin}
          onChangeText={step === 'enter' ? setPin : setConfirmPin}
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
          onPress={step === 'enter' ? handleContinue : handleConfirm}
          disabled={loading}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>
            {loading ? 'Saving...' : step === 'enter' ? 'Continue' : 'Confirm PIN'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipLink} onPress={goHome}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: 'center', padding: spacing['2xl'] },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtext: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing['2xl'],
    lineHeight: 22,
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
