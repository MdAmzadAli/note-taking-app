
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
import { router, useLocalSearchParams } from 'expo-router';
import { 
  getCategories, saveCategory, deleteCategory,
  getTaskCategories, saveTaskCategory, deleteTaskCategory,
  getReminderCategories, saveReminderCategory, deleteReminderCategory
} from '@/utils/storage';
import AppLayout from './AppLayout';

interface DataItem {
  id: string;
  name: string;
  createdAt: string;
}

interface DataConfig {
  title: string;
  icon: string;
  placeholder: string;
  createText: string;
  defaultItems: DataItem[];
  storageKey: string;
  saveFunction: (item: DataItem) => Promise<void>;
  deleteFunction: (id: string) => Promise<void>;
  getFunction: () => Promise<DataItem[]>;
}

const getDataConfig = (type: string): DataConfig => {
  switch (type) {
    case 'categories':
      return {
        title: 'Edit Categories',
        icon: 'apps-outline',
        placeholder: 'Create new category',
        createText: 'category',
        defaultItems: [
          { id: '1', name: 'Work', createdAt: new Date().toISOString() },
          { id: '2', name: 'Personal', createdAt: new Date().toISOString() },
          { id: '3', name: 'Ideas', createdAt: new Date().toISOString() },
        ],
        storageKey: 'categories',
        saveFunction: saveCategory,
        deleteFunction: deleteCategory,
        getFunction: getCategories,
      };
    case 'task-categories':
      return {
        title: 'Edit Task Categories',
        icon: 'folder-outline',
        placeholder: 'Create new task category',
        createText: 'task category',
        defaultItems: [
          { id: '1', name: 'Personal', createdAt: new Date().toISOString() },
          { id: '2', name: 'Work', createdAt: new Date().toISOString() },
          { id: '3', name: 'Shopping', createdAt: new Date().toISOString() },
        ],
        storageKey: 'task-categories',
        saveFunction: saveTaskCategory,
        deleteFunction: deleteTaskCategory,
        getFunction: getTaskCategories,
      };
    case 'reminder-categories':
      return {
        title: 'Edit Reminder Categories',
        icon: 'alarm-outline',
        placeholder: 'Create new reminder category',
        createText: 'reminder category',
        defaultItems: [
          { id: '1', name: 'Important', createdAt: new Date().toISOString() },
          { id: '2', name: 'Daily', createdAt: new Date().toISOString() },
          { id: '3', name: 'Weekly', createdAt: new Date().toISOString() },
          { id: '4', name: 'Monthly', createdAt: new Date().toISOString() },
        ],
        storageKey: 'reminder-categories',
        saveFunction: saveReminderCategory,
        deleteFunction: deleteReminderCategory,
        getFunction: getReminderCategories,
      };
    default:
      return getDataConfig('categories');
  }
};

