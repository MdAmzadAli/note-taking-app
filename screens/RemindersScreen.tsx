
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert
} from 'react-native';
import { Reminder, Profession } from '../types';
import { PROFESSION_CONFIGS } from '../constants/professions';
import { StorageService } from '../utils/storage';
import { ReminderModal } from '../components/ReminderModal';
import { NotificationService } from '../utils/notifications';

interface RemindersScreenProps {
  profession: Profession;
}

export const RemindersScreen: React.FC<RemindersScreenProps> = ({ profession }) => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  
  const config = PROFESSION_CONFIGS[profession];

  const loadReminders = async () => {
    try {
      const allReminders = await StorageService.getReminders();
      const professionReminders = allReminders.filter(reminder => reminder.profession === profession);
      setReminders(professionReminders);
    } catch (error) {
      Alert.alert('Error', 'Failed to load reminders');
    }
  };

  useEffect(() => {
    loadReminders();
  }, []);

  const addReminder = async (reminder: Reminder) => {
    try {
      reminder.profession = profession;
      await StorageService.saveReminder(reminder);
      await NotificationService.scheduleReminder(reminder);
      loadReminders();
    } catch (error) {
      Alert.alert('Error', 'Failed to save reminder');
    }
  };

  const toggleReminder = async (reminderId: string) => {
    try {
      const allReminders = await StorageService.getReminders();
      const reminder = allReminders.find(r => r.id === reminderId);
      if (reminder) {
        reminder.completed = !reminder.completed;
        await StorageService.saveReminder(reminder);
        loadReminders();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update reminder');
    }
  };

  const renderReminder = ({ item }: { item: Reminder }) => (
    <TouchableOpacity
      style={[styles.reminderItem, { backgroundColor: config.colors.secondary }]}
      onPress={() => toggleReminder(item.id)}
    >
      <View style={styles.reminderContent}>
        <View style={styles.reminderInfo}>
          <Text style={[
            styles.reminderTitle,
            { 
              color: config.colors.text,
              textDecorationLine: item.completed ? 'line-through' : 'none',
              opacity: item.completed ? 0.6 : 1
            }
          ]}>
            {item.title}
          </Text>
          <Text style={styles.reminderTime}>
            {new Date(item.time).toLocaleString()}
          </Text>
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

  return (
    <View style={[styles.container, { backgroundColor: config.colors.background }]}>
      <View style={[styles.header, { backgroundColor: config.colors.primary }]}>
        <Text style={[styles.headerTitle, { color: config.colors.text }]}>
          Reminders
        </Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setIsModalVisible(true)}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={reminders}
        renderItem={renderReminder}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.remindersList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: config.colors.text }]}>
              No reminders yet. Add some reminders to stay organized!
            </Text>
          </View>
        }
      />

      <ReminderModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSave={addReminder}
        config={config}
      />
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
    fontSize: 24,
    fontWeight: 'bold'
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
  remindersList: {
    padding: 16
  },
  reminderItem: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2
  },
  reminderContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  reminderInfo: {
    flex: 1
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4
  },
  reminderTime: {
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
  }
});
