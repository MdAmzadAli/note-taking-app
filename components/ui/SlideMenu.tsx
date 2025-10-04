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
  TextInput,
  Alert,
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
  onRename?: (id: string, newName: string) => void;
  onDelete?: (id: string) => void;
  showOptions?: boolean;
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
  autoCloseOnItemPress?: boolean; 
}

export default function SlideMenu({ 
  visible, 
  onClose, 
  title = "Menu",
  titleIcon = "menu-outline",
  sections,
  selectedItemId,
  autoCloseOnItemPress = true
}: SlideMenuProps) {
  const slideAnim = useRef(new Animated.Value(-Dimensions.get('window').width)).current;
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [showOptionsForItem, setShowOptionsForItem] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);

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
      // Reset states when closing
      setShowOptionsForItem(null);
      setEditingItemId(null);
      setEditingItemName('');
      setShowDeleteModal(false);
      setItemToDelete(null);
      // Notify parent that menu closed (optional callback)
      if (onClose) {
        onClose();
      }
    });
  };

  const handleRenameStart = (item: MenuItem) => {
    setEditingItemId(item.id);
    setEditingItemName(item.name);
    setShowOptionsForItem(null);
  };

  const handleRenameConfirm = (item: MenuItem) => {
    if (editingItemName.trim() === '') {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }
    if (editingItemName.trim() === item.name) {
      setEditingItemId(null);
      setEditingItemName('');
      return;
    }
    if (item.onRename) {
      item.onRename(item.id, editingItemName.trim());
    }
    setEditingItemId(null);
    setEditingItemName('');
  };

  const handleRenameCancel = () => {
    setEditingItemId(null);
    setEditingItemName('');
  };

  const handleDeleteStart = (item: MenuItem) => {
    setItemToDelete(item);
    setShowDeleteModal(true);
    setShowOptionsForItem(null);
  };

  const handleDeleteConfirm = () => {
    if (itemToDelete && itemToDelete.onDelete) {
      itemToDelete.onDelete(itemToDelete.id);
    }
    setShowDeleteModal(false);
    setItemToDelete(null);
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setItemToDelete(null);
  };

  const handleItemPress = (item: MenuItem) => {
    if (item.onPress) {
      item.onPress();
    }
    // Only auto-close if the prop allows it (default: true for backward compatibility)
    if (autoCloseOnItemPress !== false) {
      handleClose();
    }
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
                                if (section.title?.toLowerCase().includes('categor')) {
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
                          <View key={item.id} style={styles.menuItemContainer}>
                            <TouchableOpacity
                              style={[
                                styles.menuItem,
                                (selectedItemId === item.id || item.isSelected) && styles.selectedMenuItem
                              ]}
                              onPress={() => editingItemId !== item.id ? handleItemPress(item) : undefined}
                              disabled={editingItemId === item.id}
                            >
                              {item.icon && (
                                <Ionicons 
                                  name={item.icon} 
                                  size={20} 
                                  color={(selectedItemId === item.id || item.isSelected) ? "#000000" : "#FFFFFF"} 
                                />
                              )}
                              
                              {editingItemId === item.id ? (
                                <View style={styles.editingContainer}>
                                  <TextInput
                                    style={styles.editInput}
                                    value={editingItemName}
                                    onChangeText={setEditingItemName}
                                    autoFocus
                                    selectTextOnFocus
                                    onSubmitEditing={() => handleRenameConfirm(item)}
                                  />
                                  <TouchableOpacity 
                                    style={styles.confirmButton}
                                    onPress={() => handleRenameConfirm(item)}
                                  >
                                    <Ionicons name="checkmark" size={16} color="#00FF7F" />
                                  </TouchableOpacity>
                                  <TouchableOpacity 
                                    style={styles.cancelButton}
                                    onPress={handleRenameCancel}
                                  >
                                    <Ionicons name="close" size={16} color="#FF4444" />
                                  </TouchableOpacity>
                                </View>
                              ) : (
                                <Text 
                                  style={[
                                    styles.menuItemText, 
                                    (selectedItemId === item.id || item.isSelected) && styles.selectedMenuItemText,
                                    (item.onRename || item.onDelete) && styles.menuItemTextWithOptions
                                  ]}
                                  numberOfLines={1}
                                  ellipsizeMode="tail"
                                >
                                  {item.name.length > 22 ? `${item.name.substring(0, 22)}...` : item.name}
                                </Text>
                              )}
                            </TouchableOpacity>

                            {/* 3-dot menu for workspaces (only show if item has rename/delete functions) */}
                            {(item.onRename || item.onDelete) && editingItemId !== item.id && (
                              <TouchableOpacity 
                                style={styles.optionsButton}
                                onPress={() => setShowOptionsForItem(showOptionsForItem === item.id ? null : item.id)}
                              >
                                <Ionicons name="ellipsis-vertical" size={16} color="#FFFFFF" />
                              </TouchableOpacity>
                            )}

                            {/* Options Dropdown */}
                            {showOptionsForItem === item.id && (
                              <View style={styles.optionsDropdown}>
                                {item.onRename && (
                                  <TouchableOpacity 
                                    style={styles.option}
                                    onPress={() => handleRenameStart(item)}
                                  >
                                    <Ionicons name="pencil" size={16} color="#FFFFFF" />
                                    <Text style={styles.optionText}>Rename</Text>
                                  </TouchableOpacity>
                                )}
                                
                                {item.onRename && item.onDelete && <View style={styles.optionSeparator} />}
                                
                                {item.onDelete && (
                                  <TouchableOpacity 
                                    style={styles.deleteOption}
                                    onPress={() => handleDeleteStart(item)}
                                  >
                                    <Ionicons name="trash" size={16} color="#FF4444" />
                                    <Text style={styles.deleteOptionText}>Delete</Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            )}
                          </View>
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

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={handleDeleteCancel}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModal}>
            <Text style={styles.deleteModalTitle}>Delete Workspace</Text>
            <Text style={styles.deleteModalText}>
              Are you sure you want to delete "{itemToDelete?.name}"? This action cannot be undone.
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity 
                style={[styles.deleteModalButton, styles.cancelModalButton]}
                onPress={handleDeleteCancel}
              >
                <Text style={styles.cancelModalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.deleteModalButton, styles.confirmModalButton]}
                onPress={handleDeleteConfirm}
              >
                <Text style={styles.confirmModalButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    color: '#00FF7F',
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
    flex: 1,
  },
  menuItemTextWithOptions: {
    marginRight: 50, // Leave space for the 3-dot icon
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
  selectedMenuItemText: {
    color: '#000000',
  },
  infoIcon: {
    marginLeft: 'auto',
    marginRight: 2,
    padding: 2,
  },
  menuItemContainer: {
    position: 'relative',
  },
  editingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 12,
  },
  editInput: {
    color: '#FFFFFF',
    fontSize: 16,
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#00FF7F',
    paddingVertical: 4,
    marginRight: 8,
  },
  confirmButton: {
    padding: 4,
    marginRight: 4,
  },
  cancelButton: {
    padding: 4,
  },
  optionsButton: {
    position: 'absolute',
    right: 16,
    top: 12,
    padding: 8,
    backgroundColor: '#3C4043',
    borderRadius: 12,
  },
  optionsDropdown: {
    position: 'absolute',
    top: 44,
    right: 16,
    backgroundColor: '#333333',
    borderRadius: 8,
    minWidth: 120,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  optionText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  optionSeparator: {
    height: 1,
    backgroundColor: '#444444',
    marginHorizontal: 8,
  },
  deleteOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  deleteOptionText: {
    fontSize: 14,
    color: '#FF4444',
    fontWeight: '500',
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteModal: {
    backgroundColor: '#202124',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    minWidth: 280,
    maxWidth: 350,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  deleteModalText: {
    fontSize: 14,
    color: '#E8EAED',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  deleteModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelModalButton: {
    backgroundColor: '#3C4043',
  },
  confirmModalButton: {
    backgroundColor: '#FF4444',
  },
  cancelModalButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  confirmModalButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});