
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
  const [showWorkspaceOptions, setShowWorkspaceOptions] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);

  const handleWorkspaceOptions = (workspace: Workspace) => {
    setShowWorkspaceOptions(workspace.id);
  };

  const handleDeleteWorkspace = (workspace: Workspace) => {
    setWorkspaceToDelete(workspace);
    setShowDeleteModal(true);
    setShowWorkspaceOptions(null);
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
      <TouchableOpacity 
        style={styles.workspaceItemContent} 
        onPress={() => onWorkspacePress(item)}
        activeOpacity={0.8}
      >
        <View style={styles.workspaceIconContainer}>
          <IconSymbol size={20} name="folder" color="#007AFF" />
        </View>
        <View style={styles.workspaceInfo}>
          <Text style={styles.workspaceName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.workspaceFileCount}>
            {item.files.length} files
          </Text>
          <Text style={styles.workspaceDate}>
            Created {new Date(item.createdDate).toLocaleDateString()}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.workspaceOptionsButton}
        onPress={() => handleWorkspaceOptions(item)}
      >
        <IconSymbol size={16} name="ellipsis" color="#8E8E93" />
      </TouchableOpacity>
      
      {showWorkspaceOptions === item.id && (
        <View style={styles.workspaceOptionsDropdown}>
          <TouchableOpacity 
            style={styles.workspaceOptionItem}
            onPress={() => handleDeleteWorkspace(item)}
          >
            <IconSymbol size={16} name="trash" color="#FF3B30" />
            <Text style={styles.workspaceOptionText}>Delete Workspace</Text>
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
              <TouchableOpacity onPress={onClose}>
                <Text style={styles.menuCloseText}>Close</Text>
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
                <Text style={styles.createWorkspaceButtonText}>+ Create New Workspace</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </TouchableWithoutFeedback>
      </View>
      
      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={cancelDelete}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModal}>
            <Text style={styles.deleteTitle}>Delete Workspace</Text>
            <Text style={styles.deleteText}>
              Are you sure you want to delete "{workspaceToDelete?.name}"? This action cannot be undone.
            </Text>
            <View style={styles.deleteButtons}>
              <TouchableOpacity 
                style={[styles.deleteButton, styles.cancelButton]}
                onPress={cancelDelete}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.deleteButton, styles.confirmButton]}
                onPress={confirmDelete}
              >
                <Text style={styles.confirmButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    width: '80%',
    backgroundColor: '#1C1C1E',
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#3C3C3E',
    backgroundColor: '#1C1C1E',
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  menuCloseText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  workspaceList: {
    flex: 1,
    paddingVertical: 8,
  },
  workspaceCard: {
    marginHorizontal: 16,
    marginVertical: 6,
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    position: 'relative',
  },
  workspaceItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingRight: 50,
  },
  workspaceIconContainer: {
    width: 40,
    height: 40,
    backgroundColor: '#3C3C3E',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  workspaceInfo: {
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
    color: '#8E8E93',
    fontFamily: 'Inter',
    marginBottom: 2,
  },
  workspaceDate: {
    fontSize: 11,
    color: '#6D6D70',
    fontFamily: 'Inter',
  },
  workspaceOptionsButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workspaceOptionsDropdown: {
    position: 'absolute',
    top: 40,
    right: 8,
    backgroundColor: '#3C3C3E',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  workspaceOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  workspaceOptionText: {
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  menuFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#3C3C3E',
    backgroundColor: '#1C1C1E',
  },
  createWorkspaceButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  createWorkspaceButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 14,
    fontFamily: 'Inter',
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteModal: {
    backgroundColor: '#2C2C2E',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 32,
    maxWidth: 300,
    width: '100%',
  },
  deleteTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  deleteText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    fontFamily: 'Inter',
  },
  deleteButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#3C3C3E',
  },
  confirmButton: {
    backgroundColor: '#FF3B30',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
});
