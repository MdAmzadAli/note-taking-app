import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, Alert } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';

interface RenameModalProps {
  isVisible: boolean;
  currentName: string;
  onClose: () => void;
  onRename: (newName: string) => void;
  title?: string;
  label?: string;
  placeholder?: string;
  errorMessage?: string;
}

export default function RenameModal({ 
  isVisible, 
  currentName, 
  onClose, 
  onRename,
  title = "Rename File",
  label = "File Name", 
  placeholder = "Enter new file name...",
  errorMessage = "Name cannot be empty"
}: RenameModalProps) {
  const [newName, setNewName] = useState('');

  // Initialize with current name when modal opens
  useEffect(() => {
    if (isVisible) {
      setNewName(currentName);
    }
  }, [isVisible, currentName]);

  const handleRename = () => {
    const trimmedName = newName.trim();
    
    if (!trimmedName) {
      Alert.alert('Error', errorMessage);
      return;
    }
    
    if (trimmedName === currentName) {
      onClose();
      return;
    }
    
    onRename(trimmedName);
    onClose();
  };

  const handleCancel = () => {
    setNewName(currentName); // Reset to original name
    onClose();
  };

  return (
    <Modal visible={isVisible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleCancel}>
              <IconSymbol size={16} name="xmark" color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
              style={styles.textInput}
              value={newName}
              onChangeText={setNewName}
              placeholder={placeholder}
              placeholderTextColor="#666666"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus={true}
              selectTextOnFocus={true}
            />
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.renameButton} onPress={handleRename}>
                <Text style={styles.renameButtonText}>Rename</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#1a1a1a',
    borderWidth:1,
    borderColor:"#555555",
    borderRadius: 12,
    width: '85%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  closeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    fontFamily: 'Inter',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#2C2C2E',
    borderWidth: 1,
    borderColor: '#555555',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter',
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#3C3C3E',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  renameButton: {
    flex: 1,
    backgroundColor: '#00FF7F',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  renameButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    fontFamily: 'Inter',
  },
});