
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, TouchableWithoutFeedback, FlatList } from 'react-native';

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
  isBackendConnected,
  isLoading
}: SideMenuProps) {
  const renderWorkspaceItem = ({ item }: { item: Workspace }) => (
    <TouchableOpacity style={styles.workspaceItem} onPress={() => onWorkspacePress(item)}>
      <Text style={styles.workspaceName}>{item.name}</Text>
      <Text style={styles.workspaceFileCount}>
        {item.files.length} files
        {item.files.some(f => f.isUploaded) && ' (Backend integrated)'}
      </Text>
    </TouchableOpacity>
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
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    zIndex: 1000,
  },
  slidingMenu: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: '80%',
    backgroundColor: '#FFFFFF',
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter',
  },
  menuCloseText: {
    fontSize: 13,
    color: '#000000',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  workspaceList: {
    flex: 1,
  },
  workspaceItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  workspaceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  workspaceFileCount: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  menuFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  createWorkspaceButton: {
    backgroundColor: '#000000',
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
});
