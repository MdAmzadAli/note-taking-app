
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert
} from 'react-native';
import { Profession } from '../types';
import { PROFESSION_CONFIGS } from '../constants/professions';
import { StorageService } from '../utils/storage';

interface OnboardingScreenProps {
  onComplete: (profession: Profession) => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const handleProfessionSelect = async (profession: Profession) => {
    try {
      const settings = await StorageService.getSettings();
      const updatedSettings = {
        ...settings,
        profession,
        hasCompletedOnboarding: true
      };
      await StorageService.saveSettings(updatedSettings);
      onComplete(profession);
    } catch (error) {
      Alert.alert('Error', 'Failed to save profession selection');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to ProfNotes</Text>
        <Text style={styles.subtitle}>Choose your profession to get started</Text>
        
        <View style={styles.professionsContainer}>
          {Object.entries(PROFESSION_CONFIGS).map(([key, config]) => (
            <TouchableOpacity
              key={key}
              style={[styles.professionButton, { backgroundColor: config.colors.primary }]}
              onPress={() => handleProfessionSelect(key as Profession)}
            >
              <Text style={[styles.professionText, { color: config.colors.text }]}>
                {config.header}
              </Text>
              <Text style={[styles.professionSubtext, { color: config.colors.text }]}>
                {config.fields.join(' • ')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA'
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center'
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#2C3E50'
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    color: '#7F8C8D'
  },
  professionsContainer: {
    gap: 16
  },
  professionButton: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center'
  },
  professionText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8
  },
  professionSubtext: {
    fontSize: 14,
    opacity: 0.8
  }
});
