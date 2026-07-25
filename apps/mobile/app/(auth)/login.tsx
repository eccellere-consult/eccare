import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { api } from '../../lib/api';

type Step = 'phone' | 'otp';

export default function LoginScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSendOTP() {
    if (phone.length < 10) {
      Alert.alert('Enter your phone number', 'Please enter a valid 10-digit phone number.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/send-otp', { phone: `+91${phone}` });
      setStep('otp');
    } catch {
      Alert.alert('Error', 'Could not send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOTP() {
    if (otp.length < 4) {
      Alert.alert('Enter OTP', 'Please enter the code sent to your phone.');
      return;
    }
    setLoading(true);
    try {
      const data = await api.post('/auth/verify-otp', { phone: `+91${phone}`, otp });
      await SecureStore.setItemAsync('token', data.token);
      await SecureStore.setItemAsync('user', JSON.stringify(data.user));

      if (data.user.role === 'caregiver') {
        router.replace('/(caregiver)');
      } else {
        router.replace('/(elder)');
      }
    } catch {
      Alert.alert('Wrong code', 'The OTP you entered is incorrect. Please try again.');
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

        {step === 'phone' ? (
          <>
            <Text style={styles.heading}>Enter your phone number</Text>
            <View style={styles.phoneRow}>
              <Text style={styles.countryCode}>+91</Text>
              <TextInput
                style={styles.phoneInput}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={10}
                placeholder="9876543210"
                placeholderTextColor="#B0BEC5"
                autoFocus
                accessibilityLabel="Phone number"
              />
            </View>
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSendOTP}
              disabled={loading}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Send OTP'}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.heading}>Enter the code sent to{'\n'}+91 {phone}</Text>
            <TextInput
              style={styles.otpInput}
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="123456"
              placeholderTextColor="#B0BEC5"
              autoFocus
              accessibilityLabel="OTP code"
            />
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleVerifyOTP}
              disabled={loading}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>{loading ? 'Verifying...' : 'Verify'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.backLink}
              onPress={() => { setStep('phone'); setOtp(''); }}
            >
              <Text style={styles.backText}>Change phone number</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F7F3' },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  logo: {
    fontSize: 64,
    fontWeight: '900',
    color: '#0B5563',
    textAlign: 'center',
  },
  tagline: {
    fontSize: 22,
    color: '#0E6B78',
    textAlign: 'center',
    marginBottom: 48,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#052E36',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 34,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  countryCode: {
    fontSize: 24,
    fontWeight: '700',
    color: '#052E36',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#E1F2F4',
    borderRadius: 12,
  },
  phoneInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: '#052E36',
    borderWidth: 1,
    borderColor: '#DAD7CE',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    letterSpacing: 2,
  },
  otpInput: {
    fontSize: 32,
    fontWeight: '700',
    color: '#052E36',
    borderWidth: 1,
    borderColor: '#DAD7CE',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#0B5563',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  backLink: { marginTop: 20, alignItems: 'center' },
  backText: { fontSize: 18, color: '#0B5563', fontWeight: '600' },
});
