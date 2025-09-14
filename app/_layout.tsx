// app/_layout.tsx
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebase'; // Import auth
import * as Notifications from 'expo-notifications'; // Import Notifications

// This is a simplified auth context. In a real app, you might use React Context API.
function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { user, loading };
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const inAuthGroup = segments[0] === '(auth)'; // Define an auth group for public routes

  useEffect(() => {
    if (loading) return; // Wait for auth state to be determined

    if (user && !inAuthGroup) {
      // User is logged in, but trying to access auth routes, redirect to map
      router.replace('/map');
    } else if (!user && !inAuthGroup) {
      // User is not logged in and trying to access protected routes, redirect to login
      router.replace('/LoginScreen');
    } else if (user && inAuthGroup) {
      // User is logged in and trying to access auth routes, redirect to map
      router.replace('/map');
    }
  }, [user, loading, inAuthGroup]);

  return <>{children}</>;
}

export default function RootLayout() {
  const router = useRouter(); // Get router instance here for notification handling

  useEffect(() => {
    // Set up notification handler for when the app is in the foreground
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    // Handle notifications received while the app is in the foreground
    const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received (foreground):', notification);
      // You can do something with the notification data here, e.g., update UI
    });

    // Handle user interaction with notifications (e.g., tapping on a notification)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response received:', response);
      const { notification } = response;
      const { data } = notification.request.content;

      if (data.type === 'geofence_entry' || data.type === 'geofence_exit') {
        // Navigate to the map screen or a specific geofence detail screen
        router.push('/map'); // Navigate to map screen
      }
    });

    return () => {
      Notifications.removeNotificationSubscription(foregroundSubscription);
      Notifications.removeNotificationSubscription(responseSubscription);
    };
  }, []); // Empty dependency array means this runs once on mount

  return (
    <AuthGuard>
      <StatusBar style="light" />
      <Stack
        initialRouteName="LoginScreen" // Set initial route to LoginScreen
        screenOptions={{
          headerStyle: {
            backgroundColor: '#007AFF',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        {/* Public routes (authentication) */}
        <Stack.Screen
          name="LoginScreen"
          options={{ headerShown: false }} // Hide header for login screen
        />
        <Stack.Screen
          name="RegisterScreen"
          options={{ headerShown: false }} // Hide header for register screen
        />

        {/* Protected routes */}
        <Stack.Screen
          name="index"
          options={{ title: 'Child Watch' }}
        />
        <Stack.Screen
          name="map"
          options={{ title: 'Live Location' }}
        />
        <Stack.Screen
          name="settings"
          options={{ title: 'Settings' }}
        />
        <Stack.Screen
          name="geofence"
          options={{ title: 'Safe Zones' }}
        />
        <Stack.Screen
          name="audioRecordings"
          options={{ title: 'Audio Recordings' }}
        />
      </Stack>
    </AuthGuard>
  );
}
