import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Vibration, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@ec/design-tokens';
import { api } from '../../lib/api';

export default function EmergencyScreen() {
  const [sending, setSending] = useState(false);

  async function getLocationSafely(): Promise<{ lat?: number; lng?: number }> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return {};
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return { lat: position.coords.latitude, lng: position.coords.longitude };
    } catch {
      return {};
    }
  }

  async function sendSOS() {
    setSending(true);
    try {
      const { lat, lng } = await getLocationSafely();
      await api.post('/emergency/sos', { triggerType: 'manual', lat, lng });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Help is coming', 'Your family has been notified. Stay calm.');
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Could not send alert',
        err instanceof Error ? err.message : 'Please check your connection and try again.',
      );
    } finally {
      setSending(false);
    }
  }

  function handleSOS() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Vibration.vibrate([0, 200, 100, 200]);

    Alert.alert(
      'Send Emergency Alert?',
      'This will notify all your family members and emergency contacts with your location.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, Send SOS', style: 'destructive', onPress: sendSOS },
      ],
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Emergency Help</Text>
      <Text style={styles.subtitle}>
        Press the big red button below to alert your family and emergency contacts.
      </Text>

      <TouchableOpacity
        style={styles.sosButton}
        activeOpacity={0.8}
        onPress={handleSOS}
        disabled={sending}
        accessibilityRole="button"
        accessibilityLabel="Send Emergency SOS Alert"
      >
        {sending ? (
          <ActivityIndicator size="large" color={colors.emergency.light} />
        ) : (
          <>
            <Ionicons name="warning" size={56} color={colors.emergency.light} />
            <Text style={styles.sosText}>SOS</Text>
            <Text style={styles.sosHint}>Tap to send alert</Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.reassurance}>
        Your family will receive your location and a notification immediately.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
    alignItems: 'center',
  },
  heading: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.emergency.main,
    marginTop: spacing.xl,
  },
  subtitle: {
    fontSize: 18,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing['4xl'],
    lineHeight: 28,
  },
  sosButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.emergency.main,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 12,
    shadowColor: colors.emergency.dark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  sosText: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.emergency.light,
    marginTop: spacing.xs,
  },
  sosHint: {
    fontSize: 15,
    color: colors.emergency.light,
    opacity: 0.9,
    marginTop: spacing.xs,
  },
  reassurance: {
    fontSize: 18,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing['4xl'],
    lineHeight: 28,
    paddingHorizontal: spacing.xl,
  },
});
