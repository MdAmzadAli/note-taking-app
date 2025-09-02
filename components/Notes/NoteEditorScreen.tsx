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
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import ColorThemePicker from './ColorThemePicker';

interface NoteEditorScreenProps {
  isEditing: boolean;
  noteTitle: string;
  noteContent: string;
  noteTheme?: string;
  noteGradient?: string[] | null;
  onSave: (theme?: string, gradient?: string[]) => void;
  onBack: () => void;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
}

export default function NoteEditorScreen({ 
  isEditing, 
  noteTitle, 
  noteContent, 
  noteTheme = '#1C1C1C',
  noteGradient = null,
  onSave, 
  onBack, 
  onTitleChange, 
  onContentChange 
}: NoteEditorScreenProps) {
  const [isPinned, setIsPinned] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState(noteTheme);
  const [selectedGradient, setSelectedGradient] = useState<string[] | null>(noteGradient);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [initialTitle, setInitialTitle] = useState(noteTitle);
  const [initialContent, setInitialContent] = useState(noteContent);

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
              onSave(selectedTheme, selectedGradient || undefined);
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
    onSave(selectedTheme, selectedGradient || undefined);
    setInitialTitle(noteTitle);
    setInitialContent(noteContent);
    setHasUnsavedChanges(false);
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
              onPress={() => setIsPinned(!isPinned)}
            >
              <Ionicons 
                name={isPinned ? "star" : "star-outline"} 
                size={24} 
                color={isPinned ? "#FFD700" : "#FFFFFF"} 
              />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Main Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
          <TouchableOpacity style={styles.bottomButton}>
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
});