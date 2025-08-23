// app/geofence.tsx - Complete Geofencing Screen with Child Location Centering
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Dimensions,
  TextInput,
  ScrollView,
  Modal,
  ActivityIndicator,
  Keyboard, // Added
  TouchableWithoutFeedback // Added
} from 'react-native';
import MapView, { Marker, Circle, Region } from 'react-native-maps';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase';
import { ref, set, get, push } from 'firebase/database';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location'; // Added

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

// Added SearchResult interface
interface SearchResult {
  place_name: string;
  center: [number, number];
}

export default function GeofenceScreen() {
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
  const [region, setRegion] = useState<Region>({
    latitude: 14.5995,
    longitude: 120.9842,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  // Added state variables for search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const router = useRouter();
  const params = useLocalSearchParams();

  // Fetch child's current location
  const fetchChildLocation = async () => {
    try {
      setLoadingChildLocation(true);
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

        // Only set region if we're creating a new geofence and no center is selected yet
        if (isCreating && !selectedCenter) {
          setRegion({
            latitude: newLocation.latitude,
            longitude: newLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01
          });
        }
      }
    } catch (error) {
      console.error('Error fetching child location:', error);
    } finally {
      setLoadingChildLocation(false);
    }
  };

  // Load existing geofences only when not creating/editing
  useEffect(() => {
    if (!isCreating && !isEditing) {
      loadGeofences();
    }
  }, [isCreating, isEditing]);

  // Fetch child location and set up initial state
  useEffect(() => {
    fetchChildLocation();

    // Check if we're coming from map with specific coordinates
    if (params.latitude && params.longitude) {
      const lat = parseFloat(params.latitude as string);
      const lng = parseFloat(params.longitude as string);
      setRegion({
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01
      });
      setSelectedCenter({ latitude: lat, longitude: lng });
      setIsCreating(true); // Ensure creation mode is active if coordinates are passed
      setIsEditing(false);
    } else {
      // If no params, default to viewing existing geofences
      setIsCreating(false);
      setIsEditing(false);
      loadGeofences();
    }
  }, []);

  // Added useEffect for search debounce
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

  const loadGeofences = async () => {
    try {
      const geofencesRef = ref(db, 'geofences');
      const snapshot = await get(geofencesRef);

      if (snapshot.exists()) {
        const data = snapshot.val();
        const geofenceArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setGeofences(geofenceArray);
      } else {
        setGeofences([]);
      }
    } catch (error) {
      console.error('Error loading geofences:', error);
      Alert.alert('Error', 'Failed to load safe zones');
    }
  };

  const handleMapPress = (e: any) => {
    if ((isCreating || isEditing) && !selectedCenter) {
      setSelectedCenter(e.nativeEvent.coordinate);
      setRegion({
        latitude: e.nativeEvent.coordinate.latitude,
        longitude: e.nativeEvent.coordinate.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01
      });
    }
  };

  const startCreating = () => {
    if (geofences.length >= 5) {
      Alert.alert('Limit Reached', 'You can only create a maximum of 5 safe zones.');
      return;
    }
    setIsCreating(true);
    setIsEditing(false);
    setEditingGeofence(null);
    setSelectedCenter(null);
    setRadius(100);
    setGeofenceName('');
    setSearchQuery(''); // Clear search on start creating
    setSearchResults([]); // Clear search results

    // Center map on child's location if available
    if (childLocation) {
      setRegion({
        latitude: childLocation.latitude,
        longitude: childLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01
      });
    }
  };

  const startEditing = (geofence: Geofence) => {
    setIsEditing(true);
    setIsCreating(false);
    setEditingGeofence(geofence);
    setSelectedCenter(geofence.center);
    setRadius(geofence.radius);
    setGeofenceName(geofence.name);
    setSearchQuery(geofence.name); // Set search query to geofence name
    setSearchResults([]); // Clear search results

    // Center map on the selected geofence
    setRegion({
      latitude: geofence.center.latitude,
      longitude: geofence.center.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01
    });
  };

  const cancelOperation = () => {
    setIsCreating(false);
    setIsEditing(false);
    setEditingGeofence(null);
    setSelectedCenter(null);
    setGeofenceName('');
    setRadius(100);
    setSearchQuery(''); // Clear search on cancel
    setSearchResults([]); // Clear search results
    setShowNameModal(false); // Ensure modal is closed
    Keyboard.dismiss(); // Dismiss keyboard
    loadGeofences(); // Reload geofences to show the updated list
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
      const geofencesRef = ref(db, 'geofences');
      const newGeofenceRef = push(geofencesRef);

      const newGeofence: Omit<Geofence, 'id'> = {
        name: geofenceName.trim(),
        center: selectedCenter,
        radius: radius,
        isActive: true,
        createdAt: Date.now()
      };

      await set(newGeofenceRef, newGeofence);

      Alert.alert('Success', 'Safe zone created successfully!');
      cancelOperation();
    } catch (error) {
      console.error('Error saving geofence:', error);
      Alert.alert('Error', 'Failed to save safe zone');
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
      const geofenceRef = ref(db, `geofences/${editingGeofence.id}`);

      const updatedGeofence: Geofence = {
        ...editingGeofence,
        name: geofenceName.trim(),
        center: selectedCenter,
        radius: radius,
      };

      await set(geofenceRef, updatedGeofence);

      Alert.alert('Success', 'Safe zone updated successfully!');
      cancelOperation();
    } catch (error) {
      console.error('Error updating geofence:', error);
      Alert.alert('Error', 'Failed to update safe zone');
    }
  };

  const toggleGeofence = async (geofenceId: string, currentState: boolean) => {
    try {
      const geofenceRef = ref(db, `geofences/${geofenceId}/isActive`);
      await set(geofenceRef, !currentState);
      loadGeofences();
    } catch (error) {
      console.error('Error toggling geofence:', error);
      Alert.alert('Error', 'Failed to update safe zone status');
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
              const geofenceRef = ref(db, `geofences/${geofenceId}`);
              await set(geofenceRef, null);
              loadGeofences();
              if (editingGeofence && editingGeofence.id === geofenceId) {
                cancelOperation();
              }
              Alert.alert('Deleted', `Safe zone "${name}" has been deleted.`);
            } catch (error) {
              console.error('Error deleting geofence:', error);
              Alert.alert('Error', 'Failed to delete safe zone');
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
      setRegion({
        latitude: childLocation.latitude,
        longitude: childLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01
      });
      setSelectedCenter({
        latitude: childLocation.latitude,
        longitude: childLocation.longitude
      });
    } else {
      Alert.alert('Child Location Not Available', 'Cannot center on child location as it is not yet loaded or available.');
    }
  };

  // Added search functions
  const searchLocations = async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
      );
      
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.map((feature: any) => ({
          place_name: feature.display_name,
          center: [parseFloat(feature.lon), parseFloat(feature.lat)]
        })));
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
    
    setSelectedCenter({
      latitude,
      longitude,
    });
    
    setRegion({
      latitude,
      longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01
    });
    
    setGeofenceName(result.place_name); // Pre-fill name with search result
    setSearchQuery(result.place_name); // Keep search query for display
    setShowSearchResults(false);
    Keyboard.dismiss();
  };

  const handleCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use your current location.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setSelectedCenter({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });
      setRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01
      });
      setGeofenceName('My Current Location'); // Suggest a name
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
    // Do not clear selectedCenter here, as it might be set by map tap or child location
  };

  return (
    <TouchableWithoutFeedback onPress={() => {
      setShowSearchResults(false);
      Keyboard.dismiss();
    }}>
      <View style={styles.container}>
        {/* Search Bar for Geofence Creation/Editing - Moved to top */}
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

              {/* Current Location Button */}
              <Pressable style={styles.currentLocationButton} onPress={handleCurrentLocation}>
                <Ionicons name="locate" size={20} color="#007AFF" />
              </Pressable>
            </View>

            {/* Search Results */}
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

        {/* Map Section */}
        <View style={styles.mapContainer}>
          {loadingChildLocation ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading child's location...</Text>
            </View>
          ) : null}

          <MapView
            style={styles.map}
            region={region}
            onRegionChangeComplete={setRegion}
            onPress={handleMapPress}
            showsUserLocation={true}
          >
            {/* Child's current location marker */}
            {childLocation && (
              <Marker
                coordinate={{
                  latitude: childLocation.latitude,
                  longitude: childLocation.longitude
                }}
                title="Child's Location"
                description="Current position"
                pinColor="#4CD964"
              />
            )}

            {/* Existing geofences */}
            {geofences.map((geofence) => (
              <React.Fragment key={geofence.id}>
                <Marker
                  coordinate={geofence.center}
                  title={geofence.name}
                  description={`${geofence.radius}m radius`}
                  pinColor={geofence.isActive ? '#007AFF' : '#FF3B30'}
                  onPress={() => startEditing(geofence)}
                />
                <Circle
                  center={geofence.center}
                  radius={geofence.radius}
                  strokeColor={geofence.isActive ? 'rgba(0, 122, 255, 0.5)' : 'rgba(255, 59, 48, 0.5)'}
                  fillColor={geofence.isActive ? 'rgba(0, 122, 255, 0.1)' : 'rgba(255, 59, 48, 0.1)'}
                  strokeWidth={2}
                />
              </React.Fragment>
            ))}

            {/* New/Edited geofence being created/modified */}
            {(isCreating || isEditing) && selectedCenter && (
              <>
                <Marker
                  coordinate={selectedCenter}
                  pinColor={isCreating ? "#FF9500" : "#5856D6"}
                  title={isEditing ? "Editing Safe Zone" : "New Safe Zone Location"}
                  draggable
                  onDragEnd={(e) => setSelectedCenter(e.nativeEvent.coordinate)}
                />
                <Circle
                  center={selectedCenter}
                  radius={radius}
                  strokeColor={isCreating ? "rgba(255, 149, 0, 0.5)" : "rgba(88, 86, 214, 0.5)"}
                  fillColor={isCreating ? "rgba(255, 149, 0, 0.1)" : "rgba(88, 86, 214, 0.1)"}
                  strokeWidth={2}
                />
              </>
            )}
          </MapView>

          {/* Center on child button */}
          {(isCreating || isEditing) && childLocation && (
            <Pressable style={styles.centerButton} onPress={centerOnChildLocation}>
              <Ionicons name="locate" size={24} color="#007AFF" />
            </Pressable>
          )}

          {/* Map Overlay Instructions */}
          {(isCreating || isEditing) && (
            <View style={styles.instructionOverlay}>
              <Text style={styles.instructionText}>
                {selectedCenter
                  ? `Drag the marker to reposition the safe zone, then adjust radius below.`
                  : `Tap on the map or use the locate button to set the safe zone's center.`
                }
              </Text>
            </View>
          )}
        </View>

        {/* Controls Section */}
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

        {/* Name Input Modal */}
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
  searchSection: {
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: 'white',
    zIndex: 100, // Ensure search section is above map
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
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
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
    top: 75, // Adjusted position to be below the search bar
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
  // Added Search Container styles
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
  // Added Search Results styles
  searchResultsContainer: {
    position: 'absolute',
    top: 60, // Adjusted based on your layout to be below the search bar
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
});
