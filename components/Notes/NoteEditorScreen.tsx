import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Modal,
  TouchableWithoutFeedback,
  StatusBar,
  Platform,
  Alert,
  Image,
  Dimensions,
  PanResponder,
  KeyboardAvoidingView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import ColorThemePicker from './ColorThemePicker';
import MediaAttachmentModal from './MediaAttachmentModal';

interface ImageAttachment {
  id: string;
  uri: string;
  type: 'photo' | 'image';
  createdAt: string;
}

interface NoteEditorScreenProps {
  isEditing: boolean;
  noteTitle: string;
  noteContent: string;
  noteTheme?: string;
  noteGradient?: string[] | null;
  isPinned?: boolean;
  images?: ImageAttachment[];
  onSave: (theme?: string, gradient?: string[], isPinned?: boolean, images?: ImageAttachment[]) => void;
  onBack: () => void;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  onImagesChange?: (images: ImageAttachment[]) => void;
}

interface TextFormat {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  highlighted: boolean;
  highlightColor: string;
  textColor: string;
  fontSize: number;
}

const HIGHLIGHT_COLORS = [
  '#FFFF00', // Yellow
  '#00FF00', // Green
  '#00FFFF', // Cyan
  '#FF00FF', // Magenta
  '#FFA500', // Orange
  '#FF69B4', // Hot Pink
];

const TEXT_COLORS = [
  '#FFFFFF', // White
  '#000000', // Black
  '#FF0000', // Red
  '#00FF00', // Green
  '#0000FF', // Blue
  '#FFFF00', // Yellow
  '#FF00FF', // Magenta
  '#00FFFF', // Cyan
  '#FFA500', // Orange
  '#800080', // Purple
];

