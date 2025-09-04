
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import VoiceInput from '@/components/VoiceInput';
import { getExampleCommands } from '@/utils/voiceCommands';
import { getUserSettings } from '@/utils/storage';

interface VoiceCommandsScreenProps {
  onBack: () => void;
}

export default function VoiceCommandsScreen({ onBack }: VoiceCommandsScreenProps) {
  const [profession, setProfession] = useState('doctor');

  useEffect(() => {
    loadUserSettings();
  }, []);

  const loadUserSettings = async () => {
    try {
      const settings = await getUserSettings();
      setProfession(settings.profession);
    } catch (error) {
      console.error('Error loading user settings:', error);
    }
  };

  const commandCategories = [
    {
      title: 'Search Commands',
      commands: [
        'Search for patient notes',
        'Find tasks about project',
        'Look for reminders',
        'Show me notes about meeting'
      ]
    },
    {
      title: 'Create Note Commands',
      commands: [
        'Create note about morning meeting',
        'New note called shopping list',
        'Add note patient follow-up required',
        'Make note about client requirements'
      ]
    },
    {
      title: 'Set Reminder Commands',
      commands: [
        'Set reminder for doctor appointment tomorrow at 2pm',
        'Remind me to call John in 2 hours',
        'Create reminder for team meeting Friday at 10am',
        'Set reminder to review contract tomorrow'
      ]
    },
    {
      title: 'Create Task Commands',
      commands: [
        'Create task review contract due Friday',
        'New task finish presentation due tomorrow',
        'Add task call client due next week',
        'Make task update documentation due Monday'
      ]
    }
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <IconSymbol size={24} name="chevron.left" color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voice Commands</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.introSection}>
          <Text style={styles.introTitle}>How to Use Voice Commands</Text>
          <Text style={styles.introText}>
            Voice commands require AssemblyAI API key configuration in Settings. 
            Once configured, tap the microphone icon to start voice recognition. 
            Speak clearly and include the action you want to perform along with the relevant details.
          </Text>
        </View>

        <View style={styles.voiceInputSection}>
          <Text style={styles.sectionTitle}>Try Voice Commands</Text>
          <VoiceInput
            onCommandExecuted={(result) => {
              console.log('Voice command executed:', result);
            }}
            onSearchRequested={(query, results) => {
              console.log('Search requested:', query, results);
            }}
            style={styles.centeredVoiceInput}
          />
          <Text style={styles.voiceInputHint}>
            Tap the microphone above to test voice commands
          </Text>
        </View>

        {commandCategories.map((category, index) => (
          <View key={index} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{category.title}</Text>
            {category.commands.map((command, cmdIndex) => (
              <View key={cmdIndex} style={styles.commandItem}>
                <Text style={styles.commandBullet}>•</Text>
                <Text style={styles.commandText}>"{command}"</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.tipsSection}>
          <Text style={styles.sectionTitle}>Tips for Best Results</Text>
          
          <View style={styles.tipItem}>
            <Text style={styles.tipTitle}>Speak Clearly</Text>
            <Text style={styles.tipText}>
              Speak at a normal pace and volume in a quiet environment.
            </Text>
          </View>

          <View style={styles.tipItem}>
            <Text style={styles.tipTitle}>Be Specific</Text>
            <Text style={styles.tipText}>
              Include specific details like dates, times, and keywords for better accuracy.
            </Text>
          </View>

          <View style={styles.tipItem}>
            <Text style={styles.tipTitle}>Use Natural Language</Text>
            <Text style={styles.tipText}>
              You don't need to use exact phrases - the app understands natural speech patterns.
            </Text>
          </View>

          <View style={styles.tipItem}>
            <Text style={styles.tipTitle}>Check Permissions</Text>
            <Text style={styles.tipText}>
              Make sure your device allows microphone access for voice commands to work.
            </Text>
          </View>
        </View>

        <View style={styles.troubleshootingSection}>
          <Text style={styles.sectionTitle}>Troubleshooting</Text>
          
          <View style={styles.troubleItem}>
            <Text style={styles.troubleTitle}>Voice not recognized?</Text>
            <Text style={styles.troubleText}>
              • Check microphone permissions{'\n'}
              • Ensure you're in a quiet environment{'\n'}
              • Try speaking more slowly and clearly{'\n'}
              • Make sure your device's microphone is working
            </Text>
          </View>

          <View style={styles.troubleItem}>
            <Text style={styles.troubleTitle}>Command not understood?</Text>
            <Text style={styles.troubleText}>
              • Use action words like "create", "set", "search", "find"{'\n'}
              • Be specific about what you want to create or find{'\n'}
              • Try rephrasing your command{'\n'}
              • Refer to the example commands above
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Inter',
    textAlign: 'center',
    marginRight: 40, // Compensate for back button
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  introSection: {
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  introTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter',
    marginBottom: 12,
  },
  introText: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter',
    lineHeight: 24,
  },
  voiceInputSection: {
    paddingVertical: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter',
    marginBottom: 16,
  },
  centeredVoiceInput: {
    marginVertical: 16,
  },
  voiceInputHint: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
    textAlign: 'center',
    marginTop: 8,
  },
  categorySection: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter',
    marginBottom: 16,
  },
  commandItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  commandBullet: {
    fontSize: 16,
    color: '#000000',
    fontFamily: 'Inter',
    marginRight: 8,
    marginTop: 2,
  },
  commandText: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
    fontFamily: 'Inter',
    lineHeight: 24,
  },
  tipsSection: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tipItem: {
    marginBottom: 16,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter',
    marginBottom: 4,
  },
  tipText: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter',
    lineHeight: 24,
  },
  troubleshootingSection: {
    paddingVertical: 20,
    paddingBottom: 40,
  },
  troubleItem: {
    marginBottom: 20,
  },
  troubleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter',
    marginBottom: 8,
  },
  troubleText: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter',
    lineHeight: 24,
  },
});
