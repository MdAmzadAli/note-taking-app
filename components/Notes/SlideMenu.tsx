import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  TouchableWithoutFeedback,
  Dimensions,
  ScrollView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { router } from 'expo-router';

interface Label {
  id: string;
  name: string;
  createdAt: string;
}

interface SlideMenuProps {
  visible: boolean;
  onClose: () => void;
  slideAnim: Animated.Value;
  onCreateTemplate: () => void;
}

export default function SlideMenu({ 
  visible, 
  onClose, 
  slideAnim, 
  onCreateTemplate 
}: SlideMenuProps) {
  const [labels, setLabels] = useState<Label[]>([]);

  useEffect(() => {
    // Load labels from storage when component mounts
    loadLabels();
  }, [visible]);

  const loadLabels = async () => {
    try {
      // TODO: Implement actual label loading from AsyncStorage
      // For now, using mock labels to match the reference image
      const mockLabels = [
        { id: '1', name: 'Bbjh', createdAt: new Date().toISOString() },
        { id: '2', name: 'Dfgt', createdAt: new Date().toISOString() },
        { id: '3', name: 'Eiekejeh', createdAt: new Date().toISOString() },
        { id: '4', name: 'Ejekekek', createdAt: new Date().toISOString() },
        { id: '5', name: 'Emnshe', createdAt: new Date().toISOString() },
        { id: '6', name: 'Nzznsmsm', createdAt: new Date().toISOString() },
        { id: '7', name: 'Shsjjs', createdAt: new Date().toISOString() },
        { id: '8', name: 'Sjsjjs', createdAt: new Date().toISOString() },
        { id: '9', name: 'Skkwwhyw', createdAt: new Date().toISOString() },
        { id: '10', name: 'Uwjwjw', createdAt: new Date().toISOString() },
        { id: '11', name: 'Wjwkekke', createdAt: new Date().toISOString() },
      ];
      setLabels(mockLabels);
    } catch (error) {
      console.error('Error loading labels:', error);
    }
  };

  const handleCreateNewLabel = () => {
    onClose();
    router.push('/labels-edit');
  };

  const handleLabelPress = (labelId: string) => {
    // TODO: Implement label filtering functionality
    console.log('Selected label:', labelId);
    onClose();
  };

  return (
    <Modal
      transparent={true}
      animationType="none"
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View style={[styles.menu, { transform: [{ translateX: slideAnim }] }]}>
              {/* Google Keep Header */}
              <View style={styles.header}>
                <View style={styles.googleIcon}>
                  <Ionicons name="logo-google" size={24} color="#4285F4" />
                </View>
                <Text style={styles.title}>Google Keep</Text>
              </View>

              <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Notes Section - Default Selected */}
                <TouchableOpacity style={styles.notesSection}>
                  <View style={styles.notesItem}>
                    <Ionicons name="bulb-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.notesText}>Notes</Text>
                  </View>
                </TouchableOpacity>

                {/* Reminders Section */}
                <TouchableOpacity style={styles.remindersSection}>
                  <View style={styles.remindersItem}>
                    <Ionicons name="notifications-outline" size={20} color="#9CA3AF" />
                    <Text style={styles.remindersText}>Reminders</Text>
                  </View>
                </TouchableOpacity>

                {/* Separation Line */}
                <View style={styles.separator} />

                {/* Labels Section */}
                <View style={styles.labelsHeader}>
                  <Text style={styles.labelsTitle}>Labels</Text>
                  <TouchableOpacity onPress={handleCreateNewLabel}>
                    <Text style={styles.editText}>Edit</Text>
                  </TouchableOpacity>
                </View>

                {/* Labels List */}
                <View style={styles.labelsContainer}>
                  {labels.map((label) => (
                    <TouchableOpacity
                      key={label.id}
                      style={styles.labelItem}
                      onPress={() => handleLabelPress(label.id)}
                    >
                      <Ionicons name="pricetag-outline" size={20} color="#9CA3AF" />
                      <Text style={styles.labelText}>{label.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Create New Label */}
                <TouchableOpacity 
                  style={styles.createLabelItem}
                  onPress={handleCreateNewLabel}
                >
                  <Ionicons name="add" size={20} color="#9CA3AF" />
                  <Text style={styles.createLabelText}>Create new label</Text>
                </TouchableOpacity>

                {/* Bottom Separator */}
                <View style={styles.separator} />
              </ScrollView>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menu: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: Dimensions.get('window').width * 0.8,
    backgroundColor: '#202124',
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  googleIcon: {
    marginRight: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '400',
  },
  scrollContent: {
    flex: 1,
  },
  notesSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  notesItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1976D2',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
  },
  notesText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  remindersSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  remindersItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  remindersText: {
    color: '#E8EAED',
    fontSize: 16,
    marginLeft: 12,
  },
  separator: {
    height: 1,
    backgroundColor: '#3C4043',
    marginHorizontal: 20,
    marginVertical: 12,
  },
  labelsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  labelsTitle: {
    color: '#9AA0A6',
    fontSize: 14,
    fontWeight: '500',
  },
  editText: {
    color: '#8AB4F8',
    fontSize: 14,
    fontWeight: '500',
  },
  labelsContainer: {
    paddingHorizontal: 20,
  },
  labelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  labelText: {
    color: '#E8EAED',
    fontSize: 16,
    marginLeft: 12,
  },
  createLabelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 36,
    marginTop: 8,
  },
  createLabelText: {
    color: '#9AA0A6',
    fontSize: 16,
    marginLeft: 12,
  },
});