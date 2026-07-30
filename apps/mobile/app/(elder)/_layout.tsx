import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { colors } from '@ec/design-tokens';
import { registerForPushNotifications } from '../../lib/notifications';

export default function ElderLayout() {
  useEffect(() => {
    registerForPushNotifications();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary.main },
        headerTintColor: colors.surface,
        headerTitleStyle: { fontWeight: 'bold', fontSize: 24 },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'EC' }} />
      <Stack.Screen name="call" options={{ title: 'Call Family' }} />
      <Stack.Screen name="dial-pad" options={{ title: 'Dial Pad' }} />
      <Stack.Screen name="medicine" options={{ title: 'Medicine' }} />
      <Stack.Screen name="speak" options={{ title: 'Speak to EC' }} />
      <Stack.Screen name="emergency" options={{ title: 'Emergency' }} />
      <Stack.Screen name="add-contact" options={{ title: 'Add Contact' }} />
    </Stack>
  );
}
