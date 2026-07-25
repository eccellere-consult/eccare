import { Stack } from 'expo-router';

export default function ElderLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0B5563' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: 'bold', fontSize: 24 },
        contentStyle: { backgroundColor: '#F8F7F3' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'EC' }} />
      <Stack.Screen name="call" options={{ title: 'Call Family' }} />
      <Stack.Screen name="medicine" options={{ title: 'Medicine' }} />
      <Stack.Screen name="doctor" options={{ title: 'Doctor' }} />
      <Stack.Screen name="food" options={{ title: 'Food' }} />
      <Stack.Screen name="emergency" options={{ title: 'Emergency' }} />
      <Stack.Screen name="add-contact" options={{ title: 'Add Contact' }} />
    </Stack>
  );
}
