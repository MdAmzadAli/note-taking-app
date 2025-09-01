
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, TouchableWithoutFeedback, FlatList, Modal } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';

interface Workspace {
  id: string;
  name: string;
  files: any[];
  createdDate: string;
}

interface SideMenuProps {
  isVisible: boolean;
  slideAnim: Animated.Value;
  workspaces: Workspace[];
  onClose: () => void;
  onWorkspacePress: (workspace: Workspace) => void;
  onCreateWorkspace: () => void;
  onDeleteWorkspace: (workspaceId: string) => void;
  isBackendConnected: boolean;
  isLoading: boolean;
}

export default function SideMenu({
  isVisible,
  slideAnim,
  workspaces,
  onClose,
  onWorkspacePress,
  onCreateWorkspace,
  onDeleteWorkspace,
  isBackendConnected,
  isLoading
}: SideMenuProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);
  const [showOptionsForWorkspace, setShowOptionsForWorkspace] = useState<string | null>(null);
  const handleDeleteWorkspace = (workspace: Workspace) => {
    setWorkspaceToDelete(workspace);
    setShowDeleteModal(true);
    setShowOptionsForWorkspace(null);
  };

  const confirmDelete = () => {
    if (workspaceToDelete) {
      onDeleteWorkspace(workspaceToDelete.id);
    }
    setShowDeleteModal(false);
    setWorkspaceToDelete(null);
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setWorkspaceToDelete(null);
  };

  const renderWorkspaceItem = ({ item }: { item: Workspace }) => (
    <View style={styles.workspaceCard}>
      <TouchableOpacity style={styles.workspaceContent} onPress={() => onWorkspacePress(item)}>
        <View style={styles.workspaceIconContainer}>
          <IconSymbol size={20} name="folder" color="#8B5CF6" />
        </View>
        <View style={styles.workspaceDetails}>
          <Text style={styles.workspaceName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.workspaceFileCount}>
            {item.files.length} files
            {item.files.some(f => f.isUploaded) && ' • Indexed'}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.workspaceOptionsButton}
        onPress={() => setShowOptionsForWorkspace(showOptionsForWorkspace === item.id ? null : item.id)}
      >
        <IconSymbol size={16} name="line.horizontal.3" color="#FFFFFF" />
      </TouchableOpacity>
      
      {/* Options Dropdown */}
      {showOptionsForWorkspace === item.id && (
        <View style={styles.optionsDropdown}>
          <TouchableOpacity 
            style={styles.deleteOption}
            onPress={() => handleDeleteWorkspace(item)}
          >
            <IconSymbol size={16} name="trash" color="#FF4444" />
            <Text style={styles.deleteOptionText}>Delete Workspace</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (!isVisible) return null;

  return (
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={styles.menuOverlay}>
        <TouchableWithoutFeedback>
          <Animated.View style={[styles.slidingMenu, { transform: [{ translateX: slideAnim }] }]}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>Workspaces</Text>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <IconSymbol size={20} name="xmark" color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={workspaces}
              renderItem={renderWorkspaceItem}
              keyExtractor={(item) => item.id}
              style={styles.workspaceList}
            />

            <View style={styles.menuFooter}>
              <TouchableOpacity
                style={[styles.createWorkspaceButton, { opacity: isBackendConnected ? 1 : 0.5 }]}
                onPress={() => {
                  onClose();
                  onCreateWorkspace();
                }}
                disabled={!isBackendConnected || isLoading}
              >
                <IconSymbol size={16} name="plus" color="#FFFFFF" />
                <Text style={styles.createWorkspaceButtonText}>Create New Workspace</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </TouchableWithoutFeedback>
        
        {/* Delete Confirmation Modal */}
        <Modal
          visible={showDeleteModal}
          transparent
          animationType="fade"
          onRequestClose={cancelDelete}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.confirmationModal}>
              <Text style={styles.confirmationTitle}>Delete Workspace</Text>
              <Text style={styles.confirmationText}>
                Are you sure you want to delete "{workspaceToDelete?.name}"? This will remove all files and data permanently.
              </Text>
              <View style={styles.confirmationButtons}>
                <TouchableOpacity 
                  style={[styles.confirmationButton, styles.cancelButtonStyle]}
                  onPress={cancelDelete}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.confirmationButton, styles.deleteButtonStyle]}
                  onPress={confirmDelete}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  slidingMenu: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: '85%',
    backgroundColor: '#1A1A1A',
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    backgroundColor: '#000000',
  },
  menuTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  workspaceList: {
    flex: 1,
    padding: 16,
  },
  workspaceCard: {
    backgroundColor: '#2A2A2A',
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  workspaceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  workspaceIconContainer: {
    width: 40,
    height: 40,
    backgroundColor: '#3A3A3A',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#8B5CF6',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  workspaceDetails: {
    flex: 1,
  },
  workspaceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  workspaceFileCount: {
    fontSize: 13,
    color: '#8B5CF6',
    fontFamily: 'Inter',
  },
  workspaceOptionsButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsDropdown: {
    position: 'absolute',
    top: 40,
    right: 12,
    backgroundColor: '#333333',
    borderRadius: 8,
    minWidth: 150,
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
    fontFamily: 'Inter',
  },
  menuFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333333',
    backgroundColor: '#1A1A1A',
  },
  createWorkspaceButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: '#8B5CF6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  createWorkspaceButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
    fontFamily: 'Inter',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmationModal: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    minWidth: 280,
  },
  confirmationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmationText: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  confirmationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  confirmationButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonStyle: {
    backgroundColor: '#333333',
  },
  deleteButtonStyle: {
    backgroundColor: '#FF4444',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});
