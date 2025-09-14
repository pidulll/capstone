import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Alert, ActivityIndicator, Dimensions,
  Pressable, Keyboard, TouchableWithoutFeedback
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Circle } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { db } from '../firebase';
import { ref, get, onValue, off } from 'firebase/database';
import * as Notifications from 'expo-notifications'; // Import Notifications

interface ChildLocation {
  latitude: number;
  longitude: number;
  timestamp: number;
}

interface Geofence {
  id: string;
  name: string;
  center: {
    latitude: number;
    longitude: number;
  };
  radius: number;
  isActive: boolean;
  createdAt: number;
}

export default function MapScreen() {
  const [childLocation, setChildLocation] = useState<ChildLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<string | null>(null);
  const [currentRegion, setCurrentRegion] = useState({
    latitude: 14.5995, // Default to Manila or a central location
    longitude: 120.9842,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [debugInfo, setDebugInfo] = useState('Initializing...');
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [geofenceStatus, setGeofenceStatus] = useState<'inside' | 'outside' | 'unknown'>('unknown');
  const [previousGeofenceStatus, setPreviousGeofenceStatus] = useState<'inside' | 'outside' | 'unknown'>('unknown'); // New state for previous status

  const mapRef = useRef<MapView>(null);

  // Haversine formula to calculate distance between two lat/lon points
  const haversineDistance = (coords1: { latitude: number; longitude: number }, coords2: { latitude: number; longitude: number }) => {
    const toRad = (x: number) => x * Math.PI / 180;
    const R = 6371e3; // Earth's radius in meters

    const lat1 = toRad(coords1.latitude);
    const lon1 = toRad(coords1.longitude);
    const lat2 = toRad(coords2.latitude);
    const lon2 = toRad(coords2.longitude);

    const deltaLat = lat2 - lat1;
    const deltaLon = lon2 - lon1;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  const checkGeofenceStatus = useCallback(async (childLoc: ChildLocation | null, activeGeofences: Geofence[]) => {
    if (!childLoc || activeGeofences.length === 0) {
      setGeofenceStatus('unknown');
      setPreviousGeofenceStatus('unknown'); // Reset if no child/geofences
      return;
    }

    let currentStatus: 'inside' | 'outside' = 'outside';
    let enteredGeofenceName: string | null = null;

    for (const geofence of activeGeofences) {
      if (geofence.isActive) {
        const distance = haversineDistance(childLoc, geofence.center);
        if (distance <= geofence.radius) {
          currentStatus = 'inside';
          enteredGeofenceName = geofence.name;
          break; // Child is inside at least one active geofence
        }
      }
    }

    setGeofenceStatus(currentStatus);

    // Notification Logic
    if (previousGeofenceStatus !== 'unknown') { // Only trigger if we have a previous state
      if (currentStatus === 'inside' && previousGeofenceStatus === 'outside') {
        // Child entered a safe zone
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Safe Zone Alert!",
            body: `Your child has entered ${enteredGeofenceName || 'a safe zone'}.`,
            data: { type: 'geofence_entry', geofenceName: enteredGeofenceName },
          },
          trigger: null, // Send immediately
        });
        console.log(`Notification: Child entered ${enteredGeofenceName || 'a safe zone'}`);
      } else if (currentStatus === 'outside' && previousGeofenceStatus === 'inside') {
        // Child exited all safe zones
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Safe Zone Alert!",
            body: "Your child has exited all safe zones!",
            data: { type: 'geofence_exit' },
          },
          trigger: null, // Send immediately
        });
        console.log("Notification: Child exited all safe zones");
      }
    }
    setPreviousGeofenceStatus(currentStatus); // Update previous status for next check
  }, [previousGeofenceStatus]); // Add previousGeofenceStatus to dependency array

  const fetchLocationAndGeofenceData = async () => {
    try {
      setIsRefreshing(true);
      setDebugInfo('Fetching location and geofence data...');
      console.log('Fetching data from Firebase...');

      const locationRef = ref(db, 'child_location/current');
      const geofencesRef = ref(db, 'geofences');

      const [locationSnapshot, geofencesSnapshot] = await Promise.all([
        get(locationRef),
        get(geofencesRef)
      ]);

      // Process Location Data
      let newChildLocation: ChildLocation | null = null;
      if (locationSnapshot.exists()) {
        const data = locationSnapshot.val();
        newChildLocation = {
          latitude: data.latitude,
          longitude: data.longitude,
          timestamp: data.timestamp
        };
        setChildLocation(newChildLocation);
        setLastUpdate(new Date(data.timestamp).toLocaleTimeString());
        setDebugInfo('Location data loaded successfully');

        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: newChildLocation.latitude,
            longitude: newChildLocation.longitude,
            latitudeDelta: currentRegion.latitudeDelta,
            longitudeDelta: currentRegion.longitudeDelta,
          }, 1000);
        }
        setCurrentRegion(prev => ({
          ...prev,
          latitude: newChildLocation!.latitude,
          longitude: newChildLocation!.longitude,
        }));
      } else {
        console.log('No child location data found in Firebase');
        setDebugInfo('No child location data');
        if (loading) {
          Alert.alert('No Location Data', 'No location data available for your child. Please check if their device is connected.');
        }
        setChildLocation(null);
      }

      // Process Geofence Data
      const loadedGeofences: Geofence[] = [];
      if (geofencesSnapshot.exists()) {
        const data = geofencesSnapshot.val();
        Object.keys(data).forEach(key => {
          loadedGeofences.push({ id: key, ...data[key] });
        });
        console.log(`Loaded ${loadedGeofences.length} geofences`);
      } else {
        console.log('No geofences found');
      }
      setGeofences(loadedGeofences);

      // Check Geofence Status
      checkGeofenceStatus(newChildLocation, loadedGeofences);

      setLastFetch(new Date().toLocaleTimeString());

    } catch (error) {
      console.error('Firebase read error:', error);
      setDebugInfo(`Error: ${error.message}`);
      Alert.alert('Connection Error', 'Unable to retrieve data. Please check your internet connection.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Request notification permissions
    const requestPermissions = async () => {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        Alert.alert('Permission required', 'Push notifications are required to alert you about safe zone changes.');
        return;
      }
    };

    requestPermissions();

    fetchLocationAndGeofenceData();
    const interval = setInterval(fetchLocationAndGeofenceData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [checkGeofenceStatus]); // Ensure checkGeofenceStatus is a dependency

  // Listen for real-time updates to geofences (optional, but good for dynamic status)
  useEffect(() => {
    const geofencesRef = ref(db, 'geofences');
    const unsubscribe = onValue(geofencesRef, (snapshot) => {
      const loadedGeofences: Geofence[] = [];
      if (snapshot.exists()) {
        const data = snapshot.val();
        Object.keys(data).forEach(key => {
          loadedGeofences.push({ id: key, ...data[key] });
        });
      }
      setGeofences(loadedGeofences);
      checkGeofenceStatus(childLocation, loadedGeofences); // Re-check status on geofence change
    }, (error) => {
      console.error('Error real-time fetching geofences:', error);
    });

    return () => off(geofencesRef, 'value', unsubscribe);
  }, [childLocation, checkGeofenceStatus]);

  const handleRefresh = () => {
    fetchLocationAndGeofenceData();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>Finding your child's location...</Text>
        <Text style={styles.loadingSubtext}>This may take a moment</Text>
        <Text style={styles.debugText}>Debug: {debugInfo}</Text>

        <Pressable
          style={styles.debugButton}
          onPress={() => {
            setLoading(false);
            setChildLocation({ latitude: 14.5995, longitude: 120.9842, timestamp: Date.now() });
            setCurrentRegion({
              latitude: 14.5995,
              longitude: 120.9842,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            });
          }}
        >
          <Text style={styles.debugButtonText}>Skip Loading (Debug)</Text>
        </Pressable>
      </View>
    );
  }

  if (!childLocation) {
    return (
      <View style={styles.noDataContainer}>
        <Ionicons name="location-off" size={64} color="#FF6B6B" style={styles.noDataIcon} />
        <Text style={styles.noDataText}>Location Unavailable</Text>
        <Text style={styles.noDataSubtext}>
          We can't find your child's location. Please check:
        </Text>
        <View style={styles.troubleshootList}>
          <Text style={styles.troubleshootItem}>• Child's device is turned on</Text>
          <Text style={styles.troubleshootItem}>• Location sharing is enabled</Text>
          <Text style={styles.troubleshootItem}>• Internet connection is active</Text>
        </View>
        <Text style={styles.debugText}>Debug: {debugInfo}</Text>
        <Pressable style={styles.retryButton} onPress={handleRefresh}>
          <Ionicons name="refresh" size={20} color="white" />
          <Text style={styles.retryButtonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={() => {
      Keyboard.dismiss();
    }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Child's Location</Text>
          <Pressable style={styles.refreshButton} onPress={handleRefresh} disabled={isRefreshing}>
            <Ionicons name="refresh" size={22} color={isRefreshing ? "#CCC" : "#4A90E2"} />
          </Pressable>
        </View>

        <View style={styles.mapSection}>
          <MapView
            ref={mapRef}
            // provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={currentRegion}
            region={currentRegion}
            onRegionChangeComplete={region => setCurrentRegion(region)}
            showsUserLocation={true}
            showsMyLocationButton={false}
            // The MapView component from react-native-maps supports pinch-to-zoom by default.
            // No specific prop is needed to enable it, and removing the slider is enough.
          >
            {childLocation && (
              <Marker
                coordinate={{
                  latitude: childLocation.latitude,
                  longitude: childLocation.longitude,
                }}
                title="Child's Location"
                description={`Last updated: ${lastUpdate}`}
                pinColor="#007AFF"
              />
            )}
            {geofences.map(geofence => geofence.isActive && (
              <Circle
                key={geofence.id}
                center={geofence.center}
                radius={geofence.radius}
                strokeWidth={2}
                strokeColor={'rgba(0, 255, 0, 0.5)'}
                fillColor={'rgba(0, 255, 0, 0.2)'}
              />
            ))}
          </MapView>

          {/* Audio Button on Map */}
          <Link href="/audioRecordings" asChild>
            <Pressable style={styles.audioFab}>
              <Ionicons name="mic" size={24} color="white" />
              <Text style={styles.audioFabText}>Recordings</Text>
            </Pressable>
          </Link>

          {/* Zoom Slider on Map - REMOVED */}
          {/*
          <View style={styles.zoomContainer}>
            <Text style={styles.zoomLabel}>Zoom Level</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              value={1 - (currentRegion.latitudeDelta / 0.2)}
              onValueChange={handleZoomChange}
              minimumTrackTintColor="#4A90E2"
              maximumTrackTintColor="#E8E8E8"
              thumbTintColor="#4A90E2"
            />
          </View>
          */}
        </View>

        <View style={styles.infoContainer}>
          {/* Pulse Monitoring / Status (Placeholder) */}
          <View style={styles.statusSection}>
            <Ionicons name="heart-outline" size={20} color="#FF6B6B" />
            <Text style={styles.statusText}>Pulse Monitoring: N/A</Text>
          </View>

          {/* Geofence Status */}
          <View style={styles.statusSection}>
            <Ionicons
              name={geofenceStatus === 'inside' ? 'shield-checkmark' : 'shield-outline'}
              size={20}
              color={geofenceStatus === 'inside' ? '#4CAF50' : '#FF9500'}
            />
            <Text style={[
              styles.statusText,
              { color: geofenceStatus === 'inside' ? '#4CAF50' : '#FF9500' }
            ]}>
              Geofence Status: {geofenceStatus === 'inside' ? 'Inside Safe Zone' : geofenceStatus === 'outside' ? 'Outside Safe Zone' : 'Checking...'}
            </Text>
          </View>

          {/* Latitude and Longitude */}
          <View style={styles.locationDetails}>
            <View style={styles.coordinateRow}>
              <Ionicons name="navigate" size={16} color="#666" />
              <Text style={styles.coordinatesText}>
                Lat: {childLocation.latitude.toFixed(6)}, Lon: {childLocation.longitude.toFixed(6)}
              </Text>
            </View>
            <Text style={styles.lastUpdated}>Last updated: {lastUpdate}</Text>
            <Text style={styles.lastChecked}>Last checked: {lastFetch}</Text>
          </View>
        </View>

        {/* FAB Container for both Safe Zones and Settings */}
        <View style={styles.bottomFabContainer}>
          {/* Settings Button */}
          <Link href="/settings" asChild>
            <Pressable style={styles.settingsFab}>
              <Ionicons name="settings" size={24} color="white" />
              <Text style={styles.fabText}>Settings</Text>
            </Pressable>
          </Link>

          {/* Original FAB for Safe Zones */}
          <Link href="/geofence" asChild>
            <Pressable style={styles.fab}>
              <Ionicons name="shield" size={24} color="white" />
              <Text style={styles.fabText}>Safe Zones</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 20
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    color: '#333',
    fontWeight: '600',
    textAlign: 'center'
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center'
  },
  debugText: {
    marginTop: 10,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic'
  },
  debugButton: {
    marginTop: 20,
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5
  },
  debugButtonText: {
    color: 'white',
    fontSize: 14
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8'
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333'
  },
  refreshButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0'
  },
  mapSection: {
    flex: 2, // Map takes 2 parts of available space
    position: 'relative', // For positioning FABs on top
  },
  map: {
    width: width,
    height: '100%'
  },
  // Removed zoomContainer and slider styles as they are no longer needed
  /*
  zoomContainer: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  zoomLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6
  },
  slider: {
    width: '100%',
    height: 32
  },
  */
  audioFab: {
    position: 'absolute',
    bottom: 20, // Positioned inside the map section
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 25,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  audioFabText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16
  },
  bottomFabContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between', // Distribute items horizontally
    alignItems: 'center',
    zIndex: 10,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#4A90E2',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 25,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  settingsFab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#6c757d', // A different color for settings
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 25,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  fabText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16
  },
  infoContainer: {
    flex: 1, // Info section takes 1 part of available space
    backgroundColor: 'white',
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    marginTop: -16, // Overlap with map section slightly for rounded corners
  },
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0'
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333'
  },
  updateInfo: {
    fontSize: 12,
    color: '#666'
  },
  locationDetails: {
    gap: 6,
    marginTop: 10,
  },
  coordinateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  coordinatesText: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'monospace'
  },
  lastUpdated: {
    fontSize: 12,
    color: '#666'
  },
  lastChecked: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic'
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 40
  },
  noDataIcon: {
    marginBottom: 20
  },
  noDataText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center'
  },
  noDataSubtext: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center'
  },
  troubleshootList: {
    marginBottom: 24,
    alignItems: 'flex-start'
  },
  troubleshootItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#4A90E2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16
  }
});
