export type ProfessionType = 'doctor' | 'lawyer' | 'developer';

export interface FieldConfig {
  name: string;
  placeholder: string;
  type: 'text' | 'multiline';
  required?: boolean;
}

export interface ProfessionConfig {
  id: ProfessionType;
  name: string;
  icon: string;
  description: string;
  header: string;
  fields: FieldConfig[];
  templates: Array<{
    name: string;
    fields: Array<{
      name: string;
      placeholder: string;
      type: 'text' | 'number' | 'multiline' | 'date';
    }>;
  }>;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
  };
}

export const PROFESSIONS: Record<ProfessionType, ProfessionConfig> = {
  doctor: {
    id: 'doctor',
    name: 'Doctor',
    icon: '🩺',
    description: 'Medical professional with patient care focus',
    header: 'Patient Notes',
    fields: [
      { name: 'Patient Name', placeholder: 'Enter patient name', type: 'text', required: true },
      { name: 'Symptoms', placeholder: 'Describe symptoms', type: 'multiline' },
      { name: 'Diagnosis', placeholder: 'Enter diagnosis', type: 'multiline' },
      { name: 'Prescription', placeholder: 'Enter prescription details', type: 'multiline' },
    ],
    templates: [
      {
        name: 'Patient Note',
        fields: [
          { name: 'Patient Name', placeholder: 'Enter patient name', type: 'text' },
          { name: 'Age', placeholder: 'Patient age', type: 'number' },
          { name: 'Chief Complaint', placeholder: 'Primary concern', type: 'text' },
          { name: 'History', placeholder: 'Medical history details', type: 'multiline' },
          { name: 'Examination', placeholder: 'Physical examination findings', type: 'multiline' },
          { name: 'Diagnosis', placeholder: 'Provisional diagnosis', type: 'text' },
          { name: 'Treatment Plan', placeholder: 'Recommended treatment', type: 'multiline' },
        ],
      },
      {
        name: 'Prescription',
        fields: [
          { name: 'Patient Name', placeholder: 'Enter patient name', type: 'text' },
          { name: 'Medication', placeholder: 'Medication name', type: 'text' },
          { name: 'Dosage', placeholder: 'Dosage instructions', type: 'text' },
          { name: 'Duration', placeholder: 'Treatment duration', type: 'text' },
          { name: 'Instructions', placeholder: 'Special instructions', type: 'multiline' },
        ],
      },
    ],
    colors: {
      primary: '#E3F2FD',
      secondary: '#1976D2',
      background: '#FAFAFA',
      text: '#0D47A1',
    },
  },
  lawyer: {
    id: 'lawyer',
    name: 'Lawyer',
    icon: '⚖️',
    description: 'Legal professional handling cases and clients',
    header: 'Case Notes',
    fields: [
      { name: 'Client Name', placeholder: 'Enter client name', type: 'text', required: true },
      { name: 'Case Summary', placeholder: 'Describe the case', type: 'multiline' },
      { name: 'Action Items', placeholder: 'List required actions', type: 'multiline' },
      { name: 'Legal References', placeholder: 'Relevant laws/cases', type: 'multiline' },
    ],
    templates: [
      {
        name: 'Client Brief',
        fields: [
          { name: 'Client Name', placeholder: 'Enter client name', type: 'text' },
          { name: 'Case Type', placeholder: 'Type of legal case', type: 'text' },
          { name: 'Date Filed', placeholder: 'Case filing date', type: 'date' },
          { name: 'Case Summary', placeholder: 'Brief case description', type: 'multiline' },
          { name: 'Key Facts', placeholder: 'Important case facts', type: 'multiline' },
          { name: 'Next Actions', placeholder: 'Upcoming legal actions', type: 'multiline' },
        ],
      },
      {
        name: 'Court Hearing',
        fields: [
          { name: 'Case Number', placeholder: 'Enter case number', type: 'text' },
          { name: 'Hearing Date', placeholder: 'Date of hearing', type: 'date' },
          { name: 'Judge', placeholder: 'Presiding judge', type: 'text' },
          { name: 'Outcome', placeholder: 'Hearing result', type: 'multiline' },
          { name: 'Follow-up', placeholder: 'Required follow-up actions', type: 'multiline' },
        ],
      },
    ],
    colors: {
      primary: '#FFF3E0',
      secondary: '#F57C00',
      background: '#FAFAFA',
      text: '#E65100',
    },
  },
  developer: {
    id: 'developer',
    name: 'Developer',
    icon: '💻',
    description: 'Software developer working on technical projects',
    header: 'Dev Notes',
    fields: [
      { name: 'Feature', placeholder: 'Feature or task name', type: 'text', required: true },
      { name: 'Code Snippet', placeholder: 'Code examples or snippets', type: 'multiline' },
      { name: 'To-Do', placeholder: 'Tasks to complete', type: 'multiline' },
      { name: 'Notes', placeholder: 'Additional notes', type: 'multiline' },
    ],
    templates: [
      {
        name: 'Bug Report',
        fields: [
          { name: 'Bug Title', placeholder: 'Brief bug description', type: 'text' },
          { name: 'Priority', placeholder: 'High/Medium/Low', type: 'text' },
          { name: 'Steps to Reproduce', placeholder: 'How to reproduce the bug', type: 'multiline' },
          { name: 'Expected Behavior', placeholder: 'What should happen', type: 'multiline' },
          { name: 'Actual Behavior', placeholder: 'What actually happens', type: 'multiline' },
          { name: 'Environment', placeholder: 'OS, browser, version', type: 'text' },
        ],
      },
      {
        name: 'Feature Planning',
        fields: [
          { name: 'Feature Name', placeholder: 'Feature title', type: 'text' },
          { name: 'Requirements', placeholder: 'Feature requirements', type: 'multiline' },
          { name: 'Technical Approach', placeholder: 'Implementation plan', type: 'multiline' },
          { name: 'Timeline', placeholder: 'Estimated timeline', type: 'text' },
          { name: 'Dependencies', placeholder: 'Required dependencies', type: 'multiline' },
        ],
      },
    ],
    colors: {
      primary: '#F3E5F5',
      secondary: '#7B1FA2',
      background: '#FAFAFA',
      text: '#4A148C',
    },
  },
};

export const getProfessionConfig = (profession: ProfessionType): ProfessionConfig => {
  return PROFESSIONS[profession];
};

export const getAllProfessions = (): ProfessionConfig[] => {
  return Object.values(PROFESSIONS);
};