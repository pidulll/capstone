// app/index.tsx
import { Link } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Child Watch</Text>
      <Text style={styles.subtitle}>Keep your child safe</Text>
      
      <Link href="/settings" asChild>
        <Pressable style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>View Live Location</Text>
        </Pressable>
      </Link>
      
      <Link href="/settings" asChild>
        <Pressable style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Settings</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    width: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: 'white',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    width: '80%',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});