import React from 'react';
import AppLayout from '@/app/AppLayout';
import TasksScreen from '@/screens/TasksScreen';

export default function TasksTab() {
  return (
    <AppLayout>
      <TasksScreen />
    </AppLayout>
  );
}