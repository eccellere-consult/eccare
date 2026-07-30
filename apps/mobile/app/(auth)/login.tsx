import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, borderRadius } from '@ec/design-tokens';
import { api } from '../../lib/api';
import { setStoredSession } from '../../lib/auth';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.includes('@') || password.length < 1) {
      Alert.alert('Enter your details', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const data = await api.post('/auth/login', { email, password });
      await setStoredSession(data.token, data.user);
      router.replace({ pathname: '/(auth)/set-pin', params: { userId: data.user.id, role: data.user.role } });
    } catch (err) {
      Alert.alert('Sign in failed', err instanceof Error ? err.message : 'Incorrect email or password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.logo}>EC</Text>
        <Text style={styles.tagline}>Just Easy.</Text>

        <Text style={styles.heading}>Sign in</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="you@example.com"
          placeholderTextColor={colors.disabled}
          autoFocus
          accessibilityLabel="Email"
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Password"
          placeholderTextColor={colors.disabled}
          accessibilityLabel="Password"
        />
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{loading ? 'Signing in...' : 'Sign in'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: 'center', padding: spacing['2xl'] },
  logo: {
    fontSize: 64,
    fontWeight: '900',
    color: colors.primary.main,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 22,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing['5xl'],
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing['2xl'],
  },
  input: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    marginBottom: spacing.lg,
  },
  button: {
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.surface,
  },
});
