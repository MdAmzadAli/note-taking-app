
import { Platform, Alert, Linking } from 'react-native';
import { request, check, PERMISSIONS, RESULTS, PermissionStatus } from 'react-native-permissions';

export const requestMicrophonePermission = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'web') {
      // For web, we'll handle this differently
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch (error) {
        Alert.alert(
          'Microphone Permission Required',
          'Please allow microphone access in your browser settings to use voice commands.',
          [{ text: 'OK' }]
        );
        return false;
      }
    }

    const permission = Platform.OS === 'ios' 
      ? PERMISSIONS.IOS.MICROPHONE 
      : PERMISSIONS.ANDROID.RECORD_AUDIO;

    const result = await check(permission);
    
    if (result === RESULTS.GRANTED) {
      return true;
    }

    if (result === RESULTS.DENIED) {
      const requestResult = await request(permission);
      return requestResult === RESULTS.GRANTED;
    }

    if (result === RESULTS.BLOCKED) {
      Alert.alert(
        'Microphone Permission Required',
        'Voice commands require microphone access. Please enable it in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
      return false;
    }

    return false;
  } catch (error) {
    console.error('Error requesting microphone permission:', error);
    return false;
  }
};

export const checkMicrophonePermission = async (): Promise<PermissionStatus> => {
  try {
    if (Platform.OS === 'web') {
      return RESULTS.GRANTED; // Assume granted for web, will be checked when used
    }

    const permission = Platform.OS === 'ios' 
      ? PERMISSIONS.IOS.MICROPHONE 
      : PERMISSIONS.ANDROID.RECORD_AUDIO;

    return await check(permission);
  } catch (error) {
    console.error('Error checking microphone permission:', error);
    return RESULTS.UNAVAILABLE;
  }
};
