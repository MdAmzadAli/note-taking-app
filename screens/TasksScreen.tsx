
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Modal
} from 'react-native';
import { Task, Profession } from '../types';
import { PROFESSION_CONFIGS } from '../constants/professions';
import { StorageService } from '../utils/storage';

interface TasksScreenProps {
  profession: Profession;
}

export const TasksScreen: React.FC<TasksScreenProps> = ({ profession }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('');
  
  const config = PROFESSION_CONFIGS[profession];

  const loadTasks = async () => {
    try {
      const allTasks = await StorageService.getTasks();
      const professionTasks = allTasks.filter(task => task.profession === profession);
      setTasks(professionTasks);
    } catch (error) {
      Alert.alert('Error', 'Failed to load tasks');
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const addTask = async () => {
    if (!newTaskTitle.trim()) {
      Alert.alert('Error', 'Please enter a task title');
      return;
    }

    const newTask: Task = {
      id: Date.now().toString(),
      title: newTaskTitle,
      reminderTime: newTaskTime ? new Date(Date.now() + 24 * 60 * 60 * 1000) : undefined,
      completed: false,
      profession
    };

    try {
      await StorageService.saveTask(newTask);
      setNewTaskTitle('');
      setNewTaskTime('');
      setIsModalVisible(false);
      loadTasks();
    } catch (error) {
      Alert.alert('Error', 'Failed to save task');
    }
  };

  const toggleTask = async (taskId: string) => {
    try {
      const allTasks = await StorageService.getTasks();
      const task = allTasks.find(t => t.id === taskId);
      if (task) {
        task.completed = !task.completed;
        await StorageService.saveTask(task);
        loadTasks();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update task');
    }
  };

  const renderTask = ({ item }: { item: Task }) => (
    <TouchableOpacity
      style={[styles.taskItem, { backgroundColor: config.colors.secondary }]}
      onPress={() => toggleTask(item.id)}
    >
      <View style={styles.taskContent}>
        <View style={styles.taskInfo}>
          <Text style={[
            styles.taskTitle,
            { 
              color: config.colors.text,
              textDecorationLine: item.completed ? 'line-through' : 'none',
              opacity: item.completed ? 0.6 : 1
            }
          ]}>
            {item.title}
          </Text>
          {item.reminderTime && (
            <Text style={styles.taskTime}>
              Reminder: {new Date(item.reminderTime).toLocaleTimeString()}
            </Text>
          )}
        </View>
        <View style={[
          styles.checkbox,
          { 
            backgroundColor: item.completed ? config.colors.primary : 'transparent',
            borderColor: config.colors.primary
          }
        ]}>
          {item.completed && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );

  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toLocaleDateString();
  };

  return (
    <View style={[styles.container, { backgroundColor: config.colors.background }]}>
      <View style={[styles.header, { backgroundColor: config.colors.primary }]}>
        <Text style={[styles.headerTitle, { color: config.colors.text }]}>
          Tomorrow's Tasks ({getTomorrowDate()})
        </Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setIsModalVisible(true)}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={tasks}
        renderItem={renderTask}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.tasksList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: config.colors.text }]}>
              No tasks for tomorrow yet. Add some tasks to get organized!
            </Text>
          </View>
        }
      />

      <Modal visible={isModalVisible} animationType="slide">
        <View style={[styles.modalContainer, { backgroundColor: config.colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: config.colors.primary }]}>
            <TouchableOpacity onPress={() => setIsModalVisible(false)}>
              <Text style={[styles.modalButton, { color: config.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: config.colors.text }]}>New Task</Text>
            <TouchableOpacity onPress={addTask}>
              <Text style={[styles.modalButton, { color: config.colors.text }]}>Add</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <TextInput
              style={[styles.taskInput, { 
                backgroundColor: config.colors.secondary,
                color: config.colors.text
              }]}
              placeholder="Task title"
              placeholderTextColor={config.colors.text + '80'}
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              multiline
            />

            <View style={styles.reminderSection}>
              <Text style={[styles.sectionTitle, { color: config.colors.text }]}>
                Reminder Time (Optional)
              </Text>
              <TextInput
                style={[styles.timeInput, { 
                  backgroundColor: config.colors.secondary,
                  color: config.colors.text
                }]}
                placeholder="HH:MM (e.g., 09:00)"
                placeholderTextColor={config.colors.text + '80'}
                value={newTaskTime}
                onChangeText={setNewTaskTime}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  addButtonText: {
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold'
  },
  tasksList: {
    padding: 16
  },
  taskItem: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2
  },
  taskContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  taskInfo: {
    flex: 1
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4
  },
  taskTime: {
    fontSize: 12,
    color: '#7F8C8D'
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12
  },
  checkmark: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold'
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.6,
    paddingHorizontal: 32
  },
  modalContainer: {
    flex: 1
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50
  },
  modalButton: {
    fontSize: 16,
    fontWeight: '600'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  modalContent: {
    flex: 1,
    padding: 16
  },
  taskInput: {
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 24
  },
  reminderSection: {
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8
  },
  timeInput: {
    padding: 12,
    borderRadius: 8,
    fontSize: 16
  }
});
