// app/map.tsx - With search pin functionality
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Alert, ActivityIndicator, Dimensions, 
  Pressable, Keyboard, TouchableWithoutFeedback
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { db } from '../firebase';
import { ref, get } from 'firebase/database';
// import * as Location from 'expo-location'; // No longer needed if current location search is removed

interface ChildLocation {
  latitude: number;
  longitude: number;
  timestamp: number;
}

// interface SearchResult { // No longer needed
//   place_name: string;
//   center: [number, number];
// }

export default function MapScreen() {
  const [childLocation, setChildLocation] = useState<ChildLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<string | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // const [searchQuery, setSearchQuery] = useState(''); // Removed
  // const [searchResults, setSearchResults] = useState<SearchResult[]>([]); // Removed
  // const [isSearching, setIsSearching] = useState(false); // Removed
  // const [showSearchResults, setShowSearchResults] = useState(false); // Removed
  // const [searchedLocation, setSearchedLocation] = useState<{latitude: number; longitude: number; name: string} | null>(null); // Removed

  const fetchLocationData = async () => {
    try {
      setIsRefreshing(true);
      const locationRef = ref(db, 'child_location/current');
      const snapshot = await get(locationRef);

      if (snapshot.exists()) {
        const data = snapshot.val();
        const newLocation = {
          latitude: data.latitude,
          longitude: data.longitude,
          timestamp: data.timestamp
        };

        setChildLocation(newLocation);
        setRegion({
          latitude: newLocation.latitude,
          longitude: newLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01
        });
        setLastUpdate(new Date(data.timestamp).toLocaleTimeString());
        setLastFetch(new Date().toLocaleTimeString());
      } else {
        if (loading) {
          Alert.alert('No Location Data', 'No location data available for your child. Please check if their device is connected.');
        }
      }
    } catch (error) {
      console.error('Firebase read error:', error);
      Alert.alert('Connection Error', 'Unable to retrieve location data. Please check your internet connection.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Removed searchLocations, handleSearchSelect, handleCurrentLocation, clearSearch functions

  useEffect(() => {
    fetchLocationData();
    const interval = setInterval(fetchLocationData, 60000);
    return () => clearInterval(interval);
  }, []);

  // Removed useEffect for searchQuery

  const handleZoomChange = (value: number) => {
    if (region) {
      setRegion({
        ...region,
        latitudeDelta: value,
        longitudeDelta: value
      });
    }
  };

  const handleRefresh = () => {
    fetchLocationData();
    // clearSearch(); // Removed
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>Finding your child's location...</Text>
        <Text style={styles.loadingSubtext}>This may take a moment</Text>
      </View>
    );
  }

  if (!childLocation || !region) {
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
        <Pressable style={styles.retryButton} onPress={handleRefresh}>
          <Ionicons name="refresh" size={20} color="white" />
          <Text style={styles.retryButtonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={() => {
      // setShowSearchResults(false); // Removed
      Keyboard.dismiss();
    }}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Child's Location</Text>
          <Pressable style={styles.refreshButton} onPress={handleRefresh} disabled={isRefreshing}>
            <Ionicons name="refresh" size={22} color={isRefreshing ? "#CCC" : "#4A90E2"} />
          </Pressable>
        </View>

        {/* Removed Search Bar */}
        {/* Removed Search Results */}

        <MapView style={styles.map} region={region} onRegionChangeComplete={setRegion}>
          {/* Child's Location Marker */}
          <Marker
            coordinate={{
              latitude: childLocation.latitude,
              longitude: childLocation.longitude,
            }}
            title="Your Child's Location"
            description={`Last updated: ${lastUpdate}`}
            pinColor="#FF6B6B"
          />

          {/* Removed Searched Location Marker */}
        </MapView>

        {/* Zoom Controls - Moved down and made smaller */}
        <View style={styles.zoomContainer}>
          <Text style={styles.zoomLabel}>Zoom Level</Text>
          <Slider
            style={styles.slider}
            minimumValue={0.002}
            maximumValue={0.2}
            value={region.latitudeDelta}
            step={0.002}
            onValueChange={handleZoomChange}
            minimumTrackTintColor="#4A90E2"
            maximumTrackTintColor="#E8E8E8"
            thumbTintColor="#4A90E2"
          />
        </View>

        {/* Safe Zones Button */}
        <View style={styles.fabContainer}>
          <Link href="/geofence" asChild>
            <Pressable style={styles.fab}>
              <Ionicons name="shield" size={24} color="white" />
              <Text style={styles.fabText}>Safe Zones</Text>
            </Pressable>
          </Link>
        </View>

        {/* Information Panel */}
        <View style={styles.infoContainer}>
          <View style={styles.statusSection}>
            <View style={styles.statusIndicator}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.statusText}>Location Active</Text>
            </View>
            <Text style={styles.updateInfo}>Updates every minute</Text>
          </View>

          <View style={styles.locationDetails}>
            <View style={styles.coordinateRow}>
              <Ionicons name="navigate" size={16} color="#666" />
              <Text style={styles.coordinatesText}>
                {childLocation.latitude.toFixed(6)}, {childLocation.longitude.toFixed(6)}
              </Text>
            </View>
            <Text style={styles.lastUpdated}>Last updated: ${lastUpdate}</Text>
            <Text style={styles.lastChecked}>Last checked: ${lastFetch}</Text>
          </View>
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
  // Removed Search Container styles
  // Removed Search Results styles
  map: {
    flex: 1,
    width: width
  },
  zoomContainer: {
    position: 'absolute',
    top: 130, // Moved down to be below the header
    left: 20,
    right: 20,
    backgroundColor: 'white',
    padding: 12, // Reduced padding to make it smaller
    borderRadius: 10, // Slightly smaller radius
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  zoomLabel: {
    fontSize: 13, // Smaller font
    fontWeight: '600',
    color: '#333',
    marginBottom: 6 // Reduced margin
  },
  slider: {
    width: '100%',
    height: 32 // Smaller slider height
  },
  // Safe Zones button positioned above the info container
  fabContainer: {
    position: 'absolute',
    bottom: 160,
    right: 20,
    zIndex: 10
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
    shadowRadius: 6
  },
  fabText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16
  },
  // Information Panel
  infoContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8
  },
  statusSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0'
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50'
  },
  updateInfo: {
    fontSize: 12,
    color: '#666'
  },
  locationDetails: {
    gap: 6
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

