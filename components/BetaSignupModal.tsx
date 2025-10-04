import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { API_ENDPOINTS } from '@/config/api';

interface BetaSignupModalProps {
  visible: boolean;
  onClose: () => void;
  onSignupComplete?: (email: string, userId: string) => void;
  userUuid?: string | null;
}

export default function BetaSignupModal({ 
  visible, 
  onClose, 
  onSignupComplete,
  userUuid 
}: BetaSignupModalProps) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSkip = () => {
    setEmail('');
    onClose();
  };

  const handleSignup = async () => {
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your email address to continue.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_ENDPOINTS.base}/beta-user/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          user_uuid: userUuid,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        Alert.alert(
          'Welcome to Beta!',
          'Thank you for signing up! You\'ll be notified when the app launches with your 40% discount for the first year.',
          [
            {
              text: 'Great!',
              onPress: () => {
                // Pass the user UUID (which should be the same as the one we sent)
                onSignupComplete?.(result.email, userUuid || result.user_id);
                setEmail('');
                // Don't call onClose() here - handleBetaSignupComplete will handle it
              },
            },
          ]
        );
      } else {
        // Handle case where email already exists
        if (result.error && result.error.includes('already registered')) {
          Alert.alert(
            'Already Registered',
            'This email is already registered for beta access. Thank you for your interest!',
            [
              {
                text: 'OK',
                onPress: () => {
                  setEmail('');
                  // Call onSignupComplete to indicate this was a successful interaction
                  onSignupComplete?.(email.trim().toLowerCase(), userUuid || 'existing-user');
                },
              },
            ]
          );
        } else {
          throw new Error(result.error || 'Failed to sign up for beta access');
        }
      }
    } catch (error) {
      console.error('Beta signup error:', error);
      Alert.alert(
        'Signup Error',
        'Failed to sign up for beta access. Please try again later.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleSkip}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <View style={styles.container}>
            <View style={styles.content}>
              <Text style={styles.title}>🎉 Get 40% OFF First Year!</Text>
              <Text style={styles.subtitle}>
                Be the first to know when we launch and get an exclusive 40% discount for the first year!
              </Text>
              
              <Text style={styles.description}>
                Join our beta community and never miss out on the full release.
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <TextInput
                  style={styles.emailInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter your email"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isSubmitting}
                />
              </View>

              <TouchableOpacity
                style={[styles.signupButton, isSubmitting && styles.disabledButton]}
                onPress={handleSignup}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Text style={styles.signupButtonText}>Claim My 40% Discount</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkip}
                disabled={isSubmitting}
              >
                <Text style={styles.skipButtonText}>Maybe Later</Text>
              </TouchableOpacity>

              <Text style={styles.disclaimer}>
                * Optional - No verification required. You can always update your email later in settings.
              </Text>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#374151',
  },
  content: {
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#00FFA7',
    fontFamily: 'Inter',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#9CA3AF',
    fontFamily: 'Inter',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
    marginBottom: 8,
  },
  emailInput: {
    backgroundColor: '#333333',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#555555',
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter',
    width: '100%',
  },
  signupButton: {
    backgroundColor: '#00FFA7',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 16,
  },
  signupButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    fontFamily: 'Inter',
  },
  disabledButton: {
    backgroundColor: '#6B7280',
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  skipButtonText: {
    fontSize: 16,
    color: '#9CA3AF',
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  disclaimer: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});