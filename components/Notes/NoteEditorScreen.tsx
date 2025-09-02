import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
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
    setFullImageUri(imageUri);
    setShowFullImage(true);
  };

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

  return (
    <View style={[styles.container, { backgroundColor: selectedGradient ? 'transparent' : selectedTheme }]}>
      {renderBackground()}
      <StatusBar barStyle="light-content" backgroundColor={selectedTheme} translucent={true} />
      
      {/* Header */}
      <SafeAreaView style={styles.safeAreaHeader}>
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
      </SafeAreaView>

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
        
        <TextInput
          style={styles.bodyInput}
          placeholder="Note"
          placeholderTextColor="#888888"
          value={noteContent}
          onChangeText={onContentChange}
          multiline={true}
          textAlignVertical="top"
        />
      </ScrollView>

      {/* Bottom Toolbar */}
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
            <View style={styles.fullImageContainer}>
              <Image
                source={{ uri: fullImageUri }}
                style={styles.fullImage}
                resizeMode="contain"
              />
              
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
            </View>
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
  safeAreaHeader: {
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
    paddingVertical: 16,
    height: 150,
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
    top: 50,
    right: 20,
    zIndex: 1,
    padding: 10,
  },
  fullImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  fullImage: {
    width: Dimensions.get('window').width - 40,
    height: Dimensions.get('window').height - 200,
  },
  deleteImageButton: {
    position: 'absolute',
    bottom: 100,
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
});