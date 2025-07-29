
import Fuse from 'fuse.js';
import { Note, Profession } from '../types';

export class SearchService {
  static searchNotes(notes: Note[], query: string): Note[] {
    if (!query.trim()) return notes;

    const fuse = new Fuse(notes, {
      keys: [
        'title',
        'fields.Symptoms',
        'fields.Diagnosis',
        'fields.Prescription',
        'fields.Client Name',
        'fields.Case Summary',
        'fields.Action Items',
        'fields.Feature',
        'fields.Code Snippet',
        'fields.To-Do'
      ],
      threshold: 0.4,
      includeScore: true
    });

    const results = fuse.search(query);
    return results.map(result => result.item);
  }

  static groupNotesByProfession(notes: Note[]): Record<Profession, Note[]> {
    return notes.reduce((acc, note) => {
      if (!acc[note.profession]) {
        acc[note.profession] = [];
      }
      acc[note.profession].push(note);
      return acc;
    }, {} as Record<Profession, Note[]>);
  }
}
