import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@ec/design-tokens';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary.main },
          headerTintColor: colors.surface,
          headerTitleStyle: { fontWeight: 'bold', fontSize: 24 },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(elder)" options={{ headerShown: false }} />
        <Stack.Screen name="(caregiver)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
