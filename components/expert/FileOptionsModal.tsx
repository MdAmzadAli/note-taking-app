
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, Keyboard, Platform } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import * as DocumentPicker from 'expo-document-picker';
import { WORKSPACE_MAX_FILES } from '@/app/(tabs)/expert';

interface FileItem {
  id: string;
  name: string;
  type: 'device' | 'from_url' | 'webpage';
  source: string;
  file?: any;
}

interface FileOptionsModalProps {
  isVisible: boolean;
  onClose: () => void;
  onFilesAdded: (files: FileItem[]) => void;
  maxFiles?: number;
  currentFileCount?: number;
}

export default function FileOptionsModal({
  isVisible,
  onClose,
  onFilesAdded,
  maxFiles = WORKSPACE_MAX_FILES,
  currentFileCount = 0
}: FileOptionsModalProps) {
  const [activeUrlInput, setActiveUrlInput] = useState<'url' | 'webpage' | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [modalPosition, setModalPosition] = useState(0);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      if (modalPosition === 0 && !activeUrlInput) {
        setModalPosition(-e.endCoordinates.height * 0.3);
      }
    });

    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
      if (!activeUrlInput) {
        setModalPosition(0);
      }
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, [modalPosition, activeUrlInput]);

  const handleClose = () => {
    setActiveUrlInput(null);
    setUrlInput('');
    setModalPosition(0);
    onClose();
  };

  const handleAddFromDevice = async () => {
    const remainingSlots = maxFiles - currentFileCount;
    if (remainingSlots <= 0) {
      Alert.alert('Limit Reached', `Maximum ${maxFiles} files can be uploaded.`);
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const filesToAdd = result.assets.slice(0, remainingSlots);
        const newFiles: FileItem[] = filesToAdd.map((file, index) => ({
          id: (Date.now() + index).toString(),
          name: file.name,
          type: 'device',
          source: file.name,
          file: file
        }));

        onFilesAdded(newFiles);
        handleClose();

        if (result.assets.length > remainingSlots) {
          Alert.alert(
            'Some files not added',
            `Only ${filesToAdd.length} files were added due to the ${maxFiles}-file limit. ${result.assets.length - remainingSlots} files were skipped.`
          );
        }
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleUrlOptionClick = (type: 'url' | 'webpage') => {
    if (currentFileCount >= maxFiles) {
      Alert.alert('Limit Reached', `Maximum ${maxFiles} files can be uploaded.`);
      return;
    }
    setActiveUrlInput(type);
    setUrlInput('');
  };

  const handleAddUrl = () => {
    if (urlInput.trim() && activeUrlInput) {
      const backendType = activeUrlInput === 'url' ? 'from_url' : 'webpage';

      const newFile: FileItem = {
        id: Date.now().toString(),
        name: urlInput.trim(),
        type: backendType,
        source: urlInput.trim(),
      };
      
      onFilesAdded([newFile]);
      setUrlInput('');
      // Keep input section open for multiple additions
    } else {
      Alert.alert('Error', 'Please enter a valid URL');
    }
  };

  const modalTransform = Platform.OS === 'ios' && activeUrlInput ? modalPosition : 0;

  return (
    <Modal visible={isVisible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View 
          style={[
            styles.modal,
            {
              transform: [{ translateY: modalTransform }],
            }
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Add File</Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <IconSymbol size={16} name="xmark" color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <TouchableOpacity style={styles.option} onPress={handleAddFromDevice}>
              <IconSymbol size={20} name="phone" color="#FFFFFF" />
              <Text style={styles.optionText}>From Device</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.option} onPress={() => handleUrlOptionClick('url')}>
              <IconSymbol size={20} name="link" color="#FFFFFF" />
              <Text style={styles.optionText}>From Internet</Text>
            </TouchableOpacity>

            {activeUrlInput === 'url' && (
              <View style={styles.urlInputSection}>
                <View style={styles.urlInputContainer}>
                  <TextInput
                    style={styles.urlInput}
                    value={urlInput}
                    onChangeText={setUrlInput}
                    placeholder="Enter URL..."
                    placeholderTextColor="#666666"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    autoFocus={true}
                  />
                  <TouchableOpacity style={styles.sendButton} onPress={handleAddUrl}>
                    <IconSymbol size={16} name="arrow.right" color="#007AFF" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.option} onPress={() => handleUrlOptionClick('webpage')}>
              <IconSymbol size={20} name="globe" color="#FFFFFF" />
              <Text style={styles.optionText}>Add Webpage</Text>
            </TouchableOpacity>

            {activeUrlInput === 'webpage' && (
              <View style={styles.urlInputSection}>
                <View style={styles.urlInputContainer}>
                  <TextInput
                    style={styles.urlInput}
                    value={urlInput}
                    onChangeText={setUrlInput}
                    placeholder="Enter webpage URL..."
                    placeholderTextColor="#666666"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    autoFocus={true}
                  />
                  <TouchableOpacity style={styles.sendButton} onPress={handleAddUrl}>
                    <IconSymbol size={16} name="arrow.right" color="#007AFF" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
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
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    width: '80%',
    maxWidth: 300,
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
  content: {
    padding: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    marginVertical: 2,
    gap: 12,
  },
  optionText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  urlInputSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    marginVertical: 4,
  },
  urlInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333333',
    borderWidth: 1,
    borderColor: '#555555',
    borderRadius: 6,
    paddingRight: 8,
    gap: 8,
  },
  urlInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  sendButton: {
    padding: 8,
    backgroundColor: '#2A2A2A',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
});
