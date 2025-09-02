import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  TouchableWithoutFeedback,
  Dimensions,
  SafeAreaView,
} from 'react-native';

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
              <SafeAreaView style={styles.safeAreaContent}>
                <Text style={styles.title}>Menu</Text>
                <TouchableOpacity style={styles.item} onPress={() => {
                  onClose();
                  onCreateTemplate();
                }}>
                  <Text style={styles.itemText}>Create Template</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.item} onPress={onClose}>
                  <Text style={styles.itemText}>Settings</Text>
                </TouchableOpacity>
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
    width: Dimensions.get('window').width * 0.75,
    backgroundColor: '#2A2A2A',
  },
  safeAreaContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 30,
  },
  item: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3A3A3A',
  },
  itemText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});