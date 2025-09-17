
export interface SummaryNotification {
  type: 'summary';
  fileId: string;
  summary: string;
  timestamp: string;
}

const getWebSocketUrl = () => {
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostname = window.location.hostname;
    
    // Check if we're in Expo tunnel environment (mobile/Expo Go)
    if (hostname.includes('.exp.direct')) {
      // For Expo Go/tunnel, use the same Replit domain as API base URL
      return 'wss://4039270b-5003-46d5-8738-f71302f8ef1e-00-2bd8dwfrl5uow.riker.replit.dev:8000/ws/summary';
    }
    // For Replit web, the Python backend runs on port 8000
    else if (hostname.includes('replit.dev')) {
      return `${protocol}//${hostname}:8000/ws/summary`;
    } else {
      // For local development (Python backend on port 8000)
      return `${protocol}//${hostname}:8000/ws/summary`;
    }
  }
  return 'ws://0.0.0.0:8000/ws/summary';
};

class SummaryService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 2000;
  private reconnectTimeoutId: number | null = null;
  private listeners: ((notification: SummaryNotification) => void)[] = [];

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      console.log('🔌 WebSocket already connected or connecting');
      return;
    }

    // Clear any pending reconnection timeout
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    try {
      const wsUrl = getWebSocketUrl();
      console.log('🔌 Connecting to WebSocket:', wsUrl);
      
      // Close existing connection if any
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected for summary notifications');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const notification: SummaryNotification = JSON.parse(event.data);
          console.log('📨 Summary notification received:', notification);
          
          // Notify all listeners
          this.listeners.forEach(listener => {
            try {
              listener(notification);
            } catch (error) {
              console.error('❌ Error in summary listener:', error);
            }
          });
        } catch (error) {
          console.error('❌ Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        this.ws = null;
        
        // Only attempt reconnection if not manually closed (code 1000)
        if (event.code !== 1000) {
          this.attemptReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
      };

    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('❌ Max reconnection attempts reached');
      return;
    }

    // Clear any existing reconnection timeout
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000); // Cap at 30 seconds
    
    console.log(`🔄 Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimeoutId = setTimeout(() => {
      this.connect();
    }, delay);
  }

  addListener(listener: (notification: SummaryNotification) => void): void {
    this.listeners.push(listener);
  }

  removeListener(listener: (notification: SummaryNotification) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  disconnect(): void {
    // Clear any pending reconnection timeout
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    
    // Reset reconnection attempts
    this.reconnectAttempts = 0;
    
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect'); // Use code 1000 for clean closure
      this.ws = null;
    }
    this.listeners = [];
  }

  // Note: Manual summary requests are no longer needed since summaries are automatically
  // generated during file upload and sent via WebSocket notifications
  // This method is kept for backward compatibility but should not be used
  async requestSummary(fileId: string, workspaceId?: string): Promise<void> {
    console.warn('⚠️ Manual summary request is deprecated. Summaries are now automatically generated during file upload and sent via WebSocket.');
    console.log('📋 File summaries are automatically generated in the background after upload for file:', fileId);
    // No actual request is made - summaries come automatically via WebSocket
  }
}

export const summaryService = new SummaryService();