export default function NoteEditorScreen({ 
  isEditing, 
  noteTitle, 
  noteContent, 
  noteTheme = '#1C1C1C',
  noteGradient = null,
  isPinned = false,
  images = [],
  onSave, 
  onBack, 
  onTitleChange, 
  onContentChange,
  onImagesChange 
}: NoteEditorScreenProps) {
  const [isNotePinned, setIsNotePinned] = useState(isPinned);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState(noteTheme);
  const [selectedGradient, setSelectedGradient] = useState<string[] | null>(noteGradient);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [initialTitle, setInitialTitle] = useState(noteTitle);
  const [initialContent, setInitialContent] = useState(noteContent);
  const [noteImages, setNoteImages] = useState<ImageAttachment[]>(images);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [fullImageUri, setFullImageUri] = useState<string | null>(null);
  const [showFullImage, setShowFullImage] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Rich text formatting states
  const [showHighlightColors, setShowHighlightColors] = useState(false);
  const [showTextColors, setShowTextColors] = useState(false);
  const [showSelectionToolbar, setShowSelectionToolbar] = useState(false);
  const [textSelection, setTextSelection] = useState({ start: 0, end: 0 });
  const [currentFormat, setCurrentFormat] = useState<TextFormat>({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    highlighted: false,
    highlightColor: '#FFFF00',
    textColor: '#FFFFFF',
    fontSize: 18,
  });
  
  const textInputRef = useRef<TextInput>(null);

  useEffect(() => {
    setInitialTitle(noteTitle);
    setInitialContent(noteContent);
  }, []);

  useEffect(() => {
    const titleChanged = noteTitle !== initialTitle;
    const contentChanged = noteContent !== initialContent;
    setHasUnsavedChanges(titleChanged || contentChanged);
  }, [noteTitle, noteContent, initialTitle, initialContent]);

  const handleThemeSelect = (color: string) => {
    setSelectedTheme(color);
    setSelectedGradient(null);
    setShowColorPicker(false);
  };

  const handleGradientSelect = (gradient: string[]) => {
    setSelectedGradient(gradient);
    setSelectedTheme(gradient[0]);
    setShowColorPicker(false);
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
              onSave(selectedTheme, selectedGradient || undefined, isNotePinned, noteImages);
              onImagesChange && onImagesChange(noteImages);
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
    onSave(selectedTheme, selectedGradient || undefined, isNotePinned, noteImages);
    onImagesChange && onImagesChange(noteImages);
    setInitialTitle(noteTitle);
    setInitialContent(noteContent);
    setHasUnsavedChanges(false);
  };

  const handleTextSelection = (event: any) => {
    const { selection } = event.nativeEvent;
    setTextSelection(selection);
    
    // Show formatting toolbar if text is selected
    if (selection.start !== selection.end) {
      setShowSelectionToolbar(true);
    } else {
      setShowSelectionToolbar(false);
      setShowHighlightColors(false);
      setShowTextColors(false);
    }
  };

  const toggleBold = () => {
    setCurrentFormat(prev => ({ ...prev, bold: !prev.bold }));
  };

  const toggleItalic = () => {
    setCurrentFormat(prev => ({ ...prev, italic: !prev.italic }));
  };

  const toggleUnderline = () => {
    setCurrentFormat(prev => ({ ...prev, underline: !prev.underline }));
  };

  const toggleStrikethrough = () => {
    setCurrentFormat(prev => ({ ...prev, strikethrough: !prev.strikethrough }));
  };

  const handleFontSizeDecrease = () => {
    if (currentFormat.fontSize > 8) {
      setCurrentFormat(prev => ({ ...prev, fontSize: prev.fontSize - 2 }));
    }
  };

  const handleFontSizeIncrease = () => {
    if (currentFormat.fontSize < 48) {
      setCurrentFormat(prev => ({ ...prev, fontSize: prev.fontSize + 2 }));
    }
  };

  const handleHighlightColor = (color: string) => {
    setCurrentFormat(prev => ({ 
      ...prev, 
      highlighted: true, 
      highlightColor: color 
    }));
    setShowHighlightColors(false);
  };

  const handleTextColor = (color: string) => {
    setCurrentFormat(prev => ({ ...prev, textColor: color }));
    setShowTextColors(false);
  };

  const getTextStyle = () => {
    const decorationLines = [
      currentFormat.underline ? 'underline' : '',
      currentFormat.strikethrough ? 'line-through' : ''
    ].filter(Boolean).join(' ');

    return {
      fontSize: currentFormat.fontSize,
      color: currentFormat.textColor,
      fontWeight: (currentFormat.bold ? 'bold' : 'normal') as 'bold' | 'normal',
      fontStyle: (currentFormat.italic ? 'italic' : 'normal') as 'italic' | 'normal',
      textDecorationLine: (decorationLines || 'none') as 'none' | 'underline' | 'line-through' | 'underline line-through',
      backgroundColor: currentFormat.highlighted ? currentFormat.highlightColor : 'transparent',
      fontFamily: 'Inter',
      lineHeight: currentFormat.fontSize * 1.4,
    };
  };

  const requestPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();

    if (status !== 'granted' || cameraStatus.status !== 'granted') {
      Alert.alert('Permission required', 'Please grant camera and photo library permissions to add images.');
      return false;
    }
    return true;
  };

  const handleTakePhoto = async () => {
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
      setNoteImages([...noteImages, newImage]);
    }
  };

  const handleAddImage = async () => {
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
      setNoteImages([...noteImages, ...newImages]);
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
            setNoteImages(noteImages.filter(img => img.id !== imageId));
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
    Alert.alert('Recording', 'Recording feature coming soon!');
  };

  const handleTickBoxes = () => {
    Alert.alert('Tick Boxes', 'Tick boxes feature coming soon!');
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

  const renderSelectionToolbar = () => {
    if (!showSelectionToolbar) return null;

    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.selectionToolbar}>
          {/* Bold */}
          <TouchableOpacity
            style={[styles.toolbarButton, currentFormat.bold && styles.toolbarButtonActive]}
            onPress={toggleBold}
          >
            <Text style={[styles.toolbarButtonText, { fontWeight: 'bold' }]}>B</Text>
          </TouchableOpacity>

          {/* Italic */}
          <TouchableOpacity
            style={[styles.toolbarButton, currentFormat.italic && styles.toolbarButtonActive]}
            onPress={toggleItalic}
          >
            <Text style={[styles.toolbarButtonText, { fontStyle: 'italic' }]}>I</Text>
          </TouchableOpacity>

          {/* Underline */}
          <TouchableOpacity
            style={[styles.toolbarButton, currentFormat.underline && styles.toolbarButtonActive]}
            onPress={toggleUnderline}
          >
            <Text style={[styles.toolbarButtonText, { textDecorationLine: 'underline' }]}>U</Text>
          </TouchableOpacity>

          {/* Strikethrough */}
          <TouchableOpacity
            style={[styles.toolbarButton, currentFormat.strikethrough && styles.toolbarButtonActive]}
            onPress={toggleStrikethrough}
          >
            <Text style={[styles.toolbarButtonText, { textDecorationLine: 'line-through' }]}>S</Text>
          </TouchableOpacity>

          {/* Highlighter */}
          <TouchableOpacity
            style={[styles.toolbarButton, currentFormat.highlighted && styles.toolbarButtonActive]}
            onPress={() => setShowHighlightColors(!showHighlightColors)}
          >
            <View style={styles.highlighterIcon}>
              <Text style={[styles.toolbarButtonText, { backgroundColor: currentFormat.highlightColor }]}>A</Text>
            </View>
          </TouchableOpacity>

          {/* Font Color */}
          <TouchableOpacity
            style={styles.toolbarButton}
            onPress={() => setShowTextColors(!showTextColors)}
          >
            <View style={styles.fontColorIcon}>
              <Text style={styles.toolbarButtonText}>A</Text>
              <View style={[styles.colorUnderline, { backgroundColor: currentFormat.textColor }]} />
            </View>
          </TouchableOpacity>

          {/* Font Size Controls */}
          <TouchableOpacity
            style={[styles.toolbarButton, currentFormat.fontSize <= 8 && styles.toolbarButtonDisabled]}
            onPress={handleFontSizeDecrease}
            disabled={currentFormat.fontSize <= 8}
          >
            <Ionicons name="remove" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.fontSizeDisplay}>
            <Text style={styles.fontSizeText}>{currentFormat.fontSize}</Text>
          </View>

          <TouchableOpacity
            style={[styles.toolbarButton, currentFormat.fontSize >= 48 && styles.toolbarButtonDisabled]}
            onPress={handleFontSizeIncrease}
            disabled={currentFormat.fontSize >= 48}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Highlight Colors Modal */}
        {showHighlightColors && (
          <View style={styles.colorPalette}>
            <Text style={styles.colorPaletteTitle}>Highlight Color</Text>
            <View style={styles.colorOptionsRow}>
              {HIGHLIGHT_COLORS.map((color, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.colorOption, 
                    { backgroundColor: color },
                    currentFormat.highlightColor === color && styles.colorOptionSelected
                  ]}
                  onPress={() => handleHighlightColor(color)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Text Colors Modal */}
        {showTextColors && (
          <View style={styles.colorPalette}>
            <Text style={styles.colorPaletteTitle}>Text Color</Text>
            <View style={styles.colorOptionsRow}>
              {TEXT_COLORS.map((color, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.colorOption, 
                    { backgroundColor: color, borderColor: '#333', borderWidth: 1 },
                    currentFormat.textColor === color && styles.colorOptionSelected
                  ]}
                  onPress={() => handleTextColor(color)}
                />
              ))}
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: selectedGradient ? 'transparent' : selectedTheme }]}>
      {renderBackground()}
      <StatusBar barStyle="light-content" backgroundColor={selectedTheme} translucent={true} />

      <SafeAreaView style={styles.safeAreaContainer}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

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
        </View>

        {/* Main Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Image Gallery */}
          {noteImages.length > 0 && (
            <View style={styles.imageGallery}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.imageScrollView}
              >
                {noteImages.map((image, index) => (
                  <TouchableOpacity
                    key={image.id}
                    style={[
                      styles.imageCard,
                      {
                        zIndex: noteImages.length - index,
                        transform: [
                          { rotate: `${(index % 3 - 1) * 3}deg` },
                          { translateY: index * 2 },
                          { translateX: index * -8 },
                        ],
                      },
                    ]}
                    onPress={() => handleImagePress(image.uri)}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: image.uri }}
                      style={styles.attachedImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <TextInput
            style={styles.titleInput}
            placeholder="Title"
            placeholderTextColor="#888888"
            value={noteTitle}
            onChangeText={onTitleChange}
            multiline={false}
          />

          {/* Enhanced Text Editor with formatting */}
          <TextInput
            ref={textInputRef}
            style={[styles.bodyInput, getTextStyle()]}
            placeholder="Note"
            placeholderTextColor="#888888"
            value={noteContent}
            onChangeText={onContentChange}
            onSelectionChange={handleTextSelection}
            multiline={true}
            textAlignVertical="top"
            selectionColor={currentFormat.textColor}
          />
        </ScrollView>

        {/* Selection Toolbar - appears at bottom when text is selected */}
        {renderSelectionToolbar()}

        {/* Default Bottom Toolbar - only shown when no text is selected */}
        {!showSelectionToolbar && (
          <View style={styles.bottomBar}>
            <View style={styles.bottomLeft}>
              <TouchableOpacity 
                style={styles.bottomButton}
                onPress={() => setShowMediaModal(true)}
              >
                <Ionicons name="add" size={20} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.bottomButton}
                onPress={() => setShowColorPicker(true)}
              >
                <Ionicons name="brush" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.bottomButton}>
              <Ionicons name="ellipsis-horizontal" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>

      {/* Media Attachment Modal */}
      <MediaAttachmentModal
        visible={showMediaModal}
        onClose={() => setShowMediaModal(false)}
        onTakePhoto={handleTakePhoto}
        onAddImage={handleAddImage}
        onDrawing={handleDrawing}
        onRecording={handleRecording}
        onTickBoxes={handleTickBoxes}
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
        selectedTheme={selectedTheme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
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
  },
  selectionToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    marginHorizontal: 20,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  toolbarButton: {
    padding: 8,
    marginHorizontal: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarButtonActive: {
    backgroundColor: 'rgba(0, 255, 127, 0.3)',
  },
  toolbarButtonDisabled: {
    opacity: 0.5,
  },
  toolbarButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  highlighterIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fontColorIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorUnderline: {
    width: 20,
    height: 2,
    marginTop: 2,
  },
  fontSizeDisplay: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  fontSizeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  colorPalette: {
    backgroundColor: 'rgba(0,0,0,0.9)',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  colorPaletteTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  colorOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  colorOption: {
    width: 30,
    height: 30,
    borderRadius: 15,
    margin: 4,
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: '#00FF7F',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
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
});