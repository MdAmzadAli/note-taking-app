import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatSession, ChatMessage } from '@/types';

const CHAT_SESSIONS_KEY = 'expert_chat_sessions';

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
}