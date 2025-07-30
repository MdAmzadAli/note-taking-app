
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { IconSymbol } from './ui/IconSymbol';
import { WritingStyle } from '@/types';

interface WritingStyleSelectorProps {
  selectedStyle: WritingStyle;
  onStyleChange: (style: WritingStyle) => void;
}

const WRITING_STYLES = [
  {
    id: 'bullet' as WritingStyle,
    name: 'Bullet Points',
    icon: 'list.bullet',
    description: 'Organized bullet points',
  },
  {
    id: 'journal' as WritingStyle,
    name: 'Journal',
    icon: 'book',
    description: 'Date-stamped entries',
  },
  {
    id: 'cornell' as WritingStyle,
    name: 'Cornell Notes',
    icon: 'rectangle.split.3x1',
    description: 'Cue, notes, summary',
  },
  {
    id: 'mind_dump' as WritingStyle,
    name: 'Mind Dump',
    icon: 'brain',
    description: 'Freeform thoughts',
  },
  {
    id: 'checklist' as WritingStyle,
    name: 'Checklist',
    icon: 'checkmark.square',
    description: 'Task checklist',
  },
];

export default function WritingStyleSelector({ selectedStyle, onStyleChange }: WritingStyleSelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Writing Style</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollView}>
        {WRITING_STYLES.map((style) => (
          <TouchableOpacity
            key={style.id}
            style={[
              styles.styleButton,
              selectedStyle === style.id && styles.selectedStyleButton,
            ]}
            onPress={() => onStyleChange(style.id)}
          >
            <IconSymbol
              name={style.icon}
              size={20}
              color={selectedStyle === style.id ? '#FFFFFF' : '#6B7280'}
            />
            <Text
              style={[
                styles.styleName,
                selectedStyle === style.id && styles.selectedStyleName,
              ]}
            >
              {style.name}
            </Text>
            <Text
              style={[
                styles.styleDescription,
                selectedStyle === style.id && styles.selectedStyleDescription,
              ]}
            >
              {style.description}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
    paddingHorizontal: 16,
    fontFamily: 'Inter',
  },
  scrollView: {
    paddingLeft: 16,
  },
  styleButton: {
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 12,
    alignItems: 'center',
    minWidth: 100,
    maxWidth: 120,
  },
  selectedStyleButton: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  styleName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginTop: 6,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  selectedStyleName: {
    color: '#FFFFFF',
  },
  styleDescription: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  selectedStyleDescription: {
    color: '#E5E7EB',
  },
});
