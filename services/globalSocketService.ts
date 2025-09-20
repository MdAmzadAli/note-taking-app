import { io, Socket } from 'socket.io-client';
import { ChatSessionStorage } from '@/utils/chatStorage';
import { eventBus } from '@/utils/eventBus';
import { API_ENDPOINTS } from '@/config/api';

interface SummaryNotification {
  type: string;
  fileId: string;
  summary: string;
  timestamp: string;
}

class GlobalSocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;

  /**
   * Initialize the global socket connection
   * This should be called once when the app starts
   */
  public initialize(): void {
    if (this.socket) {
      console.log('🔌 GlobalSocketService: Already initialized');
      return;
    }

    const socketUrl = API_ENDPOINTS.base;
    console.log('🔌 GlobalSocketService: Initializing persistent connection to:', socketUrl);

    this.socket = io(socketUrl, {
      transports: ['polling', 'websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      forceNew: true,
      upgrade: true,
      rememberUpgrade: false,
      timeout: 20000
    });

    this.setupEventHandlers();
  }

  /**
   * Setup socket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ GlobalSocketService: Connected to server');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Emit event to notify components that socket is connected
      eventBus.emit('SOCKET_CONNECTED');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 GlobalSocketService: Disconnected:', reason);
      this.isConnected = false;
      
      // Emit event to notify components that socket is disconnected
      eventBus.emit('SOCKET_DISCONNECTED', { reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ GlobalSocketService: Connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('❌ GlobalSocketService: Max reconnection attempts reached');
        eventBus.emit('SOCKET_CONNECTION_FAILED', { error: error.message });
      }
    });

    // Critical: Listen for summary notifications globally
    this.socket.on('summary_notification', this.handleSummaryNotification.bind(this));

    console.log('🔌 GlobalSocketService: Event handlers setup complete');
  }

  /**
   * Handle summary notifications globally - this ensures summaries are never lost
   */
  private async handleSummaryNotification(notification: SummaryNotification): Promise<void> {
    console.log('📨 GlobalSocketService: Received summary notification:', notification);

    try {
      // First, try to determine if this is for a single file or workspace
      // We'll save to both potential storage locations to ensure it's captured
      
      // Save to single file session storage (if it exists)
      try {
        const singleFileSession = await ChatSessionStorage.getChatSession(notification.fileId);
        if (singleFileSession) {
          await ChatSessionStorage.updateSessionSummary(notification.fileId, notification.summary);
          console.log('✅ GlobalSocketService: Summary saved to single file session:', notification.fileId);
        }
      } catch (error) {
        console.log('ℹ️ GlobalSocketService: No single file session found for:', notification.fileId);
      }

      // Save to workspace sessions (check all workspaces)
      try {
        const workspaceSessions = await ChatSessionStorage.getAllWorkspaceSessions();
        for (const workspace of workspaceSessions) {
          // Check if this file is part of this workspace
          if (workspace.active_files.includes(notification.fileId)) {
            await ChatSessionStorage.updateWorkspaceFileSummary(
              workspace.workspace_id, 
              notification.fileId, 
              notification.summary
            );
            console.log('✅ GlobalSocketService: Summary saved to workspace session:', workspace.workspace_id, 'file:', notification.fileId);
          }
        }
      } catch (error) {
        console.log('ℹ️ GlobalSocketService: Error checking workspace sessions:', error);
      }

      // Emit local event so any mounted ChatInterface can update its UI
      eventBus.emit('SUMMARY_RECEIVED', {
        fileId: notification.fileId,
        summary: notification.summary,
        timestamp: notification.timestamp
      });

      console.log('✅ GlobalSocketService: Summary notification processed successfully for file:', notification.fileId);
    } catch (error) {
      console.error('❌ GlobalSocketService: Error processing summary notification:', error);
      
      // Emit error event
      eventBus.emit('SUMMARY_ERROR', {
        fileId: notification.fileId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get connection status
   */
  public getConnectionStatus(): { connected: boolean; attempts: number } {
    return {
      connected: this.isConnected,
      attempts: this.reconnectAttempts
    };
  }

  /**
   * Manually reconnect if needed
   */
  public reconnect(): void {
    if (this.socket && !this.isConnected) {
      console.log('🔄 GlobalSocketService: Manual reconnection initiated');
      this.socket.connect();
    }
  }

  /**
   * Disconnect the socket (should only be called when app is shutting down)
   */
  public disconnect(): void {
    if (this.socket) {
      console.log('🔌 GlobalSocketService: Disconnecting socket');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  /**
   * Get the socket instance (for advanced usage by components if needed)
   */
  public getSocket(): Socket | null {
    return this.socket;
  }
}

// Create and export singleton instance
export const globalSocketService = new GlobalSocketService();

// Export event constants for components to use
export const SOCKET_EVENTS = {
  CONNECTED: 'SOCKET_CONNECTED',
  DISCONNECTED: 'SOCKET_DISCONNECTED',
  CONNECTION_FAILED: 'SOCKET_CONNECTION_FAILED',
  SUMMARY_RECEIVED: 'SUMMARY_RECEIVED',
  SUMMARY_ERROR: 'SUMMARY_ERROR'
} as const;