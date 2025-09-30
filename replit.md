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

### File Usage Tracking System
**Date**: September 30, 2025
**Changes Made**:
1. **Backend API and WebSocket support**:
   - File: `backend_python/main.py` - Added `/usage/file/{user_uuid}` endpoint for fetching file usage
   - File: `backend_python/component/vector_database_service.py` - Added `file_usage_updated` Socket.IO events when files are uploaded/deleted
   - Implemented module-level Socket.IO instance (`_sio_instance`) for reliable real-time updates
   - Added `set_global_sio()` function to set Socket.IO instance at module level

2. **Frontend context extension**:
   - File: `contexts/UsageContext.tsx` - Extended context to manage both transcription and file usage
   - Renamed from `TranscriptionUsageContext.tsx` to `UsageContext.tsx` for unified usage management
   - Added `useFileUsage()` hook while maintaining backward compatibility with `useTranscriptionUsage()`
   - Real-time WebSocket updates for both transcription and file usage

3. **Settings tab enhancements**:
   - File: `app/(tabs)/settings.tsx` - Added file storage usage display below transcription usage
   - Shows progress bar, percentage, and formatted bytes (MB/GB) for file usage
   - Warning message when storage limit is reached

4. **Upload button restrictions**:
   - File: `components/expert/UploadModal.tsx` - Upload button disabled when file storage limit exceeded
   - Status text shows warning when limit is reached

5. **Updated imports**:
   - File: `app/_layout.tsx` - Updated to use new `UsageProvider`
   - File: `screens/NotesScreen.tsx` - Updated import to use new context

**Bug Fix** (Same day): Fixed real-time update issue where file usage wasn't updating live
   - Root cause: Socket.IO instance wasn't being properly set on VectorDatabaseService
   - Solution: Changed from instance-level `self.sio` to module-level `_sio_instance` variable
   - Now file usage updates immediately via WebSocket when files are uploaded/deleted

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