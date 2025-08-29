
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
    
    if (hostname.includes('replit.dev')) {
      return `${protocol}//${hostname}:5000/ws/summary`;
    } else {
      return `${protocol}//${hostname}:5000/ws/summary`;
    }
  }
  return 'ws://0.0.0.0:5000/ws/summary';
};

class SummaryService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: ((notification: SummaryNotification) => void)[] = [];

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('🔌 WebSocket already connected');
      return;
    }

    try {
      const wsUrl = getWebSocketUrl();
      console.log('🔌 Connecting to WebSocket:', wsUrl);
      
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

      this.ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        this.ws = null;
        this.attemptReconnect();
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

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
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
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners = [];
  }

  async requestSummary(fileId: string, workspaceId?: string): Promise<void> {
    try {
      const response = await fetch(`${getWebSocketUrl().replace('/ws/summary', '')}/rag/summary/${fileId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: workspaceId || null
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to request summary: ${response.statusText}`);
      }

      console.log('✅ Summary generation requested for file:', fileId);
    } catch (error) {
      console.error('❌ Failed to request summary:', error);
      throw error;
    }
  }
}

export const summaryService = new SummaryService();
