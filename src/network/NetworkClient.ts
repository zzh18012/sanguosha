// ============================================================
// NetworkClient — WebSocket client for online play
// ============================================================

type ServerMessage =
  | { type: 'ROOM_CREATED'; roomCode: string; playerId: string; playerIndex: number }
  | { type: 'ROOM_JOINED'; roomCode: string; playerId: string; playerIndex: number; players: LobbyPlayer[] }
  | { type: 'PLAYER_JOINED'; player: LobbyPlayer }
  | { type: 'PLAYER_LEFT'; playerId: string }
  | { type: 'GAME_STATE'; state: any; validActions: any[]; deckCount: number; discardCount: number }
  | { type: 'GAME_STARTED' }
  | { type: 'ERROR'; code: string; message: string }
  | { type: 'PONG' };

type ClientMessage =
  | { type: 'CREATE_ROOM'; playerName: string; playerCount: number }
  | { type: 'JOIN_ROOM'; roomCode: string; playerName: string }
  | { type: 'START_GAME' }
  | { type: 'PLAYER_ACTION'; action: any }
  | { type: 'LEAVE_ROOM' }
  | { type: 'PING' };

export interface LobbyPlayer {
  playerId: string;
  playerName: string;
  playerIndex: number;
  isHost: boolean;
}

type MessageHandler = (msg: ServerMessage) => void;

export class NetworkClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers = new Map<string, MessageHandler>();
  private buffers = new Map<string, ServerMessage[]>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private _connected = false;

  constructor(url: string) {
    this.url = url;
  }

  get connected(): boolean {
    return this._connected;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
      } catch (e) {
        reject(e);
        return;
      }

      this.ws.onopen = () => {
        this._connected = true;
        this.startHeartbeat();
        resolve();
      };

      this.ws.onerror = () => {
        this._connected = false;
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as ServerMessage;
          const handler = this.handlers.get(msg.type);
          if (handler) {
            handler(msg);
          } else {
            // Buffer the message — handler may not be registered yet
            // (e.g. GAME_STATE arrives before OnlineGameProvider mounts)
            const buf = this.buffers.get(msg.type) || [];
            buf.push(msg);
            this.buffers.set(msg.type, buf);
          }
        } catch {
          // ignore malformed messages
        }
      };

      this.ws.onclose = () => {
        this._connected = false;
        this.stopHeartbeat();
        this.scheduleReconnect();
      };
    });
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  on(type: ServerMessage['type'], handler: MessageHandler): void {
    this.handlers.set(type, handler);
    // Flush any buffered messages that arrived before handler was registered
    const buf = this.buffers.get(type);
    if (buf) {
      this.buffers.delete(type);
      for (const msg of buf) handler(msg);
    }
  }

  off(type: ServerMessage['type']): void {
    this.handlers.delete(type);
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.handlers.clear();
    this.buffers.clear();
    this.ws?.close();
    this.ws = null;
    this._connected = false;
  }

  private startHeartbeat(): void {
    this.pingInterval = setInterval(() => this.send({ type: 'PING' }), 25000);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {});
    }, 3000);
  }
}

export type { ServerMessage, ClientMessage };
