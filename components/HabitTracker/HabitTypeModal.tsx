
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
} from 'react-native';

interface HabitTypeModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectType: (type: 'yes_no' | 'measurable') => void;
}

const { width } = Dimensions.get('window');

export default function HabitTypeModal({ visible, onClose, onSelectType }: HabitTypeModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Choose Habit Type</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <TouchableOpacity
              style={styles.typeCard}
              onPress={() => onSelectType('yes_no')}
            >
              <View style={styles.typeIcon}>
                <Text style={styles.typeEmoji}>✅</Text>
              </View>
              <Text style={styles.typeTitle}>Yes or No</Text>
              <Text style={styles.typeDescription}>
                Simple completion tracking for habits like "Did I exercise today?"
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.typeCard}
              onPress={() => onSelectType('measurable')}
            >
              <View style={styles.typeIcon}>
                <Text style={styles.typeEmoji}>📊</Text>
              </View>
              <Text style={styles.typeTitle}>Measurable</Text>
              <Text style={styles.typeDescription}>
                Track quantities or time like "How many glasses of water?" or "How many minutes?"
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: width * 0.85,
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a202c',
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    fontSize: 18,
    color: '#64748b',
    fontWeight: '600',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  typeCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeIcon: {
    width: 60,
    height: 60,
    backgroundColor: '#ffffff',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeEmoji: {
    fontSize: 28,
  },
  typeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: 8,
  },
  typeDescription: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
});
