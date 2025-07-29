
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { saveSelectedProfession } from '@/utils/storage';
import { PROFESSIONS, ProfessionType } from '@/constants/professions';

export default function OnboardingScreen() {
  const [selectedProfession, setSelectedProfession] = useState<ProfessionType | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleProfessionSelect = (profession: ProfessionType) => {
    setSelectedProfession(profession);
  };

  const handleContinue = async () => {
    if (!selectedProfession) {
      Alert.alert('Please select a profession', 'Choose your profession to continue');
      return;
    }

    setIsLoading(true);
    try {
      await saveSelectedProfession(selectedProfession);
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error saving profession:', error);
      Alert.alert('Error', 'Failed to save your selection. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to NotePro</Text>
        <Text style={styles.subtitle}>Choose your profession to get started</Text>
        
        <View style={styles.professionsContainer}>
          {Object.entries(PROFESSIONS).map(([key, profession]) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.professionCard,
                { backgroundColor: profession.colors.primary },
                selectedProfession === key && styles.selectedCard,
              ]}
              onPress={() => handleProfessionSelect(key as ProfessionType)}
              activeOpacity={0.7}
            >
              <Text style={styles.professionIcon}>{profession.icon}</Text>
              <Text style={[styles.professionTitle, { color: profession.colors.text }]}>
                {profession.name}
              </Text>
              <Text style={[styles.professionDescription, { color: profession.colors.text }]}>
                {profession.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.continueButton,
            !selectedProfession && styles.disabledButton,
          ]}
          onPress={handleContinue}
          disabled={!selectedProfession || isLoading}
        >
          <Text style={styles.continueButtonText}>
            {isLoading ? 'Setting up...' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
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
  },
  professionsContainer: {
    gap: 16,
    marginBottom: 40,
  },
  professionCard: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedCard: {
    transform: [{ scale: 1.02 }],
    shadowOpacity: 0.2,
    elevation: 5,
  },
  professionIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  professionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  professionDescription: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
  },
  continueButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