export default function EditScreen() {
  const params = useLocalSearchParams();
  const type = (params.type as string) || 'categories';
  const config = getDataConfig(type);

  const [items, setItems] = useState<DataItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState('');

  useEffect(() => {
    loadItems();
  }, [type]);

  const loadItems = async () => {
    try {
      const storedItems = await config.getFunction();
      
      // Define old default category names to detect and remove
      const oldNoteDefaults = ['Work', 'Personal', 'Ideas', 'Projects', 'Shopping', 'Health', 'Travel', 'Finance', 'Learning', 'Family', 'Goals'];
      const oldTaskDefaults = ['Personal', 'Work', 'Shopping', 'Health', 'Learning'];
      
      // If no items exist, create default ones
      if (storedItems.length === 0) {
        // Save default items to storage
        for (const item of config.defaultItems) {
          await config.saveFunction(item);
        }
        
        setItems(config.defaultItems);
      } else {
        // Check if we need to migrate from old defaults to new defaults
        let needsMigration = false;
        
        if (type === 'categories' && storedItems.length >= 11) {
          // Check if stored items contain old note defaults
          const storedNames = storedItems.map(item => item.name);
          const hasOldDefaults = oldNoteDefaults.every(name => storedNames.includes(name));
          needsMigration = hasOldDefaults;
        } else if (type === 'task-categories' && storedItems.length >= 5) {
          // Check if stored items contain old task defaults
          const storedNames = storedItems.map(item => item.name);
          const hasOldDefaults = oldTaskDefaults.every(name => storedNames.includes(name));
          needsMigration = hasOldDefaults;
        }
        
        if (needsMigration) {
          // Get the old default names for this type
          const oldDefaults = type === 'categories' ? oldNoteDefaults : oldTaskDefaults;
          
          // Keep only user-created categories (not in old defaults) and new defaults
          const userCreated = storedItems.filter(item => !oldDefaults.includes(item.name));
          
          // Delete all old items from storage
          for (const item of storedItems) {
            await config.deleteFunction(item.id);
          }
          
          // Save new defaults
          for (const item of config.defaultItems) {
            await config.saveFunction(item);
          }
          
          // Save user-created categories back
          for (const item of userCreated) {
            await config.saveFunction(item);
          }
          
          // Combine new defaults with user-created categories
          setItems([...config.defaultItems, ...userCreated]);
        } else {
          setItems(storedItems);
        }
      }
    } catch (error) {
      console.error(`Error loading ${config.createText}s:`, error);
    }
  };

  const handleCreateItem = async () => {
    if (newItemName.trim() === '') {
      Alert.alert('Error', `Please enter a ${config.createText} name`);
      return;
    }

    const newItem: DataItem = {
      id: Date.now().toString(),
      name: newItemName.trim(),
      createdAt: new Date().toISOString(),
    };

    try {
      await config.saveFunction(newItem);
      setItems(prev => [...prev, newItem]);
      setNewItemName('');
      console.log(`Created new ${config.createText}:`, newItem);
    } catch (error) {
      console.error(`Error creating ${config.createText}:`, error);
      Alert.alert('Error', `Failed to create ${config.createText}`);
    }
  };

  const handleDeleteItem = (itemId: string) => {
    Alert.alert(
      `Delete ${config.createText.charAt(0).toUpperCase() + config.createText.slice(1)}`,
      `Are you sure you want to delete this ${config.createText}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await config.deleteFunction(itemId);
              setItems(prev => prev.filter(item => item.id !== itemId));
              console.log(`Deleted ${config.createText}:`, itemId);
            } catch (error) {
              console.error(`Error deleting ${config.createText}:`, error);
              Alert.alert('Error', `Failed to delete ${config.createText}`);
            }
          },
        },
      ]
    );
  };

  const handleEditItem = (itemId: string, currentName: string) => {
    setEditingItemId(itemId);
    setEditingItemName(currentName);
  };

  const handleSaveEdit = async () => {
    if (editingItemName.trim() === '') {
      Alert.alert('Error', `Please enter a ${config.createText} name`);
      return;
    }

    try {
      const updatedItem = items.find(c => c.id === editingItemId);
      if (updatedItem) {
        const newItem = {
          ...updatedItem,
          name: editingItemName.trim()
        };
        
        await config.saveFunction(newItem);
        
        setItems(prev =>
          prev.map(item =>
            item.id === editingItemId
              ? { ...item, name: editingItemName.trim() }
              : item
          )
        );

        setEditingItemId(null);
        setEditingItemName('');
        
        console.log(`Updated ${config.createText}:`, editingItemId, editingItemName);
      }
    } catch (error) {
      console.error(`Error updating ${config.createText}:`, error);
      Alert.alert('Error', `Failed to update ${config.createText}`);
    }
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditingItemName('');
  };

  return (
    <AppLayout>
      {/* Navbar */}
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#E8EAED" />
        </TouchableOpacity>
        <Text style={styles.navbarTitle}>{config.title}</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Create New Item Section */}
        <View style={styles.createSection}>
          <TouchableOpacity 
            style={styles.clearButton}
            onPress={() => setNewItemName('')}
          >
            <Ionicons name="close" size={20} color="#9AA0A6" />
          </TouchableOpacity>
          
          <TextInput
            style={styles.createInput}
            placeholder={config.placeholder}
            placeholderTextColor="#9AA0A6"
            value={newItemName}
            onChangeText={setNewItemName}
            onSubmitEditing={handleCreateItem}
          />
          
          <TouchableOpacity 
            style={styles.checkButton}
            onPress={handleCreateItem}
          >
            <Ionicons name="checkmark" size={20} color="#9AA0A6" />
          </TouchableOpacity>
        </View>

        {/* Items List */}
        <View style={styles.itemsContainer}>
          {[...items].reverse().map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Ionicons name={config.icon} size={20} color="#9AA0A6" />
                
                {editingItemId === item.id ? (
                  <TextInput
                    style={styles.editInput}
                    value={editingItemName}
                    onChangeText={setEditingItemName}
                    onSubmitEditing={handleSaveEdit}
                    autoFocus
                  />
                ) : (
                  <Text style={styles.itemName}>{item.name}</Text>
                )}
              </View>

              <View style={styles.itemActions}>
                {editingItemId === item.id ? (
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
                      onPress={() => handleEditItem(item.id, item.name)}
                    >
                      <Ionicons name="pencil" size={20} color="#9AA0A6" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => handleDeleteItem(item.id)}
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
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
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
  itemsContainer: {
    flex: 1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2E3134',
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemName: {
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
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    marginLeft: 12,
    padding: 8,
  },
});
