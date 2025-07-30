import { Platform, Alert, Linking } from 'react-native';

export const requestMicrophonePermission = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'web') {
      // For web, request microphone permission directly
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

    // For React Native (non-web), we'll handle this differently in Expo Go
    // Since react-native-permissions doesn't work in Expo Go, we'll assume permission is granted
    // and let the voice recognition library handle the permission request
    return true;
  } catch (error) {
    console.error('Error requesting microphone permission:', error);
    return false;
  }
};

export const checkMicrophonePermission = async (): Promise<string> => {
  try {
    if (Platform.OS === 'web') {
      return 'granted'; // Will be checked when actually used
    }

    // For React Native in Expo Go, assume granted
    return 'granted';
  } catch (error) {
    console.error('Error checking microphone permission:', error);
    return 'unavailable';
  }
};