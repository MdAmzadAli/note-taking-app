import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
  StatusBar,
  Platform,
  Alert,
  Image,
  Dimensions,
  PanResponder,
  KeyboardAvoidingView,
  NativeSyntheticEvent,
  TextInputSelectionChangeEventData,
  Keyboard,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import ColorThemePicker from './ColorThemePicker';
import MediaAttachmentModal from './MediaAttachmentModal';
import AudioRecordingModal from './AudioRecordingModal';
import AudioPlayerComponent from './AudioPlayerComponent';
import TickBoxComponent from './TickBoxComponent';
import { getCategories } from '@/utils/storage';

interface ImageAttachment {
  id: string;
  uri: string;
  type: 'photo' | 'image';
  createdAt: string;
}

interface AudioAttachment {
  id: string;
  uri: string;
  duration: number;
  createdAt: string;
}

interface TickBoxItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

interface TickBoxGroup {
  id: string;
  items: TickBoxItem[];
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
  createdAt: string;
}

// Clean block system - each block is either text or media
interface EditorBlock {
  id: string;
  type: 'text' | 'image' | 'audio' | 'tickbox';
  content?: string; // for text blocks
  data?: ImageAttachment[] | AudioAttachment | TickBoxGroup; // for media blocks
  createdAt: string;
}

interface NoteEditorScreenProps {
  isEditing: boolean;
  noteTitle: string;
  noteContent: string;
  noteTheme?: string;
  noteGradient?: string[] | null;
  fontStyle?: string | undefined;
  isPinned?: boolean;
  images?: ImageAttachment[];
  audios?: AudioAttachment[];
  tickBoxGroups?: TickBoxGroup[];
  createdAt?: string;
  updatedAt?: string;
  categoryId?: string;
  readOnly?: boolean;
  onSave: (theme?: string, gradient?: string[], isPinned?: boolean, images?: ImageAttachment[], categoryId?: string, audios?: AudioAttachment[], tickBoxGroups?: TickBoxGroup[], fontStyle?: string | undefined) => void;
  onBack: () => void;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  onImagesChange?: (images: ImageAttachment[]) => void;
  onAudiosChange?: (audios: AudioAttachment[]) => void;
  onTickBoxGroupsChange?: (tickBoxGroups: TickBoxGroup[]) => void;
}

