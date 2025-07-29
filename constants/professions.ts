
export type ProfessionType = 'doctor' | 'lawyer' | 'developer';

export interface FieldConfig {
  name: string;
  placeholder: string;
  type: 'text' | 'multiline';
  required?: boolean;
}

export interface ProfessionConfig {
  name: string;
  icon: string;
  header: string;
  fields: FieldConfig[];
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
  };
}

export const PROFESSIONS: Record<ProfessionType, ProfessionConfig> = {
  doctor: {
    name: 'Doctor',
    icon: '🩺',
    header: 'Patient Notes',
    fields: [
      { name: 'Patient Name', placeholder: 'Enter patient name', type: 'text', required: true },
      { name: 'Symptoms', placeholder: 'Describe symptoms', type: 'multiline' },
      { name: 'Diagnosis', placeholder: 'Enter diagnosis', type: 'multiline' },
      { name: 'Prescription', placeholder: 'Enter prescription details', type: 'multiline' },
    ],
    colors: {
      primary: '#E3F2FD',
      secondary: '#2196F3',
      background: '#F8FBFF',
      text: '#1565C0',
    },
  },
  lawyer: {
    name: 'Lawyer',
    icon: '⚖️',
    header: 'Case Notes',
    fields: [
      { name: 'Client Name', placeholder: 'Enter client name', type: 'text', required: true },
      { name: 'Case Summary', placeholder: 'Describe the case', type: 'multiline' },
      { name: 'Action Items', placeholder: 'List required actions', type: 'multiline' },
      { name: 'Legal References', placeholder: 'Relevant laws/cases', type: 'multiline' },
    ],
    colors: {
      primary: '#F5F5DC',
      secondary: '#5D4037',
      background: '#FAFAFA',
      text: '#3E2723',
    },
  },
  developer: {
    name: 'Developer',
    icon: '💻',
    header: 'Dev Notes',
    fields: [
      { name: 'Feature', placeholder: 'Feature or task name', type: 'text', required: true },
      { name: 'Code Snippet', placeholder: 'Code examples or snippets', type: 'multiline' },
      { name: 'To-Do', placeholder: 'Tasks to complete', type: 'multiline' },
      { name: 'Notes', placeholder: 'Additional notes', type: 'multiline' },
    ],
    colors: {
      primary: '#F3E5F5',
      secondary: '#7B1FA2',
      background: '#FAFAFA',
      text: '#4A148C',
    },
  },
};
