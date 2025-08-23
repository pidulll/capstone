// screens/MapScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, Dimensions } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { db } from './firebase';
import { ref, onValue, off } from 'firebase/database';

export default function MapScreen() {
  const [childLocation, setChildLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    // Match the actual path used in your database
    const locationRef = ref(db, 'child_location/current');

    onValue(
      locationRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setChildLocation({
            latitude: data.latitude,
            longitude: data.longitude,
            timestamp: data.timestamp,
          });
          setLastUpdate(new Date(data.timestamp).toLocaleTimeString());
        } else {
          setChildLocation(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Firebase read error:', error);
        Alert.alert('Error', 'Failed to retrieve location data.');
        setLoading(false);
      }
    );

    return () => off(locationRef); // proper cleanup
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading location...</Text>
      </View>
    );
  }

  const defaultRegion = {
    latitude: childLocation?.latitude || 37.7749,
    longitude: childLocation?.longitude || -122.4194,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Child's Live Location</Text>

      <View style={styles.mapContainer}>
        <MapView style={styles.map} region={defaultRegion}>
          {childLocation && (
            <Marker
              coordinate={{
                latitude: childLocation.latitude,
                longitude: childLocation.longitude,
              }}
              title="Child's Location"
              description={`Last updated at ${lastUpdate}`}
            />
          )}
        </MapView>

        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            {childLocation
              ? `Last Updated: ${lastUpdate}`
              : 'No location data available'}
          </Text>
          <View style={styles.statusIndicator}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: childLocation ? '#4CAF50' : '#F44336' },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: childLocation ? '#4CAF50' : '#F44336' },
              ]}
            >
              {childLocation ? 'Live Tracking' : 'Offline'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#666' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginVertical: 15 },
  mapContainer: { flex: 1 },
  map: { width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.7 },
  infoContainer: { backgroundColor: 'white', padding: 15, borderRadius: 10, margin: 10 },
  infoText: { fontSize: 16, marginBottom: 10, textAlign: 'center' },
  statusIndicator: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  statusText: { fontSize: 14, fontWeight: 'bold' },
});
