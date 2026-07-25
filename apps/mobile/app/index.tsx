import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export default function Index() {
  const [checking, setChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState<string>('elder');

  useEffect(() => {
    async function check() {
      try {
        const token = await SecureStore.getItemAsync('token');
        if (token) {
          const raw = await SecureStore.getItemAsync('user');
          if (raw) {
            const user = JSON.parse(raw);
            setRole(user.role || 'elder');
          }
          setLoggedIn(true);
        }
      } catch {
        // not logged in
      }
      setChecking(false);
    }
    check();
  }, []);

  if (checking) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#00796B" />
      </View>
    );
  }

  if (!loggedIn) {
    return <Redirect href="/(auth)/login" />;
  }

  if (role === 'caregiver') {
    return <Redirect href="/(caregiver)" />;
  }

  return <Redirect href="/(elder)" />;
}

const styles = StyleSheet.create({
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF8F0' },
});
