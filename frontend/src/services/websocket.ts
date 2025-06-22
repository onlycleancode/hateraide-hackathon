/**
 * WebSocket service for real-time content moderation updates
 */

export interface ModerationAction {
  reply_id: string;
  action_type: 'blur' | 'hide';
  reason: string;
  sentiment: 'harmful' | 'unfriendly';
  timestamp: string;
  status: string;
}

export interface ModerationUpdate {
  type: 'content_moderation';
  action: ModerationAction;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectInterval: number = 5000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private listeners: Map<string, (data: ModerationUpdate) => void> = new Map();
  private isConnecting: boolean = false;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    const wsUrl = `ws://localhost:8000/api/ws`;
    
    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.clearReconnectTimer();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'content_moderation') {
            this.notifyListeners(data);
          }
        } catch (error) {
        }
      };

      this.ws.onerror = (error) => {
        this.isConnecting = false;
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.scheduleReconnect();
      };
    } catch (error) {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.reconnectInterval);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  disconnect() {
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
  }

  subscribe(id: string, callback: (data: ModerationUpdate) => void) {
    this.listeners.set(id, callback);
  }

  unsubscribe(id: string) {
    this.listeners.delete(id);
  }

  private notifyListeners(data: ModerationUpdate) {
    this.listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
      }
    });
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
    }
  }
}

export const wsService = new WebSocketService();