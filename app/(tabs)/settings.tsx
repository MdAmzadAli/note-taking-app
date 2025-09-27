import React, { useState } from 'react';
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
});