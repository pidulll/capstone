import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { get, push, ref, set } from 'firebase/database';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import { db } from '../firebase'; // Import auth
import { useAuth } from './_layout'; // Import useAuth

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

interface ChildLocation {
  latitude: number;
  longitude: number;
  timestamp: number;
}

interface SearchResult {
  place_name: string;
  center: [number, number]; // [longitude, latitude] from Nominatim
}

export default function GeofenceScreen() {
  const { user, isPaired, pairingLoading } = useAuth(); // Use the custom auth hook
  const mapRef = useRef<MapView>(null);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [isCreating, setIsCreating] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingGeofence, setEditingGeofence] = useState<Geofence | null>(null);
  const [selectedCenter, setSelectedCenter] = useState<{ latitude: number, longitude: number } | null>(null);
  const [radius, setRadius] = useState(100);
  const [geofenceName, setGeofenceName] = useState('');
  const [showNameModal, setShowNameModal] = useState(false);
  const [loadingChildLocation, setLoadingChildLocation] = useState(true);
  const [childLocation, setChildLocation] = useState<ChildLocation | null>(null);
  const [currentMapRegion, setCurrentMapRegion] = useState({
    latitude: 14.5995, // Default to Manila or a central location
    longitude: 120.9842,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [debugInfo, setDebugInfo] = useState('Initializing...');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null); // New state for device ID

  const router = useRouter();
  const params = useLocalSearchParams();

  // Effect to get deviceId once paired
  useEffect(() => {
    const getPairedDeviceId = async () => {
      if (user && isPaired) {
        try {
          const pairedDevicesRef = ref(db, `paired_devices/${user.uid}`);
          const snapshot = await get(pairedDevicesRef);
          if (snapshot.exists()) {
            setDeviceId(snapshot.val());
            setDebugInfo(`Paired with device ID: ${snapshot.val()}`);
          } else {
            setDeviceId(null);
            setDebugInfo('User is authenticated but no device ID found in paired_devices.');
          }
        } catch (error) {
          console.error("Error fetching paired device ID:", error);
          setDebugInfo(`Error fetching paired device ID: ${error.message}`);
          setDeviceId(null);
        }
      } else {
        setDeviceId(null);
        setDebugInfo('User not paired or not authenticated.');
      }
    };

    if (!pairingLoading) {
      getPairedDeviceId();
    }
  }, [user, isPaired, pairingLoading]);


  const fetchChildLocation = async () => {
    if (!user || !isPaired || !deviceId) {
      setDebugInfo('Not paired or device ID not available. Skipping child location fetch.');
      setLoadingChildLocation(false);
      return;
    }

    try {
      setLoadingChildLocation(true);
      setDebugInfo('Fetching child location...');
      console.log('Fetching child location from Firebase...');

      const locationRef = ref(db, `child_location/${deviceId}/current`);
      const snapshot = await get(locationRef);

      if (snapshot.exists()) {
        const data = snapshot.val();
        console.log('Child location data received:', data);

        const newLocation = {
          latitude: data.latitude,
          longitude: data.longitude,
          timestamp: data.timestamp
        };
        setChildLocation(newLocation);
        setDebugInfo('Child location loaded');

        if (isCreating && !selectedCenter) {
          setCurrentMapRegion(prev => ({
            ...prev,
            latitude: newLocation.latitude,
            longitude: newLocation.longitude,
          }));
          mapRef.current?.animateToRegion({
            latitude: newLocation.latitude,
            longitude: newLocation.longitude,
            latitudeDelta: currentMapRegion.latitudeDelta,
            longitudeDelta: currentMapRegion.longitudeDelta,
          }, 500);
        }
      } else {
        console.log('No child location data found');
        setDebugInfo('No child location data');
      }
    } catch (error) {
      console.error('Error fetching child location:', error);
      setDebugInfo(`Child location error: ${error.message}`);
    } finally {
      setLoadingChildLocation(false);
    }
  };

  const loadGeofences = async () => {
    if (!user || !isPaired || !deviceId) {
      setDebugInfo('Not paired or device ID not available. Skipping geofence load.');
      setGeofences([]);
      return;
    }

    try {
      setDebugInfo('Loading geofences...');
      console.log('Loading geofences from Firebase...');

      // MODIFIED: Point to user-specific geofences
      const geofencesRef = ref(db, `geofences/${user.uid}`);
      const snapshot = await get(geofencesRef);

      const geofenceArray: Geofence[] = [];
      if (snapshot.exists()) {
        const data = snapshot.val();
        Object.keys(data).forEach(key => {
          const geofence = { id: key, ...data[key] };
          geofenceArray.push(geofence);
        });
        console.log(`Loaded ${geofenceArray.length} geofences`);
        setDebugInfo(`Loaded ${geofenceArray.length} geofences`);
      } else {
        console.log('No geofences found');
        setDebugInfo('No geofences found');
      }
      setGeofences(geofenceArray);
    } catch (error) {
      console.error('Error loading geofences:', error);
      setDebugInfo(`Geofence load error: ${error.message}`);
      Alert.alert('Error', 'Failed to load safe zones');
    }
  };

  useEffect(() => {
    if (isPaired && deviceId && user) { // Added user to condition
      fetchChildLocation();
      loadGeofences();

      if (params.latitude && params.longitude) {
        const lat = parseFloat(params.latitude as string);
        const lng = parseFloat(params.longitude as string);
        console.log('Using coordinates from params:', lat, lng);

        setCurrentMapRegion(prev => ({
          ...prev,
          latitude: lat,
          longitude: lng,
        }));
        setSelectedCenter({ latitude: lat, longitude: lng });
        setIsCreating(true);
        setIsEditing(false);

        mapRef.current?.animateToRegion({
          latitude: lat,
          longitude: lng,
          latitudeDelta: currentMapRegion.latitudeDelta,
          longitudeDelta: currentMapRegion.longitudeDelta,
        }, 500);
      } else {
        setIsCreating(false);
        setIsEditing(false);
      }
    } else if (!pairingLoading) {
      setLoadingChildLocation(false); // Stop loading if not paired
    }
  }, [isPaired, deviceId, pairingLoading, user]); // Added user to dependency array

  useEffect(() => {
    if (searchQuery.length >= 3) {
      const debounceTimer = setTimeout(() => {
        searchLocations(searchQuery);
      }, 500);
      return () => clearTimeout(debounceTimer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const startCreating = () => {
    if (!isPaired) {
      Alert.alert("Device Not Paired", "Please pair with your child's device to create safe zones.");
      return;
    }
    if (geofences.length >= 5) {
      Alert.alert('Limit Reached', 'You can only create a maximum of 5 safe zones.');
      return;
    }
    console.log('Starting geofence creation');
    setIsCreating(true);
    setIsEditing(false);
    setEditingGeofence(null);
    setSelectedCenter(null);
    setRadius(100);
    setGeofenceName('');
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);

    if (childLocation) {
      setCurrentMapRegion(prev => ({
        ...prev,
        latitude: childLocation.latitude,
        longitude: childLocation.longitude,
      }));
      mapRef.current?.animateToRegion({
        latitude: childLocation.latitude,
        longitude: childLocation.longitude,
        latitudeDelta: currentMapRegion.latitudeDelta,
        longitudeDelta: currentMapRegion.longitudeDelta,
      }, 500);
    }
  };

  const startEditing = (geofence: Geofence) => {
    if (!isPaired) {
      Alert.alert("Device Not Paired", "Please pair with your child's device to edit safe zones.");
      return;
    }
    console.log('Starting to edit geofence:', geofence.name);
    setIsEditing(true);
    setIsCreating(false);
    setEditingGeofence(geofence);
    setSelectedCenter(geofence.center);
    setRadius(geofence.radius);
    setGeofenceName(geofence.name);
    setSearchQuery(geofence.name);
    setSearchResults([]);
    setShowSearchResults(false);

    setCurrentMapRegion(prev => ({
      ...prev,
      latitude: geofence.center.latitude,
      longitude: geofence.center.longitude,
    }));
    mapRef.current?.animateToRegion({
      latitude: geofence.center.latitude,
      longitude: geofence.center.longitude,
      latitudeDelta: currentMapRegion.latitudeDelta,
      longitudeDelta: currentMapRegion.longitudeDelta,
    }, 500);
  };

  const cancelOperation = () => {
    console.log('Cancelling operation');
    setIsCreating(false);
    setIsEditing(false);
    setEditingGeofence(null);
    setSelectedCenter(null);
    setGeofenceName('');
    setRadius(100);
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
    setShowNameModal(false);
    Keyboard.dismiss();
    loadGeofences(); // Reload geofences to clear temp marker
  };

  const saveGeofence = async () => {
    if (!selectedCenter) {
      Alert.alert('Error', 'Please set a location for the safe zone.');
      return;
    }

    if (!geofenceName.trim()) {
      setShowNameModal(true);
      return;
    }

    try {
      console.log('Saving new geofence:', geofenceName);
      // MODIFIED: Point to user-specific geofences
      const geofencesRef = ref(db, `geofences/${user.uid}`);
      const newGeofenceRef = push(geofencesRef);

      const newGeofence: Omit<Geofence, 'id'> = {
        name: geofenceName.trim(),
        center: selectedCenter,
        radius: radius,
        isActive: true,
        createdAt: Date.now()
      };

      await set(newGeofenceRef, newGeofence);
      console.log('Geofence saved successfully');

      Alert.alert('Success', 'Safe zone created successfully!');
      cancelOperation();
    } catch (error: any) {
      console.error('Error saving geofence:', error);
      Alert.alert('Error', `Failed to save safe zone: ${error.message}`);
    }
  };

  const updateGeofence = async () => {
    if (!editingGeofence || !selectedCenter) {
      Alert.alert('Error', 'No safe zone selected for editing or location not set.');
      return;
    }

    if (!geofenceName.trim()) {
      setShowNameModal(true);
      return;
    }

    try {
      console.log('Updating geofence:', editingGeofence.id);
      // MODIFIED: Point to user-specific geofence
      const geofenceRef = ref(db, `geofences/${user.uid}/${editingGeofence.id}`);

      const updatedGeofence: Geofence = {
        ...editingGeofence,
        name: geofenceName.trim(),
        center: selectedCenter,
        radius: radius,
      };

      await set(geofenceRef, updatedGeofence);
      console.log('Geofence updated successfully');

      Alert.alert('Success', 'Safe zone updated successfully!');
      cancelOperation();
    } catch (error: any) {
      console.error('Error updating geofence:', error);
      Alert.alert('Error', `Failed to update safe zone: ${error.message}`);
    }
  };

  const toggleGeofence = async (geofenceId: string, currentState: boolean) => {
    try {
      console.log('Toggling geofence:', geofenceId, 'from', currentState, 'to', !currentState);
      // MODIFIED: Point to user-specific geofence status
      const geofenceRef = ref(db, `geofences/${user.uid}/${geofenceId}/isActive`);
      await set(geofenceRef, !currentState);
      loadGeofences();
    } catch (error: any) {
      console.error('Error toggling geofence:', error);
      Alert.alert('Error', `Failed to update safe zone status: ${error.message}`);
    }
  };

  const deleteGeofence = (geofenceId: string, name: string) => {
    Alert.alert(
      'Delete Safe Zone',
      `Are you sure you want to delete "${name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Deleting geofence:', geofenceId);
              // MODIFIED: Point to user-specific geofence
              const geofenceRef = ref(db, `geofences/${user.uid}/${geofenceId}`);
              await set(geofenceRef, null);
              loadGeofences();
              if (editingGeofence && editingGeofence.id === geofenceId) {
                cancelOperation();
              }
              Alert.alert('Deleted', `Safe zone "${name}" has been deleted.`);
            } catch (error: any) {
              console.error('Error deleting geofence:', error);
              Alert.alert('Error', `Failed to delete safe zone: ${error.message}`);
            }
          }
        }
      ]
    );
  };

  const handleSaveWithName = async () => {
    if (!geofenceName.trim()) {
      Alert.alert('Error', 'Please enter a name for the safe zone');
      return;
    }
    setShowNameModal(false);
    if (isCreating) {
      await saveGeofence();
    } else if (isEditing) {
      await updateGeofence();
    }
  };

  const centerOnChildLocation = () => {
    if (childLocation) {
      setCurrentMapRegion(prev => ({
        ...prev,
        latitude: childLocation.latitude,
        longitude: childLocation.longitude,
      }));
      setSelectedCenter({
        latitude: childLocation.latitude,
        longitude: childLocation.longitude
      });
      mapRef.current?.animateToRegion({
        latitude: childLocation.latitude,
        longitude: childLocation.longitude,
        latitudeDelta: currentMapRegion.latitudeDelta,
        longitudeDelta: currentMapRegion.longitudeDelta,
      }, 500);
    } else {
      Alert.alert('Child Location Not Available', 'Cannot center on child location as it is not yet loaded or available.');
    }
  };

  const searchLocations = async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      console.log('Searching for:', query);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
      );

      if (response.ok) {
        const data = await response.json();
        const results = data.map((feature: any) => ({
          place_name: feature.display_name,
          center: [parseFloat(feature.lon), parseFloat(feature.lat)]
        }));
        console.log('Search results:', results.length);
        setSearchResults(results);
      }
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Search Error', 'Unable to search for locations.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchSelect = (result: SearchResult) => {
    const [longitude, latitude] = result.center;
    console.log('Selected search result:', result.place_name, latitude, longitude);

    setSelectedCenter({ latitude, longitude });
    setCurrentMapRegion(prev => ({
      ...prev,
      latitude: latitude,
      longitude: longitude,
    }));

    mapRef.current?.animateToRegion({
      latitude: latitude,
      longitude: longitude,
      latitudeDelta: currentMapRegion.latitudeDelta,
      longitudeDelta: currentMapRegion.longitudeDelta,
    }, 500);

    setGeofenceName(result.place_name);
    setSearchQuery(result.place_name);
    setShowSearchResults(false);
    Keyboard.dismiss();
  };

  const handleCurrentLocation = async () => {
    try {
      console.log('Getting current location...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use your current location.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      console.log('Current location:', location.coords);

      setSelectedCenter({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });
      setCurrentMapRegion(prev => ({
        ...prev,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      }));

      mapRef.current?.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: currentMapRegion.latitudeDelta,
        longitudeDelta: currentMapRegion.longitudeDelta,
      }, 500);

      setGeofenceName('My Current Location');
      setSearchQuery('My Current Location');
      setShowSearchResults(false);
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Location Error', 'Unable to get your current location.');
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  if (loadingChildLocation || pairingLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>
          {pairingLoading ? "Checking pairing status..." : "Loading map and geofences..."}
        </Text>
        <Text style={styles.debugText}>Debug: {debugInfo}</Text>

        <Pressable
          style={styles.debugButton}
          onPress={() => {
            setLoadingChildLocation(false);
            // Set dummy data for testing
            setChildLocation({ latitude: 14.5995, longitude: 120.9842, timestamp: Date.now() });
            setCurrentMapRegion({
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

  if (!isPaired) {
    return (
      <View style={styles.noDataContainer}>
        <Ionicons name="link-off" size={64} color="#FF6B6B" style={styles.noDataIcon} />
        <Text style={styles.noDataText}>Device Not Paired</Text>
        <Text style={styles.noDataSubtext}>
          Please pair with your child's device to manage safe zones.
        </Text>
        <Link href="/settings" asChild>
          <Pressable style={styles.retryButton}>
            <Ionicons name="settings" size={20} color="white" />
            <Text style={styles.retryButtonText}>Go to Settings</Text>
          </Pressable>
        </Link>
        <Text style={styles.debugText}>Debug: {debugInfo}</Text>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={() => {
      setShowSearchResults(false);
      Keyboard.dismiss();
    }}>
      <View style={styles.container}>
        {(isCreating || isEditing) && (
          <View style={styles.searchSection}>
            <View style={styles.searchContainer}>
              <View style={styles.searchInputContainer}>
                <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search for an address or place..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onFocus={() => setShowSearchResults(true)}
                  clearButtonMode="while-editing"
                />
                {searchQuery && (
                  <Pressable
                    style={styles.clearButton}
                    onPress={clearSearch}
                  >
                    <Ionicons name="close-circle" size={20} color="#666" />
                  </Pressable>
                )}
              </View>

              <Pressable style={styles.currentLocationButton} onPress={handleCurrentLocation}>
                <Ionicons name="locate" size={20} color="#007AFF" />
              </Pressable>
            </View>

            {showSearchResults && searchResults.length > 0 && (
              <View style={styles.searchResultsContainer}>
                <ScrollView
                  style={styles.searchResults}
                  keyboardShouldPersistTaps="handled"
                >
                  {searchResults.map((result, index) => (
                    <Pressable
                      key={index}
                      style={styles.searchResultItem}
                      onPress={() => handleSearchSelect(result)}
                    >
                      <Ionicons name="location-outline" size={18} color="#007AFF" />
                      <Text style={styles.searchResultText} numberOfLines={2}>
                        {result.place_name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {showSearchResults && isSearching && (
              <View style={styles.searchResultsContainer}>
                <View style={styles.loadingSearch}>
                  <ActivityIndicator size="small" color="#007AFF" />
                  <Text style={styles.loadingSearchText}>Searching...</Text>
                </View>
              </View>
            )}
          </View>
        )}

        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            // provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={currentMapRegion}
            region={currentMapRegion}
            onRegionChangeComplete={region => setCurrentMapRegion(region)}
            onPress={(e) => {
              e.persist();
              if ((isCreating || isEditing) && !selectedCenter) {
                setSelectedCenter(e.nativeEvent.coordinate);
                setCurrentMapRegion(prev => ({
                  ...prev,
                  latitude: e.nativeEvent.coordinate.latitude,
                  longitude: e.nativeEvent.coordinate.longitude,
                }));
              }
            }}
            showsUserLocation={true}
            showsMyLocationButton={false}
          >
            {/* Child Location Marker */}
            {childLocation && (
              <Marker
                coordinate={{
                  latitude: childLocation.latitude,
                  longitude: childLocation.longitude,
                }}
                title="Child's Location"
                description="Current position"
                pinColor="blue"
              />
            )}

            {/* Existing Geofences */}
            {geofences.map(geofence => (
              <React.Fragment key={geofence.id}>
                <Marker
                  coordinate={geofence.center}
                  title={geofence.name}
                  description={`Radius: ${geofence.radius}m`}
                  pinColor={geofence.isActive ? 'green' : 'red'}
                  onPress={() => startEditing(geofence)}
                />
                <Circle
                  center={geofence.center}
                  radius={geofence.radius}
                  strokeWidth={2}
                  strokeColor={geofence.isActive ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.5)'}
                  fillColor={geofence.isActive ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)'}
                />
              </React.Fragment>
            ))}

            {/* Temporary Geofence for Creation/Editing */}
            {(isCreating || isEditing) && selectedCenter && (
              <React.Fragment>
                <Marker
                  coordinate={selectedCenter}
                  title={geofenceName || (isEditing ? editingGeofence?.name : 'New Safe Zone')}
                  description={`Radius: ${radius}m`}
                  draggable
                  onDragEnd={(e) => setSelectedCenter(e.nativeEvent.coordinate)}
                  pinColor="purple"
                />
                <Circle
                  center={selectedCenter}
                  radius={radius}
                  strokeWidth={2}
                  strokeColor="rgba(128, 0, 128, 0.5)"
                  fillColor="rgba(128, 0, 128, 0.2)"
                />
              </React.Fragment>
            )}
          </MapView>

          {(isCreating || isEditing) && childLocation && (
            <Pressable style={styles.centerButton} onPress={centerOnChildLocation}>
              <Ionicons name="locate" size={24} color="#007AFF" />
            </Pressable>
          )}

          {(isCreating || isEditing) && (
            <View style={styles.instructionOverlay}>
              <Text style={styles.instructionText}>
                {selectedCenter
                  ? `Drag the purple marker to reposition the safe zone, then adjust radius below.`
                  : `Tap on the map or use the locate button to set the safe zone's center.`
                }
              </Text>
            </View>
          )}
        </View>

        <View style={styles.controlsContainer}>
          {!(isCreating || isEditing) ? (
            <ScrollView style={styles.geofenceList} showsVerticalScrollIndicator={false}>
              <View style={styles.headerRow}>
                <Text style={styles.sectionTitle}>Your Safe Zones ({geofences.length}/5)</Text>
                <Pressable style={styles.addButton} onPress={startCreating}>
                  <Ionicons name="add" size={24} color="white" />
                </Pressable>
              </View>

              {geofences.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="shield-outline" size={48} color="#C7C7CC" />
                  <Text style={styles.emptyText}>No safe zones created yet</Text>
                  <Text style={styles.emptySubtext}>Tap the '+' button to create your first safe zone.</Text>
                </View>
              ) : (
                geofences.map((geofence) => (
                  <Pressable key={geofence.id} style={styles.geofenceItem} onPress={() => startEditing(geofence)}>
                    <View style={styles.geofenceInfo}>
                      <View style={styles.geofenceHeader}>
                        <Text style={styles.geofenceName}>{geofence.name}</Text>
                        <View style={[
                          styles.statusBadge,
                          { backgroundColor: geofence.isActive ? '#34C759' : '#FF3B30' }
                        ]}>
                          <Text style={styles.statusText}>
                            {geofence.isActive ? 'Active' : 'Inactive'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.geofenceDetails}>
                        Radius: {geofence.radius}m • Created: {new Date(geofence.createdAt).toLocaleDateString()}
                      </Text>
                    </View>

                    <View style={styles.geofenceActions}>
                      <Pressable
                        style={[styles.actionButton, { backgroundColor: geofence.isActive ? '#FF9500' : '#34C759' }]}
                        onPress={() => toggleGeofence(geofence.id, geofence.isActive)}
                      >
                        <Ionicons
                          name={geofence.isActive ? 'pause' : 'play'}
                          size={16}
                          color="white"
                        />
                      </Pressable>

                      <Pressable
                        style={[styles.actionButton, { backgroundColor: '#FF3B30' }]}
                        onPress={() => deleteGeofence(geofence.id, geofence.name)}
                      >
                        <Ionicons name="trash" size={16} color="white" />
                      </Pressable>
                    </View>
                  </Pressable>
                ))
              )}
            </ScrollView>
          ) : (
            <View style={styles.creationControls}>
              <Text style={styles.creationTitle}>{isCreating ? 'Create New Safe Zone' : 'Edit Safe Zone'}</Text>

              {selectedCenter ? (
                <View style={styles.radiusControl}>
                  <Text style={styles.radiusLabel}>Radius: {radius} meters</Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={50}
                    maximumValue={500}
                    step={10}
                    value={radius}
                    onValueChange={setRadius}
                    minimumTrackTintColor="#007AFF"
                    maximumTrackTintColor="#E5E5EA"
                    thumbTintColor="#007AFF"
                  />
                </View>
              ) : (
                <View style={styles.noCenterSelected}>
                  <Ionicons name="map" size={48} color="#C7C7CC" />
                  <Text style={styles.noCenterText}>Tap on the map above or use search to select a center for your safe zone.</Text>
                </View>
              )}

              <View style={styles.buttonRow}>
                <Pressable style={styles.cancelButton} onPress={cancelOperation}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={[styles.saveButton, !selectedCenter && styles.disabledButton]}
                  onPress={() => setShowNameModal(true)}
                  disabled={!selectedCenter}
                >
                  <Text style={styles.saveButtonText}>{isCreating ? 'Save Safe Zone' : 'Update Safe Zone'}</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        <Modal
          visible={showNameModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowNameModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{isCreating ? 'Name Your Safe Zone' : 'Rename Safe Zone'}</Text>
              <TextInput
                style={styles.nameInput}
                placeholder="e.g., Home, School, Park"
                value={geofenceName}
                onChangeText={setGeofenceName}
                autoFocus={true}
                maxLength={50}
                onSubmitEditing={handleSaveWithName}
              />
              <View style={styles.modalButtons}>
                <Pressable
                  style={styles.modalCancelButton}
                  onPress={() => setShowNameModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.modalSaveButton} onPress={handleSaveWithName}>
                  <Text style={styles.modalSaveText}>{isCreating ? 'Save' : 'Update'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 20
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    color: '#333',
    fontWeight: '600',
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
  searchSection: {
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: 'white',
    zIndex: 100,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  mapContainer: {
    flex: 2,
    position: 'relative',
  },
  map: {
    width: width,
    height: '100%',
  },
  centerButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'white',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  instructionOverlay: {
    position: 'absolute',
    top: 75,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
    borderRadius: 8,
    zIndex: 5,
  },
  instructionText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '500',
  },
  controlsContainer: {
    flex: 1,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#007AFF',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  geofenceList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#e9ecef',
    borderRadius: 12,
    marginHorizontal: 10,
    marginTop: 10,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  geofenceItem: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  geofenceInfo: {
    flex: 1,
  },
  geofenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  geofenceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  geofenceDetails: {
    fontSize: 14,
    color: '#666',
  },
  geofenceActions: {
    flexDirection: 'row',
    marginLeft: 12,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  creationControls: {
    padding: 20,
  },
  creationTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 25,
    paddingHorizontal: 15,
    marginRight: 10
  },
  searchIcon: {
    marginRight: 10
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16
  },
  clearButton: {
    padding: 5
  },
  currentLocationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center'
  },
  searchResultsContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    maxHeight: 200,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 1000
  },
  searchResults: {
    flex: 1
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0'
  },
  searchResultText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#333'
  },
  loadingSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    justifyContent: 'center'
  },
  loadingSearchText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#666'
  },
  radiusControl: {
    marginBottom: 30,
    paddingHorizontal: 10,
  },
  radiusLabel: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  noCenterSelected: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#e9ecef',
    borderRadius: 12,
    marginBottom: 30,
  },
  noCenterText: {
    fontSize: 16,
    color: '#666',
    marginTop: 15,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#E5E5EA',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#C7C7CC',
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    padding: 24,
    width: width * 0.85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  nameInput: {
    borderWidth: 1,
    borderColor: '#CED4DA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    color: '#333',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#E5E5EA',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
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
