import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface NotesHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onMenuPress: () => void;
  onVoiceInput: () => void;
  isListening: boolean;
  showMicButton?: boolean;
  isTranscriptionDisabled?: boolean;
  selectedCategoryName?: string | null;
  searchType?: 'notes' | 'tasks';
  showDeleteAllMenu?: boolean;
  onDeleteAll?: () => void;
}

export default function NotesHeader({ 
  searchQuery, 
  onSearchChange, 
  onMenuPress, 
  onVoiceInput, 
  isListening,
  showMicButton = true,
  isTranscriptionDisabled = false,
  selectedCategoryName = null,
  searchType = 'notes',
  showDeleteAllMenu = false,
  onDeleteAll
}: NotesHeaderProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const getSearchPlaceholder = () => {
    if (selectedCategoryName) {
      return `Search ${selectedCategoryName} ${searchType}`;
    }
    return searchType === 'notes' ? 'Search Keep' : 'Search Tasks';
  };

  const handleDeleteAllPress = () => {
    setShowMenu(false);
    setShowConfirmModal(true);
  };

  const handleConfirmDeleteAll = () => {
    setShowConfirmModal(false);
    if (onDeleteAll) {
      onDeleteAll();
    }
  };
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.hamburgerButton} onPress={onMenuPress}>
        <Ionicons name="menu" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={getSearchPlaceholder()}
          placeholderTextColor="#999999"
          value={searchQuery}
          onChangeText={onSearchChange}
        />
      </View>

      {showMicButton && (
        <TouchableOpacity 
          style={[
            styles.micButton,
            isTranscriptionDisabled && styles.micButtonDisabled
          ]} 
          onPress={isTranscriptionDisabled ? undefined : onVoiceInput}
          disabled={isTranscriptionDisabled}
          activeOpacity={isTranscriptionDisabled ? 1 : 0.7}
        >
          <Ionicons 
            name="mic" 
            size={20} 
            color={isTranscriptionDisabled ? "#666666" : (isListening ? "#00FF7F" : "#FFFFFF")} 
          />
        </TouchableOpacity>
      )}

      {showDeleteAllMenu && (
        <TouchableOpacity style={styles.menuButton} onPress={() => setShowMenu(true)}>
          <Ionicons name="ellipsis-vertical" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Dropdown Menu Modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.dropdownMenu}>
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={handleDeleteAllPress}
            >
              <Ionicons name="trash" size={18} color="#FF4444" />
              <Text style={styles.menuItemText}>Delete All</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.confirmModalOverlay}>
          <View style={styles.confirmModal}>
            <Text style={styles.confirmTitle}>Delete All Notes</Text>
            <Text style={styles.confirmMessage}>
              Are you sure you want to permanently delete all notes in trash? This action cannot be undone.
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.deleteButton} 
                onPress={handleConfirmDeleteAll}
              >
                <Text style={styles.deleteButtonText}>Delete All</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    // backgroundColor: '#1A1A1A',
  },
  hamburgerButton: {
    padding: 8,
    marginRight: 12,
  },
  searchContainer: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 24,
    paddingHorizontal: 16,
    marginRight: 12,
  },
  searchInput: {
    color: '#FFFFFF',
    fontSize: 14,
    paddingVertical: 12,
  },
  micButton: {
    padding: 8,
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonDisabled: {
    backgroundColor: '#1A1A1A',
    opacity: 0.5,
  },
  menuButton: {
    padding: 8,
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: 16,
  },
  dropdownMenu: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    paddingVertical: 8,
    minWidth: 120,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemText: {
    color: '#FF4444',
    fontSize: 16,
    marginLeft: 12,
  },
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  confirmModal: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 320,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  confirmButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#3A3A3A',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#FF4444',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
});