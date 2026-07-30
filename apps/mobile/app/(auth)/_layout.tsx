import { Stack } from 'expo-router';
import { colors } from '@ec/design-tokens';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="set-pin" />
      <Stack.Screen name="pin-login" />
    </Stack>
  );
}
