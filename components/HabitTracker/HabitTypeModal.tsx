
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
      <TouchableOpacity 
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity 
          style={styles.content}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <TouchableOpacity
            style={styles.typeCard}
            onPress={() => onSelectType('yes_no')}
          >
            <View style={styles.cardContent}>
              <Text style={styles.typeEmoji}>✅</Text>
              <View style={styles.textContent}>
                <Text style={styles.typeTitle}>Yes or No</Text>
                <Text style={styles.exampleText}>• Did you wake up early today?</Text>
                <Text style={styles.exampleText}>• Did you exercise for 30 minutes?</Text>
                <Text style={styles.exampleText}>• Did you read a book today?</Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.typeCard}
            onPress={() => onSelectType('measurable')}
          >
            <View style={styles.cardContent}>
              <Text style={styles.typeEmoji}>📊</Text>
              <View style={styles.textContent}>
                <Text style={styles.typeTitle}>Measurable</Text>
                <Text style={styles.exampleText}>• How many glasses of water?</Text>
                <Text style={styles.exampleText}>• How many minutes of meditation?</Text>
                <Text style={styles.exampleText}>• How many pages did you read?</Text>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    width: width * 0.9,
    maxWidth: 400,
    gap: 24,
  },
  typeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    backdropFilter: 'blur(20px)',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  typeEmoji: {
    fontSize: 32,
    marginTop: 4,
  },
  textContent: {
    flex: 1,
  },
  typeTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: 12,
  },
  exampleText: {
    fontSize: 14,
    color: '#4a5568',
    lineHeight: 20,
    marginBottom: 4,
    fontStyle: 'italic',
  },
});
