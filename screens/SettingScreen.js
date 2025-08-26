// screens/SettingsScreen.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert } from 'react-native';

export default function SettingsScreen() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationSharing, setLocationSharing] = useState(true);

  const handleEmergencyContact = () => {
    Alert.alert(
      "Emergency Contact",
      "This feature will allow you to set emergency contacts.",
      [{ text: "OK" }]
    );
  };

  const handleGeofencing = () => {
    Alert.alert(
      "Geofencing",
      "This feature will allow you to set safe zones for your child.",
      [{ text: "OK" }]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      
      <View style={styles.settingItem}>
        <Text style={styles.settingText}>Enable Notifications</Text>
        <Switch
          value={notificationsEnabled}
          onValueChange={setNotificationsEnabled}
        />
      </View>

      <View style={styles.settingItem}>
        <Text style={styles.settingText}>Location Sharing</Text>
        <Switch
          value={locationSharing}
          onValueChange={setLocationSharing}
        />
      </View>

      <TouchableOpacity style={styles.button} onPress={handleEmergencyContact}>
        <Text style={styles.buttonText}>Emergency Contacts</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={handleGeofencing}>
        <Text style={styles.buttonText}>Geofencing Settings</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
  },
  settingText: {
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
});