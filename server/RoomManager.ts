// ============================================================
// RoomManager — manages game rooms with 4-digit codes
// ============================================================

import { WebSocket } from 'ws';
import type { GameRunner } from './GameRunner';

export interface PlayerSession {
  playerId: string;
  playerName: string;
  playerIndex: number;
  ws: WebSocket;
}

interface ServerMessage {
  type: string;
  [key: string]: unknown;
}

export interface LobbyPlayer {
  playerId: string;
  playerName: string;
  playerIndex: number;
  isHost: boolean;
}

export class Room {
  roomCode: string;
  hostPlayerId: string;
  playerCount: number;
  players = new Map<string, PlayerSession>();
  gameRunner: GameRunner | null = null;
  state: 'lobby' | 'playing' | 'finished' = 'lobby';

  constructor(roomCode: string, hostId: string, hostName: string, ws: WebSocket, playerCount: number) {
    this.roomCode = roomCode;
    this.hostPlayerId = hostId;
    this.playerCount = playerCount;
    this.players.set(hostId, { playerId: hostId, playerName: hostName, playerIndex: 0, ws });
  }

  sendToPlayer(playerId: string, msg: ServerMessage): void {
    const session = this.players.get(playerId);
    if (session?.ws.readyState === WebSocket.OPEN) {
      session.ws.send(JSON.stringify(msg));
    }
  }

  broadcast(msg: ServerMessage, excludePlayerId?: string): void {
    for (const [pid, session] of this.players) {
      if (pid === excludePlayerId) continue;
      if (session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(JSON.stringify(msg));
      }
    }
  }

  getLobbyPlayers(): LobbyPlayer[] {
    return Array.from(this.players.values()).map(p => ({
      playerId: p.playerId,
      playerName: p.playerName,
      playerIndex: p.playerIndex,
      isHost: p.playerId === this.hostPlayerId,
    }));
  }

  getOrderedPlayerNames(): string[] {
    const entries = Array.from(this.players.values()).sort((a, b) => a.playerIndex - b.playerIndex);
    return entries.map(p => p.playerName);
  }

  getOrderedPlayerIds(): string[] {
    const entries = Array.from(this.players.values()).sort((a, b) => a.playerIndex - b.playerIndex);
    return entries.map(p => p.playerId);
  }
}

export class RoomManager {
  private rooms = new Map<string, Room>();

  createRoom(playerName: string, playerCount: number, ws: WebSocket): { roomCode: string; playerId: string; playerIndex: number } {
    const playerId = this.generateId();
    const roomCode = this.generateRoomCode();
    const room = new Room(roomCode, playerId, playerName, ws, playerCount);
    this.rooms.set(roomCode, room);
    return { roomCode, playerId, playerIndex: 0 };
  }

  joinRoom(roomCode: string, playerName: string, ws: WebSocket): { playerId: string; playerIndex: number; room: Room } | { error: string } {
    const room = this.rooms.get(roomCode);
    if (!room) return { error: 'ROOM_NOT_FOUND' };
    if (room.state !== 'lobby') return { error: 'GAME_ALREADY_STARTED' };
    if (room.players.size >= room.playerCount) return { error: 'ROOM_FULL' };

    const playerId = this.generateId();
    const playerIndex = room.players.size;
    room.players.set(playerId, { playerId, playerName, playerIndex, ws });
    return { playerId, playerIndex, room };
  }

  leaveRoom(roomCode: string, playerId: string): Room | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    room.players.delete(playerId);

    if (room.players.size === 0) {
      room.gameRunner?.cleanup?.();
      this.rooms.delete(roomCode);
      return null;
    }

    // If host left, assign new host
    if (playerId === room.hostPlayerId) {
      const firstPlayer = room.players.values().next().value;
      if (firstPlayer) {
        room.hostPlayerId = firstPlayer.playerId;
      }
    }

    return room;
  }

  getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode);
  }

  private generateRoomCode(): string {
    for (let i = 0; i < 100; i++) {
      const code = String(1000 + Math.floor(Math.random() * 9000));
      if (!this.rooms.has(code)) return code;
    }
    // fallback: sequential scan
    for (let code = 1000; code <= 9999; code++) {
      if (!this.rooms.has(String(code))) return String(code);
    }
    return String(1000 + Math.floor(Math.random() * 9000));
  }

  private generateId(): string {
    return `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}
