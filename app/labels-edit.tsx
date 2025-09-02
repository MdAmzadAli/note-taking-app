import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { router } from 'expo-router';

interface Label {
  id: string;
  name: string;
  createdAt: string;
}

export default function LabelsEditScreen() {
  const [labels, setLabels] = useState<Label[]>([]);
  const [newLabelName, setNewLabelName] = useState('');
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingLabelName, setEditingLabelName] = useState('');

  useEffect(() => {
    loadLabels();
  }, []);

  const loadLabels = async () => {
    try {
      // TODO: Implement actual label loading from AsyncStorage
      // For now, using mock labels to match the reference image
      const mockLabels = [
        { id: '1', name: 'Bbjh', createdAt: new Date().toISOString() },
        { id: '2', name: 'Dfgt', createdAt: new Date().toISOString() },
        { id: '3', name: 'Eiekejeh', createdAt: new Date().toISOString() },
        { id: '4', name: 'Ejekekek', createdAt: new Date().toISOString() },
        { id: '5', name: 'Emnshe', createdAt: new Date().toISOString() },
        { id: '6', name: 'Nzznsmsm', createdAt: new Date().toISOString() },
        { id: '7', name: 'Shsjjs', createdAt: new Date().toISOString() },
        { id: '8', name: 'Sjsjjs', createdAt: new Date().toISOString() },
        { id: '9', name: 'Skkwwhyw', createdAt: new Date().toISOString() },
        { id: '10', name: 'Uwjwjw', createdAt: new Date().toISOString() },
        { id: '11', name: 'Wjwkekke', createdAt: new Date().toISOString() },
      ];
      setLabels(mockLabels);
    } catch (error) {
      console.error('Error loading labels:', error);
    }
  };

  const handleCreateLabel = () => {
    if (newLabelName.trim() === '') {
      Alert.alert('Error', 'Please enter a label name');
      return;
    }

    const newLabel: Label = {
      id: Date.now().toString(),
      name: newLabelName.trim(),
      createdAt: new Date().toISOString(),
    };

    setLabels(prev => [...prev, newLabel]);
    setNewLabelName('');
    
    // TODO: Save to AsyncStorage
    console.log('Created new label:', newLabel);
  };

  const handleDeleteLabel = (labelId: string) => {
    Alert.alert(
      'Delete Label',
      'Are you sure you want to delete this label?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setLabels(prev => prev.filter(label => label.id !== labelId));
            // TODO: Update AsyncStorage
            console.log('Deleted label:', labelId);
          },
        },
      ]
    );
  };

  const handleEditLabel = (labelId: string, currentName: string) => {
    setEditingLabelId(labelId);
    setEditingLabelName(currentName);
  };

  const handleSaveEdit = () => {
    if (editingLabelName.trim() === '') {
      Alert.alert('Error', 'Please enter a label name');
      return;
    }

    setLabels(prev =>
      prev.map(label =>
        label.id === editingLabelId
          ? { ...label, name: editingLabelName.trim() }
          : label
      )
    );

    setEditingLabelId(null);
    setEditingLabelName('');
    
    // TODO: Update AsyncStorage
    console.log('Updated label:', editingLabelId, editingLabelName);
  };

  const handleCancelEdit = () => {
    setEditingLabelId(null);
    setEditingLabelName('');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#202124" />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#E8EAED" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit labels</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Create New Label Section */}
        <View style={styles.createSection}>
          <TouchableOpacity 
            style={styles.clearButton}
            onPress={() => setNewLabelName('')}
          >
            <Ionicons name="close" size={20} color="#9AA0A6" />
          </TouchableOpacity>
          
          <TextInput
            style={styles.createInput}
            placeholder="Create new label"
            placeholderTextColor="#9AA0A6"
            value={newLabelName}
            onChangeText={setNewLabelName}
            onSubmitEditing={handleCreateLabel}
          />
          
          <TouchableOpacity 
            style={styles.checkButton}
            onPress={handleCreateLabel}
          >
            <Ionicons name="checkmark" size={20} color="#9AA0A6" />
          </TouchableOpacity>
        </View>

        {/* Labels List */}
        <View style={styles.labelsContainer}>
          {labels.map((label) => (
            <View key={label.id} style={styles.labelRow}>
              <View style={styles.labelInfo}>
                <Ionicons name="pricetag-outline" size={20} color="#9AA0A6" />
                
                {editingLabelId === label.id ? (
                  <TextInput
                    style={styles.editInput}
                    value={editingLabelName}
                    onChangeText={setEditingLabelName}
                    onSubmitEditing={handleSaveEdit}
                    autoFocus
                  />
                ) : (
                  <Text style={styles.labelName}>{label.name}</Text>
                )}
              </View>

              <View style={styles.labelActions}>
                {editingLabelId === label.id ? (
                  <>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={handleCancelEdit}
                    >
                      <Ionicons name="close" size={20} color="#9AA0A6" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={handleSaveEdit}
                    >
                      <Ionicons name="checkmark" size={20} color="#9AA0A6" />
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => handleEditLabel(label.id, label.name)}
                    >
                      <Ionicons name="pencil" size={20} color="#9AA0A6" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => handleDeleteLabel(label.id)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#9AA0A6" />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#202124',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 24,
    borderBottomWidth: 1,
    borderBottomColor: '#3C4043',
  },
  backButton: {
    marginRight: 16,
    padding: 8,
  },
  headerTitle: {
    color: '#E8EAED',
    fontSize: 20,
    fontWeight: '400',
  },
  content: {
    flex: 1,
  },
  createSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3C4043',
  },
  clearButton: {
    marginRight: 16,
    padding: 8,
  },
  createInput: {
    flex: 1,
    color: '#E8EAED',
    fontSize: 16,
    paddingVertical: 8,
  },
  checkButton: {
    marginLeft: 16,
    padding: 8,
  },
  labelsContainer: {
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2E3134',
  },
  labelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  labelName: {
    color: '#E8EAED',
    fontSize: 16,
    marginLeft: 16,
  },
  editInput: {
    color: '#E8EAED',
    fontSize: 16,
    marginLeft: 16,
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#8AB4F8',
    paddingBottom: 4,
  },
  labelActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    marginLeft: 12,
    padding: 8,
  },
});