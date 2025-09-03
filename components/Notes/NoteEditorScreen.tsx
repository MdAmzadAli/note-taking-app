
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

  const requestPermission = async () => {
    console.log('Requesting permissions...', 'Platform:', Platform.OS);
    
    // For web, we don't need explicit permissions
    if (Platform.OS === 'web') {
      console.log('Web platform detected, skipping permission requests');
      return true;
    }
    
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
    
    console.log('Media library permission:', status);
    console.log('Camera permission:', cameraStatus.status);

    if (status !== 'granted' || cameraStatus.status !== 'granted') {
      Alert.alert('Permission required', 'Please grant camera and photo library permissions to add images.');
      return false;
    }
    return true;
  };

  const handleTakePhoto = async () => {
    console.log('Taking photo - starting...', 'Platform:', Platform.OS);
    
    // Check if camera is available on this platform
    if (Platform.OS === 'web') {
      Alert.alert('Camera Not Available', 'Camera functionality is not available in web browsers. Please use "Add Image" to upload files instead.');
      return;
    }
    
    const hasPermission = await requestPermission();
    console.log('Permission result:', hasPermission);
    if (!hasPermission) return;

    console.log('Launching camera...');
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    console.log('Camera result:', result);
    if (!result.canceled && result.assets[0]) {
      const newImage: ImageAttachment = {
        id: Date.now().toString(),
        uri: result.assets[0].uri,
        type: 'photo',
        createdAt: new Date().toISOString(),
      };
      console.log('Adding new image:', newImage);
      setNoteImages([...noteImages, newImage]);
      setShowMediaModal(false);
    }
  };

  const handleAddImage = async () => {
    console.log('Adding image - starting...', 'Platform:', Platform.OS);
    const hasPermission = await requestPermission();
    console.log('Permission result:', hasPermission);
    if (!hasPermission) return;

    console.log('Launching image library...');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 10,
    });

    console.log('Image library result:', result);
    if (!result.canceled && result.assets) {
      const newImages: ImageAttachment[] = result.assets.map((asset, index) => ({
        id: (Date.now() + index).toString(),
        uri: asset.uri,
        type: 'image',
        createdAt: new Date().toISOString(),
      }));
      console.log('Adding new images:', newImages);
      setNoteImages([...noteImages, ...newImages]);
      setShowMediaModal(false);
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
      // Only respond to horizontal swipes with minimal vertical movement
      return Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dy) < 80;
    },
    onPanResponderGrant: () => {
      // Grant the responder
    },
    onPanResponderMove: (evt, gestureState) => {
      // Optional: Add visual feedback during swipe
    },
    onPanResponderRelease: (evt, gestureState) => {
      const { dx } = gestureState;
      const swipeThreshold = 50;

      if (Math.abs(dx) > swipeThreshold && noteImages.length > 1) {
        if (dx > 0) {
          // Swiped right, go to previous image
          handlePreviousImage();
        } else {
          // Swiped left, go to next image
          handleNextImage();
        }
      }
    },
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => false,
  });

  const handleDrawing = () => {
    Alert.alert('Drawing', 'Drawing feature coming soon!');
    setShowMediaModal(false);
  };

  const handleRecording = () => {
    Alert.alert('Recording', 'Recording feature coming soon!');
    setShowMediaModal(false);
  };

  const handleTickBoxes = () => {
    Alert.alert('Tick Boxes', 'Tick boxes feature coming soon!');
    setShowMediaModal(false);
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
          {/* Top Image Gallery - only show if no content */}
          {noteImages.length > 0 && !noteTitle.trim() && !noteContent.trim() && (
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

          <TextInput
            style={styles.bodyInput}
            placeholder="Note"
            placeholderTextColor="#888888"
            value={noteContent}
            onChangeText={onContentChange}
            multiline={true}
            textAlignVertical="top"
          />

          {/* Inline Images - show if there's content */}
          {noteImages.length > 0 && (noteTitle.trim() || noteContent.trim()) && (
            <View style={styles.inlineImagesContainer}>
              {noteImages.map((image, index) => {
                const isEvenRow = Math.floor(index / 2) % 2 === 0;
                const isFirstInRow = index % 2 === 0;
                const isLastInRow = index % 2 === 1 || index === noteImages.length - 1;
                
                return (
                  <TouchableOpacity
                    key={image.id}
                    style={[
                      styles.inlineImageCard,
                      {
                        marginRight: isLastInRow ? 0 : 8,
                        marginBottom: index < noteImages.length - 2 ? 8 : 0,
                      },
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
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Bottom Toolbar */}
        <View style={styles.bottomBar}>
          <View style={styles.bottomLeft}>
            <TouchableOpacity 
              style={styles.bottomButton}
              onPress={() => {
                console.log('Add button pressed - opening media modal');
                setShowMediaModal(true);
              }}
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

              {/* Image navigation indicators */}
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
  inlineImagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 20,
    marginBottom: 20,
  },
  inlineImageCard: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: '#F8F8F8',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  inlineImage: {
    width: '100%',
    height: '100%',
  },
});
