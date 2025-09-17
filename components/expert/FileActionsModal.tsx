import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';

interface FileActionsModalProps {
  isVisible: boolean;
  fileName: string;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export default function FileActionsModal({ 
  isVisible, 
  fileName, 
  onClose, 
  onRename, 
  onDelete 
}: FileActionsModalProps) {
  
  const handleRename = () => {
    onRename(); // This will handle closing actions modal and opening rename modal
  };

  const handleDelete = () => {
    onDelete(); // This will handle closing actions modal and opening delete modal
  };

  return (
    <Modal visible={isVisible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.fileName} numberOfLines={2}>{fileName}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <IconSymbol size={16} name="xmark" color="#FFFFFF" />
            </TouchableOpacity>
          </View>

        

          <View style={styles.content}>
            <TouchableOpacity style={styles.actionButton} onPress={handleRename}>
              <IconSymbol size={20} name="pencil" color="#FFFFFF" />
              <Text style={styles.actionText}>Rename</Text>
              <IconSymbol size={16} name="chevron.right" color="#8E8E93" />
            </TouchableOpacity>

            <View style={styles.separator} />

            <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={handleDelete}>
              <IconSymbol size={20} name="trash" color="#FF3B30" />
              <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
              <IconSymbol size={16} name="chevron.right" color="#8E8E93" />
            </TouchableOpacity>
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
    backgroundColor: '#2a2a2a',
    borderWidth:1,
    borderColor:"#555555",
    borderRadius: 12,
    width: '75%',
    maxWidth: 280,
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
    fontSize: 16,
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
  fileInfo: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    // backgroundColor: '#2C2C2E',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  content: {
    paddingVertical: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  deleteButton: {
    // No additional styles needed as delete color is handled by text
  },
  actionText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  deleteText: {
    color: '#FF3B30',
  },
  separator: {
    height: 1,
    backgroundColor: '#333333',
    marginHorizontal: 16,
  },
});