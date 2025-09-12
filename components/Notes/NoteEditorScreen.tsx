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

// Media placeholder structure for inline embedding
interface MediaPlaceholder {
  id: string;
  type: 'image' | 'audio' | 'tickbox';
  data: ImageAttachment[] | AudioAttachment | TickBoxGroup;
}

interface Category {
  id: string;
  name: string;
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
  // Removed segments - using new inline editor approach
  createdAt?: string;
  updatedAt?: string;
  categoryId?: string;
  readOnly?: boolean; // Add read-only mode for deleted notes
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
  const [isNotePinned, setIsNotePinned] = useState(isPinned);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState(noteTheme);
  const [selectedGradient, setSelectedGradient] = useState<string[] | null>(noteGradient);
  const [selectedFontStyle, setSelectedFontStyle] = useState<string | undefined>(undefined);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [initialTitle, setInitialTitle] = useState(noteTitle);
  const [initialContent, setInitialContent] = useState(noteContent);
  const [noteImages, setNoteImages] = useState<ImageAttachment[]>(images);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [fullImageUri, setFullImageUri] = useState<string | null>(null);
  const [showFullImage, setShowFullImage] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(categoryId || null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [noteAudios, setNoteAudios] = useState<AudioAttachment[]>(audios);
  const [noteTickBoxGroups, setNoteTickBoxGroups] = useState<TickBoxGroup[]>(tickBoxGroups);

  // Custom editor state for inline media embedding
  const [cursorPosition, setCursorPosition] = useState({ start: 0, end: 0 });
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [pendingModalAction, setPendingModalAction] = useState<(() => void) | null>(null);
  const [mediaPlaceholders, setMediaPlaceholders] = useState<{[key: string]: MediaPlaceholder}>({});

  const textInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const [isProcessingMedia, setIsProcessingMedia] = useState(false);

  useEffect(() => {
    setInitialTitle(noteTitle);
    setInitialContent(noteContent);
    setSelectedFontStyle(fontStyle);
    loadCategories();
    initializeEditor();

    // Add keyboard event listeners
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setIsKeyboardVisible(true);
        // Auto-scroll to active input after keyboard appears
        setTimeout(() => {
          scrollToInput();
        }, 100);
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
        // Execute pending modal action after keyboard has fully dismissed
        if (pendingModalAction) {
          setTimeout(() => {
            pendingModalAction();
            setPendingModalAction(null);
          }, 200); // Increased delay for smoother transition
        }
      }
    );

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, [pendingModalAction]); // Add pendingModalAction as dependency

  // Initialize media placeholders from existing media
  useEffect(() => {
    const placeholders: {[key: string]: MediaPlaceholder} = {};
    
    // Add image placeholders
    images.forEach(image => {
      placeholders[`image-${image.id}`] = {
        id: `image-${image.id}`,
        type: 'image',
        data: [image]
      };
    });
    
    // Add audio placeholders
    audios.forEach(audio => {
      placeholders[`audio-${audio.id}`] = {
        id: `audio-${audio.id}`,
        type: 'audio',
        data: audio
      };
    });
    
    // Add tickbox placeholders
    tickBoxGroups.forEach(group => {
      placeholders[`tickbox-${group.id}`] = {
        id: `tickbox-${group.id}`,
        type: 'tickbox',
        data: group
      };
    });
    
    setMediaPlaceholders(placeholders);
  }, [images, audios, tickBoxGroups]);

  const initializeEditor = () => {
    // New custom editor initialization - no segments needed
    console.log('Initializing custom editor with inline media support');
  };

