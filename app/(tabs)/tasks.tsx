import React from 'react';
import AppLayout from '@/components/AppLayout';
import TasksScreen from '@/screens/TasksScreen';

export default function TasksTab() {
  return (
    <AppLayout>
      <TasksScreen />
    </AppLayout>
  );
}