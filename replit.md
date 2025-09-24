# Professional Notes App - Project Memory

## Project Overview
This is a React Native Expo note-taking app with features including:
- Note creation and editing with rich content
- Category management 
- Deleted notes section
- Habit tracking
- Task management
- Professional templates
- Expert chat features with file upload capabilities

## User's Strict Development Rules

### 1. Native Module Restrictions
- **NO changes to native modules** - no installation/deletion of native modules
- User is working with Expo dev client - must respect this constraint
- Only work with existing JavaScript/TypeScript code

### 2. Backend Restrictions  
- **DO NOT run the backend** - focus only on frontend files that need changes
- Backend exists in `backend_python/` but should be left untouched

### 3. Scope Limitations
- **DO NOT change any other code, layout, or structure** beyond what's explicitly requested
- Focus strictly on the given requirements only
- No additional features or improvements unless asked

## Recent Changes (September 2025)

### Expert Chat Summary Timeout & Retry System
**Date**: September 24, 2025
**Changes Made**:
1. **Enhanced workspace mode summary handling**:
   - File: `components/expert/ChatInterface.tsx`
   - Workspace dropdown now shows individual file status (summary ready, loading, timed out)
   - Added individual retry buttons for specific files that failed in workspace mode
   - Enhanced main summary display to handle partial summary states properly
   - Shows count of ready summaries vs total files in workspace mode

2. **Timeout and retry functionality**:
   - Implemented 5-second timeout for single file mode, 20-second timeout for workspace mode
   - Added retry buttons that appear when summaries timeout with proper error messaging
   - Individual file retry capability in workspace mode for specific failed files
   - File: `services/ragService.ts` - Added requestSummary function for manual retry

### Deleted Notes UI Improvements
**Date**: September 14, 2025
**Changes Made**:
1. **Category section hidden for deleted notes**:
   - File: `components/Notes/NoteEditorScreen.tsx`
   - When `readOnly` is true (deleted notes), category dropdown is completely hidden
   
2. **Navbar modifications for deleted section**:
   - File: `screens/NotesScreen.tsx` 
   - Mic icon hidden when `selectedSection === 'deleted'`
   - Search placeholder changed to "search deleted Notes..." for deleted section

## Project Structure
- **Frontend**: React Native Expo app
- **Backend**: Python backend (unused per user rules)
- **Main screens**: Notes, Tasks, Habits, Expert chat, etc.
- **Key components**: NoteEditorScreen, NotesHeader, various modals and UI components

## User Preferences
- Prefers targeted, minimal changes only
- Values strict adherence to requirements
- Works with Expo dev client constraints
- Focuses on frontend-only modifications