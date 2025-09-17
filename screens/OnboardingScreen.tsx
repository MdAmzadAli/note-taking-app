
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { PROFESSIONS, ProfessionType } from '@/constants/professions';
import { saveSelectedProfession, saveUserSettings } from '@/utils/storage';

const { width } = Dimensions.get('window');

export default function OnboardingScreen() {
  const [selectedProfession, setSelectedProfession] = useState<ProfessionType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleProfessionSelect = (profession: ProfessionType) => {
    setSelectedProfession(profession);
  };

  const handleContinue = async () => {
    if (!selectedProfession) {
      Alert.alert('Selection Required', 'Please select your profession to continue.');
      return;
    }

    setIsLoading(true);
    try {
      // Save selected profession and initial settings
      await saveSelectedProfession(selectedProfession);
      await saveUserSettings({
        profession: selectedProfession,
        viewMode: 'paragraph',
        isOnboardingComplete: true,
      });

      // Navigate to main app
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error saving profession:', error);
      Alert.alert('Error', 'Failed to save your selection. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to Notes App</Text>
        <Text style={styles.subtitle}>
          Choose your profession to get started with personalized templates
        </Text>

        <View style={styles.professionsContainer}>
          {Object.entries(PROFESSIONS).map(([key, config]) => {
            const professionKey = key as ProfessionType;
            const isSelected = selectedProfession === professionKey;
            
            return (
              <TouchableOpacity
                key={professionKey}
                style={[
                  styles.professionCard,
                  { backgroundColor: config.colors.primary },
                  isSelected && { 
                    borderColor: config.colors.secondary,
                    borderWidth: 3,
                    transform: [{ scale: 1.05 }],
                  }
                ]}
                onPress={() => handleProfessionSelect(professionKey)}
              >
                <Text style={styles.professionIcon}>{config.icon}</Text>
                <Text style={[styles.professionName, { color: config.colors.text }]}>
                  {config.name}
                </Text>
                <Text style={[styles.professionDescription, { color: config.colors.text }]}>
                  {config.header}
                </Text>
                <View style={styles.fieldsPreview}>
                  {config.fields.slice(0, 3).map((field, index) => (
                    <Text key={index} style={[styles.fieldName, { color: config.colors.text }]}>
                      • {field.name}
                    </Text>
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[
            styles.continueButton,
            { 
              backgroundColor: selectedProfession 
                ? PROFESSIONS[selectedProfession].colors.secondary 
                : '#ccc',
              opacity: selectedProfession ? 1 : 0.6,
            }
          ]}
          onPress={handleContinue}
          disabled={!selectedProfession || isLoading}
        >
          <Text style={styles.continueButtonText}>
            {isLoading ? 'Setting up...' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    color: '#666',
    lineHeight: 22,
  },
  professionsContainer: {
    marginBottom: 40,
  },
  professionCard: {
    padding: 20,
    marginBottom: 16,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 160,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  professionIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  professionName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  professionDescription: {
    fontSize: 14,
    marginBottom: 12,
    fontWeight: '600',
  },
  fieldsPreview: {
    alignItems: 'center',
  },
  fieldName: {
    fontSize: 12,
    marginBottom: 2,
    opacity: 0.8,
  },
  continueButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  continueButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});
