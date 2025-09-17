import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface MediaAttachmentModalProps {
  visible: boolean;
  onClose: () => void;
  onTakePhoto: () => void;
  onAddImage: () => void;
  onDrawing: () => void;
  onRecording: () => void;
  onTickBoxes: () => void;
}

export default function MediaAttachmentModal({
  visible,
  onClose,
  onTakePhoto,
  onAddImage,
  onDrawing,
  onRecording,
  onTickBoxes,
}: MediaAttachmentModalProps) {
  const slideAnim = React.useRef(new Animated.Value(350)).current;
  const [isAnimationComplete, setIsAnimationComplete] = React.useState(false);
// sjdifsid
  React.useEffect(() => {
    if (visible) {
      setIsAnimationComplete(false);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start((finished) => {
        if (finished) {
          setIsAnimationComplete(true);
        }
      });
    } else {
      setIsAnimationComplete(false);
      Animated.timing(slideAnim, {
        toValue: 350,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const handleOptionPress = React.useCallback((action: () => void) => {
    console.log('MediaAttachmentModal handleOptionPress called');
    
    // Close modal immediately
    onClose();
    
    // Execute action with a tiny delay to ensure modal closes first
    setTimeout(() => {
      action();
    }, 50);
  }, [onClose]);

  const options = [
    {
      icon: 'camera',
      label: 'Take photo',
      action: onTakePhoto,
    },
    {
      icon: 'image',
      label: 'Add image',
      action: onAddImage,
    },
    {
      icon: 'mic',
      label: 'Recording',
      action: onRecording,
    },
    {
      icon: 'checkbox',
      label: 'Tick boxes',
      action: onTickBoxes,
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.modalContainer,
                {
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <View style={styles.handle} />
              
              <View style={styles.optionsContainer}>
                {options.map((option, index) => (
                  <TouchableOpacity
                    key={option.label}
                    style={[
                      styles.option,
                      !isAnimationComplete && styles.optionDisabled
                    ]}
                    onPress={() => {
                      if (isAnimationComplete) {
                        handleOptionPress(option.action);
                      }
                    }}
                    activeOpacity={isAnimationComplete ? 0.7 : 1}
                    disabled={!isAnimationComplete}
                  >
                    <View style={[
                      styles.iconContainer,
                      !isAnimationComplete && styles.iconContainerDisabled
                    ]}>
                      <Ionicons 
                        name={option.icon as any} 
                        size={24} 
                        color={isAnimationComplete ? "#FFFFFF" : "#888888"} 
                      />
                    </View>
                    <Text style={[
                      styles.optionLabel,
                      !isAnimationComplete && styles.optionLabelDisabled
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#2C2C2C',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#666666',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  optionsContainer: {
    paddingHorizontal: 20,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  optionDisabled: {
    opacity: 0.6,
  },
  iconContainerDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  optionLabelDisabled: {
    color: '#888888',
  },
});