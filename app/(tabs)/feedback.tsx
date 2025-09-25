import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import AppLayout from '@/app/AppLayout';
import FeedbackModal from '@/components/FeedbackModal';

export default function FeedbackTab() {
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  // Auto-open modal when tab is accessed
  useEffect(() => {
    setShowFeedbackModal(true);
  }, []);

  const handleModalClose = () => {
    setShowFeedbackModal(false);
    // Since this tab is only for the modal, we don't need additional content
  };

  return (
    <AppLayout>
      <View style={styles.container}>
        <FeedbackModal
          visible={showFeedbackModal}
          onClose={handleModalClose}
        />
      </View>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
});