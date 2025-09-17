// app/_layout.tsx
import * as Notifications from 'expo-notifications';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged, User } from 'firebase/auth';
import { get, ref } from 'firebase/database'; // Import get and ref
import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase'; // Import db

// This is a simplified auth context. In a real app, you might use React Context API.
export function useAuth() { // <--- ADD 'export' HERE
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPaired, setIsPaired] = useState<boolean | null>(null); // New state for pairing status
  const [pairingLoading, setPairingLoading] = useState(true); // New state for pairing loading

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      if (firebaseUser) {
        setPairingLoading(true);
        try {
          const pairedDevicesRef = ref(db, `paired_devices/${firebaseUser.uid}`);
          const snapshot = await get(pairedDevicesRef);
          setIsPaired(snapshot.exists());
        } catch (error) {
          console.error("Error checking pairing status:", error);
          setIsPaired(false); // Assume not paired on error
        } finally {
          setPairingLoading(false);
        }
      } else {
        setIsPaired(false);
        setPairingLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  return { user, loading, isPaired, pairingLoading };
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, isPaired, pairingLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const inAuthGroup = segments[0] === '(auth)'; // Define an auth group for public routes
  const isMapScreen = segments[segments.length - 1] === 'map';
  const isSettingsScreen = segments[segments.length - 1] === 'settings';
  const isGeofenceScreen = segments[segments.length - 1] === 'geofence';
  const isAudioRecordingsScreen = segments[segments.length - 1] === 'audioRecordings';

  useEffect(() => {
    if (loading || pairingLoading) return; // Wait for auth and pairing state to be determined

    if (user && !inAuthGroup) {
      // User is logged in, trying to access protected routes
      if (isPaired) {
        // If paired, allow access to all protected routes
        // No explicit redirect needed if already on a protected route
      } else {
        // If not paired, redirect to settings (or a specific pairing screen)
        // but allow access to settings and device management within settings
        if (isMapScreen || isGeofenceScreen || isAudioRecordingsScreen) {
          router.replace('/settings'); // Redirect to settings if trying to access location-dependent features
        }
      }
    } else if (!user && !inAuthGroup) {
      // User is not logged in and trying to access protected routes, redirect to login
      router.replace('/LoginScreen');
    } else if (user && inAuthGroup) {
      // User is logged in and trying to access auth routes, redirect to map (if paired) or settings (if not paired)
      if (isPaired) {
        router.replace('/map');
      } else {
        router.replace('/settings'); // Redirect to settings to prompt pairing
      }
    }
  }, [user, loading, isPaired, pairingLoading, inAuthGroup, isMapScreen, isSettingsScreen, isGeofenceScreen, isAudioRecordingsScreen]);

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

      // Navigate to the map screen for all relevant notification types
      if (data.type === 'geofence_entry' || data.type === 'geofence_exit' || data.type === 'device_removed' || data.type === 'device_reattached') {
        router.push('/map');
      }
    });

    return () => {
      foregroundSubscription.remove();
      responseSubscription.remove();
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
