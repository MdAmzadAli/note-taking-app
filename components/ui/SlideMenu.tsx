
import React, { useEffect, useRef, useState } from 'react';
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

interface MenuItem {
  id: string;
  name: string;
  icon?: string;
  onPress?: () => void;
  isSelected?: boolean;
}

interface MenuSection {
  title?: string;
  items: MenuItem[];
  showEdit?: boolean;
  onEdit?: () => void;
  showCreate?: boolean;
  onCreateNew?: () => void;
}

interface SlideMenuProps {
  visible: boolean;
  onClose?: () => void; // Optional callback for when menu closes
  title?: string;
  titleIcon?: string;
  sections: MenuSection[];
  selectedItemId?: string | null;
}

export default function SlideMenu({ 
  visible, 
  onClose, 
  title = "Menu",
  titleIcon = "menu-outline",
  sections,
  selectedItemId
}: SlideMenuProps) {
  const slideAnim = useRef(new Animated.Value(-Dimensions.get('window').width)).current;
  const [isModalVisible, setIsModalVisible] = useState(false);

  useEffect(() => {
    if (visible && !isModalVisible) {
      // Show modal first
      setIsModalVisible(true);
    }
  }, [visible, isModalVisible]);

  // Separate effect to start animation after modal is shown
  useEffect(() => {
    if (visible && isModalVisible) {
      // Use setTimeout to ensure Modal is fully mounted before animating
      const timer = setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }, 10); // Small delay to ensure Modal is ready

      return () => clearTimeout(timer);
    }
  }, [visible, isModalVisible, slideAnim]);

  const handleClose = () => {
    // Animate out, then hide modal
    Animated.timing(slideAnim, {
      toValue: -Dimensions.get('window').width,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsModalVisible(false);
      // Notify parent that menu closed (optional callback)
      if (onClose) {
        onClose();
      }
    });
  };

  const handleItemPress = (item: MenuItem) => {
    if (item.onPress) {
      item.onPress();
    }
    handleClose();
  };

  return (
    <Modal
      transparent={true}
      animationType="none"
      visible={isModalVisible}
      onRequestClose={handleClose}
      statusBarTranslucent 
      presentationStyle="overFullScreen" 
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View style={[styles.menu, { transform: [{ translateX: slideAnim }] }]}>
              <SafeAreaView style={styles.safeAreaContent}>
                {/* Header */}
                <View style={styles.header}>
                  <View style={styles.titleIcon}>
                    <Ionicons name={titleIcon} size={24} color="#4285F4" />
                  </View>
                  <Text style={styles.title}>{title}</Text>
                </View>

                <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                  {sections.map((section, sectionIndex) => (
                    <View key={sectionIndex}>
                      {/* Section Header */}
                      {section.title && (
                        <View style={styles.sectionHeader}>
                          <Text style={styles.sectionTitle}>{section.title}</Text>
                          {section.showEdit && section.onEdit && (
                            <TouchableOpacity onPress={() => {
                              if (section.onEdit) {
                                section.onEdit();
                              } else {
                                handleClose();
                                // Navigate based on section title
                                if (section.title.toLowerCase().includes('categor')) {
                                  const type = title.toLowerCase().includes('task') ? 'task-categories' : 'categories';
                                  router.push(`/labels-edit?type=${type}`);
                                }
                              }
                            }}>
                              <Text style={styles.editText}>Edit</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}

                      {/* Section Items */}
                      <View style={styles.sectionContainer}>
                        {section.items.map((item) => (
                          <TouchableOpacity
                            key={item.id}
                            style={[
                              styles.menuItem,
                              (selectedItemId === item.id || item.isSelected) && styles.selectedMenuItem
                            ]}
                            onPress={() => handleItemPress(item)}
                          >
                            {item.icon && (
                              <Ionicons name={item.icon} size={20} color="#FFFFFF" />
                            )}
                            <Text style={styles.menuItemText}>{item.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {/* Create New Item */}
                      {section.showCreate && section.onCreateNew && (
                        <TouchableOpacity 
                          style={styles.createNewItem}
                          onPress={() => {
                            if (section.onCreateNew) {
                              section.onCreateNew();
                            }
                            handleClose();
                          }}
                        >
                          <Ionicons name="add" size={20} color="#FFFFFF" />
                          <Text style={styles.createNewText}>Create new</Text>
                        </TouchableOpacity>
                      )}

                      {/* Section Separator */}
                      {sectionIndex < sections.length - 1 && (
                        <View style={styles.separator} />
                      )}
                    </View>
                  ))}

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
    marginTop: 0,
  },
  titleIcon: {
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#9AA0A6',
    fontSize: 14,
    fontWeight: '500',
  },
  editText: {
    color: '#8AB4F8',
    fontSize: 14,
    fontWeight: '500',
  },
  sectionContainer: {
    paddingHorizontal: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemText: {
    color: '#E8EAED',
    fontSize: 16,
    marginLeft: 12,
  },
  createNewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 36,
    marginTop: 8,
  },
  createNewText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 12,
  },
  selectedMenuItem: {
    backgroundColor: '#00FF7F',
    color:'#000000',
    borderRadius: 24,
  },
});
