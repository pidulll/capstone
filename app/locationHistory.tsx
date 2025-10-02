    // app/locationHistory.tsx
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { get, ref } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { db } from '../firebase';
import { useAuth } from './_layout';

    interface HistoricalLocation {
      timestamp: number;
      latitude: number;
      longitude: number;
    }

    export default function LocationHistoryScreen() {
      const { user, isPaired, pairingLoading } = useAuth();
      const [history, setHistory] = useState<HistoricalLocation[]>([]);
      const [loading, setLoading] = useState(true);
      const [deviceId, setDeviceId] = useState<string | null>(null);
      const mapRef = React.useRef<MapView>(null);

      // Effect to get deviceId once paired
      useEffect(() => {
        const getPairedDeviceId = async () => {
          if (user && isPaired) {
            try {
              const pairedDevicesRef = ref(db, `paired_devices/${user.uid}`);
              const snapshot = await get(pairedDevicesRef);
              if (snapshot.exists()) {
                setDeviceId(snapshot.val());
              } else {
                setDeviceId(null);
              }
            } catch (error) {
              console.error("Error fetching paired device ID in location history:", error);
              setDeviceId(null);
            }
          } else {
            setDeviceId(null);
          }
        };

        if (!pairingLoading) {
          getPairedDeviceId();
        }
      }, [user, isPaired, pairingLoading]);

      useEffect(() => {
        const fetchLocationHistory = async () => {
          if (!user || !deviceId) {
            setLoading(false);
            return;
          }

          setLoading(true);
          try {
            const historyRef = ref(db, `child_location_history/${deviceId}`);
            const snapshot = await get(historyRef);

            const loadedHistory: HistoricalLocation[] = [];
            if (snapshot.exists()) {
              const data = snapshot.val();
              Object.keys(data).forEach(key => {
                loadedHistory.push({
                  timestamp: parseInt(key), // Firebase keys are strings, convert to number
                  latitude: data[key].latitude,
                  longitude: data[key].longitude,
                });
              });
            }
            // Sort by timestamp in ascending order for polyline drawing
            loadedHistory.sort((a, b) => a.timestamp - b.timestamp);
            setHistory(loadedHistory);

            // Animate map to show the full path if history exists
            if (loadedHistory.length > 0) {
              const coordinates = loadedHistory.map(loc => ({
                latitude: loc.latitude,
                longitude: loc.longitude,
              }));
              mapRef.current?.fitToCoordinates(coordinates, {
                edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                animated: true,
              });
            }

          } catch (error) {
            console.error('Error fetching location history:', error);
            Alert.alert('Error', 'Failed to load location history.');
          } finally {
            setLoading(false);
          }
        };

        if (deviceId) {
          fetchLocationHistory();
        }
      }, [deviceId]);

      const renderHistoryItem = ({ item }: { item: HistoricalLocation }) => (
        <View style={styles.historyItem}>
          <Ionicons name="time-outline" size={20} color="#007AFF" style={styles.historyIcon} />
          <View>
            <Text style={styles.historyTimestamp}>
              {new Date(item.timestamp).toLocaleString()}
            </Text>
            <Text style={styles.historyCoordinates}>
              Lat: {item.latitude.toFixed(6)}, Lon: {item.longitude.toFixed(6)}
            </Text>
          </View>
        </View>
      );

      if (loading || pairingLoading) {
        return (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>
              {pairingLoading ? 'Checking pairing status...' : 'Loading location history...'}
            </Text>
          </View>
        );
      }

      if (!isPaired) {
        return (
          <View style={styles.noDataContainer}>
            <Ionicons name="link-off" size={64} color="#FF6B6B" style={styles.noDataIcon} />
            <Text style={styles.noDataText}>Device Not Paired</Text>
            <Text style={styles.noDataSubtext}>
              Please pair with your child's device to view location history.
            </Text>
            <Link href="/settings" asChild>
              <Pressable style={styles.retryButton}>
                <Ionicons name="settings" size={20} color="white" />
                <Text style={styles.retryButtonText}>Go to Settings</Text>
              </Pressable>
            </Link>
          </View>
        );
      }

      return (
        <View style={styles.container}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={
              history.length > 0
                ? {
                    latitude: history[0].latitude,
                    longitude: history[0].longitude,
                    latitudeDelta: 0.0922,
                    longitudeDelta: 0.0421,
                  }
                : {
                    latitude: 14.5995, // Default to Manila
                    longitude: 120.9842,
                    latitudeDelta: 0.0922,
                    longitudeDelta: 0.0421,
                  }
            }
          >
            {history.map((location, index) => (
              <Marker
                key={location.timestamp}
                coordinate={{ latitude: location.latitude, longitude: location.longitude }}
                title={`Location at ${new Date(location.timestamp).toLocaleTimeString()}`}
                description={`Lat: ${location.latitude.toFixed(4)}, Lon: ${location.longitude.toFixed(4)}`}
                pinColor={index === 0 ? 'green' : (index === history.length - 1 ? 'red' : 'blue')}
              />
            ))}
            {history.length > 1 && (
              <Polyline
                coordinates={history.map(loc => ({ latitude: loc.latitude, longitude: loc.longitude }))}
                strokeColor="#007AFF"
                strokeWidth={3}
              />
            )}
          </MapView>

          <View style={styles.historyListContainer}>
            <Text style={styles.listTitle}>Recent Locations</Text>
            {history.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="map-outline" size={48} color="#C7C7CC" />
                <Text style={styles.emptyText}>No location history yet</Text>
                <Text style={styles.emptySubtext}>
                  Locations will be logged every 30 minutes when your child's device is active.
                </Text>
              </View>
            ) : (
              <FlatList
                data={history}
                renderItem={renderHistoryItem}
                keyExtractor={(item) => item.timestamp.toString()}
                contentContainerStyle={styles.flatListContent}
                inverted // Show most recent at the top
              />
            )}
          </View>
        </View>
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
      },
      loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#333',
      },
      noDataContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
        padding: 40,
      },
      noDataIcon: {
        marginBottom: 20,
      },
      noDataText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 16,
        textAlign: 'center',
      },
      noDataSubtext: {
        fontSize: 16,
        color: '#666',
        marginBottom: 20,
        textAlign: 'center',
      },
      retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#4A90E2',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 25,
      },
      retryButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16,
      },
      map: {
        width: width,
        height: height * 0.5, // Map takes top half
      },
      historyListContainer: {
        flex: 1,
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        marginTop: -20, // Overlap with map slightly
        paddingTop: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 10,
      },
      listTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 15,
        paddingHorizontal: 20,
      },
      flatListContent: {
        paddingHorizontal: 20,
        paddingBottom: 20,
      },
      historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      },
      historyIcon: {
        marginRight: 15,
      },
      historyTimestamp: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
      },
      historyCoordinates: {
        fontSize: 13,
        color: '#666',
        marginTop: 2,
      },
      emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        textAlign: 'center',
      },
      emptyText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginTop: 15,
      },
      emptySubtext: {
        fontSize: 14,
        color: '#666',
        marginTop: 8,
        textAlign: 'center',
      },
    });
    