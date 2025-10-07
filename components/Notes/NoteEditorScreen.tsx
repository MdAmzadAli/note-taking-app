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
  Share,
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
import ImageViewerModal from './ImageViewerModal';
import { getCategories } from '@/utils/storage';
import { EditorBlock } from '@/types';
import { SafeAreaView } from 'react-native-safe-area-context';


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
// EditorBlock interface now imported from @/types

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
  savedEditorBlocks?: EditorBlock[]; // NEW: Pass saved editor blocks for proper reconstruction
  createdAt?: string;
  updatedAt?: string;
  categoryId?: string;
  readOnly?: boolean;
  onSave: (theme?: string, gradient?: string[], isPinned?: boolean, images?: ImageAttachment[], categoryId?: string, audios?: AudioAttachment[], tickBoxGroups?: TickBoxGroup[], fontStyle?: string | undefined, editorBlocks?: EditorBlock[]) => void;
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
  savedEditorBlocks = [], // NEW: Accept saved editor blocks
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
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [currentImageSection, setCurrentImageSection] = useState<ImageAttachment[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string>('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [pendingModalAction, setPendingModalAction] = useState<(() => void) | null>(null);
  const [isProcessingMedia, setIsProcessingMedia] = useState(false);
  const [showDeleteTickBoxModal, setShowDeleteTickBoxModal] = useState(false);
  const [tickBoxGroupToDelete, setTickBoxGroupToDelete] = useState<string | null>(null);

  // Dynamic height tracking for text inputs
  const [textInputHeights, setTextInputHeights] = useState<{[key: string]: number}>({});

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

    // CRITICAL FIX: Use saved editorBlocks structure if available (preserves order!)
    // Works for both editing and read-only (deleted notes) modes
    if (savedEditorBlocks && savedEditorBlocks.length > 0) {
      console.log('[EDITOR] Restoring from saved editorBlocks structure:', savedEditorBlocks.length, 'blocks');
      // Restore the exact block structure that was saved
      savedEditorBlocks.forEach(savedBlock => {
        blocks.push({
          ...savedBlock,
          id: savedBlock.id || generateBlockId(), // Ensure ID exists
        });
      });

      // Set the first text block as active
      const firstTextBlock = blocks.find(block => block.type === 'text');
      if (firstTextBlock) {
        setActiveTextBlockId(firstTextBlock.id);
      }
    } else {
      // Fallback to old method for backward compatibility or new notes
      console.log('[EDITOR] Using fallback initialization (backward compatibility)');

      // Always start with a text block (Rule 1)
      const initialTextBlock: EditorBlock = {
        id: generateBlockId(),
        type: 'text',
        content: noteContent || '',
        createdAt: new Date().toISOString(),
      };
      blocks.push(initialTextBlock);
      setActiveTextBlockId(initialTextBlock.id);

      // Add existing media blocks if editing (OLD WAY - loses order)
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
    }

    setEditorBlocks(blocks);
    console.log('[EDITOR] Initialized with', blocks.length, 'blocks');
  };

  const generateBlockId = () => `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const loadCategories = async () => {
    try {
      const categoriesData = await getCategories();
      setCategories(categoriesData);
      
      // Ensure the selected category is properly set for deleted notes
      if (categoryId && categoriesData.find(cat => cat.id === categoryId)) {
        setSelectedCategoryId(categoryId);
      } else if (categoryId && !categoriesData.find(cat => cat.id === categoryId)) {
        console.warn('Category not found for deleted note:', categoryId);
        setSelectedCategoryId(null);
      }
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
    // Initialize height for this input if not already set
    if (!textInputHeights[blockId]) {
      setTextInputHeights(prev => ({ ...prev, [blockId]: 50 }));
    }
  };

  // Dynamic height management
  const handleTextInputLayout = (blockId: string, event: any) => {
    const { height } = event.nativeEvent.layout;
    const currentHeight = textInputHeights[blockId] || 50;

    // If content is approaching the bottom (within 20px), increase height
    if (height >= currentHeight - 20) {
      setTextInputHeights(prev => ({
        ...prev,
        [blockId]: Math.max(currentHeight + 50, 50)
      }));
    }
  };

  const handleTextContentSizeChange = (blockId: string, event: any) => {
    const { height } = event.nativeEvent.contentSize;
    const currentMinHeight = textInputHeights[blockId] || 50;

    // Calculate the required height with buffer for future typing
    const requiredHeight = Math.max(height + 40, 50); // 40px buffer for typing

    // Only update if we need more space than current minHeight
    if (requiredHeight > currentMinHeight) {
      console.log(`Adjusting height for block ${blockId} from ${currentMinHeight} to ${requiredHeight}`);
      setTextInputHeights(prev => ({
        ...prev,
        [blockId]: requiredHeight
      }));
    }
  };

  const getTextInputStyle = (blockId: string, isFirstInput: boolean = false) => {
    const baseHeight = textInputHeights[blockId] || 50;
    return [
      styles.bodyInput,
      selectedFontStyle ? { fontFamily: selectedFontStyle } : {},
      { 
        minHeight: isFirstInput ? Math.max(baseHeight, 200) : baseHeight,
        
      }
    ];
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
    setEditorBlocks(prev => prev.map(block => {
      if (block.type === 'image' && block.data) {
        const images = block.data as ImageAttachment[];
        const updatedImages = images.filter(img => img.id !== imageId);

        // If no images left in this block, remove the entire block
        if (updatedImages.length === 0) {
          return null;
        }

        return { ...block, data: updatedImages };
      }
      return block;
    }).filter(Boolean) as EditorBlock[]);

    // Update current section images
    setCurrentImageSection(prev => prev.filter(img => img.id !== imageId));
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
    setTickBoxGroupToDelete(groupId);
    setShowDeleteTickBoxModal(true);
  };

  const confirmDeleteTickBoxGroup = () => {
    if (tickBoxGroupToDelete) {
      setEditorBlocks(prev => prev.filter(block => {
        if (block.type === 'tickbox' && block.data) {
          const group = block.data as TickBoxGroup;
          return group.id !== tickBoxGroupToDelete;
        }
        return true;
      }));
    }
    setShowDeleteTickBoxModal(false);
    setTickBoxGroupToDelete(null);
  };

  const cancelDeleteTickBoxGroup = () => {
    setShowDeleteTickBoxModal(false);
    setTickBoxGroupToDelete(null);
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
  const handleImagePress = (imageId: string, blockId: string) => {
    // Find the specific block containing this image
    const imageBlock = editorBlocks.find(block => 
      block.id === blockId && block.type === 'image'
    );

    if (imageBlock && imageBlock.data) {
      const images = imageBlock.data as ImageAttachment[];
      setCurrentImageSection(images);
      setSelectedImageId(imageId);
      setShowImageViewer(true);
    }
  };



  // Save and navigation
  const handleSave = () => {
    const content = getContentFromBlocks();
    const { images, audios, tickBoxGroups } = getMediaFromBlocks();

    // Debug logging to verify editorBlocks state
    console.log('[EDITOR] Saving note with editorBlocks:', editorBlocks.length, 'blocks');
    console.log('[EDITOR] EditorBlocks structure:', editorBlocks.map(block => ({ id: block.id, type: block.type, hasContent: !!block.content, hasData: !!block.data })));

    // CRITICAL FIX: Pass the complete editorBlocks structure to preserve order
    onSave(selectedTheme, selectedGradient || undefined, isNotePinned, images, selectedCategoryId || undefined, audios, tickBoxGroups, selectedFontStyle, editorBlocks);
    onContentChange(content);
    onImagesChange && onImagesChange(images);
    onAudiosChange && onAudiosChange(audios);
    onTickBoxGroupsChange && onTickBoxGroupsChange(tickBoxGroups);

    setInitialTitle(noteTitle);
    setInitialContent(content);
    setHasUnsavedChanges(false);
  };

  const handleBack = () => {
    if (readOnly) { // Direct navigation for deleted notes
      onBack();
      return;
    }

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

  // Share and export handlers
  const getNotePlainText = () => {
    let content = '';

    // Add title if exists
    if (noteTitle && noteTitle.trim()) {
      content += noteTitle.trim() + '\n\n';
    }

    // Process each block in order
    editorBlocks.forEach(block => {
      if (block.type === 'text' && block.content && block.content.trim()) {
        content += block.content.trim() + '\n\n';
      } else if (block.type === 'image' && block.data) {
        const images = block.data as ImageAttachment[];
        if (images.length === 1) {
          content += '[Image attached]\n\n';
        } else {
          content += `[${images.length} images attached]\n\n`;
        }
      } else if (block.type === 'audio' && block.data) {
        const audio = block.data as AudioAttachment;
        const duration = audio.duration > 0 ? ` (${Math.floor(audio.duration / 60)}:${String(audio.duration % 60).padStart(2, '0')})` : '';
        content += `[Audio recording${duration}]\n\n`;
      } else if (block.type === 'tickbox' && block.data) {
        const group = block.data as TickBoxGroup;
        group.items.forEach(item => {
          const checkbox = item.completed ? '☑' : '☐';
          content += `${checkbox} ${item.text}\n`;
        });
        content += '\n';
      }
    });

    return content.trim();
  };

  const handleShare = async () => {
    try {
      const noteText = getNotePlainText();
      if (!noteText) {
        Alert.alert('Nothing to Share', 'This note appears to be empty.');
        return;
      }

      await Share.share({
        message: noteText,
        title: noteTitle || 'Note'
      });
    } catch (error) {
      console.error('Error sharing note:', error);
      Alert.alert('Error', 'Failed to share note. Please try again.');
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
              style={getTextInputStyle(block.id, index === 0)}
              placeholder={index === 0 ? "Start typing your note..." : "Continue typing..."}
              editable={!readOnly}
              placeholderTextColor="#888888"
              value={block.content || ''}
              onChangeText={text => handleTextChange(block.id, text)}
              onFocus={() => handleTextFocus(block.id)}
             // onLayout={(event) => handleTextInputLayout(block.id, event)}
              onContentSizeChange={(event) => handleTextContentSizeChange(block.id, event)}
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
                    onPress={() => handleImagePress(image.id, block.id)}
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
                readOnly={readOnly}
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
                readOnly={readOnly}
              />
              {!readOnly && (
                <TouchableOpacity
                  style={styles.deleteTickBoxGroupButton}
                  onPress={() => handleTickBoxGroupDelete(tickBoxGroup.id)}
                >
                  <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.deleteTickBoxGroupText}>Delete checklist</Text>
                </TouchableOpacity>
              )}
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

      <SafeAreaView style={styles.safeAreaContainer} edges={['top']}>
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

              {!readOnly && (
                <TouchableOpacity
                  style={styles.categoryDropdownButton}
                  onPress={() => setShowCategoryDropdown(true)}
                >
                  <Text style={styles.categoryButtonText}>
                    {categories.find(cat => cat.id === selectedCategoryId)?.name || 'No Category'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              )}
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

         </SafeAreaView>
        {/* Bottom Toolbar - Hidden for read-only/deleted notes */}
        {!readOnly && (

      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>

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

            <TouchableOpacity 
              style={styles.bottomButton}
              onPress={handleShare}
            >
              <Ionicons name="share-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            </SafeAreaView> 

        )}
     

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

      {/* Image Viewer Modal */}
      <ImageViewerModal
        visible={showImageViewer}
        images={currentImageSection}
        initialImageId={selectedImageId}
        onClose={() => setShowImageViewer(false)}
        onDeleteImage={handleDeleteImage}
        readOnly={readOnly}
      />

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

      {/* TickBox Group Delete Confirmation Modal */}
      <Modal
        visible={showDeleteTickBoxModal}
        transparent
        animationType="fade"
        onRequestClose={cancelDeleteTickBoxGroup}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteConfirmationModal}>
            <Text style={styles.deleteConfirmationTitle}>Delete Checklist</Text>
            <Text style={styles.deleteConfirmationMessage}>
              Are you sure you want to delete this checklist? This action cannot be undone.
            </Text>

            <View style={styles.deleteConfirmationButtons}>
              <TouchableOpacity
                style={[styles.deleteConfirmationButton, styles.cancelDeleteButton]}
                onPress={cancelDeleteTickBoxGroup}
              >
                <Text style={styles.cancelDeleteButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.deleteConfirmationButton, styles.confirmDeleteButton]}
                onPress={confirmDeleteTickBoxGroup}
              >
                <Text style={styles.confirmDeleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 0, 
    // paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  safeAreaContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    // paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
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
    marginBottom: 4,
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
    // paddingBottom: 20, // Ensure proper spacing at bottom
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
    color: '#FFFFFF',
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
    color: '#d3d3d3',
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
  deleteConfirmationModal: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  deleteConfirmationTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  deleteConfirmationMessage: {
    color: '#CCCCCC',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'Inter',
  },
  deleteConfirmationButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteConfirmationButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelDeleteButton: {
    backgroundColor: '#4B5563',
    borderWidth: 1,
    borderColor: '#6B7280',
  },
  confirmDeleteButton: {
    backgroundColor: '#DC2626',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  cancelDeleteButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  confirmDeleteButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  // Inline content styles
  inlineContentContainer: {
    marginBottom: 8,
  },
  inlineImageContainer: {
    marginVertical: 4,
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
    marginVertical: 4,
  },
  inlineTickBoxContainer: {
    marginVertical: 4,
  },
  // Custom editor styles
  customEditorContainer: {
    flex: 1,
  },
});