
import { Platform, Alert, Linking } from 'react-native';

export const requestMicrophonePermission = async (): Promise<boolean> => {
  try {
    console.log('[PERMISSIONS] Starting microphone permission request...');
    
    if (Platform.OS === 'web') {
      // For web platform
      try {
        console.log('[PERMISSIONS] Requesting web microphone access...');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        console.log('[PERMISSIONS] Web microphone access granted');
        return true;
      } catch (error: any) {
        console.log('[PERMISSIONS] Web microphone access denied:', error);
        Alert.alert(
          'Microphone Permission Required',
          'Please allow microphone access in your browser settings to use voice commands.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => openAppSettings() }
          ]
        );
        return false;
      }
    }

    // For React Native - check if we're in Expo Go or production build
    try {
      const Constants = await import('expo-constants');
      const isExpoGo = Constants.default?.appOwnership === 'expo';
      
      if (isExpoGo) {
        console.log('[PERMISSIONS] Expo Go environment - assuming permission granted');
        // Add a small delay to simulate permission flow
        await new Promise(resolve => setTimeout(resolve, 100));
        return true;
      }

      // Production build - use react-native-permissions
      try {
        const { PERMISSIONS, RESULTS, request, check } = await import('react-native-permissions');
        
        const permission = Platform.OS === 'ios' 
          ? PERMISSIONS.IOS.MICROPHONE 
          : PERMISSIONS.ANDROID.RECORD_AUDIO;

        // Check current permission status
        const currentStatus = await check(permission);
        console.log('[PERMISSIONS] Current microphone permission status:', currentStatus);

        switch (currentStatus) {
          case RESULTS.GRANTED:
            return true;
            
          case RESULTS.DENIED:
            // Request permission
            const requestResult = await request(permission);
            console.log('[PERMISSIONS] Permission request result:', requestResult);
            
            if (requestResult === RESULTS.GRANTED) {
              return true;
            } else if (requestResult === RESULTS.BLOCKED) {
              showPermissionBlockedAlert();
              return false;
            } else {
              showPermissionDeniedAlert();
              return false;
            }
            
          case RESULTS.BLOCKED:
            showPermissionBlockedAlert();
            return false;
            
          case RESULTS.UNAVAILABLE:
            Alert.alert(
              'Microphone Unavailable',
              'Microphone is not available on this device.',
              [{ text: 'OK' }]
            );
            return false;
            
          default:
            console.log('[PERMISSIONS] Unknown permission status:', currentStatus);
            return false;
        }
      } catch (permissionError) {
        console.log('[PERMISSIONS] react-native-permissions not available, falling back');
        // Fallback for development builds without react-native-permissions
        return true;
      }
    } catch (constantsError) {
      console.log('[PERMISSIONS] expo-constants not available, assuming production');
      return true;
    }
  } catch (error) {
    console.error('[PERMISSIONS] Error requesting microphone permission:', error);
    return false;
  }
};

export const checkMicrophonePermission = async (): Promise<'granted' | 'denied' | 'blocked' | 'unavailable'> => {
  try {
    if (Platform.OS === 'web') {
      // For web, we can't check without requesting, so we'll return 'granted' by default
      return 'granted';
    }

    // Check if we're in Expo Go
    try {
      const Constants = await import('expo-constants');
      const isExpoGo = Constants.default?.appOwnership === 'expo';
      
      if (isExpoGo) {
        return 'granted'; // Assume granted in Expo Go
      }
    } catch (e) {
      // Constants not available, continue
    }

    // Production build - use react-native-permissions
    try {
      const { PERMISSIONS, RESULTS, check } = await import('react-native-permissions');
      
      const permission = Platform.OS === 'ios' 
        ? PERMISSIONS.IOS.MICROPHONE 
        : PERMISSIONS.ANDROID.RECORD_AUDIO;

      const status = await check(permission);
      
      switch (status) {
        case RESULTS.GRANTED:
          return 'granted';
        case RESULTS.DENIED:
          return 'denied';
        case RESULTS.BLOCKED:
          return 'blocked';
        case RESULTS.UNAVAILABLE:
          return 'unavailable';
        default:
          return 'denied';
      }
    } catch (error) {
      console.log('[PERMISSIONS] react-native-permissions not available for checking');
      return 'granted'; // Fallback assumption
    }
  } catch (error) {
    console.error('[PERMISSIONS] Error checking microphone permission:', error);
    return 'denied';
  }
};

const showPermissionDeniedAlert = () => {
  Alert.alert(
    'Microphone Permission Denied',
    'Voice commands require microphone access. Please allow microphone permission to use this feature.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Try Again', onPress: () => requestMicrophonePermission() }
    ]
  );
};

const showPermissionBlockedAlert = () => {
  Alert.alert(
    'Microphone Permission Blocked',
    'Microphone permission has been permanently denied. Please enable it in your device settings to use voice commands.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => openAppSettings() }
    ]
  );
};

const openAppSettings = async () => {
  try {
    if (Platform.OS === 'ios') {
      await Linking.openURL('app-settings:');
    } else {
      await Linking.openSettings();
    }
  } catch (error) {
    console.error('[PERMISSIONS] Error opening app settings:', error);
    Alert.alert(
      'Cannot Open Settings',
      'Please manually go to your device settings and enable microphone permission for this app.',
      [{ text: 'OK' }]
    );
  }
};

// Utility function to get permission status as human-readable string
export const getPermissionStatusText = (status: string): string => {
  switch (status) {
    case 'granted':
      return 'Microphone access is enabled';
    case 'denied':
      return 'Microphone access is denied';
    case 'blocked':
      return 'Microphone access is permanently blocked';
    case 'unavailable':
      return 'Microphone is not available on this device';
    default:
      return 'Unknown permission status';
  }
};