export default function NoteEditorScreen({
  isEditing,
  noteTitle,
  noteContent,
  noteTheme = '#1C1C1C',
  noteGradient = null,
  fontStyle,
  isPinned = false,
  images = [],
  audios = [],
  tickBoxGroups = [],
  createdAt,
  updatedAt,
  categoryId,
  readOnly = false,
  onSave,
  onBack,
  onTitleChange,
  onContentChange,
  onImagesChange,
  onAudiosChange,
  onTickBoxGroupsChange
}: NoteEditorScreenProps) {
  // State management
  const [isNotePinned, setIsNotePinned] = useState(isPinned);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState(noteTheme);
  const [selectedGradient, setSelectedGradient] = useState<string[] | null>(noteGradient);
  const [selectedFontStyle, setSelectedFontStyle] = useState<string | undefined>(fontStyle);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [initialTitle, setInitialTitle] = useState(noteTitle);
  const [initialContent, setInitialContent] = useState(noteContent);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(categoryId || null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [fullImageUri, setFullImageUri] = useState<string | null>(null);
  const [showFullImage, setShowFullImage] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [pendingModalAction, setPendingModalAction] = useState<(() => void) | null>(null);
  const [isProcessingMedia, setIsProcessingMedia] = useState(false);

  // Core editor state - array of blocks
  const [editorBlocks, setEditorBlocks] = useState<EditorBlock[]>([]);
  const [activeTextBlockId, setActiveTextBlockId] = useState<string>('');

  const textInputRefs = useRef<{[key: string]: TextInput}>({});
  const scrollViewRef = useRef<ScrollView>(null);

  // Initialize editor blocks on mount
  useEffect(() => {
    initializeEditorBlocks();
    loadCategories();

    // Keyboard listeners
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setIsKeyboardVisible(true);
      setTimeout(() => scrollToActiveInput(), 100);
    });

    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
      setIsKeyboardVisible(false);
      if (pendingModalAction) {
        setTimeout(() => {
          pendingModalAction();
          setPendingModalAction(null);
        }, 200);
      }
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, [pendingModalAction]);

  // Initialize editor blocks from existing data
  const initializeEditorBlocks = () => {
    const blocks: EditorBlock[] = [];

    // Always start with a text block (Rule 1)
    const initialTextBlock: EditorBlock = {
      id: generateBlockId(),
      type: 'text',
      content: noteContent || '',
      createdAt: new Date().toISOString(),
    };
    blocks.push(initialTextBlock);
    setActiveTextBlockId(initialTextBlock.id);

    // Add existing media blocks if editing
    if (isEditing) {
      images.forEach(image => {
        blocks.push({
          id: generateBlockId(),
          type: 'image',
          data: [image],
          createdAt: image.createdAt,
        });
        // Add text block after each media (Rule 4)
        blocks.push({
          id: generateBlockId(),
          type: 'text',
          content: '',
          createdAt: new Date().toISOString(),
        });
      });

      audios.forEach(audio => {
        blocks.push({
          id: generateBlockId(),
          type: 'audio',
          data: audio,
          createdAt: audio.createdAt,
        });
        // Add text block after each media (Rule 4)
        blocks.push({
          id: generateBlockId(),
          type: 'text',
          content: '',
          createdAt: new Date().toISOString(),
        });
      });

      tickBoxGroups.forEach(group => {
        blocks.push({
          id: generateBlockId(),
          type: 'tickbox',
          data: group,
          createdAt: group.createdAt,
        });
        // Add text block after each media (Rule 4)
        blocks.push({
          id: generateBlockId(),
          type: 'text',
          content: '',
          createdAt: new Date().toISOString(),
        });
      });
    }

    setEditorBlocks(blocks);
  };

  const generateBlockId = () => `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const loadCategories = async () => {
    try {
      const categoriesData = await getCategories();
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  // Update content change detection
  useEffect(() => {
    const currentContent = getContentFromBlocks();
    const titleChanged = noteTitle !== initialTitle;
    const contentChanged = currentContent !== initialContent;
    setHasUnsavedChanges(titleChanged || contentChanged);
  }, [noteTitle, editorBlocks, initialTitle, initialContent]);

  // Convert blocks back to content string for saving
  const getContentFromBlocks = (): string => {
    return editorBlocks
      .filter(block => block.type === 'text')
      .map(block => block.content || '')
      .join('\n');
  };

  // Extract media from blocks for saving
  const getMediaFromBlocks = () => {
    const images: ImageAttachment[] = [];
    const audios: AudioAttachment[] = [];
    const tickBoxGroups: TickBoxGroup[] = [];

    editorBlocks.forEach(block => {
      if (block.type === 'image' && block.data) {
        const imageArray = block.data as ImageAttachment[];
        images.push(...imageArray);
      } else if (block.type === 'audio' && block.data) {
        audios.push(block.data as AudioAttachment);
      } else if (block.type === 'tickbox' && block.data) {
        tickBoxGroups.push(block.data as TickBoxGroup);
      }
    });

    return { images, audios, tickBoxGroups };
  };

  // Handle text changes in blocks
  const handleTextChange = (blockId: string, text: string) => {
    setEditorBlocks(prev => prev.map(block => 
      block.id === blockId ? { ...block, content: text } : block
    ));
  };

  // Focus management
  const handleTextFocus = (blockId: string) => {
    setActiveTextBlockId(blockId);
  };

  const scrollToActiveInput = () => {
    if (scrollViewRef.current && activeTextBlockId && textInputRefs.current[activeTextBlockId]) {
      const textInput = textInputRefs.current[activeTextBlockId];
      textInput.measure((x, y, width, height, pageX, pageY) => {
        const screenHeight = Dimensions.get('window').height;
        const availableHeight = screenHeight - keyboardHeight - 200;
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, pageY - availableHeight / 2),
          animated: true,
        });
      });
    }
  };

  // Media insertion (Rules 2, 3, 4)
  const insertMediaAfterBlock = (afterBlockId: string, mediaType: 'image' | 'audio' | 'tickbox', mediaData: any) => {
    setEditorBlocks(prev => {
      // Always insert at the end to ensure new media appears below previous ones
      const insertIndex = prev.length;

      const newBlocks = [...prev];

      // Insert media block at the end
      const mediaBlock: EditorBlock = {
        id: generateBlockId(),
        type: mediaType,
        data: mediaData,
        createdAt: new Date().toISOString(),
      };
      newBlocks.splice(insertIndex, 0, mediaBlock);

      // Always add text block after media (Rule 4)
      const textBlock: EditorBlock = {
        id: generateBlockId(),
        type: 'text',
        content: '',
        createdAt: new Date().toISOString(),
      };
      newBlocks.splice(insertIndex + 1, 0, textBlock);

      // Focus the new text block
      setTimeout(() => {
        setActiveTextBlockId(textBlock.id);
        if (textInputRefs.current[textBlock.id]) {
          textInputRefs.current[textBlock.id].focus();
        }
      }, 100);

      return newBlocks;
    });
  };

  // Media handlers
  const handleTakePhoto = async () => {
    if (isProcessingMedia) return;
    setIsProcessingMedia(true);

    try {
      const hasPermission = await requestPermission();
      if (!hasPermission) return;

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const newImage: ImageAttachment = {
          id: Date.now().toString(),
          uri: result.assets[0].uri,
          type: 'photo',
          createdAt: new Date().toISOString(),
        };

        insertMediaAfterBlock(activeTextBlockId, 'image', [newImage]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    } finally {
      setIsProcessingMedia(false);
    }
  };

  const handleAddImage = async () => {
    if (isProcessingMedia) return;
    setIsProcessingMedia(true);

    try {
      const hasPermission = await requestPermission();
      if (!hasPermission) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: 10,
      });

      if (!result.canceled && result.assets) {
        const newImages: ImageAttachment[] = result.assets.map((asset, index) => ({
          id: (Date.now() + index).toString(),
          uri: asset.uri,
          type: 'image',
          createdAt: new Date().toISOString(),
        }));

        insertMediaAfterBlock(activeTextBlockId, 'image', newImages);
      }
    } catch (error) {
      console.error('Error adding image:', error);
      Alert.alert('Error', 'Failed to add image. Please try again.');
    } finally {
      setIsProcessingMedia(false);
    }
  };

  const handleRecording = () => {
    if (isProcessingMedia) return;
    setIsProcessingMedia(true);
    setShowAudioModal(true);
  };

  const handleAudioSave = (audioUri: string, duration: number = 0) => {
    const newAudio: AudioAttachment = {
      id: Date.now().toString(),
      uri: audioUri,
      duration: duration,
      createdAt: new Date().toISOString(),
    };

    insertMediaAfterBlock(activeTextBlockId, 'audio', newAudio);
    setShowAudioModal(false);
    setIsProcessingMedia(false);
  };

  const handleTickBoxes = () => {
    if (isProcessingMedia) return;
    setIsProcessingMedia(true);

    const newTickBoxGroup: TickBoxGroup = {
      id: Date.now().toString(),
      items: [],
      createdAt: new Date().toISOString(),
    };

    insertMediaAfterBlock(activeTextBlockId, 'tickbox', newTickBoxGroup);
    setIsProcessingMedia(false);
  };

  // Delete handlers
  const handleDeleteImage = (imageId: string) => {
    Alert.alert('Delete Image', 'Are you sure you want to delete this image?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setEditorBlocks(prev => prev.filter(block => {
            if (block.type === 'image' && block.data) {
              const images = block.data as ImageAttachment[];
              return !images.some(img => img.id === imageId);
            }
            return true;
          }));
          setShowFullImage(false);
        },
      },
    ]);
  };

  const handleAudioDelete = (audioId: string) => {
    setEditorBlocks(prev => prev.filter(block => {
      if (block.type === 'audio' && block.data) {
        const audio = block.data as AudioAttachment;
        return audio.id !== audioId;
      }
      return true;
    }));
  };

  const handleTickBoxGroupUpdate = (groupId: string, updatedItems: TickBoxItem[]) => {
    setEditorBlocks(prev => prev.map(block => {
      if (block.type === 'tickbox' && block.data) {
        const group = block.data as TickBoxGroup;
        if (group.id === groupId) {
          return { ...block, data: { ...group, items: updatedItems } };
        }
      }
      return block;
    }));
  };

  const handleTickBoxGroupDelete = (groupId: string) => {
    setEditorBlocks(prev => prev.filter(block => {
      if (block.type === 'tickbox' && block.data) {
        const group = block.data as TickBoxGroup;
        return group.id !== groupId;
      }
      return true;
    }));
  };

  // Permission helper
  const requestPermission = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted' || cameraStatus.status !== 'granted') {
        Alert.alert(
          'Permission required',
          'Please grant camera and photo library permissions to add images.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Try Again', onPress: () => requestPermission() }
          ]
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      if (Platform.OS === 'web') {
        return true;
      }
      Alert.alert('Error', 'Failed to request permissions. Please try again.');
      return false;
    }
  };

  // Image viewing
  const handleImagePress = (imageUri: string) => {
    const { images } = getMediaFromBlocks();
    const imageIndex = images.findIndex(img => img.uri === imageUri);
    setCurrentImageIndex(imageIndex);
    setFullImageUri(imageUri);
    setShowFullImage(true);
  };

  const handlePreviousImage = () => {
    const { images } = getMediaFromBlocks();
    if (currentImageIndex > 0) {
      const prevIndex = currentImageIndex - 1;
      setCurrentImageIndex(prevIndex);
      setFullImageUri(images[prevIndex].uri);
    }
  };

  const handleNextImage = () => {
    const { images } = getMediaFromBlocks();
    if (currentImageIndex < images.length - 1) {
      const nextIndex = currentImageIndex + 1;
      setCurrentImageIndex(nextIndex);
      setFullImageUri(images[nextIndex].uri);
    }
  };

  // Save and navigation
  const handleSave = () => {
    const content = getContentFromBlocks();
    const { images, audios, tickBoxGroups } = getMediaFromBlocks();

    onSave(selectedTheme, selectedGradient || undefined, isNotePinned, images, selectedCategoryId || undefined, audios, tickBoxGroups, selectedFontStyle);
    onContentChange(content);
    onImagesChange && onImagesChange(images);
    onAudiosChange && onAudiosChange(audios);
    onTickBoxGroupsChange && onTickBoxGroupsChange(tickBoxGroups);

    setInitialTitle(noteTitle);
    setInitialContent(content);
    setHasUnsavedChanges(false);
  };

  const handleBack = () => {
    if (hasUnsavedChanges) {
      Alert.alert('Unsaved Changes', 'You have unsaved changes. Would you like to save before leaving?', [
        { text: "Don't Save", style: 'destructive', onPress: onBack },
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save', onPress: () => { handleSave(); onBack(); } },
      ]);
    } else {
      onBack();
    }
  };

  // Theme handlers
  const handleThemeSelect = (color: string) => {
    setSelectedTheme(color);
    setSelectedGradient(null);
  };

  const handleGradientSelect = (gradient: string[]) => {
    setSelectedGradient(gradient);
    setSelectedTheme(gradient[0]);
  };

  const handleFontStyleSelect = (fontStyle: string | undefined) => {
    setSelectedFontStyle(fontStyle);
  };

  // Modal handler
  const handleModalOpen = (modalAction: () => void) => {
    if (isKeyboardVisible) {
      setPendingModalAction(() => modalAction);
      Keyboard.dismiss();
    } else {
      modalAction();
    }
  };

  // Render methods
  const renderBackground = () => {
    if (selectedGradient) {
      return (
        <LinearGradient
          colors={selectedGradient as any}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      );
    }
    return null;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Pan responder for image swiping
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dy) < 80;
    },
    onPanResponderRelease: (evt, gestureState) => {
      const { dx } = gestureState;
      const swipeThreshold = 50;
      const { images } = getMediaFromBlocks();

      if (Math.abs(dx) > swipeThreshold && images.length > 1) {
        if (dx > 0) {
          handlePreviousImage();
        } else {
          handleNextImage();
        }
      }
    },
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => false,
  });

  // Render editor blocks
  const renderEditorBlocks = () => {
    return editorBlocks.map((block, index) => {
      switch (block.type) {
        case 'text':
          return (
            <TextInput
              key={block.id}
              ref={ref => {
                if (ref) textInputRefs.current[block.id] = ref;
              }}
              style={[styles.bodyInput, selectedFontStyle ? { fontFamily: selectedFontStyle } : {}]}
              placeholder={index === 0 ? "Start typing your note..." : "Continue typing..."}
              editable={!readOnly}
              placeholderTextColor="#888888"
              value={block.content || ''}
              onChangeText={text => handleTextChange(block.id, text)}
              onFocus={() => handleTextFocus(block.id)}
              multiline={true}
              textAlignVertical="top"
              blurOnSubmit={false}
            />
          );

        case 'image':
          const images = block.data as ImageAttachment[];
          return (
            <View key={block.id} style={styles.inlineImageContainer}>
              <View style={styles.inlineImageGallery}>
                {images.map((image, imgIndex) => (
                  <TouchableOpacity
                    key={`${image.id}-${imgIndex}`}
                    style={[
                      styles.inlineImageCard,
                      { marginLeft: imgIndex % 2 === 0 ? 0 : 8 }
                    ]}
                    onPress={() => handleImagePress(image.uri)}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: image.uri }}
                      style={styles.inlineImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );

        case 'audio':
          const audio = block.data as AudioAttachment;
          return (
            <View key={block.id} style={styles.inlineAudioContainer}>
              <AudioPlayerComponent
                audioUri={audio.uri}
                duration={audio.duration}
                onDelete={() => handleAudioDelete(audio.id)}
                isDarkMode={true}
              />
            </View>
          );

        case 'tickbox':
          const tickBoxGroup = block.data as TickBoxGroup;
          return (
            <View key={block.id} style={styles.inlineTickBoxContainer}>
              <TickBoxComponent
                items={tickBoxGroup.items}
                onItemsChange={(items) => handleTickBoxGroupUpdate(tickBoxGroup.id, items)}
                isDarkMode={true}
              />
              <TouchableOpacity
                style={styles.deleteTickBoxGroupButton}
                onPress={() => handleTickBoxGroupDelete(tickBoxGroup.id)}
              >
                <Ionicons name="trash-outline" size={16} color="#FF4444" />
                <Text style={styles.deleteTickBoxGroupText}>Delete checklist</Text>
              </TouchableOpacity>
            </View>
          );

        default:
          return null;
      }
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: selectedGradient ? 'transparent' : selectedTheme }]}>
      {renderBackground()}

      <View style={styles.safeAreaContainer}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {!readOnly && (
            <View style={styles.headerIcons}>
              <TouchableOpacity
                style={[styles.headerIcon, hasUnsavedChanges && styles.saveButtonActive]}
                onPress={handleSave}
              >
                <Ionicons
                  name="checkmark"
                  size={24}
                  color={hasUnsavedChanges ? "#00FF7F" : "#FFFFFF"}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.headerIcon}
                onPress={() => setIsNotePinned(!isNotePinned)}
              >
                <Ionicons
                  name={isNotePinned ? "star" : "star-outline"}
                  size={24}
                  color={isNotePinned ? "#FFD700" : "#FFFFFF"}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Main Content */}
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.content}
            contentContainerStyle={[
              styles.scrollViewContent,
              { paddingBottom: Math.max(120, keyboardHeight + 50) }
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Meta info row */}
            <View style={styles.metaInfoRow}>
              <View style={styles.dateTimeInfo}>
                {createdAt && (
                  <Text style={styles.dateTimeText}>
                    Created: {formatDateTime(createdAt)}
                  </Text>
                )}
                {updatedAt && createdAt !== updatedAt && (
                  <Text style={styles.dateTimeText}>
                    Modified: {formatDateTime(updatedAt)}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={styles.categoryDropdownButton}
                onPress={readOnly ? undefined : () => setShowCategoryDropdown(true)}
                disabled={readOnly}
              >
                <Text style={styles.categoryButtonText}>
                  {categories.find(cat => cat.id === selectedCategoryId)?.name || 'No Category'}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Title Input */}
            <TextInput
              style={[styles.titleInput, selectedFontStyle ? { fontFamily: selectedFontStyle } : {}]}
              placeholder="Title"
              editable={!readOnly}
              placeholderTextColor="#888888"
              value={noteTitle}
              onChangeText={onTitleChange}
              multiline={false}
            />

            {/* Editor Blocks */}
            {renderEditorBlocks()}
          </ScrollView>
        </KeyboardAvoidingView>


        {/* Bottom Toolbar - Hidden for read-only/deleted notes */}
        {!readOnly && (
          <View style={styles.bottomBar}>
            <View style={styles.bottomLeft}>
              <TouchableOpacity
                style={styles.bottomButton}
                onPress={() => handleModalOpen(() => setShowMediaModal(true))}
              >
                <Ionicons name="add" size={20} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.bottomButton}
                onPress={() => handleModalOpen(() => setShowColorPicker(true))}
              >
                <Ionicons name="brush" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.bottomButton}>
              <Ionicons name="ellipsis-horizontal" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Media Attachment Modal */}
      <MediaAttachmentModal
        visible={showMediaModal}
        onClose={() => {
          setShowMediaModal(false);
          setIsProcessingMedia(false); // Reset processing state when modal is closed
        }}
        onTakePhoto={React.useCallback(handleTakePhoto, [])}
        onAddImage={React.useCallback(handleAddImage, [])}
        onDrawing={React.useCallback(handleRecording, [])}
        onRecording={React.useCallback(handleRecording, [])}
        onTickBoxes={React.useCallback(handleTickBoxes, [])}
      />

      {/* Full Image View Modal */}
      <Modal
        visible={showFullImage}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFullImage(false)}
      >
        <View style={styles.fullImageOverlay}>
          <TouchableOpacity
            style={styles.fullImageCloseButton}
            onPress={() => setShowFullImage(false)}
          >
            <Ionicons name="close" size={30} color="#FFFFFF" />
          </TouchableOpacity>

          {fullImageUri && (
            <Animated.View style={styles.fullImageContainer} {...panResponder.panHandlers}>
              <Image
                source={{ uri: fullImageUri }}
                style={styles.fullImage}
                resizeMode="contain"
              />

              {noteImages.length > 1 && (
                <View style={styles.imageIndicators}>
                  <View style={styles.swipeHint}>
                    <Text style={styles.swipeHintText}>Swipe to navigate</Text>
                  </View>
                  <Text style={styles.imageCounter}>
                    {currentImageIndex + 1} / {noteImages.length}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.deleteImageButton}
                onPress={() => {
                  const imageToDelete = noteImages.find(img => img.uri === fullImageUri);
                  if (imageToDelete) {
                    handleDeleteImage(imageToDelete.id);
                  }
                }}
              >
                <Ionicons name="trash" size={24} color="#FF4444" />
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </Modal>

      {/* Color Theme Picker Modal */}
      <ColorThemePicker
        visible={showColorPicker}
        onClose={() => setShowColorPicker(false)}
        onThemeSelect={handleThemeSelect}
        onGradientSelect={handleGradientSelect}
        onFontStyleSelect={handleFontStyleSelect}
        selectedTheme={selectedTheme}
        selectedFontStyle={selectedFontStyle}
      />

      {/* Audio Recording Modal */}
      <AudioRecordingModal
        visible={showAudioModal}
        onClose={() => {
          setShowAudioModal(false);
          setIsProcessingMedia(false); // Reset processing state when modal is closed
        }}
        onSave={handleAudioSave}
      />

      {/* Category Dropdown Modal */}
      <Modal
        visible={showCategoryDropdown}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryDropdown(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowCategoryDropdown(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.categoryModal}>
                <Text style={styles.categoryModalTitle}>Select Category</Text>
                <ScrollView style={styles.categoryList}>
                  <TouchableOpacity
                    style={[
                      styles.categoryOption,
                      selectedCategoryId === null && styles.selectedCategoryOption
                    ]}
                    onPress={() => {
                      setSelectedCategoryId(null);
                      setShowCategoryDropdown(false);
                    }}
                  >
                    <Text style={[
                      styles.categoryOptionText,
                      selectedCategoryId === null && styles.selectedCategoryText
                    ]}>
                      No Category
                    </Text>
                  </TouchableOpacity>

                  {categories.map((category) => (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.categoryOption,
                        selectedCategoryId === category.id && styles.selectedCategoryOption
                      ]}
                      onPress={() => {
                        setSelectedCategoryId(category.id);
                        setShowCategoryDropdown(false);
                      }}
                    >
                      <Text style={[
                        styles.categoryOptionText,
                        selectedCategoryId === category.id && styles.selectedCategoryText
                      ]}>
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  safeAreaContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    padding: 8,
    marginLeft: 8,
  },
  saveButtonActive: {
    backgroundColor: 'rgba(0, 255, 127, 0.2)',
    borderRadius: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  titleInput: {
    fontSize: 24,
    color: '#FFFFFF',
    fontFamily: 'Inter',
    fontWeight: '400',
    marginBottom: 20,
  },
  bodyInput: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'Inter',
    fontWeight: '400',
    lineHeight: 26,
    minHeight: 400,
    // Fix text shifting on enter by ensuring consistent line height
    includeFontPadding: false,
    textAlignVertical: 'top',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 20, // Ensure proper spacing at bottom
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  bottomLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomButton: {
    padding: 12,
    marginRight: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  imageGallery: {
    marginBottom: 20,
    paddingVertical: 20,
    height: 180,
    alignItems: 'center',
  },
  imageScrollView: {
    paddingLeft: 20,
    paddingRight: 40,
  },
  audioSection: {
    marginBottom: 16,
  },
  tickBoxSection: {
    marginBottom: 16,
  },
  tickBoxGroupContainer: {
    marginBottom: 12,
  },
  deleteTickBoxGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: -8,
    marginRight: 8,
  },
  deleteTickBoxGroupText: {
    color: '#FF4444',
    fontSize: 12,
    marginLeft: 4,
  },
  imageCard: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#F8F8F8',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    shadowColor: '#000000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
    overflow: 'hidden',
    marginRight: -15,
  },
  attachedImage: {
    width: '100%',
    height: '100%',
  },
  fullImageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImageCloseButton: {
    position: 'absolute',
    top: 15,
    right: 20,
    zIndex: 1,
    padding: 10,
  },
  fullImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  fullImage: {
    width: Dimensions.get('window').width - 40,
    height: Dimensions.get('window').height - 280,
  },
  deleteImageButton: {
    position: 'absolute',
    bottom: 40,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#FF4444',
  },
  deleteButtonText: {
    color: '#FF4444',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  imageIndicators: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    alignItems: 'center',
  },
  imageCounter: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginBottom: 8,
  },
  swipeHint: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  swipeHintText: {
    color: '#CCCCCC',
    fontSize: 12,
    textAlign: 'center',
  },
  metaInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  dateTimeInfo: {
    flex: 1,
  },
  dateTimeText: {
    color: '#888888',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter',
  },
  categoryDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  categoryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginRight: 4,
    fontFamily: 'Inter',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryModal: {
    backgroundColor: '#2A2A2A',
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxHeight: '60%',
  },
  categoryModalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  categoryList: {
    maxHeight: 300,
  },
  categoryOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  selectedCategoryOption: {
    backgroundColor: '#00FF7F',
  },
  categoryOptionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter',
  },
  selectedCategoryText: {
    color: '#000000',
    fontWeight: '600',
  },
  // Inline content styles
  inlineContentContainer: {
    marginBottom: 16,
  },
  inlineImageContainer: {
    marginVertical: 12,
  },
  inlineImageGallery: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  inlineImageCard: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#F8F8F8',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    marginBottom: 8,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inlineImage: {
    width: '100%',
    height: '100%',
  },
  inlineAudioContainer: {
    marginVertical: 8,
  },
  inlineTickBoxContainer: {
    marginVertical: 12,
  },
  // Custom editor styles
  customEditorContainer: {
    flex: 1,
  },
});