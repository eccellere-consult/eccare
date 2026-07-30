import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '@ec/design-tokens';
import { api } from '../lib/api';
import { getPinUserId, getStoredToken, logout } from '../lib/auth';

type Destination = 'checking' | 'pin-login' | 'login' | 'elder' | 'caregiver';

export default function Index() {
  const [destination, setDestination] = useState<Destination>('checking');

  useEffect(() => {
    async function check() {
      const pinUserId = await getPinUserId();
      if (pinUserId) {
        setDestination('pin-login');
        return;
      }

      const token = await getStoredToken();
      if (!token) {
        setDestination('login');
        return;
      }

      try {
        const user = await api.get('/auth/me');
        setDestination(user.role === 'caregiver' ? 'caregiver' : 'elder');
      } catch {
        await logout();
        setDestination('login');
      }
    }
    check();
  }, []);

  if (destination === 'checking') {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary.main} />
      </View>
    );
  }

  if (destination === 'pin-login') return <Redirect href="/(auth)/pin-login" />;
  if (destination === 'login') return <Redirect href="/(auth)/login" />;
  if (destination === 'caregiver') return <Redirect href="/(caregiver)" />;
  return <Redirect href="/(elder)" />;
}

const styles = StyleSheet.create({
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
});
