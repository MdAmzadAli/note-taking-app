import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { API_ENDPOINTS } from '@/config/api';
import AppLayout from '@/app/AppLayout';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FEEDBACK_TYPES = [
  'Bug',
  'Feature Request', 
  'General Feedback',
  'Other'
];

// Feedback Modal Component
function FeedbackModal({ visible, onClose }) {
  const [feedbackType, setFeedbackType] = useState('Bug');
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setFeedbackType('Bug');
    setFeedback('');
    setIsSubmitting(false);
    onClose();
  };

  const getPlatformType = () => {
    return Platform.OS === 'ios' ? 'IOS' : 'Android';
  };

  const handleSubmit = async () => {
    if (!feedback.trim()) {
      Alert.alert('Error', 'Please enter your feedback');
      return;
    }

    setIsSubmitting(true);

    try {
      const feedbackData = {
        feedbackType,
        feedback: feedback.trim(),
        platformType: getPlatformType(),
      };

      const response = await fetch(API_ENDPOINTS.feedback, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(feedbackData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        Alert.alert(
          'Thank You A Lot!', 
          'Your feedback has been submitted successfully.',
          [
            {
              text: 'OK',
              onPress: resetForm,
            },
          ]
        );
      } else {
        throw new Error(result.detail || 'Failed to submit feedback');
      }
    } catch (error) {
      console.error('Feedback submission error:', error);
      Alert.alert(
        'Error',
        'Failed to submit feedback. Please try again later.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Send Feedback</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.label}>Feedback Type</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={feedbackType}
                onValueChange={setFeedbackType}
                style={styles.picker}
                dropdownIconColor="#FFFFFF"
                enabled={!isSubmitting}
              >
                {FEEDBACK_TYPES.map((type) => (
                  <Picker.Item
                    key={type}
                    label={type}
                    value={type}
                    color={'#FFFFFF'}
                  />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Your Feedback</Text>
            <TextInput
              style={styles.textArea}
              value={feedback}
              onChangeText={setFeedback}
              placeholder="Please describe your feedback..."
              placeholderTextColor="#9CA3AF"
              multiline={true}
              numberOfLines={8}
              textAlignVertical="top"
              editable={!isSubmitting}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.submitButton,
              isSubmitting && styles.disabledButton,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>Send Feedback</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

// Main Settings Tab Component
export default function SettingsTab() {
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [betaUserEmail, setBetaUserEmail] = useState('');
  const [tempEmail, setTempEmail] = useState('');
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [betaUserId, setBetaUserId] = useState<string | null>(null);
  const [isLoadingBetaData, setIsLoadingBetaData] = useState(true);

  // Load beta user data on component mount
  useEffect(() => {
    const loadBetaUserData = async () => {
      try {
        const betaUserData = await AsyncStorage.getItem('betaUserData');
        if (betaUserData) {
          const data = JSON.parse(betaUserData);
          setBetaUserEmail(data.email || '');
          setBetaUserId(data.userId || null);
          setTempEmail(data.email || '');
        }
      } catch (error) {
        console.error('Error loading beta user data:', error);
      } finally {
        setIsLoadingBetaData(false);
      }
    };

    loadBetaUserData();
  }, []);

  const handleEmailEdit = () => {
    setTempEmail(betaUserEmail);
    setIsEditingEmail(true);
  };

  const handleEmailCancel = () => {
    setTempEmail(betaUserEmail);
    setIsEditingEmail(false);
  };

  const handleEmailSave = async () => {
    if (!tempEmail.trim()) {
      Alert.alert('Email Required', 'Please enter your email address.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(tempEmail.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setIsUpdatingEmail(true);

    try {
      if (betaUserId) {
        // Update existing beta user email
        const response = await fetch(`${API_ENDPOINTS.base}/beta-user/update`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: betaUserId,
            email: tempEmail.trim().toLowerCase(),
          }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          setBetaUserEmail(result.email);
          setTempEmail(result.email);
          setIsEditingEmail(false);
          
          // Update local storage
          const betaUserData = { email: result.email, userId: betaUserId, signupDate: new Date().toISOString() };
          await AsyncStorage.setItem('betaUserData', JSON.stringify(betaUserData));
          
          Alert.alert('Success', 'Your email has been updated successfully!');
        } else {
          throw new Error(result.error || 'Failed to update email');
        }
      } else {
        // Create new beta user
        const response = await fetch(`${API_ENDPOINTS.base}/beta-user/signup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: tempEmail.trim().toLowerCase(),
          }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          setBetaUserEmail(result.email);
          setTempEmail(result.email);
          setBetaUserId(result.user_id);
          setIsEditingEmail(false);
          
          // Update local storage
          const betaUserData = { email: result.email, userId: result.user_id, signupDate: new Date().toISOString() };
          await AsyncStorage.setItem('betaUserData', JSON.stringify(betaUserData));
          await AsyncStorage.setItem('betaSignupShown', 'true');
          
          Alert.alert('Welcome!', 'Thank you for signing up for beta access! You\'ll be notified when we launch.');
        } else {
          if (result.error && result.error.includes('already registered')) {
            Alert.alert('Already Registered', 'This email is already registered for beta access.');
          } else {
            throw new Error(result.error || 'Failed to sign up for beta access');
          }
        }
      }
    } catch (error) {
      console.error('Email update error:', error);
      Alert.alert('Error', 'Failed to update email. Please try again later.');
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  return (
    <AppLayout>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Manage your preferences</Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <TouchableOpacity
            style={styles.feedbackButton}
            onPress={() => setShowFeedbackModal(true)}
          >
            <Text style={styles.feedbackButtonText}>Send Feedback</Text>
          </TouchableOpacity>

          {/* Beta User Email Section */}
          <View style={styles.betaEmailSection}>
            <Text style={styles.sectionTitle}>Beta Access</Text>
            <Text style={styles.sectionDescription}>
              Get notified when we launch with 40% lifetime discount
            </Text>
            
            {isLoadingBetaData ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#00FFA7" size="small" />
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            ) : (
              <View style={styles.emailContainer}>
                <Text style={styles.emailLabel}>Your Email</Text>
                
                {isEditingEmail ? (
                  // Edit mode
                  <View style={styles.editingContainer}>
                    <TextInput
                      style={styles.emailInput}
                      value={tempEmail}
                      onChangeText={setTempEmail}
                      placeholder="Enter your email"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isUpdatingEmail}
                    />
                    <View style={styles.editButtons}>
                      <TouchableOpacity
                        style={[styles.editButton, styles.cancelButton]}
                        onPress={handleEmailCancel}
                        disabled={isUpdatingEmail}
                      >
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.editButton, styles.saveButton, isUpdatingEmail && styles.disabledButton]}
                        onPress={handleEmailSave}
                        disabled={isUpdatingEmail}
                      >
                        {isUpdatingEmail ? (
                          <ActivityIndicator color="#000" size="small" />
                        ) : (
                          <Text style={styles.saveButtonText}>Save</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  // Display mode
                  <View style={styles.displayContainer}>
                    <View style={styles.emailDisplay}>
                      <Text style={styles.emailText}>
                        {betaUserEmail || 'Not set'}
                      </Text>
                      <TouchableOpacity
                        style={styles.editIconButton}
                        onPress={handleEmailEdit}
                      >
                        <Text style={styles.editIconText}>✏️</Text>
                      </TouchableOpacity>
                    </View>
                    
                    {!betaUserEmail && (
                      <TouchableOpacity
                        style={styles.addEmailButton}
                        onPress={handleEmailEdit}
                      >
                        <Text style={styles.addEmailButtonText}>Add Email for Beta Access</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                
                {betaUserEmail && (
                  <Text style={styles.betaStatusText}>
                    ✅ You're registered for beta access with 40% lifetime discount!
                  </Text>
                )}
              </View>
            )}
          </View>
        </ScrollView>

        <FeedbackModal
          visible={showFeedbackModal}
          onClose={() => setShowFeedbackModal(false)}
        />
      </View>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor: '#1a1a1a',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    fontFamily: 'Inter',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
    marginBottom: 10,
  },
  pickerContainer: {
    backgroundColor: '#333333',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#555555',
    overflow: 'hidden',
  },
  picker: {
    color: '#FFFFFF',
    backgroundColor: 'transparent',
  },
  textArea: {
    backgroundColor: '#333333',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#555555',
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter',
    minHeight: 160,
  },
  platformInfo: {
    backgroundColor: '#374151',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  platformText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontFamily: 'Inter',
  },
  submitButton: {
    backgroundColor: '#00FFA7',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    fontFamily: 'Inter',
  },
  disabledButton: {
    backgroundColor: '#6B7280',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#00FFA7',
    fontFamily: 'Inter',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  headerSpacer: {
    width: 50,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  // Settings styles
  feedbackButton: {
    backgroundColor: '#00FFA7',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  feedbackButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    fontFamily: 'Inter',
  },
  // Beta Email Section Styles
  betaEmailSection: {
    marginTop: 24,
    padding: 20,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter',
    marginBottom: 6,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#9CA3AF',
    fontFamily: 'Inter',
    marginBottom: 16,
    lineHeight: 20,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontFamily: 'Inter',
    marginLeft: 8,
  },
  emailContainer: {
    flex: 1,
  },
  emailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
    marginBottom: 8,
  },
  editingContainer: {
    flex: 1,
  },
  emailInput: {
    backgroundColor: '#333333',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#555555',
    padding: 12,
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter',
    marginBottom: 12,
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  editButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#6B7280',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  saveButton: {
    backgroundColor: '#00FFA7',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    fontFamily: 'Inter',
  },
  displayContainer: {
    flex: 1,
  },
  emailDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#333333',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#555555',
    padding: 12,
    marginBottom: 12,
  },
  emailText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter',
    flex: 1,
  },
  editIconButton: {
    padding: 4,
  },
  editIconText: {
    fontSize: 16,
  },
  addEmailButton: {
    backgroundColor: '#00FFA7',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  addEmailButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    fontFamily: 'Inter',
  },
  betaStatusText: {
    fontSize: 14,
    color: '#00FFA7',
    fontFamily: 'Inter',
    textAlign: 'center',
    fontWeight: '500',
  },
});