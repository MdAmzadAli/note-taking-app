
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
                Did you wake up early today?
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
                How many glasses of water did you drink?
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 20,
    width: width * 0.85,
    maxWidth: 400,
    backdropFilter: 'blur(10px)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226, 232, 240, 0.3)',
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
    gap: 24,
  },
  typeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  typeIcon: {
    width: 60,
    height: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    color: '#4a5568',
    textAlign: 'center',
    lineHeight: 20,
    fontStyle: 'italic',
  },
});
