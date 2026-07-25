import { View, Text, TouchableOpacity, StyleSheet, Alert, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

export default function EmergencyScreen() {
  function handleSOS() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Vibration.vibrate([0, 200, 100, 200]);

    Alert.alert(
      'Send Emergency Alert?',
      'This will notify all your family members and emergency contacts with your location.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Send SOS',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Help is coming', 'Your family has been notified. Stay calm.');
            // TODO: Call POST /api/v1/emergency/sos with GPS location
          },
        },
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
        accessibilityRole="button"
        accessibilityLabel="Send Emergency SOS Alert"
      >
        <Ionicons name="warning" size={56} color="#FCEBEB" />
        <Text style={styles.sosText}>SOS</Text>
        <Text style={styles.sosHint}>Tap to send alert</Text>
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
    backgroundColor: '#F8F7F3',
    padding: 20,
    alignItems: 'center',
  },
  heading: {
    fontSize: 32,
    fontWeight: '700',
    color: '#A32D2D',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 18,
    color: '#0F6E56',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 40,
    lineHeight: 28,
  },
  sosButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#A32D2D',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 12,
    shadowColor: '#791F1F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  sosText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FCEBEB',
    marginTop: 4,
  },
  sosHint: {
    fontSize: 15,
    color: '#FCEBEB',
    opacity: 0.9,
    marginTop: 4,
  },
  reassurance: {
    fontSize: 18,
    color: '#0F6E56',
    textAlign: 'center',
    marginTop: 40,
    lineHeight: 28,
    paddingHorizontal: 20,
  },
});
