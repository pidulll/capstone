import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase';
import { ref, onValue, off } from 'firebase/database';
import { Audio } from 'expo-av';
import { useRouter } from 'expo-router';

interface AudioRecording {
  id: string;
  url: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  event: string;
}

export default function AudioRecordingsScreen() {
  const [recordings, setRecordings] = useState<AudioRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const router = useRouter();

  useEffect(() => {
    const audioRecordingsRef = ref(db, 'audio_recordings');

    const unsubscribe = onValue(audioRecordingsRef, (snapshot) => {
      const data = snapshot.val();
      const loadedRecordings: AudioRecording[] = [];
      if (data) {
        Object.keys(data).forEach((key) => {
          loadedRecordings.push({
            id: key,
            ...data[key],
          });
        });
      }
      // Sort by timestamp in descending order (most recent first)
      loadedRecordings.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecordings(loadedRecordings);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching audio recordings:', error);
      Alert.alert('Error', 'Failed to load audio recordings.');
      setLoading(false);
    });

    return () => {
      off(audioRecordingsRef, 'value', unsubscribe);
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const playSound = async (url: string, id: string) => {
    if (sound) {
      await sound.unloadAsync();
      setSound(null);
      setPlayingId(null);
    }

    try {
      setPlayingId(id);
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true },
        (status) => {
          if (status.didJustFinish) {
            setPlayingId(null);
            newSound.unloadAsync();
            setSound(null);
          }
        }
      );
      setSound(newSound);
      await newSound.playAsync();
    } catch (error) {
      console.error('Error playing sound:', error);
      Alert.alert('Playback Error', 'Could not play audio recording.');
      setPlayingId(null);
    }
  };

  const stopSound = async () => {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
      setPlayingId(null);
    }
  };

  const renderItem = ({ item }: { item: AudioRecording }) => (
    <View style={styles.recordingItem}>
      <View style={styles.recordingInfo}>
        <Text style={styles.recordingTitle}>
          {item.event === 'geofence_breach' ? 'Geofence Breach' : 'Recording'}
        </Text>
        <Text style={styles.recordingDetails}>
          {new Date(item.timestamp).toLocaleString()}
        </Text>
        <Text style={styles.recordingDetails}>
          Lat: {item.latitude.toFixed(4)}, Lon: {item.longitude.toFixed(4)}
        </Text>
      </View>
      <Pressable
        style={styles.playButton}
        onPress={() => (playingId === item.id ? stopSound() : playSound(item.url, item.id))}
      >
        <Ionicons
          name={playingId === item.id ? 'stop' : 'play'}
          size={24}
          color="white"
        />
      </Pressable>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading recordings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {recordings.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="mic-off" size={64} color="#C7C7CC" />
          <Text style={styles.emptyText}>No audio recordings yet</Text>
          <Text style={styles.emptySubtext}>
            Recordings will appear here when your child exits a safe zone.
          </Text>
        </View>
      ) : (
        <FlatList
          data={recordings}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

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
  listContent: {
    padding: 20,
  },
  recordingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  recordingInfo: {
    flex: 1,
    marginRight: 10,
  },
  recordingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  recordingDetails: {
    fontSize: 13,
    color: '#666',
  },
  playButton: {
    backgroundColor: '#007AFF',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
  },
});