  const scrollToInput = () => {
    if (scrollViewRef.current && textInputRef.current) {
      const screenHeight = Dimensions.get('window').height;
      const availableHeight = screenHeight - keyboardHeight - 200;

      textInputRef.current.measure((x, y, width, height, pageX, pageY) => {
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, pageY - availableHeight / 2),
          animated: true,
        });
      });
    }
  };

  const handleTextSelection = (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    const { start, end } = event.nativeEvent.selection;
    setCursorPosition({ start, end });
  };

  const insertMediaAtCursor = (mediaType: 'image' | 'audio' | 'tickbox', mediaData: any) => {
    console.log('insertMediaAtCursor called with:', mediaType);
    
    const currentContent = noteContent;
    
    // Use entity ID for consistent reference with deletion handlers
    let entityId: string;
    if (mediaType === 'image' && Array.isArray(mediaData)) {
      entityId = mediaData[0]?.id || Date.now().toString();
    } else if (mediaType === 'audio' && mediaData.id) {
      entityId = mediaData.id;
    } else if (mediaType === 'tickbox' && mediaData.id) {
      entityId = mediaData.id;
    } else {
      entityId = Date.now().toString();
    }
    
    // Create placeholder using entity ID for consistency with deletion
    const mediaId = `${mediaType}-${entityId}`;
    const placeholder = `[MEDIA:${mediaType}:${mediaId}]`;
    
    // Add media data to placeholders
    const newPlaceholder: MediaPlaceholder = {
      id: mediaId,
      type: mediaType,
      data: mediaData
    };
    
    setMediaPlaceholders(prev => ({
      ...prev,
      [mediaId]: newPlaceholder
    }));
    
    // Always append media after existing content with proper line breaks
    let newContent;
    if (currentContent.trim() === '') {
      // If no content exists, just add the media
      newContent = placeholder;
    } else {
      // If content exists, add line breaks and append media, then add space for new text
      newContent = currentContent + '\n\n' + placeholder + '\n\n';
    }
    
    // Update note content
    onContentChange(newContent);
    
    // Set cursor position at the end for continued typing
    const newCursorPosition = newContent.length;
    setCursorPosition({ start: newCursorPosition, end: newCursorPosition });
    
    console.log('Media placeholder inserted:', placeholder, 'with entity ID:', entityId);
  };

  // Removed createMediaSegment - using new placeholder-based approach

  // Enhanced content parsing and cursor position helpers
  const parseContent = (content: string) => {
    // Split content by media placeholders while keeping the placeholders
    const parts = content.split(/(\[MEDIA:[^\]]+\])/);
    return parts.filter(part => part.length > 0);
  };

  // Get text segments from parsed content for TextInput values
  const getTextSegments = (content: string): string[] => {
    const parts = parseContent(content);
    return parts.filter(part => !isMediaPlaceholder(part));
  };

  // Calculate absolute cursor position from relative position in text segment
  const calculateAbsoluteCursorPosition = (textSegmentIndex: number, relativeCursor: { start: number; end: number }) => {
    const parts = parseContent(noteContent);
    let absoluteStart = 0;
    let textSegmentCount = 0;
    
    for (const part of parts) {
      if (isMediaPlaceholder(part)) {
        absoluteStart += part.length;
      } else {
        if (textSegmentCount === textSegmentIndex) {
          return {
            start: absoluteStart + relativeCursor.start,
            end: absoluteStart + relativeCursor.end
          };
        }
        absoluteStart += part.length;
        textSegmentCount++;
      }
    }
    
    return { start: absoluteStart, end: absoluteStart };
  };

  const isMediaPlaceholder = (text: string): boolean => {
    return /^\[MEDIA:[^\]]+\]$/.test(text);
  };

  const parseMediaPlaceholder = (placeholder: string): { type: string; id: string } | null => {
    const match = placeholder.match(/^\[MEDIA:([^:]+):([^\]]+)\]$/);
    return match ? { type: match[1], id: match[2] } : null;
  };

  const loadCategories = async () => {
    try {
      const categoriesData = await getCategories();
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  useEffect(() => {
    const titleChanged = noteTitle !== initialTitle;
    const contentChanged = noteContent !== initialContent;
    setHasUnsavedChanges(titleChanged || contentChanged);
  }, [noteTitle, noteContent, initialTitle, initialContent]);

  const handleThemeSelect = (color: string) => {
    setSelectedTheme(color);
    setSelectedGradient(null);
    // Don't close modal automatically - let user decide
  };

  const handleGradientSelect = (gradient: string[]) => {
    setSelectedGradient(gradient);
    setSelectedTheme(gradient[0]);
    // Don't close modal automatically - let user decide
  };

  const handleFontStyleSelect = (fontStyle: string | undefined) => {
    setSelectedFontStyle(fontStyle);
    // Don't close modal automatically - let user decide
  };

  const handleBack = () => {
    if (hasUnsavedChanges) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Would you like to save before leaving?',
        [
          {
            text: 'Don\'t Save',
            style: 'destructive',
            onPress: onBack,
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Save',
            onPress: () => {
              onSave(selectedTheme, selectedGradient || undefined, isNotePinned, noteImages, selectedCategoryId || undefined, noteAudios, noteTickBoxGroups, selectedFontStyle);
              onImagesChange && onImagesChange(noteImages);
              onAudiosChange && onAudiosChange(noteAudios);
              onTickBoxGroupsChange && onTickBoxGroupsChange(noteTickBoxGroups);
              onBack();
            },
          },
        ]
      );
    } else {
      onBack();
    }
  };

  const handleSave = () => {
    // Save without segments - using new inline approach
    onSave(selectedTheme, selectedGradient || undefined, isNotePinned, noteImages, selectedCategoryId || undefined, noteAudios, noteTickBoxGroups, selectedFontStyle);
    onImagesChange && onImagesChange(noteImages);
    onAudiosChange && onAudiosChange(noteAudios);
    onTickBoxGroupsChange && onTickBoxGroupsChange(noteTickBoxGroups);
    setInitialTitle(noteTitle);
    setInitialContent(noteContent);
    setHasUnsavedChanges(false);
  };


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
      // On web or in development, permissions might not be fully supported
      // Return true to allow the functionality to proceed
      if (Platform.OS === 'web') {
        return true;
      }
      Alert.alert('Error', 'Failed to request permissions. Please try again.');
      return false;
    }
  };

  const handleTakePhoto = async () => {
    if (isProcessingMedia) return; // Prevent multiple calls
    setIsProcessingMedia(true);
    try {
      console.log('handleTakePhoto called');

      const hasPermission = await requestPermission();
      if (!hasPermission) {
        setIsProcessingMedia(false);
        return;
      }

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
        const updatedImages = [...noteImages, newImage];
        setNoteImages(updatedImages);
        insertMediaAtCursor('image', [newImage]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    } finally {
      setIsProcessingMedia(false);
    }
  };

  const handleAddImage = async () => {
    if (isProcessingMedia) return; // Prevent multiple calls
    setIsProcessingMedia(true);
    try {
      console.log('handleAddImage called');

      const hasPermission = await requestPermission();
      if (!hasPermission) {
        setIsProcessingMedia(false);
        return;
      }

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
        const updatedImages = [...noteImages, ...newImages];
        setNoteImages(updatedImages);
        insertMediaAtCursor('image', newImages);
      }
    } catch (error) {
      console.error('Error adding image:', error);
      Alert.alert('Error', 'Failed to add image. Please try again.');
    } finally {
      setIsProcessingMedia(false);
    }
  };

  const handleDeleteImage = (imageId: string) => {
    Alert.alert(
      'Delete Image',
      'Are you sure you want to delete this image?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Update noteImages state
            const updatedImages = noteImages.filter(img => img.id !== imageId);
            setNoteImages(updatedImages);
            
            // Remove image placeholder from content
            const imageMediaId = `image-${imageId}`;
            const placeholderToRemove = `[MEDIA:image:${imageMediaId}]`;
            const updatedContent = noteContent.replace(placeholderToRemove, '');
            onContentChange(updatedContent);
            
            // Clean up media placeholders
            setMediaPlaceholders(prev => {
              const newPlaceholders = { ...prev };
              delete newPlaceholders[imageMediaId];
              return newPlaceholders;
            });
            
            setShowFullImage(false);
          },
        },
      ]
    );
  };

  const handleImagePress = (imageUri: string) => {
    const imageIndex = noteImages.findIndex(img => img.uri === imageUri);
    setCurrentImageIndex(imageIndex);
    setFullImageUri(imageUri);
    setShowFullImage(true);
  };

  const handlePreviousImage = () => {
    if (currentImageIndex > 0) {
      const prevIndex = currentImageIndex - 1;
      setCurrentImageIndex(prevIndex);
      setFullImageUri(noteImages[prevIndex].uri);
    }
  };

  const handleNextImage = () => {
    if (currentImageIndex < noteImages.length - 1) {
      const nextIndex = currentImageIndex + 1;
      setCurrentImageIndex(nextIndex);
      setFullImageUri(noteImages[nextIndex].uri);
    }
  };

  // Fixed PanResponder for swipe gestures
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dy) < 80;
    },
    onPanResponderGrant: () => {},
    onPanResponderMove: (evt, gestureState) => {},
    onPanResponderRelease: (evt, gestureState) => {
      const { dx } = gestureState;
      const swipeThreshold = 50;

      if (Math.abs(dx) > swipeThreshold && noteImages.length > 1) {
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

  const handleDrawing = () => {
    Alert.alert('Drawing', 'Drawing feature coming soon!');
  };

  const handleRecording = () => {
    if (isProcessingMedia) return; // Prevent multiple calls
    setIsProcessingMedia(true);
    console.log('handleRecording called');
    setShowAudioModal(true);
    // No need to set isProcessingMedia to false here as it's handled by AudioRecordingModal's onClose/onSave
  };

  // Helper function to handle modal opening with keyboard dismissal
  const handleModalOpen = (modalAction: () => void) => {
    if (isKeyboardVisible) {
      // Store the action and dismiss keyboard
      setPendingModalAction(() => modalAction);
      Keyboard.dismiss();
    } else {
      // Directly execute the action if keyboard is not visible
      modalAction();
    }
  };

  const handleAudioSave = async (audioUri: string, duration: number = 0) => {
    // Create new audio attachment
    const newAudio: AudioAttachment = {
      id: Date.now().toString(),
      uri: audioUri,
      duration: duration,
      createdAt: new Date().toISOString(),
    };

    setNoteAudios([...noteAudios, newAudio]);
    insertMediaAtCursor('audio', newAudio);

    setShowAudioModal(false);
    setIsProcessingMedia(false); // Reset processing state after saving audio
  };

  const handleAudioDelete = (audioId: string) => {
    const updatedAudios = noteAudios.filter(audio => audio.id !== audioId);
    setNoteAudios(updatedAudios);
    
    // Remove audio placeholder from content using consistent ID format
    const audioMediaId = `audio-${audioId}`;
    const placeholderToRemove = `[MEDIA:audio:${audioMediaId}]`;
    const updatedContent = noteContent.replace(placeholderToRemove, '');
    onContentChange(updatedContent);
    
    // Clean up media placeholders
    setMediaPlaceholders(prev => {
      const newPlaceholders = { ...prev };
      delete newPlaceholders[audioMediaId];
      return newPlaceholders;
    });
  };

  const handleTickBoxes = () => {
    if (isProcessingMedia) return; // Prevent multiple calls
    setIsProcessingMedia(true);
    console.log('handleTickBoxes called');

    const newTickBoxGroup: TickBoxGroup = {
      id: Date.now().toString(),
      items: [],
      createdAt: new Date().toISOString(),
    };

    setNoteTickBoxGroups([...noteTickBoxGroups, newTickBoxGroup]);
    insertMediaAtCursor('tickbox', newTickBoxGroup);
    setIsProcessingMedia(false); // Reset processing state after adding tickboxes
  };

  const handleTickBoxGroupUpdate = (groupId: string, updatedItems: TickBoxItem[]) => {
    // Update tick box groups
    const updatedGroups = noteTickBoxGroups.map(group =>
      group.id === groupId ? { ...group, items: updatedItems } : group
    );
    setNoteTickBoxGroups(updatedGroups);
    
    // Update media placeholders with new data using consistent ID format
    const tickboxMediaId = `tickbox-${groupId}`;
    setMediaPlaceholders(prev => {
      if (prev[tickboxMediaId]) {
        return {
          ...prev,
          [tickboxMediaId]: {
            ...prev[tickboxMediaId],
            data: { ...prev[tickboxMediaId].data as TickBoxGroup, items: updatedItems }
          }
        };
      }
      return prev;
    });

    console.log('TickBox updated:', groupId, 'Items count:', updatedItems.length);
  };

  const handleTickBoxGroupDelete = (groupId: string) => {
    const updatedGroups = noteTickBoxGroups.filter(group => group.id !== groupId);
    setNoteTickBoxGroups(updatedGroups);
    
    // Remove tickbox placeholder from content using consistent ID format
    const tickboxMediaId = `tickbox-${groupId}`;
    const placeholderToRemove = `[MEDIA:tickbox:${tickboxMediaId}]`;
    const updatedContent = noteContent.replace(placeholderToRemove, '');
    onContentChange(updatedContent);
    
    // Clean up media placeholders
    setMediaPlaceholders(prev => {
      const newPlaceholders = { ...prev };
      delete newPlaceholders[tickboxMediaId];
      return newPlaceholders;
    });
  };

  const renderCustomEditor = () => {
    console.log('Rendering custom editor with fixed inline media support');
    
    const parts = parseContent(noteContent);
    const elements: React.ReactElement[] = [];
    let textSegmentIndex = 0;
    
    parts.forEach((part, index) => {
      if (isMediaPlaceholder(part)) {
        // Render the media component
        const mediaInfo = parseMediaPlaceholder(part);
        if (mediaInfo && mediaPlaceholders[mediaInfo.id]) {
          const placeholder = mediaPlaceholders[mediaInfo.id];
          const mediaElement = renderMediaComponent(placeholder, index);
          if (mediaElement) {
            elements.push(mediaElement);
          }
        }
      } else if (part.trim() !== '') {
        // Only render non-empty text segments
        const textValue = part;
        const isLastTextSegment = textSegmentIndex === getTextSegments(noteContent).filter(seg => seg.trim() !== '').length - 1;
        
        elements.push(
          <TextInput
            key={`text-${textSegmentIndex}`}
            ref={isLastTextSegment ? textInputRef : undefined}
            style={[styles.bodyInput, selectedFontStyle ? { fontFamily: selectedFontStyle } : {}]}
            placeholder={textSegmentIndex === 0 && !readOnly ? "Start typing your note..." : "Continue writing..."}
            editable={!readOnly}
            placeholderTextColor="#888888"
            value={textValue}
            onChangeText={(text) => handleTextSegmentChange(textSegmentIndex, text)}
            onSelectionChange={(event) => {
              const { start, end } = event.nativeEvent.selection;
              const absolutePosition = calculateAbsoluteCursorPosition(textSegmentIndex, { start, end });
              setCursorPosition(absolutePosition);
            }}
            onFocus={() => {
              // Update cursor position when this input is focused
              setTimeout(() => {
                if (isKeyboardVisible) {
                  scrollToInput();
                }
              }, 100);
            }}
            multiline={true}
            textAlignVertical="top"
            autoFocus={textSegmentIndex === 0 && parts.length === 1}
          />
        );
        textSegmentIndex++;
      }
    });
    
    // Always ensure there's a text input at the end for continued typing
    const hasMediaContent = parts.some(part => isMediaPlaceholder(part));
    const hasTextContent = parts.some(part => !isMediaPlaceholder(part) && part.trim() !== '');
    
    if (hasMediaContent || hasTextContent) {
      // Add a final text input for continued typing
      elements.push(
        <TextInput
          ref={textInputRef}
          key={`text-final-${textSegmentIndex}`}
          style={[styles.bodyInput, selectedFontStyle ? { fontFamily: selectedFontStyle } : {}]}
          placeholder={!readOnly ? "Continue writing..." : ""}
          editable={!readOnly}
          placeholderTextColor="#888888"
          value=""
          onChangeText={(text) => {
            if (text.trim() !== '') {
              // Append new text to the content
              const newContent = noteContent + text;
              onContentChange(newContent);
            }
          }}
          onSelectionChange={handleTextSelection}
          multiline={true}
          textAlignVertical="top"
          autoFocus={false}
        />
      );
    }
    
    // If no content exists at all, render the initial text input
    if (parts.length === 0 || (!hasMediaContent && !hasTextContent)) {
      elements.length = 0; // Clear any existing elements
      elements.push(
        <TextInput
          ref={textInputRef}
          key="text-initial"
          style={[styles.bodyInput, selectedFontStyle ? { fontFamily: selectedFontStyle } : {}]}
          placeholder={!readOnly ? "Start typing your note..." : ""}
          editable={!readOnly}
          placeholderTextColor="#888888"
          value={noteContent}
          onChangeText={(text) => onContentChange(text)}
          onSelectionChange={handleTextSelection}
          multiline={true}
          textAlignVertical="top"
          autoFocus={true}
        />
      );
    }
    
    return (
      <View style={styles.customEditorContainer}>
        {elements}
      </View>
    );
  };

  // Enhanced text segment change handler for inline editing
  const handleTextSegmentChange = (segmentIndex: number, text: string) => {
    const parts = parseContent(noteContent);
    let textSegmentCount = 0;
    let newContent = '';
    
    parts.forEach((part) => {
      if (isMediaPlaceholder(part)) {
        newContent += part;
      } else if (part.trim() !== '' || textSegmentCount === segmentIndex) {
        // Only process non-empty text segments or the target segment
        if (textSegmentCount === segmentIndex) {
          newContent += text;
        } else {
          newContent += part;
        }
        textSegmentCount++;
      }
    });
    
    // Handle case where this is the initial or only text segment
    if (parts.length === 0 || (parts.length === 1 && !isMediaPlaceholder(parts[0]))) {
      newContent = text;
    }
    
    onContentChange(newContent);
  };

  // Removed handleTextAfterMediaChange as it was causing the controlled/uncontrolled input issues

  const renderMediaComponent = (placeholder: MediaPlaceholder, index: number): React.ReactElement | null => {
    switch (placeholder.type) {
      case 'image':
        const images = Array.isArray(placeholder.data) ? placeholder.data as ImageAttachment[] : [placeholder.data as unknown as ImageAttachment];
        return (
          <View key={`${placeholder.id}-${index}`} style={styles.inlineImageContainer}>
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
        const audio = placeholder.data as AudioAttachment;
        return (
          <View key={`${placeholder.id}-${index}`} style={styles.inlineAudioContainer}>
            <AudioPlayerComponent
              audioUri={audio.uri}
              duration={audio.duration}
              onDelete={() => handleAudioDelete(audio.id)}
              isDarkMode={true}
            />
          </View>
        );
      case 'tickbox':
        const tickBoxGroup = placeholder.data as TickBoxGroup;
        return (
          <View key={`${placeholder.id}-${index}`} style={styles.inlineTickBoxContainer}>
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
  };

  // Removed renderTextSegment - using single TextInput in custom editor

  // Removed renderImageSegment - now rendered inline in renderMediaComponent

  // Removed renderAudioSegment - now rendered inline in renderMediaComponent

  // Removed renderTickBoxSegment - now rendered inline in renderMediaComponent

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

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


  return (
    <View style={[styles.container, { backgroundColor: selectedGradient ? 'transparent' : selectedTheme }]}>
      {renderBackground()}
      {/* <StatusBar barStyle="light-content" backgroundColor={selectedTheme} translucent={true} /> */}

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
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
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
          {/* Date/Time and Category Row */}
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
            onFocus={() => {
              if (isKeyboardVisible) {
                setTimeout(() => scrollToInput(), 100);
              }
            }}
            multiline={false}
          />

          {/* Segmented Content (Text + Media) */}
          {renderCustomEditor()}
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
        onDrawing={React.useCallback(handleDrawing, [])}
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