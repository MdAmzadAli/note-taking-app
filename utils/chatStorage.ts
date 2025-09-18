import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatSession, ChatMessage, WorkspaceChatSession } from '@/types';

const CHAT_SESSIONS_KEY = 'expert_chat_sessions';
const WORKSPACE_CHAT_SESSIONS_KEY = 'expert_workspace_chat_sessions';

// Storage utilities for chat sessions
export class ChatSessionStorage {

  // Get chat session for a specific file ID
  static async getChatSession(singleFileId: string): Promise<ChatSession | null> {
    try {
      const sessionsData = await AsyncStorage.getItem(CHAT_SESSIONS_KEY);
      if (!sessionsData) return null;
      
      const sessions: ChatSession[] = JSON.parse(sessionsData);
      return sessions.find(session => session.single_file_id === singleFileId) || null;
    } catch (error) {
      console.error('Error loading chat session:', error);
      return null;
    }
  }

  // Create or update chat session
  static async saveChatSession(session: ChatSession): Promise<void> {
    try {
      const sessionsData = await AsyncStorage.getItem(CHAT_SESSIONS_KEY);
      let sessions: ChatSession[] = sessionsData ? JSON.parse(sessionsData) : [];
      
      // Find existing session or create new one
      const existingIndex = sessions.findIndex(s => s.single_file_id === session.single_file_id);
      
      if (existingIndex >= 0) {
        // Update existing session
        sessions[existingIndex] = {
          ...session,
          updatedAt: new Date().toISOString()
        };
      } else {
        // Add new session
        sessions.push({
          ...session,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      
      await AsyncStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sessions));
      console.log('✅ Chat session saved for file:', session.single_file_id);
    } catch (error) {
      console.error('Error saving chat session:', error);
    }
  }

  // Add a new message to existing session
  static async addMessageToSession(singleFileId: string, message: ChatMessage): Promise<void> {
    try {
      const session = await this.getChatSession(singleFileId);
      if (!session) {
        console.warn('No session found for file:', singleFileId);
        return;
      }

      // Add new message to chats array
      session.chats.push(message);
      session.updatedAt = new Date().toISOString();
      
      await this.saveChatSession(session);
      console.log('✅ Message added to session for file:', singleFileId);
    } catch (error) {
      console.error('Error adding message to session:', error);
    }
  }

  // Update session summary
  static async updateSessionSummary(singleFileId: string, summary: string): Promise<void> {
    try {
      const session = await this.getChatSession(singleFileId);
      if (!session) {
        // Create new session if none exists
        const newSession: ChatSession = {
          id: `chat_${singleFileId}_${Date.now()}`,
          single_file_id: singleFileId,
          summary: summary,
          chats: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await this.saveChatSession(newSession);
        console.log('✅ New session created with summary for file:', singleFileId);
      } else {
        // Update existing session summary
        session.summary = summary;
        session.updatedAt = new Date().toISOString();
        await this.saveChatSession(session);
        console.log('✅ Summary updated for session:', singleFileId);
      }
    } catch (error) {
      console.error('Error updating session summary:', error);
    }
  }

  // Get or create session for file
  static async getOrCreateSession(singleFileId: string): Promise<ChatSession> {
    try {
      let session = await this.getChatSession(singleFileId);
      
      if (!session) {
        // Create new session
        session = {
          id: `chat_${singleFileId}_${Date.now()}`,
          single_file_id: singleFileId,
          summary: '',
          chats: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await this.saveChatSession(session);
        console.log('✅ New chat session created for file:', singleFileId);
      }
      
      return session;
    } catch (error) {
      console.error('Error getting or creating session:', error);
      // Return fallback session if error occurs
      return {
        id: `chat_${singleFileId}_${Date.now()}`,
        single_file_id: singleFileId,
        summary: '',
        chats: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
  }

  // Delete session for file
  static async deleteSession(singleFileId: string): Promise<void> {
    try {
      const sessionsData = await AsyncStorage.getItem(CHAT_SESSIONS_KEY);
      if (!sessionsData) return;
      
      const sessions: ChatSession[] = JSON.parse(sessionsData);
      const filteredSessions = sessions.filter(session => session.single_file_id !== singleFileId);
      
      await AsyncStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(filteredSessions));
      console.log('✅ Chat session deleted for file:', singleFileId);
    } catch (error) {
      console.error('Error deleting chat session:', error);
    }
  }

  // Get all sessions (for debugging or data management)
  static async getAllSessions(): Promise<ChatSession[]> {
    try {
      const sessionsData = await AsyncStorage.getItem(CHAT_SESSIONS_KEY);
      return sessionsData ? JSON.parse(sessionsData) : [];
    } catch (error) {
      console.error('Error loading all sessions:', error);
      return [];
    }
  }

  // Clear all sessions (for debugging or reset)
  static async clearAllSessions(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CHAT_SESSIONS_KEY);
      console.log('✅ All chat sessions cleared');
    } catch (error) {
      console.error('Error clearing sessions:', error);
    }
  }

  // ==================== WORKSPACE CHAT SESSION METHODS ====================

  // Get workspace chat session for a specific workspace ID
  static async getWorkspaceChatSession(workspaceId: string): Promise<WorkspaceChatSession | null> {
    try {
      const sessionsData = await AsyncStorage.getItem(WORKSPACE_CHAT_SESSIONS_KEY);
      if (!sessionsData) return null;
      
      const sessions: WorkspaceChatSession[] = JSON.parse(sessionsData);
      return sessions.find(session => session.workspace_id === workspaceId) || null;
    } catch (error) {
      console.error('Error loading workspace chat session:', error);
      return null;
    }
  }

  // Create or update workspace chat session
  static async saveWorkspaceChatSession(session: WorkspaceChatSession): Promise<void> {
    try {
      const sessionsData = await AsyncStorage.getItem(WORKSPACE_CHAT_SESSIONS_KEY);
      let sessions: WorkspaceChatSession[] = sessionsData ? JSON.parse(sessionsData) : [];
      
      // Find existing session or create new one
      const existingIndex = sessions.findIndex(s => s.workspace_id === session.workspace_id);
      
      if (existingIndex >= 0) {
        // Update existing session
        sessions[existingIndex] = {
          ...session,
          updatedAt: new Date().toISOString()
        };
      } else {
        // Add new session
        sessions.push({
          ...session,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      
      await AsyncStorage.setItem(WORKSPACE_CHAT_SESSIONS_KEY, JSON.stringify(sessions));
      console.log('✅ Workspace chat session saved for workspace:', session.workspace_id);
    } catch (error) {
      console.error('Error saving workspace chat session:', error);
    }
  }

  // Add a new message to existing workspace session
  static async addMessageToWorkspaceSession(workspaceId: string, message: ChatMessage): Promise<void> {
    try {
      const session = await this.getWorkspaceChatSession(workspaceId);
      if (!session) {
        console.warn('No workspace session found for workspace:', workspaceId);
        return;
      }

      // Add new message to chats array
      session.chats.push(message);
      session.updatedAt = new Date().toISOString();
      
      await this.saveWorkspaceChatSession(session);
      console.log('✅ Message added to workspace session for workspace:', workspaceId);
    } catch (error) {
      console.error('Error adding message to workspace session:', error);
    }
  }

  // Update file-specific summary in workspace session
  static async updateWorkspaceFileSummary(workspaceId: string, fileId: string, summary: string): Promise<void> {
    try {
      let session = await this.getWorkspaceChatSession(workspaceId);
      
      if (!session) {
        // Create new workspace session if none exists
        session = {
          id: `workspace_chat_${workspaceId}_${Date.now()}`,
          workspace_id: workspaceId,
          file_summaries: { [fileId]: summary },
          chats: [],
          active_files: [fileId],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await this.saveWorkspaceChatSession(session);
        console.log('✅ New workspace session created with summary for workspace:', workspaceId, 'file:', fileId);
      } else {
        // Update existing session summary for specific file
        session.file_summaries[fileId] = summary;
        
        // Add file to active_files if not already present
        if (!session.active_files.includes(fileId)) {
          session.active_files.push(fileId);
        }
        
        session.updatedAt = new Date().toISOString();
        await this.saveWorkspaceChatSession(session);
        console.log('✅ Summary updated for workspace session:', workspaceId, 'file:', fileId);
      }
    } catch (error) {
      console.error('Error updating workspace file summary:', error);
    }
  }

  // Get or create workspace session
  static async getOrCreateWorkspaceSession(workspaceId: string, initialFileIds: string[] = []): Promise<WorkspaceChatSession> {
    try {
      let session = await this.getWorkspaceChatSession(workspaceId);
      
      if (!session) {
        // Create new workspace session
        session = {
          id: `workspace_chat_${workspaceId}_${Date.now()}`,
          workspace_id: workspaceId,
          file_summaries: {},
          chats: [],
          active_files: initialFileIds,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await this.saveWorkspaceChatSession(session);
        console.log('✅ New workspace chat session created for workspace:', workspaceId);
      } else {
        // Sync active files with current file list
        session.active_files = initialFileIds;
        session.updatedAt = new Date().toISOString();
        await this.saveWorkspaceChatSession(session);
      }
      
      return session;
    } catch (error) {
      console.error('Error getting or creating workspace session:', error);
      // Return fallback session if error occurs
      return {
        id: `workspace_chat_${workspaceId}_${Date.now()}`,
        workspace_id: workspaceId,
        file_summaries: {},
        chats: [],
        active_files: initialFileIds,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
  }

  // Sync workspace session with current files (handle file deletion/modification)
  static async syncWorkspaceFiles(workspaceId: string, currentFileIds: string[]): Promise<void> {
    try {
      const session = await this.getWorkspaceChatSession(workspaceId);
      if (!session) return;

      // Remove summaries for files that no longer exist
      const updatedSummaries: { [fileId: string]: string } = {};
      currentFileIds.forEach(fileId => {
        if (session.file_summaries[fileId]) {
          updatedSummaries[fileId] = session.file_summaries[fileId];
        }
      });

      // Update session with synced file data
      session.file_summaries = updatedSummaries;
      session.active_files = currentFileIds;
      session.updatedAt = new Date().toISOString();

      await this.saveWorkspaceChatSession(session);
      console.log('✅ Workspace files synced for workspace:', workspaceId);
    } catch (error) {
      console.error('Error syncing workspace files:', error);
    }
  }

  // Delete workspace session
  static async deleteWorkspaceSession(workspaceId: string): Promise<void> {
    try {
      const sessionsData = await AsyncStorage.getItem(WORKSPACE_CHAT_SESSIONS_KEY);
      if (!sessionsData) return;
      
      const sessions: WorkspaceChatSession[] = JSON.parse(sessionsData);
      const filteredSessions = sessions.filter(session => session.workspace_id !== workspaceId);
      
      await AsyncStorage.setItem(WORKSPACE_CHAT_SESSIONS_KEY, JSON.stringify(filteredSessions));
      console.log('✅ Workspace chat session deleted for workspace:', workspaceId);
    } catch (error) {
      console.error('Error deleting workspace chat session:', error);
    }
  }

  // Get all workspace sessions (for debugging or data management)
  static async getAllWorkspaceSessions(): Promise<WorkspaceChatSession[]> {
    try {
      const sessionsData = await AsyncStorage.getItem(WORKSPACE_CHAT_SESSIONS_KEY);
      return sessionsData ? JSON.parse(sessionsData) : [];
    } catch (error) {
      console.error('Error loading all workspace sessions:', error);
      return [];
    }
  }

  // Clear all workspace sessions (for debugging or reset)
  static async clearAllWorkspaceSessions(): Promise<void> {
    try {
      await AsyncStorage.removeItem(WORKSPACE_CHAT_SESSIONS_KEY);
      console.log('✅ All workspace chat sessions cleared');
    } catch (error) {
      console.error('Error clearing workspace sessions:', error);
    }
  }
}