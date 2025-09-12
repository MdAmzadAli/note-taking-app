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

// Segmented content structure for true inline media embedding
interface SegmentedContent {
  id: string;
  type: 'text' | 'image' | 'audio' | 'tickbox';
  createdAt: string;
}

interface TextSegment extends SegmentedContent {
  type: 'text';
  content: string;
  isFocused?: boolean;
}

interface ImageSegment extends SegmentedContent {
  type: 'image';
  images: ImageAttachment[];
}

interface AudioSegment extends SegmentedContent {
  type: 'audio';
  audio: AudioAttachment;
}

interface TickBoxSegment extends SegmentedContent {
  type: 'tickbox';
  tickBoxGroup: TickBoxGroup;
}

type SegmentType = TextSegment | ImageSegment | AudioSegment | TickBoxSegment;

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
  segments?: SegmentType[]; // Add segmented content support
  createdAt?: string;
  updatedAt?: string;
  categoryId?: string;
  readOnly?: boolean; // Add read-only mode for deleted notes
  onSave: (theme?: string, gradient?: string[], isPinned?: boolean, images?: ImageAttachment[], categoryId?: string, audios?: AudioAttachment[], tickBoxGroups?: TickBoxGroup[], segments?: SegmentType[], fontStyle?: string | undefined) => void;
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
  segments: initialSegments,
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

  // Segmented content system for true inline media embedding
  const [segments, setSegments] = useState<SegmentType[]>([]);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState({ start: 0, end: 0 });
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [pendingModalAction, setPendingModalAction] = useState<(() => void) | null>(null);

  const textInputRefs = useRef<{ [key: string]: TextInput | null }>({});
  const scrollViewRef = useRef<ScrollView>(null);
  const activeInputPosition = useRef<number>(0);

  const [isProcessingMedia, setIsProcessingMedia] = useState(false);

  useEffect(() => {
    setInitialTitle(noteTitle);
    setInitialContent(noteContent);
    setSelectedFontStyle(fontStyle);
    loadCategories();
    initializeSegments();

    // Add keyboard event listeners
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setIsKeyboardVisible(true);
        // Auto-scroll to active input after keyboard appears
        setTimeout(() => {
          scrollToActiveInput();
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

  // Cleanup segments periodically to merge adjacent text segments and remove empty ones
  // Only run cleanup when not actively editing to avoid surprise changes
  useEffect(() => {
    const cleanupTimer = setTimeout(() => {
      // Only cleanup if no active segment (not currently editing)
      if (!activeSegmentId || !isKeyboardVisible) {
        cleanupSegments();
      }
    }, 3000); // Cleanup after 3 seconds of inactivity

    return () => clearTimeout(cleanupTimer);
  }, [segments, activeSegmentId, isKeyboardVisible]);

  const initializeSegments = () => {
    // If we have saved segments, use them (this preserves inline positioning)
    if (initialSegments && initialSegments.length > 0) {
      // Remove order property from legacy segments if it exists
      const cleanedSegments = initialSegments.map(({ order, ...segment }: any) => segment);
      setSegments(cleanedSegments);
      // Set focus to the first text segment
      const firstTextSegment = cleanedSegments.find(seg => seg.type === 'text');
      if (firstTextSegment) {
        setActiveSegmentId(firstTextSegment.id);
      }
      return;
    }

    // Otherwise, create initial structure for new/legacy notes
    const newSegments: SegmentType[] = [];

    // Create initial text segment
    const initialTextSegment: TextSegment = {
      id: 'initial-text',
      type: 'text',
      content: noteContent || '',
      createdAt: new Date().toISOString(),
      isFocused: true,
    };
    newSegments.push(initialTextSegment);
    setActiveSegmentId(initialTextSegment.id);

    // Add existing media as separate segments (for backward compatibility)
    if (noteImages.length > 0) {
      newSegments.push({
        id: `images-${Date.now()}`,
        type: 'image',
        images: noteImages,
        createdAt: new Date().toISOString(),
      });
    }

    noteAudios.forEach((audio) => {
      newSegments.push({
        id: `audio-${audio.id}`,
        type: 'audio',
        audio: audio,
        createdAt: new Date().toISOString(),
      });
    });

    noteTickBoxGroups.forEach((group) => {
      newSegments.push({
        id: `tickbox-${group.id}`,
        type: 'tickbox',
        tickBoxGroup: group,
        createdAt: new Date().toISOString(),
      });
    });

    setSegments(newSegments);
  };

  const scrollToActiveInput = () => {
    if (scrollViewRef.current && activeInputPosition.current > 0) {
      const screenHeight = Dimensions.get('window').height;
      const availableHeight = screenHeight - keyboardHeight - 200; // Account for header and toolbar

      scrollViewRef.current.scrollTo({
        y: Math.max(0, activeInputPosition.current - availableHeight / 2),
        animated: true,
      });
    }
  };

  const handleTextSegmentSelection = (segmentId: string, event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    const { start, end } = event.nativeEvent.selection;
    setCursorPosition({ start, end });
    setActiveSegmentId(segmentId);
  };

  const insertMediaAtCursor = (mediaType: 'image' | 'audio' | 'tickbox', mediaData: any) => {
    console.log('insertMediaAtCursor called with:', mediaType, 'activeSegmentId:', activeSegmentId);
    
    if (!activeSegmentId) {
      console.log('No active segment ID, cannot insert media');
      return;
    }

    const activeSegmentIndex = segments.findIndex(seg => seg.id === activeSegmentId);
    const activeSegment = segments[activeSegmentIndex];
    
    if (!activeSegment || activeSegment.type !== 'text') {
      console.log('Active segment not found or not text type:', activeSegment?.type);
      return;
    }

    const textSegment = activeSegment as TextSegment;
    const currentText = textSegment.content;
    const insertPosition = cursorPosition.start;

    console.log('Inserting at position:', insertPosition, 'in text:', currentText);

    // Split text at cursor position
    const beforeText = currentText.substring(0, insertPosition);
    const afterText = currentText.substring(insertPosition);

    // Create new segments array using splice for efficiency
    const newSegments = [...segments];
    const elementsToInsert: SegmentType[] = [];

    // Update current segment with text before cursor (preserve all whitespace)
    if (beforeText.length > 0) {
      newSegments[activeSegmentIndex] = {
        ...textSegment,
        content: beforeText,
      };
    } else {
      // Remove current segment only if completely empty
      newSegments.splice(activeSegmentIndex, 1);
    }

    // Create media segment
    const mediaSegment = createMediaSegment(mediaType, mediaData);
    console.log('Created media segment:', mediaSegment.type, mediaSegment.id);
    if (mediaType === 'image') {
      console.log('Image segment contains:', (mediaSegment as ImageSegment).images.length, 'images');
    }
    elementsToInsert.push(mediaSegment);

    // Always create text segment for content after cursor to maintain focus
    const newActiveSegmentId = `text-after-${Date.now()}`;
    const newTextSegment: TextSegment = {
      id: newActiveSegmentId,
      type: 'text',
      content: afterText,
      createdAt: new Date().toISOString(),
      isFocused: true,
    };
    elementsToInsert.push(newTextSegment);

    // Insert new segments at the appropriate position
    const insertIndex = beforeText.length > 0 ? activeSegmentIndex + 1 : activeSegmentIndex;
    newSegments.splice(insertIndex, 0, ...elementsToInsert);

    console.log('New segments array length:', newSegments.length);
    console.log('New segments breakdown:', newSegments.map((s, i) => ({ index: i, type: s.type, id: s.id })));

    // Update segments and focus
    setSegments(newSegments);
    setActiveSegmentId(newActiveSegmentId); // Always focus the new trailing text segment

    // Update the main note content for saving
    updateMainNoteContent(newSegments);

    // Focus the new text input after a brief delay
    setTimeout(() => {
      const newTextInput = textInputRefs.current[newActiveSegmentId];
      if (newTextInput) {
        newTextInput.focus();
        // Measure and store input position for auto-scrolling
        newTextInput.measure((x, y, width, height, pageX, pageY) => {
          activeInputPosition.current = pageY;
          if (isKeyboardVisible) {
            scrollToActiveInput();
          }
        });
      }
    }, 100);
  };

  const createMediaSegment = (mediaType: 'image' | 'audio' | 'tickbox', mediaData: any): SegmentType => {
    const timestamp = Date.now();

    switch (mediaType) {
      case 'image':
        return {
          id: `image-${timestamp}`,
          type: 'image',
          images: Array.isArray(mediaData) ? mediaData : [mediaData],
          createdAt: new Date().toISOString(),
        };
      case 'audio':
        return {
          id: `audio-${timestamp}`,
          type: 'audio',
          audio: mediaData,
          createdAt: new Date().toISOString(),
        };
      case 'tickbox':
        return {
          id: `tickbox-${timestamp}`,
          type: 'tickbox',
          tickBoxGroup: mediaData,
          createdAt: new Date().toISOString(),
        };
      default:
        throw new Error(`Unknown media type: ${mediaType}`);
    }
  };

  // Helper function to update main note content
  const updateMainNoteContent = (segmentsArray: SegmentType[]) => {
    const combinedText = segmentsArray
      .filter(seg => seg.type === 'text')
      .map(seg => (seg as TextSegment).content)
      .join('');
    onContentChange(combinedText);
  };

  const handleTextChange = (segmentId: string, text: string) => {
    const updatedSegments = segments.map(segment => {
      if (segment.id === segmentId && segment.type === 'text') {
        return { ...segment, content: text };
      }
      return segment;
    });

    setSegments(updatedSegments);
    updateMainNoteContent(updatedSegments);
  };

  // Helper function to merge adjacent text segments
  const mergeAdjacentTextSegments = (segmentsArray: SegmentType[]): SegmentType[] => {
    const merged: SegmentType[] = [];
    
    for (let i = 0; i < segmentsArray.length; i++) {
      const current = segmentsArray[i];
      const next = segmentsArray[i + 1];
      
      if (current.type === 'text' && next?.type === 'text') {
        const currentText = current as TextSegment;
        const nextText = next as TextSegment;
        
        // Merge the text segments
        const mergedSegment: TextSegment = {
          ...currentText,
          content: currentText.content + nextText.content,
          isFocused: currentText.isFocused || nextText.isFocused,
        };
        
        merged.push(mergedSegment);
        i++; // Skip the next segment as it's been merged
      } else {
        merged.push(current);
      }
    }
    
    return merged;
  };

  // Helper function to remove only completely empty text segments
  const removeEmptyTextSegments = (segmentsArray: SegmentType[]): SegmentType[] => {
    return segmentsArray.filter(segment => {
      if (segment.type === 'text') {
        const textSegment = segment as TextSegment;
        // Only remove segments that are completely empty (no content at all) and not focused
        return textSegment.content.length > 0 || textSegment.isFocused;
      }
      return true;
    });
  };

  // Function to clean up segments (merge adjacent text, remove empty segments)
  const cleanupSegments = () => {
    let cleaned = removeEmptyTextSegments(segments);
    cleaned = mergeAdjacentTextSegments(cleaned);
    
    if (cleaned.length !== segments.length || 
        JSON.stringify(cleaned) !== JSON.stringify(segments)) {
      setSegments(cleaned);
      updateMainNoteContent(cleaned);
    }
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
              onSave(selectedTheme, selectedGradient || undefined, isNotePinned, noteImages, selectedCategoryId || undefined, noteAudios, noteTickBoxGroups, segments, selectedFontStyle);
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
    // Save with segments to preserve inline positioning
    onSave(selectedTheme, selectedGradient || undefined, isNotePinned, noteImages, selectedCategoryId || undefined, noteAudios, noteTickBoxGroups, segments, selectedFontStyle);
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
            
            // Update segments to remove the image from image segments
            const updatedSegments = segments.map(segment => {
              if (segment.type === 'image') {
                const imageSegment = segment as ImageSegment;
                const filteredImages = imageSegment.images.filter(img => img.id !== imageId);
                if (filteredImages.length === 0) {
                  // Remove the entire segment if no images left
                  return null;
                }
                return { ...imageSegment, images: filteredImages };
              }
              return segment;
            }).filter(segment => segment !== null) as SegmentType[];
            
            setSegments(updatedSegments);
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
    setNoteAudios(noteAudios.filter(audio => audio.id !== audioId));
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

  const handleTickBoxGroupUpdate = (groupId: string, updatedItems: any[]) => {
    // Update tick box groups
    const updatedGroups = noteTickBoxGroups.map(group =>
      group.id === groupId ? { ...group, items: updatedItems } : group
    );
    setNoteTickBoxGroups(updatedGroups);

    // Update segments as well
    const updatedSegments = segments.map(segment => {
      if (segment.type === 'tickbox' && segment.tickBoxGroup.id === groupId) {
        return {
          ...segment,
          tickBoxGroup: { ...segment.tickBoxGroup, items: updatedItems }
        } as TickBoxSegment;
      }
      return segment;
    });
    setSegments(updatedSegments);

    // Force re-render by updating the key or triggering a state change
    console.log('TickBox updated:', groupId, 'Items count:', updatedItems.length);
  };

  const handleTickBoxGroupDelete = (groupId: string) => {
    const updatedGroups = noteTickBoxGroups.filter(group => group.id !== groupId);
    setNoteTickBoxGroups(updatedGroups);
  };

  const renderSegmentedContent = () => {
    console.log('Rendering segmented content. Segments count:', segments.length);
    
    if (segments.length === 0) {
      return (
        <TextInput
          ref={(ref) => { if (ref) textInputRefs.current['default'] = ref; }}
          style={styles.bodyInput}
          placeholder={readOnly ? "" : "Start typing your note..."}
          editable={!readOnly}
          placeholderTextColor="#888888"
          value={noteContent}
          onChangeText={onContentChange}
          onSelectionChange={(event) => handleTextSegmentSelection('default', event)}
          multiline={true}
          textAlignVertical="top"
          autoFocus
        />
      );
    }

    // Segments are already in the correct order by array index
    console.log('Segments:', segments.map((s, i) => ({ 
      index: i,
      type: s.type, 
      id: s.id,
      imageCount: s.type === 'image' ? (s as ImageSegment).images.length : 0
    })));

    return (
      <View style={styles.segmentedContentContainer}>
        {segments.map((segment, index) => {
          console.log('Processing segment for rendering:', segment.type, segment.id, 'at index:', index);
          switch (segment.type) {
            case 'text':
              console.log('Rendering text segment:', segment.id);
              return renderTextSegment(segment as TextSegment);
            case 'image':
              const imageSegment = segment as ImageSegment;
              console.log('About to render image segment:', segment.id, 'with', imageSegment.images.length, 'images');
              return renderImageSegment(imageSegment);
            case 'audio':
              console.log('Rendering audio segment:', segment.id);
              return renderAudioSegment(segment as AudioSegment);
            case 'tickbox':
              console.log('Rendering tickbox segment:', segment.id);
              return renderTickBoxSegment(segment as TickBoxSegment);
            default:
              console.log('Unknown segment type:', (segment as any).type);
              return null;
          }
        })}
      </View>
    );
  };

  const renderTextSegment = (segment: TextSegment) => {
    return (
      <TextInput
        key={segment.id}
        ref={(ref) => { if (ref) textInputRefs.current[segment.id] = ref; }}
        style={[styles.textSegmentInput, selectedFontStyle ? { fontFamily: selectedFontStyle } : {}]}
        editable={!readOnly}
        placeholder="Continue typing..."
        placeholderTextColor="#888888"
        value={segment.content}
        onChangeText={(text) => handleTextChange(segment.id, text)}
        onSelectionChange={(event) => handleTextSegmentSelection(segment.id, event)}
        onFocus={() => {
          setActiveSegmentId(segment.id);
          // Measure input position when focused
          const input = textInputRefs.current[segment.id];
          if (input) {
            input.measure((x, y, width, height, pageX, pageY) => {
              activeInputPosition.current = pageY;
              if (isKeyboardVisible) {
                setTimeout(() => scrollToActiveInput(), 100);
              }
            });
          }
        }}
        onLayout={(event) => {
          // Store layout position for scrolling calculations
          const { y } = event.nativeEvent.layout;
          if (activeSegmentId === segment.id) {
            activeInputPosition.current = y;
          }
        }}
        multiline={true}
        textAlignVertical="top"
        autoFocus={segment.isFocused}
      />
    );
  };

  const renderImageSegment = (segment: ImageSegment) => {
    console.log('Rendering image segment with images:', segment.images.length, segment.images.map(img => img.uri));
    return (
      <View key={segment.id} style={styles.inlineImageContainer}>
        <View style={styles.inlineImageGallery}>
          {segment.images.map((image, index) => {
            console.log('Rendering individual image:', image.uri, 'Index:', index);
            // Display 2 images per row
            const isNewRow = index % 2 === 0;
            return (
              <TouchableOpacity
                key={image.id}
                style={[
                  styles.inlineImageCard,
                  { marginLeft: isNewRow ? 0 : 8 }
                ]}
                onPress={() => handleImagePress(image.uri)}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: image.uri }}
                  style={styles.inlineImage}
                  resizeMode="cover"
                  onError={(error) => {
                    console.error('Image load error for:', image.uri, error);
                  }}
                  onLoad={() => {
                    console.log('Image loaded successfully:', image.uri);
                  }}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderAudioSegment = (segment: AudioSegment) => {
    return (
      <View key={segment.id} style={styles.inlineAudioContainer}>
        <AudioPlayerComponent
          audioUri={segment.audio.uri}
          duration={segment.audio.duration}
          onDelete={() => handleAudioDelete(segment.audio.id)}
          isDarkMode={true}
        />
      </View>
    );
  };

  const renderTickBoxSegment = (segment: TickBoxSegment) => {
    return (
      <View key={segment.id} style={styles.inlineTickBoxContainer}>
        <TickBoxComponent
          items={segment.tickBoxGroup.items}
          onItemsChange={(items) => handleTickBoxGroupUpdate(segment.tickBoxGroup.id, items)}
          isDarkMode={true}
        />
        <TouchableOpacity
          style={styles.deleteTickBoxGroupButton}
          onPress={() => handleTickBoxGroupDelete(segment.tickBoxGroup.id)}
        >
          <Ionicons name="trash-outline" size={16} color="#FF4444" />
          <Text style={styles.deleteTickBoxGroupText}>Delete checklist</Text>
        </TouchableOpacity>
      </View>
    );
  };

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
            ref={(ref) => { if (ref) textInputRefs.current['title'] = ref; }}
            style={[styles.titleInput, selectedFontStyle ? { fontFamily: selectedFontStyle } : {}]}
            placeholder="Title"
            editable={!readOnly}
            placeholderTextColor="#888888"
            value={noteTitle}
            onChangeText={onTitleChange}
            onFocus={() => {
              setActiveSegmentId('title');
              // Measure title input position when focused
              const input = textInputRefs.current['title'];
              if (input) {
                input.measure((x, y, width, height, pageX, pageY) => {
                  activeInputPosition.current = pageY;
                  if (isKeyboardVisible) {
                    setTimeout(() => scrollToActiveInput(), 100);
                  }
                });
              }
            }}
            multiline={false}
          />

          {/* Segmented Content (Text + Media) */}
          {renderSegmentedContent()}
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
  // Segmented content styles
  segmentedContentContainer: {
    flex: 1,
  },
  textSegmentInput: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'Inter',
    fontWeight: '400',
    lineHeight: 26,
    minHeight: 40,
    paddingVertical: 4,
    // Fix text shifting on enter by ensuring consistent line height
    includeFontPadding: false,
    textAlignVertical: 'top',
  },
});