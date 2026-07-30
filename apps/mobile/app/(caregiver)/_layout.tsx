import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { colors } from '@ec/design-tokens';
import { registerForPushNotifications } from '../../lib/notifications';

export default function CaregiverLayout() {
  useEffect(() => {
    registerForPushNotifications();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary.main },
        headerTintColor: colors.surface,
        headerTitleStyle: { fontWeight: 'bold', fontSize: 20 },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'EC Companion' }} />
    </Stack>
  );
}
