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
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { router } from 'expo-router';
import { getCategories } from '@/utils/storage';

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
  onCategorySelect?: (categoryId: string) => void;
  onShowAllNotes?: () => void;
  selectedCategoryId?: string | null;
}

export default function SlideMenu({ 
  visible, 
  onClose, 
  slideAnim, 
  onCreateTemplate,
  onCategorySelect,
  onShowAllNotes,
  selectedCategoryId
}: SlideMenuProps) {
  const [labels, setLabels] = useState<Label[]>([]);

  useEffect(() => {
    // Load labels from storage when component mounts or becomes visible
    if (visible) {
      loadLabels();
    }
  }, [visible]);

  const loadLabels = async () => {
    try {
      const categories = await getCategories();
      
      // If no categories exist, create default ones
      if (categories.length === 0) {
        const defaultCategories = [
          { id: '1', name: 'Work', createdAt: new Date().toISOString() },
          { id: '2', name: 'Personal', createdAt: new Date().toISOString() },
          { id: '3', name: 'Ideas', createdAt: new Date().toISOString() },
          { id: '4', name: 'Projects', createdAt: new Date().toISOString() },
          { id: '5', name: 'Shopping', createdAt: new Date().toISOString() },
          { id: '6', name: 'Health', createdAt: new Date().toISOString() },
          { id: '7', name: 'Travel', createdAt: new Date().toISOString() },
          { id: '8', name: 'Finance', createdAt: new Date().toISOString() },
          { id: '9', name: 'Learning', createdAt: new Date().toISOString() },
          { id: '10', name: 'Family', createdAt: new Date().toISOString() },
          { id: '11', name: 'Goals', createdAt: new Date().toISOString() },
        ];
        
        // Import saveCategory function
        const { saveCategory } = await import('@/utils/storage');
        
        // Save default categories to storage
        for (const category of defaultCategories) {
          await saveCategory(category);
        }
        
        setLabels(defaultCategories);
      } else {
        setLabels(categories);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      setLabels([]);
    }
  };

  const handleCreateNewLabel = () => {
    onClose();
    router.push('/labels-edit?type=categories');
  };

  const handleLabelPress = (labelId: string) => {
    if (onCategorySelect) {
      onCategorySelect(labelId);
    }
    onClose();
  };

  return (
    <Modal
      transparent={true}
      animationType="none"
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent 
      presentationStyle="overFullScreen" 
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View style={[styles.menu, { transform: [{ translateX: slideAnim }] }]}>
             <SafeAreaView style={styles.safeAreaContent}>
                {/* Google Keep Header */}
                <View style={styles.header}>
                <View style={styles.googleIcon}>
                  <Ionicons name="logo-google" size={24} color="#4285F4" />
                </View>
                <Text style={styles.title}>Google Keep</Text>
              </View>

              <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Categories Section */}
                <View style={styles.labelsHeader}>
                  <Text style={styles.labelsTitle}>Categories</Text>
                  <TouchableOpacity onPress={handleCreateNewLabel}>
                    <Text style={styles.editText}>Edit</Text>
                  </TouchableOpacity>
                </View>

                {/* All Notes Option */}
                <TouchableOpacity
                  style={[
                    styles.labelItem,
                    !selectedCategoryId && styles.selectedLabelItem
                  ]}
                  onPress={() => {
                    if (onShowAllNotes) {
                      onShowAllNotes();
                    }
                    onClose();
                  }}
                >
                  <Ionicons name="library-outline" size={20} color="#9CA3AF" />
                  <Text style={styles.labelText}>All Notes</Text>
                </TouchableOpacity>

                {/* Labels List */}
                <View style={styles.labelsContainer}>
                  {labels.map((label) => (
                    <TouchableOpacity
                      key={label.id}
                      style={[
                        styles.labelItem,
                        selectedCategoryId === label.id && styles.selectedLabelItem
                      ]}
                      onPress={() => handleLabelPress(label.id)}
                    >
                      <Ionicons name="apps-outline" size={20} color="#9CA3AF" />
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
                  <Text style={styles.createLabelText}>Create new category</Text>
                </TouchableOpacity>

                {/* Bottom Separator */}
                <View style={styles.separator} />
              </ScrollView>
             </SafeAreaView>
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
  },
  safeAreaContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    // paddingTop: 60, // Add extra padding for status bar area
    marginTop: 0,
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
  selectedLabelItem: {
    backgroundColor: '#0c7a53',
    borderRadius: 24,
  },
});