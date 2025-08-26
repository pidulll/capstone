import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, Pressable, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationSharing, setLocationSharing] = useState(true);
  const [emergencyAlerts, setEmergencyAlerts] = useState(true);
  const [geofencingEnabled, setGeofencingEnabled] = useState(false);

  const handleEmergencyContact = () => {
    Alert.alert(
      "Emergency Contacts",
      "Configure emergency contacts who will be notified if your child leaves the safe zone or in case of emergency.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Configure", onPress: () => console.log("Navigate to emergency contacts") }
      ]
    );
  };

  const handleGeofencing = () => {
    router.push('/geofence');
  };

  const handleLocationHistory = () => {
    Alert.alert(
      "Location History",
      "View your child's location history and movement patterns.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "View History", onPress: () => console.log("Navigate to location history") }
      ]
    );
  };

  const handleDeviceManagement = () => {
    Alert.alert(
      "Device Management",
      "Manage connected devices and their settings.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Manage", onPress: () => console.log("Navigate to device management") }
      ]
    );
  };

  const SettingItem = ({
    title,
    subtitle,
    icon,
    hasSwitch = false,
    switchValue,
    onSwitchChange,
    onPress
  }: {
    title: string;
    subtitle?: string;
    icon: keyof typeof Ionicons.glyphMap;
    hasSwitch?: boolean;
    switchValue?: boolean;
    onSwitchChange?: (value: boolean) => void;
    onPress?: () => void;
  }) => (
    <Pressable
      style={styles.settingItem}
      onPress={hasSwitch ? undefined : onPress}
    >
      <View style={styles.settingLeft}>
        <Ionicons name={icon} size={24} color="#007AFF" style={styles.settingIcon} />
        <View>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {hasSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ false: '#767577', true: '#007AFF' }}
          thumbColor={switchValue ? '#ffffff' : '#f4f3f4'}
        />
      ) : (
        <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
      )}
    </Pressable>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tracking & Notifications</Text>

        <SettingItem
          title="Push Notifications"
          subtitle="Receive alerts and updates"
          icon="notifications-outline"
          hasSwitch
          switchValue={notificationsEnabled}
          onSwitchChange={setNotificationsEnabled}
        />

        <SettingItem
          title="Location Sharing"
          subtitle="Allow real-time location tracking"
          icon="location-outline"
          hasSwitch
          switchValue={locationSharing}
          onSwitchChange={setLocationSharing}
        />

        <SettingItem
          title="Emergency Alerts"
          subtitle="Instant notifications for emergencies"
          icon="alert-circle-outline"
          hasSwitch
          switchValue={emergencyAlerts}
          onSwitchChange={setEmergencyAlerts}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Management</Text>

        <SettingItem
          title="Emergency Contacts"
          subtitle="Manage emergency contact list"
          icon="people-outline"
          onPress={handleEmergencyContact}
        />

        <SettingItem
          title="Safe Zones"
          subtitle="Create and manage safe areas for your child"
          icon="shield-outline"
          onPress={handleGeofencing}
        />

        <SettingItem
          title="Location History"
          subtitle="View past locations and routes"
          icon="time-outline"
          onPress={handleLocationHistory}
        />

        <SettingItem
          title="Device Management"
          subtitle="Manage connected devices"
          icon="phone-portrait-outline"
          onPress={handleDeviceManagement}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>

        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>App Version</Text>
          <Text style={styles.infoValue}>1.0.0</Text>
        </View>

        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Last Sync</Text>
          <Text style={styles.infoValue}>Just now</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    marginHorizontal: 20,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 16,
    color: '#333',
  },
  infoValue: {
    fontSize: 16,
    color: '#666',
  },
});

