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
  SafeAreaView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { router } from 'expo-router';

interface Category {
  id: string;
  name: string;
  createdAt: string;
}

export default function CategoriesEditScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      // TODO: Implement actual category loading from AsyncStorage
      // For now, using mock categories to match the reference image
      const mockCategories = [
        { id: '1', name: 'Work', createdAt: new Date().toISOString() },
        { id: '2', name: 'Personal', createdAt: new Date().toISOString() },
        { id: '3', name: 'Ideas', createdAt: new Date().toISOString() },
        { id: '4', name: 'Projects', createdAt: new Date().toISOString() },
        { id: '5', name: 'Shopping', createdAt: new Date().toISOString() },
        { id: '6', name: 'Health', createdAt: new Date().toISOString() },
        { id: '7', name: 'Travel', createdAt: new Date().toISOString() },
        { id: '8', name: 'Finance', createdAt: new Date().toISOString() },
        { id: '9', name: 'Learning', createdAt: new Date().toISOString() },
        { id: '10', name: 'Family', createdAt: new Date().toISOString() },
        { id: '11', name: 'Goals', createdAt: new Date().toISOString() },
      ];
      setCategories(mockCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const handleCreateCategory = () => {
    if (newCategoryName.trim() === '') {
      Alert.alert('Error', 'Please enter a category name');
      return;
    }

    const newCategory: Category = {
      id: Date.now().toString(),
      name: newCategoryName.trim(),
      createdAt: new Date().toISOString(),
    };

    setCategories(prev => [...prev, newCategory]);
    setNewCategoryName('');
    
    // TODO: Save to AsyncStorage
    console.log('Created new category:', newCategory);
  };

  const handleDeleteCategory = (categoryId: string) => {
    Alert.alert(
      'Delete Category',
      'Are you sure you want to delete this category?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setCategories(prev => prev.filter(category => category.id !== categoryId));
            // TODO: Update AsyncStorage
            console.log('Deleted category:', categoryId);
          },
        },
      ]
    );
  };

  const handleEditCategory = (categoryId: string, currentName: string) => {
    setEditingCategoryId(categoryId);
    setEditingCategoryName(currentName);
  };

  const handleSaveEdit = () => {
    if (editingCategoryName.trim() === '') {
      Alert.alert('Error', 'Please enter a category name');
      return;
    }

    setCategories(prev =>
      prev.map(category =>
        category.id === editingCategoryId
          ? { ...category, name: editingCategoryName.trim() }
          : category
      )
    );

    setEditingCategoryId(null);
    setEditingCategoryName('');
    
    // TODO: Update AsyncStorage
    console.log('Updated category:', editingCategoryId, editingCategoryName);
  };

  const handleCancelEdit = () => {
    setEditingCategoryId(null);
    setEditingCategoryName('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#202124" />
      
      {/* Navbar */}
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#E8EAED" />
        </TouchableOpacity>
        <Text style={styles.navbarTitle}>Edit Categories</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Create New Category Section */}
        <View style={styles.createSection}>
          <TouchableOpacity 
            style={styles.clearButton}
            onPress={() => setNewCategoryName('')}
          >
            <Ionicons name="close" size={20} color="#9AA0A6" />
          </TouchableOpacity>
          
          <TextInput
            style={styles.createInput}
            placeholder="Create new category"
            placeholderTextColor="#9AA0A6"
            value={newCategoryName}
            onChangeText={setNewCategoryName}
            onSubmitEditing={handleCreateCategory}
          />
          
          <TouchableOpacity 
            style={styles.checkButton}
            onPress={handleCreateCategory}
          >
            <Ionicons name="checkmark" size={20} color="#9AA0A6" />
          </TouchableOpacity>
        </View>

        {/* Categories List */}
        <View style={styles.categoriesContainer}>
          {categories.map((category) => (
            <View key={category.id} style={styles.categoryRow}>
              <View style={styles.categoryInfo}>
                <Ionicons name="apps-outline" size={20} color="#9AA0A6" />
                
                {editingCategoryId === category.id ? (
                  <TextInput
                    style={styles.editInput}
                    value={editingCategoryName}
                    onChangeText={setEditingCategoryName}
                    onSubmitEditing={handleSaveEdit}
                    autoFocus
                  />
                ) : (
                  <Text style={styles.categoryName}>{category.name}</Text>
                )}
              </View>

              <View style={styles.categoryActions}>
                {editingCategoryId === category.id ? (
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
                      onPress={() => handleEditCategory(category.id, category.name)}
                    >
                      <Ionicons name="pencil" size={20} color="#9AA0A6" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => handleDeleteCategory(category.id)}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#202124',
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#202124',
    borderBottomWidth: 1,
    borderBottomColor: '#3C4043',
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  navbarTitle: {
    color: '#E8EAED',
    fontSize: 20,
    fontWeight: '500',
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
  categoriesContainer: {
    flex: 1,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2E3134',
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryName: {
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
  categoryActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    marginLeft: 12,
    padding: 8,
  },
});