
import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
} from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Task } from '@/types';

interface TaskCardProps {
  task: Task;
  onPress: () => void;
  onComplete: (task: Task) => void;
  onDelete: (task: Task) => void;
  showCompletedTasks?: boolean;
  celebrationTaskId?: string | null;
  undoTasks?: Set<string>;
  temporarySuccessMessages?: Set<string>;
  taskCategories?: { id: string; name: string; createdAt: string }[];
  selectedCategoryId?: string | null;
  onUndo?: (taskId: string) => void;
}

export default function TaskCard({
  task,
  onPress,
  onComplete,
  onDelete,
  showCompletedTasks = false,
  celebrationTaskId = null,
  undoTasks = new Set(),
  temporarySuccessMessages = new Set(),
  taskCategories = [],
  selectedCategoryId = null,
  onUndo,
}: TaskCardProps) {
  // Check if task is overdue
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const taskDate = new Date(task.scheduledDate || task.createdAt);
  const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
  const isOverdue = taskDate < now && !task.isCompleted;

  // Check if task was completed after being overdue (for completed tasks view)
  const wasOverdueAndCompleted = task.isCompleted && taskDate < now;

  // Show temporary success message if this task has one
  if (temporarySuccessMessages.has(task.id)) {
    console.log('[UNDO] Rendering temporary success message for task:', task.id);
    return (
      <View style={styles.temporarySuccessContainer}>
        <View style={styles.temporarySuccessContent}>
          <Text style={styles.temporarySuccessEmoji}>✅</Text>
          <Text style={styles.temporarySuccessText}>Task successfully completed!</Text>
        </View>
      </View>
    );
  }

  // Show undo interface if this task has undo active
  if (undoTasks.has(task.id)) {
    console.log('[UNDO] Rendering undo interface for task:', task.id, 'task completed:', task.isCompleted, 'in undoTasks:', undoTasks.has(task.id));
    return (
      <View style={styles.undoContainer}>
        <View style={styles.undoContent}>
          <Text style={styles.undoEmoji}>✅</Text>
          <Text style={styles.undoText}>Task completed!</Text>
        </View>
        <TouchableOpacity
          style={styles.undoButton}
          onPress={() => {
            console.log('[UNDO] Undo button pressed for task:', task.id);
            onUndo?.(task.id);
          }}
        >
          <Text style={styles.undoButtonText}>Undo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  console.log('[UNDO] Rendering normal task item for:', task.id, 'in undoTasks:', undoTasks.has(task.id));

  return (
    <TouchableOpacity
      style={[
        styles.taskItem,
        task.isCompleted && styles.completedTask,
        celebrationTaskId === task.id && styles.celebrationTask,
        task.theme && { backgroundColor: task.theme, borderColor: '#FFFFFF' }
      ]}
      onPress={() => {
        if (task.isCompleted) {
          // Show a brief alert or feedback that completed tasks cannot be edited
          Alert.alert(
            'Task Completed', 
            'This task has been completed and cannot be modified. You can delete it if needed.',
            [{ text: 'OK', style: 'default' }]
          );
          return;
        }
        if (showCompletedTasks && isOverdue) {
          // Show alert that overdue tasks in completed view cannot be edited
          Alert.alert(
            'Task Overdue', 
            'This overdue task is in completed view and cannot be modified. You can delete it if needed.',
            [{ text: 'OK', style: 'default' }]
          );
          return;
        }
        onPress();
      }}
    >
      <View style={styles.taskHeader}>
        {/* Hide checkbox in completed tasks view */}
        {!showCompletedTasks && (
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={(e) => {
              e.stopPropagation();
              // Prevent status changes for overdue tasks in completed view
              if (showCompletedTasks && isOverdue) {
                Alert.alert(
                  'Task Overdue', 
                  'This overdue task is in completed view and its status cannot be changed.',
                  [{ text: 'OK', style: 'default' }]
                );
                return;
              }
              // Use onComplete which now handles undo logic internally
              onComplete(task);
            }}
          >
            <View style={[
              styles.checkbox,
              task.isCompleted && styles.checkboxCompleted
            ]}>
              {task.isCompleted && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.taskInfo}>
          <Text style={[
            styles.taskTitle,
            task.isCompleted && styles.completedText,
            task.fontStyle && { fontFamily: task.fontStyle }
          ]}>
            {task.title}
          </Text>

          {task.description && (
            <Text style={[
              styles.taskDescription,
              task.isCompleted && styles.completedText,
              task.fontStyle && { fontFamily: task.fontStyle }
            ]}>
              {task.description}
            </Text>
          )}

          <View style={styles.taskMeta}>
            <View style={styles.taskMetaLeft}>
              {task.scheduledDate && (
                <Text style={[
                  styles.taskDate,
                  task.fontStyle && { fontFamily: task.fontStyle }
                ]}>
                  📅 {new Date(task.scheduledDate).toLocaleDateString()}
                </Text>
              )}

              {task.reminderTime && !task.isCompleted && (
                <Text style={[
                  styles.reminderTime,
                  task.fontStyle && { fontFamily: task.fontStyle }
                ]}>
                  🔔 {new Date(task.reminderTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              )}

              {!selectedCategoryId && task.categoryId && (
                <Text style={[
                  styles.taskCategory,
                  task.fontStyle && { fontFamily: task.fontStyle }
                ]}>
                  🏷️ {taskCategories.find(cat => cat.id === task.categoryId)?.name || 'Unknown Category'}
                </Text>
              )}
            </View>

            {/* Show overdue text if task is overdue */}
            {isOverdue && !task.isCompleted && (
              <Text style={[
                styles.overdueText,
                task.fontStyle && { fontFamily: task.fontStyle }
              ]}>
                Overdue
              </Text>
            )}

            {/* Show "Overdue" text if task was completed after being overdue (only in completed tasks view) */}
            {showCompletedTasks && wasOverdueAndCompleted && (
              <Text style={[
                styles.overdueText,
                task.fontStyle && { fontFamily: task.fontStyle }
              ]}>
                Overdue
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity 
          style={styles.deleteIconButton}
          onPress={(e) => {
            e.stopPropagation();
            onDelete(task);
          }}
        >
          <IconSymbol size={18} name="trash" color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {celebrationTaskId === task.id && (
        <Animated.View style={styles.celebrationOverlay}>
          <Text style={styles.celebrationText}>Task has rejoined the party! 🎉</Text>
        </Animated.View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  taskItem: {
    backgroundColor: '#333333',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 0,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    position: 'relative',
  },
  celebrationTask: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
    transform: [{ scale: 1.02 }],
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    marginRight: 12,
    lineHeight: 25.6,
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  checkboxContainer: {
    marginRight: 12,
    padding: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCompleted: {
    backgroundColor: '#00FF7F',
    borderColor: '#00FF7F',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  taskInfo: {
    flex: 1,
  },
  taskDescription: {
    fontSize: 16,
    marginBottom: 8,
    lineHeight: 25.6,
    fontWeight: '400',
    color: '#D1D5DB',
    fontFamily: 'Inter',
  },
  taskMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  taskMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  taskDate: {
    fontSize: 13,
    color: '#D1D5DB',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  reminderTime: {
    fontSize: 13,
    color: '#D1D5DB',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  taskCategory: {
    fontSize: 13,
    color: '#D1D5DB',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  deleteIconButton: {
    padding: 4,
    borderRadius: 4,
  },
  overdueText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'Inter',
    fontWeight: '500',
    marginLeft: 8,
  },
  completedTask: {
    opacity: 0.7,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: '#FFFFFF',
    opacity: 1,
  },
  undoContainer: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#059669',
    minHeight: 80,
  },
  undoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  undoEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  undoText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'Inter',
    flex: 1,
  },
  undoButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  undoButtonText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  temporarySuccessContainer: {
    backgroundColor: '#059669',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#047857',
    minHeight: 80,
  },
  temporarySuccessContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  temporarySuccessEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  temporarySuccessText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  celebrationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(16, 185, 129, 0.95)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 10,
  },
  celebrationText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'Inter',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});
