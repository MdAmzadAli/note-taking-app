
import React, { useEffect } from 'react';
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
  onClose: () => void;
  slideAnim: Animated.Value;
  title?: string;
  titleIcon?: string;
  sections: MenuSection[];
  selectedItemId?: string | null;
}

export default function SlideMenu({ 
  visible, 
  onClose, 
  slideAnim, 
  title = "Menu",
  titleIcon = "menu-outline",
  sections,
  selectedItemId
}: SlideMenuProps) {

  const handleItemPress = (item: MenuItem) => {
    if (item.onPress) {
      item.onPress();
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
                            <TouchableOpacity onPress={section.onEdit}>
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
                              <Ionicons name={item.icon} size={20} color="#9CA3AF" />
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
                            section.onCreateNew!();
                            onClose();
                          }}
                        >
                          <Ionicons name="add" size={20} color="#9CA3AF" />
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
    color: '#9AA0A6',
    fontSize: 16,
    marginLeft: 12,
  },
  selectedMenuItem: {
    backgroundColor: '#0c7a53',
    borderRadius: 24,
  },
});
