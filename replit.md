# ProfessionalNotesApp

## Overview

ProfessionalNotesApp is a cross-platform mobile note-taking application built with React Native and Expo. The app is designed to provide profession-specific templates and workflows for Doctors, Lawyers, and Developers. It features voice-to-text capabilities, custom template creation, reminder management, and AI-powered content processing through integration with external services.

The application supports offline-first functionality with local data storage, voice commands for hands-free operation, and a modular architecture that allows for easy extension and customization based on user profession and preferences.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### August 29, 2025 - UploadModal Integration Enhancement
- **Unified Upload Modal**: Consolidated file upload functionality across all three modes (expert tab single files, workspace modal, and chat interface) to use a single UploadModal component
- **Mode-Specific Logic**: Enhanced UploadModal to handle different contexts:
  - `singleFile` mode: For expert tab single file uploads (original behavior preserved)
  - `workspace` mode: For workspace creation with multiple file support (up to 5 files)
  - `chatInterface` mode: For adding files to existing workspaces via chat interface
- **File Upload Features**: 
  - Device file selection (single or multiple based on mode)
  - URL-based file uploads (from internet links)
  - Webpage content extraction
  - Dynamic file limit enforcement
  - Context-aware status messages
- **Component Updates**:
  - Replaced FileOptionsModal in WorkspaceModal step 2 with UploadModal
  - Updated ChatInterface to use UploadModal for workspace file additions
  - Enhanced IconSymbol component with additional icons (xmark, arrow variants, chevron variants, phone, link, globe, plus, trash, checkmark, folder)
- **User Experience**: Consistent upload experience across all parts of the application with proper error handling and file limit management

### August 29, 2025 - Comprehensive File Deletion System
- **ChatInterface Workspace Mode**: Delete icons already present next to each file in workspace dropdown for immediate deletion
- **Expert Tab Single Files**: Implemented long-press delete functionality (800ms hold) with confirmation dialog for single file deletion
- **Complete Backend Deletion**: Enhanced backend file deletion to remove files from all storage locations:
  - Local uploads folder (physical file removal)
  - Vector database (Qdrant) index removal via `/rag/index/{file_id}` endpoint
  - Metadata files deletion from backend storage
  - Cloudinary cloud storage cleanup (if configured)
- **Frontend Integration**: 
  - Added `deleteFile` method to fileService with comprehensive error handling
  - Frontend calls both vector database removal and file deletion endpoints
  - Local storage cleanup for both single files and workspace files
  - Proper state management updates after successful deletion
- **User Experience**: Consistent deletion experience across both modes with confirmation dialogs and proper error handling
- **API Endpoints**: Leveraged existing `/file/{file_id}` DELETE and `/rag/index/{file_id}` DELETE endpoints for complete removal

## System Architecture

### Frontend Architecture
- **Framework**: React Native with Expo SDK 53
- **Navigation**: Expo Router with file-based routing using a tab-based layout
- **State Management**: React hooks with local component state and AsyncStorage for persistence
- **UI Components**: Custom themed components with consistent design system
- **Styling**: StyleSheet-based styling with a centralized theme system supporting light/dark modes

### Data Storage Solutions
- **Primary Storage**: Expo SQLite for structured data (notes, tasks, reminders, templates)
- **Settings Storage**: AsyncStorage for user preferences and configuration
- **File Storage**: Local file system for voice recordings and temporary files
- **Cloud Integration**: Cloudinary for PDF processing and file management

### Voice and Speech Integration
- **Speech Recognition**: Multiple providers supported:
  - AssemblyAI for high-quality transcription
  - Google Gemini AI for voice processing
  - Expo Speech for basic functionality
- **Voice Commands**: Natural language processing for commands like "create note", "set reminder", "search for"
- **Audio Management**: Expo AV for audio recording and playback

### AI and ML Services
- **Backend Integration**: Python FastAPI backend for advanced processing
- **RAG (Retrieval Augmented Generation)**: Vector database integration with Qdrant for document search
- **Embedding Service**: Google Gemini for text embeddings and semantic search
- **Document Processing**: PDF text extraction and chunking for knowledge base

### Authentication and Permissions
- **Local Authentication**: No user accounts - purely offline-first approach
- **Device Permissions**: Microphone access for voice input, notifications for reminders
- **Data Privacy**: All user data stored locally with optional cloud backup

### Custom Template System
- **Dynamic Forms**: Users can create custom note templates with various field types
- **Profession-Based Defaults**: Pre-configured templates for different professions
- **Field Types**: Text, multi-line text, number, date, dropdown, checkbox support
- **Template Persistence**: SQLite storage with JSON serialization for complex structures

### Search and Discovery
- **Fuzzy Search**: Fuse.js integration for intelligent content matching
- **Voice Search**: Speech-to-text search queries
- **Multi-Content Search**: Unified search across notes, tasks, reminders, and templates
- **Relevance Ranking**: Score-based result ordering with content type awareness

### Notification System
- **Local Notifications**: Expo Notifications for reminder alerts
- **Background Processing**: Scheduled notifications with proper iOS/Android handling
- **Custom Sounds**: Support for user-defined alarm tones
- **Snooze Functionality**: Built-in reminder management

### External Dependencies
- **Vector Database**: Qdrant cloud instance for semantic search
- **AI Services**: Google Gemini AI for embeddings and chat
- **File Processing**: Cloudinary for PDF conversion and image processing
- **Speech Services**: AssemblyAI for professional voice transcription

## External Dependencies

### Third-Party APIs and Services
- **Qdrant Vector Database**: Cloud-hosted vector database for semantic search and document retrieval
- **Google Gemini AI**: Generative AI service for embeddings, chat, and natural language processing
- **AssemblyAI**: Professional speech-to-text transcription service
- **Cloudinary**: Cloud-based image and video management service for PDF processing

### Key NPM Packages
- **@expo/vector-icons**: Icon library for consistent UI elements
- **@react-native-async-storage/async-storage**: Local data persistence
- **expo-sqlite**: Local database for structured data storage
- **expo-av**: Audio recording and playback functionality
- **expo-speech**: Text-to-speech and basic speech recognition
- **expo-notifications**: Local push notification management
- **fuse.js**: Fuzzy search implementation for content discovery
- **react-native-reanimated**: Smooth animations and transitions

### Development and Build Tools
- **Expo SDK**: Complete development framework for React Native
- **TypeScript**: Type safety and enhanced development experience
- **ESLint**: Code quality and consistency enforcement
- **Metro**: JavaScript bundler optimized for React Native

### Platform-Specific Integrations
- **iOS**: Core Spotlight integration for system-wide search, Siri Shortcuts support
- **Android**: Intent handling for external app integration, adaptive icons
- **Cross-Platform**: Consistent behavior across iOS, Android, and web platforms

### Backend Services (Python FastAPI)
- **Document Processing**: PDF text extraction and intelligent chunking
- **Vector Search**: Semantic similarity search across uploaded documents
- **API Gateway**: RESTful API for frontend-backend communication
- **File Management**: Upload and processing pipeline for various document formats