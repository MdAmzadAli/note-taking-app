
export type ProfessionType = 'doctor' | 'lawyer' | 'developer';

export interface ProfessionConfig {
  name: string;
  description: string;
  icon: string;
  header: string;
  colors: {
    primary: string;
    secondary: string;
    text: string;
    background: string;
  };
  fields: {
    name: string;
    placeholder: string;
    type: 'text' | 'multiline';
  }[];
}

export const PROFESSIONS: Record<ProfessionType, ProfessionConfig> = {
  doctor: {
    name: 'Doctor',
    description: 'Medical professional',
    icon: '🩺',
    header: 'Patient Notes',
    colors: {
      primary: '#E3F2FD',
      secondary: '#2196F3',
      text: '#1565C0',
      background: '#FAFAFA',
    },
    fields: [
      { name: 'Patient Name', placeholder: 'Enter patient name...', type: 'text' },
      { name: 'Symptoms', placeholder: 'Describe symptoms...', type: 'multiline' },
      { name: 'Diagnosis', placeholder: 'Enter diagnosis...', type: 'multiline' },
      { name: 'Prescription', placeholder: 'Enter prescription details...', type: 'multiline' },
    ],
  },
  lawyer: {
    name: 'Lawyer',
    description: 'Legal professional',
    icon: '⚖️',
    header: 'Case Notes',
    colors: {
      primary: '#F5F5F5',
      secondary: '#424242',
      text: '#212121',
      background: '#FAFAFA',
    },
    fields: [
      { name: 'Client Name', placeholder: 'Enter client name...', type: 'text' },
      { name: 'Case Summary', placeholder: 'Summarize the case...', type: 'multiline' },
      { name: 'Action Items', placeholder: 'List action items...', type: 'multiline' },
      { name: 'Legal References', placeholder: 'Relevant laws/cases...', type: 'multiline' },
    ],
  },
  developer: {
    name: 'Developer',
    description: 'Software developer',
    icon: '💻',
    header: 'Dev Notes',
    colors: {
      primary: '#F3E5F5',
      secondary: '#9C27B0',
      text: '#4A148C',
      background: '#FAFAFA',
    },
    fields: [
      { name: 'Feature', placeholder: 'Feature description...', type: 'text' },
      { name: 'Code Snippet', placeholder: 'Enter code...', type: 'multiline' },
      { name: 'To-Do', placeholder: 'List tasks...', type: 'multiline' },
      { name: 'Notes', placeholder: 'Additional notes...', type: 'multiline' },
    ],
  },
};
