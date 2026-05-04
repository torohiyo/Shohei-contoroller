import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="add"
        options={{ presentation: 'modal', title: 'タスク追加', headerStyle: { backgroundColor: '#fff' } }}
      />
    </Stack>
  );
}
