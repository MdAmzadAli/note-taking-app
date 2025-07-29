
import { ProfessionConfig } from '../types';

export const PROFESSION_CONFIGS: Record<string, ProfessionConfig> = {
  doctor: {
    header: 'Patient Notes',
    fields: ['Symptoms', 'Diagnosis', 'Prescription'],
    colors: {
      primary: '#87CEEB',
      secondary: '#FFFFFF',
      background: '#F0F8FF',
      text: '#2C3E50'
    },
    icon: 'medical-services'
  },
  lawyer: {
    header: 'Case Notes',
    fields: ['Client Name', 'Case Summary', 'Action Items'],
    colors: {
      primary: '#696969',
      secondary: '#F5F5DC',
      background: '#FAFAFA',
      text: '#2F4F4F'
    },
    icon: 'gavel'
  },
  developer: {
    header: 'Dev Notes',
    fields: ['Feature', 'Code Snippet', 'To-Do'],
    colors: {
      primary: '#9370DB',
      secondary: '#000000',
      background: '#1E1E1E',
      text: '#FFFFFF'
    },
    icon: 'code'
  }
};
