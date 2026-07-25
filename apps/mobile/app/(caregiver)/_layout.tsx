import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function CaregiverLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#00796B' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: 'bold', fontSize: 20 },
        tabBarStyle: { backgroundColor: '#FFFFFF', borderTopColor: '#E0F2F1', height: 64 },
        tabBarActiveTintColor: '#00796B',
        tabBarInactiveTintColor: '#B0BEC5',
        tabBarLabelStyle: { fontSize: 14, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🔔</Text>,
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          title: 'Reminders',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>💊</Text>,
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: 'Contacts',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>👥</Text>,
        }}
      />
    </Tabs>
  );
}
