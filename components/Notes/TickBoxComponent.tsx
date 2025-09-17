import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface TickBoxItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

interface TickBoxComponentProps {
  items: TickBoxItem[];
  onItemsChange: (items: TickBoxItem[]) => void;
  isDarkMode?: boolean;
  readOnly?: boolean;
}

export default function TickBoxComponent({
  items,
  onItemsChange,
  isDarkMode = false,
  readOnly = false
}: TickBoxComponentProps) {
  const [showCompleted, setShowCompleted] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Separate completed and uncompleted items
  const uncompletedItems = items.filter(item => !item.completed);
  const completedItems = items.filter(item => item.completed);

  const addNewItem = () => {
    const trimmedText = newItemText.trim();
    if (trimmedText) {
      const newItem: TickBoxItem = {
        id: Date.now().toString(),
        text: trimmedText,
        completed: false,
        createdAt: new Date().toISOString(),
      };

      const updatedItems = [...items, newItem];
      onItemsChange(updatedItems);
      setNewItemText('');
    }
  };

  const toggleItemCompletion = (itemId: string) => {
    const updatedItems = items.map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    onItemsChange(updatedItems);
  };

  const updateItemText = (itemId: string, newText: string) => {
    const updatedItems = items.map(item =>
      item.id === itemId ? { ...item, text: newText } : item
    );
    onItemsChange(updatedItems);
    setEditingItemId(null);
  };

  const deleteItem = (itemId: string) => {
    const updatedItems = items.filter(item => item.id !== itemId);
    onItemsChange(updatedItems);
  };

  const renderTickBoxItem = (item: TickBoxItem, isCompleted: boolean = false) => (
    <View key={item.id} style={[
      styles.tickBoxItem,
      isDarkMode ? styles.darkItem : styles.lightItem,
      isCompleted && styles.completedItem
    ]}>
      <TouchableOpacity
        style={[
          styles.checkbox,
          item.completed ? styles.checkedBox : styles.uncheckedBox,
          isDarkMode ? styles.darkCheckbox : styles.lightCheckbox
        ]}
        onPress={readOnly ? undefined : () => toggleItemCompletion(item.id)}
        disabled={readOnly}
      >
        {item.completed && (
          <Ionicons
            name="checkmark"
            size={16}
            color={isDarkMode ? "#FFFFFF" : "#000000"}
          />
        )}
      </TouchableOpacity>

      {editingItemId === item.id ? (
        <TextInput
          style={[
            styles.editInput,
            isDarkMode ? styles.darkInput : styles.lightInput
          ]}
          value={item.text}
          onChangeText={readOnly ? undefined : (text) => updateItemText(item.id, text)}
          onBlur={() => setEditingItemId(null)}
          onSubmitEditing={() => setEditingItemId(null)}
          autoFocus
          multiline
          editable={!readOnly}
        />
      ) : (
        <TouchableOpacity
          style={styles.itemTextContainer}
          onPress={readOnly ? undefined : () => setEditingItemId(item.id)}
        >
          <Text style={[
            styles.itemText,
            isDarkMode ? styles.darkText : styles.lightText,
            item.completed && styles.completedText
          ]}>
            {item.text}
          </Text>
        </TouchableOpacity>
      )}

      {!readOnly && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteItem(item.id)}
        >
          <Ionicons
            name="close"
            size={16}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={[styles.container, isDarkMode ? styles.darkContainer : styles.lightContainer]}>
      {/* Add new item section */}
      {!readOnly && (
        <View style={styles.addSection}>
          <TouchableOpacity
            style={[
              styles.addButton,
              isDarkMode ? styles.darkAddButton : styles.lightAddButton
            ]}
            onPress={addNewItem}
          >
            <Ionicons name="add" size={20} color={isDarkMode ? "#FFFFFF" : "#000000"} />
          </TouchableOpacity>
          <TextInput
            style={[
              styles.newItemInput,
              isDarkMode ? styles.darkInput : styles.lightInput
            ]}
            placeholder="List item"
            placeholderTextColor="#FFFFFF"
            value={newItemText}
            onChangeText={setNewItemText}
            onSubmitEditing={addNewItem}
            multiline
          />
        </View>
      )}


      {/* Uncompleted items */}
      <ScrollView style={styles.itemsList} showsVerticalScrollIndicator={false}>
        {uncompletedItems.map(item => renderTickBoxItem(item))}
      </ScrollView>

      {/* Completed items dropdown */}
      {completedItems.length > 0 && (
        <View style={styles.completedSection}>
          <TouchableOpacity
            style={[
              styles.completedHeader,
              isDarkMode ? styles.darkHeader : styles.lightHeader
            ]}
            onPress={() => setShowCompleted(!showCompleted)}
          >
            <Ionicons
              name={showCompleted ? "chevron-down" : "chevron-forward"}
              size={16}
              color="#FFFFFF"
            />
            <Text style={[
              styles.completedHeaderText,
              { color: '#FFFFFF' }
            ]}>
              {completedItems.length} checked items
            </Text>
          </TouchableOpacity>

          {showCompleted && (
            <Animated.View style={styles.completedItems}>
              {completedItems.map(item => renderTickBoxItem(item, true))}
            </Animated.View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
  },
  darkContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  lightContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  addSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.4)',
  },
  addButton: {
    width: 24,
    height: 24,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 4,
  },
  darkAddButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  lightAddButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  newItemInput: {
    flex: 1,
    fontSize: 16,
    minHeight: 24,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  darkInput: {
    color: '#FFFFFF',
    backgroundColor: 'transparent',
  },
  lightInput: {
    color: '#000000',
    backgroundColor: 'transparent',
  },
  itemsList: {
    maxHeight: 300,
  },
  tickBoxItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 4,
    borderRadius: 6,
  },
  darkItem: {
    backgroundColor: 'transparent',
  },
  lightItem: {
    backgroundColor: 'transparent',
  },
  completedItem: {
    opacity: 0.7,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
    borderWidth: 2,
  },
  darkCheckbox: {
    borderColor: '#666666',
  },
  lightCheckbox: {
    borderColor: '#CCCCCC',
  },
  checkedBox: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  uncheckedBox: {
    backgroundColor: 'transparent',
  },
  itemTextContainer: {
    flex: 1,
    paddingVertical: 2,
  },
  itemText: {
    fontSize: 16,
    lineHeight: 20,
  },
  darkText: {
    color: '#FFFFFF',
  },
  lightText: {
    color: '#000000',
  },
  completedText: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  editInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8,
  },
  completedSection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.4)',
  },
  completedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  darkHeader: {
    backgroundColor: 'transparent',
  },
  lightHeader: {
    backgroundColor: 'transparent',
  },
  completedHeaderText: {
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500',
  },
  completedItems: {
    paddingTop: 8,
  },
});