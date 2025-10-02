    // app/settings.tsx
    import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { get, off, onValue, ref, set } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { auth, db } from '../firebase';
import { useAuth } from './_layout';

    export default function SettingsScreen() {
      const router = useRouter();
      const { user, isPaired, pairingLoading } = useAuth();
      const [notificationsEnabled, setNotificationsEnabled] = useState(true);
      const [locationSharing, setLocationSharing] = useState(true);
      const [emergencyAlerts, setEmergencyAlerts] = useState(true);

      // Pairing states
      const [pairingCode, setPairingCode] = useState('');
      const [isPairingModalVisible, setIsPairingModalVisible] = useState(false);
      const [isClaimingCode, setIsClaimingCode] = useState(false);
      const [currentDevicePairingCode, setCurrentDevicePairingCode] = useState<string | null>(null);
      const [devicePairingCodeExpiry, setDevicePairingCodeExpiry] = useState<number | null>(null);
      const [deviceId, setDeviceId] = useState<string | null>(null);

      // SMS Phone Number states
      const [smsPhoneNumber, setSmsPhoneNumber] = useState('');
      const [isSavingSmsNumber, setIsSavingSmsNumber] = useState(false);
      const [isEditingSmsNumber, setIsEditingSmsNumber] = useState(false);

      // Fetch paired device ID and SMS number on load
      useEffect(() => {
        const fetchSettings = async () => {
          if (user && user.uid) {
            // Fetch paired device ID
            try {
              const pairedDevicesRef = ref(db, `paired_devices/${user.uid}`);
              const snapshot = await get(pairedDevicesRef);
              if (snapshot.exists()) {
                setDeviceId(snapshot.val());
              } else {
                setDeviceId(null);
              }
            } catch (error) {
              console.error("Error fetching paired device ID in settings:", error);
              setDeviceId(null);
            }

            // Fetch SMS phone number
            try {
              const smsNumberRef = ref(db, `parent_settings/${user.uid}/smsPhoneNumber`);
              const snapshot = await get(smsNumberRef);
              if (snapshot.exists()) {
                setSmsPhoneNumber(snapshot.val());
              } else {
                setSmsPhoneNumber('');
              }
            } catch (error) {
              console.error("Error fetching SMS phone number:", error);
              setSmsPhoneNumber('');
            }
          }
        };

        if (!pairingLoading) {
          fetchSettings();
        }
      }, [user, pairingLoading]);

      // Real-time listener for device's pairing code (if not paired yet)
      useEffect(() => {
        let unsubscribe: () => void;
        // Only listen for the device's generated code if we know its ID and it's not paired
        if (user && deviceId && !isPaired) {
          const devicePairingCodeRef = ref(db, `device_info/${deviceId}/pairingCode`);
          unsubscribe = onValue(devicePairingCodeRef, (snapshot) => {
            const code = snapshot.val();
            if (code) {
              setCurrentDevicePairingCode(code);
              // Also fetch expiry if available
              const pairingCodeEntryRef = ref(db, `pairing_codes/${code}`);
              get(pairingCodeEntryRef).then(codeSnapshot => {
                if (codeSnapshot.exists()) {
                  setDevicePairingCodeExpiry(codeSnapshot.val().expiresAt);
                }
              });
            } else {
              setCurrentDevicePairingCode(null);
              setDevicePairingCodeExpiry(null);
            }
          }, (error) => {
            console.error("Error real-time fetching device pairing code:", error);
          });
        } else if (user && isPaired && deviceId) {
          // If already paired, clear the displayed code
          setCurrentDevicePairingCode(null);
          setDevicePairingCodeExpiry(null);
        }

        return () => {
          if (unsubscribe) off(devicePairingCodeRef, 'value', unsubscribe);
        };
      }, [user, isPaired, deviceId]);


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

      const handleLiveLocation = () => {
        if (!isPaired) {
          Alert.alert("Device Not Paired", "Please pair with your child's device to view their live location.");
          return;
        }
        router.push('/map');
      };

      const handleLocationHistory = () => {
        if (!isPaired) {
          Alert.alert("Device Not Paired", "Please pair with your child's device to view location history.");
          return;
        }
        // Navigate to the new LocationHistoryScreen
        router.push('/locationHistory');
      };

      const handleDeviceManagement = () => {
        setIsPairingModalVisible(true);
      };

      const handleLogout = async () => {
        try {
          await signOut(auth);
          Alert.alert('Logged Out', 'You have been successfully logged out.');
          router.replace('/LoginScreen');
        } catch (error: any) {
          console.error('Logout error:', error.message);
          Alert.alert('Logout Failed', error.message);
        }
      };

      const handleClaimPairingCode = async () => {
        if (!user || !user.uid) {
          Alert.alert('Error', 'You must be logged in to pair a device.');
          return;
        }
        if (!pairingCode.trim()) {
          Alert.alert('Error', 'Please enter a pairing code.');
          return;
        }

        setIsClaimingCode(true);
        try {
          const codeRef = ref(db, `pairing_codes/${pairingCode.trim().toUpperCase()}`);
          const snapshot = await get(codeRef);

          if (snapshot.exists()) {
            const codeData = snapshot.val();
            const expiresAt = codeData.expiresAt;
            const deviceIdFromCode = codeData.deviceId;

            if (expiresAt !== 0 && expiresAt < Date.now()) {
              Alert.alert('Expired Code', 'This pairing code has expired. Please generate a new one on the device.');
              await set(codeRef, null); // Clear expired code
              return;
            }

            // 1. Store the claimed code in parent_settings first.
            await set(ref(db, `parent_settings/${user.uid}/claimedCode`), pairingCode.trim().toUpperCase());

            // 2. Claim the code by setting claimedBy
            await set(ref(db, `pairing_codes/${pairingCode.trim().toUpperCase()}/claimedBy`), user.uid);

            // 3. Link parent UID to device ID
            await set(ref(db, `paired_devices/${user.uid}`), deviceIdFromCode);

            // 4. Update device_info with parent UID
            // This write is now allowed by the rules if parentUid is currently null
            // or if the parent is already paired and is re-claiming (though the latter shouldn't happen with this flow)
            await set(ref(db, `device_info/${deviceIdFromCode}/parentUid`), user.uid);

            Alert.alert('Success', 'Device paired successfully!');
            setIsPairingModalVisible(false);
            setPairingCode('');
            router.replace('/map');
          } else {
            Alert.alert('Invalid Code', 'The pairing code is incorrect or does not exist.');
          }
        } catch (error: any) {
          console.error('Error claiming pairing code:', error);
          Alert.alert('Pairing Failed', error.message);
        } finally {
          setIsClaimingCode(false);
        }
      };

      const handleUnpairDevice = async () => {
        if (!user || !user.uid || !deviceId) {
          Alert.alert('Error', 'No device is currently paired.');
          return;
        }

        Alert.alert(
          "Unpair Device",
          "Are you sure you want to unpair this device? You will lose access to its location and data.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Unpair",
              style: "destructive",
              onPress: async () => {
                try {
                  const currentDeviceId = deviceId; // Capture deviceId before clearing state
                  const currentParentUid = user.uid; // Capture parentUid

                  // Get the currently claimed code from parent_settings
                  const claimedCodeRef = ref(db, `parent_settings/${currentParentUid}/claimedCode`);
                  const claimedCodeSnapshot = await get(claimedCodeRef);
                  const currentClaimedCode = claimedCodeSnapshot.exists() ? claimedCodeSnapshot.val() : null;

                  // 1. Remove parent UID from device_info
                  await set(ref(db, `device_info/${currentDeviceId}/parentUid`), null);

                  // 2. Remove parent's paired device entry
                  await set(ref(db, `paired_devices/${currentParentUid}`), null);

                  // 3. Remove claimed code from parent_settings
                  await set(ref(db, `parent_settings/${currentParentUid}/claimedCode`), null);

                  // 4. Clear claimedBy from the pairing code itself (if it exists)
                  if (currentClaimedCode) {
                    await set(ref(db, `pairing_codes/${currentClaimedCode}/claimedBy`), null);
                  }

                  // 5. Clear SMS phone number from parent_settings (NEW)
                  await set(ref(db, `parent_settings/${currentParentUid}/smsPhoneNumber`), null);

                  Alert.alert('Success', 'Device unpaired successfully.');
                  setIsPairingModalVisible(false);
                  setDeviceId(null); // Clear deviceId state in the app
                  setSmsPhoneNumber(''); // Clear local SMS number state (NEW)
                  // The useAuth hook will automatically update isPaired to false
                  router.replace('/settings'); // Stay on settings, but now unpaired
                } catch (error: any) {
                  console.error('Error unpairing device:', error);
                  Alert.alert('Unpairing Failed', error.message);
                }
              }
            }
          ]
        );
      };

      const handleSaveSmsPhoneNumber = async () => {
        if (!user || !user.uid) {
          Alert.alert('Error', 'You must be logged in to save settings.');
          return;
        }
        if (!smsPhoneNumber.trim()) {
          Alert.alert('Error', 'Please enter a phone number.');
          return;
        }
        const phoneRegex = /^\+?[0-9]{7,15}$/;
        if (!phoneRegex.test(smsPhoneNumber.trim())) {
          Alert.alert('Invalid Phone Number', 'Please enter a valid phone number, including country code (e.g., +1234567890).');
          return;
        }

        setIsSavingSmsNumber(true);
        try {
          await set(ref(db, `parent_settings/${user.uid}/smsPhoneNumber`), smsPhoneNumber.trim());
          Alert.alert('Success', 'SMS phone number saved.');
          setIsEditingSmsNumber(false);
        } catch (error: any) {
          console.error('Error saving SMS phone number:', error);
          Alert.alert('Save Failed', error.message);
        } finally {
          setIsSavingSmsNumber(false);
        }
      };

      const SettingItem = ({
        title,
        subtitle,
        icon,
        hasSwitch = false,
        switchValue,
        onSwitchChange,
        onPress,
        disabled = false
      }: {
        title: string;
        subtitle?: string;
        icon: keyof typeof Ionicons.glyphMap;
        hasSwitch?: boolean;
        switchValue?: boolean;
        onSwitchChange?: (value: boolean) => void;
        onPress?: () => void;
        disabled?: boolean;
      }) => (
        <Pressable
          style={[styles.settingItem, disabled && styles.disabledSettingItem]}
          onPress={hasSwitch ? undefined : onPress}
          disabled={disabled}
        >
          <View style={styles.settingLeft}>
            <Ionicons name={icon} size={24} color={disabled ? "#C7C7CC" : "#007AFF"} style={styles.settingIcon} />
            <View>
              <Text style={[styles.settingTitle, disabled && styles.disabledText]}>{title}</Text>
              {subtitle && <Text style={[styles.settingSubtitle, disabled && styles.disabledText]}>{subtitle}</Text>}
            </View>
          </View>
          {hasSwitch ? (
            <Switch
              value={switchValue}
              onValueChange={onSwitchChange}
              trackColor={{ false: '#767577', true: '#007AFF' }}
              thumbColor={switchValue ? '#ffffff' : '#f4f3f4'}
              disabled={disabled}
            />
          ) : (
            <Ionicons name="chevron-forward" size={20} color={disabled ? "#C7C7CC" : "#C7C7CC"} />
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
              disabled={!isPaired}
            />

            <SettingItem
              title="Location Sharing"
              subtitle="Allow real-time location tracking"
              icon="location-outline"
              hasSwitch
              switchValue={locationSharing}
              onSwitchChange={setLocationSharing}
              disabled={!isPaired}
            />

            <SettingItem
              title="Emergency Alerts"
              subtitle="Instant notifications for emergencies"
              icon="alert-circle-outline"
              hasSwitch
              switchValue={emergencyAlerts}
              onSwitchChange={setEmergencyAlerts}
              disabled={!isPaired}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Management</Text>

            <SettingItem
              title="Emergency Contacts"
              subtitle="Manage emergency contact list"
              icon="people-outline"
              onPress={handleEmergencyContact}
              disabled={!isPaired}
            />

            <SettingItem
              title="Live Location"
              subtitle="View your child's real-time position on the map"
              icon="map-outline"
              onPress={handleLiveLocation}
              disabled={!isPaired}
            />

            <SettingItem
              title="Location History"
              subtitle="View past locations and routes"
              icon="time-outline"
              onPress={handleLocationHistory}
              disabled={!isPaired}
            />

            <SettingItem
              title="Device Management"
              subtitle={isPaired ? "Manage paired device" : "Pair a new device"}
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

          <View style={styles.section}>
            <Pressable style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutButtonText}>Logout</Text>
            </Pressable>
          </View>

          {/* Device Management Modal */}
          <Modal
            visible={isPairingModalVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setIsPairingModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Device Management</Text>

                {pairingLoading ? (
                  <ActivityIndicator size="small" color="#007AFF" />
                ) : isPaired ? (
                  <View>
                    <Text style={styles.modalSubtitle}>Device is currently paired.</Text>
                    <Text style={styles.pairedDeviceId}>Paired Device ID: {deviceId}</Text>

                    <View style={styles.smsNumberContainer}>
                      <Text style={styles.smsNumberLabel}>SMS Alert Phone Number:</Text>
                      {isEditingSmsNumber ? (
                        <TextInput
                          style={styles.smsNumberInput}
                          placeholder="e.g., +1234567890"
                          value={smsPhoneNumber}
                          onChangeText={setSmsPhoneNumber}
                          keyboardType="phone-pad"
                          autoCapitalize="none"
                        />
                      ) : (
                        <Text style={styles.smsNumberDisplay}>{smsPhoneNumber || 'Not set'}</Text>
                      )}
                      <Pressable
                        style={[styles.editSmsButton, isSavingSmsNumber && styles.disabledButton]}
                        onPress={isEditingSmsNumber ? handleSaveSmsPhoneNumber : () => setIsEditingSmsNumber(true)}
                        disabled={isSavingSmsNumber}
                      >
                        {isSavingSmsNumber ? (
                          <ActivityIndicator color="white" size="small" />
                        ) : (
                          <Text style={styles.editSmsButtonText}>{isEditingSmsNumber ? 'Save Number' : 'Edit Number'}</Text>
                        )}
                      </Pressable>
                    </View>

                    <Pressable style={[styles.modalButton, styles.unpairButton]} onPress={handleUnpairDevice}>
                      <Text style={styles.modalButtonText}>Unpair Device</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View>
                    <Text style={styles.modalSubtitle}>Pair a new child device.</Text>
                    <Text style={styles.modalDescription}>
                      Enter the 6-character pairing code displayed on your child's device.
                    </Text>
                    <TextInput
                      style={styles.pairingCodeInput}
                      placeholder="Enter pairing code"
                      value={pairingCode}
                      onChangeText={setPairingCode}
                      autoCapitalize="characters"
                      maxLength={6}
                    />
                    <Pressable
                      style={[styles.modalButton, isClaimingCode && styles.disabledButton]}
                      onPress={handleClaimPairingCode}
                      disabled={isClaimingCode}
                    >
                      {isClaimingCode ? (
                        <ActivityIndicator color="white" />
                      ) : (
                        <Text style={styles.modalButtonText}>Pair Device</Text>
                      )}
                    </Pressable>

                    {currentDevicePairingCode && (
                      <View style={styles.deviceCodeDisplay}>
                        <Text style={styles.deviceCodeLabel}>Device is displaying code:</Text>
                        <Text style={styles.deviceCodeValue}>{currentDevicePairingCode}</Text>
                        {devicePairingCodeExpiry !== 0 && devicePairingCodeExpiry !== null && (
                          <Text style={styles.deviceCodeExpiry}>
                            Expires: {new Date(devicePairingCodeExpiry).toLocaleTimeString()}
                          </Text>
                        )}
                        {devicePairingCodeExpiry === 0 && (
                          <Text style={styles.deviceCodeExpiry}>
                            (Permanent Code)
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                )}

                <Pressable style={styles.modalCloseButton} onPress={() => setIsPairingModalVisible(false)}>
                  <Text style={styles.modalCloseButtonText}>Close</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
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
      disabledSettingItem: {
        opacity: 0.6,
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
      disabledText: {
        color: '#999',
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
      logoutButton: {
        backgroundColor: '#FF3B30',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginHorizontal: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
      },
      logoutButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
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
        width: '90%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 15,
      },
      modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 15,
        color: '#333',
      },
      modalSubtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 20,
      },
      modalDescription: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginBottom: 15,
      },
      pairingCodeInput: {
        borderWidth: 1,
        borderColor: '#CED4DA',
        borderRadius: 8,
        padding: 12,
        fontSize: 18,
        textAlign: 'center',
        letterSpacing: 2,
        marginBottom: 20,
        color: '#333',
        fontWeight: 'bold',
      },
      modalButton: {
        backgroundColor: '#007AFF',
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 10,
      },
      modalButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
      },
      disabledButton: {
        backgroundColor: '#C7C7CC',
        opacity: 0.7,
      },
      unpairButton: {
        backgroundColor: '#FF3B30',
        marginTop: 20,
      },
      modalCloseButton: {
        marginTop: 20,
        padding: 10,
        alignItems: 'center',
      },
      modalCloseButtonText: {
        color: '#666',
        fontSize: 16,
      },
      pairedDeviceId: {
        fontSize: 14,
        color: '#333',
        textAlign: 'center',
        marginBottom: 20,
        fontFamily: 'monospace',
      },
      deviceCodeDisplay: {
        marginTop: 25,
        padding: 15,
        backgroundColor: '#F0F0F0',
        borderRadius: 10,
        alignItems: 'center',
      },
      deviceCodeLabel: {
        fontSize: 14,
        color: '#666',
        marginBottom: 5,
      },
      deviceCodeValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#007AFF',
        letterSpacing: 3,
      },
      deviceCodeExpiry: {
        fontSize: 12,
        color: '#999',
        marginTop: 5,
      },
      smsNumberContainer: {
        marginTop: 20,
        paddingVertical: 15,
        paddingHorizontal: 10,
        backgroundColor: '#F8F9FA',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E0E0E0',
      },
      smsNumberLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#333',
        marginBottom: 8,
      },
      smsNumberDisplay: {
        fontSize: 16,
        color: '#007AFF',
        fontWeight: '600',
        marginBottom: 10,
      },
      smsNumberInput: {
        borderWidth: 1,
        borderColor: '#CED4DA',
        borderRadius: 8,
        padding: 10,
        fontSize: 16,
        marginBottom: 10,
        color: '#333',
      },
      editSmsButton: {
        backgroundColor: '#4CAF50',
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
      },
      editSmsButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
      },
    });
    