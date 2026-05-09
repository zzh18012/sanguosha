// ============================================================
// WebSocket server entry — room management, message routing
// ============================================================

import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import { readFileSync, existsSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';
import { RoomManager } from './RoomManager';
import { GameRunner } from './GameRunner';

const PORT = parseInt(process.env.PORT || '3001', 10);
const roomManager = new RoomManager();
const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

// Map ws to player session for disconnect handling
const wsSessionMap = new Map<WebSocket, { roomCode: string; playerId: string }>();

const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
};

function serveStatic(_req: IncomingMessage, res: ServerResponse): void {
  // Log any request that looks like a WebSocket upgrade that reached wrong handler
  if (_req.headers.upgrade) {
    console.log('[HTTP request with upgrade header!]', _req.url, _req.headers.upgrade);
  }
  const url = _req.url === '/' ? '/index.html' : _req.url || '/index.html';
  const filePath = join(PUBLIC_DIR, url);
  if (existsSync(filePath)) {
    const ext = extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(readFileSync(filePath));
  } else {
    // SPA fallback
    const indexPath = join(PUBLIC_DIR, 'index.html');
    if (existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(readFileSync(indexPath));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', rooms: roomManager['rooms'].size }));
    }
  }
}

// HTTP server — serves static frontend + health fallback
const httpServer = createServer(serveStatic);

// WebSocket server — manual upgrade handling for proxy compatibility
const wss = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (request, socket, head) => {
  console.log('[WS Upgrade]', request.url);
  wss.handleUpgrade(request, socket, head, (ws) => {
    console.log('[WS Upgrade] connection emitted');
    wss.emit('connection', ws, request);
  });
});

wss.on('connection', (ws: WebSocket, req) => {
  console.log('[WS] New connection, total clients:', wss.clients.size);
  ws.on('message', (raw: RawData) => {
    let msg: { type: string; [key: string]: unknown };
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      sendTo(ws, { type: 'ERROR', code: 'PARSE_ERROR', message: '无效消息格式' });
      return;
    }

    switch (msg.type) {
      case 'CREATE_ROOM': {
        const playerName = (msg.playerName as string) || '玩家';
        const playerCount = Math.min(8, Math.max(2, (msg.playerCount as number) || 4));
        const { roomCode, playerId, playerIndex } = roomManager.createRoom(playerName, playerCount, ws);
        wsSessionMap.set(ws, { roomCode, playerId });
        sendTo(ws, { type: 'ROOM_CREATED', roomCode, playerId, playerIndex });
        break;
      }

      case 'JOIN_ROOM': {
        const roomCode = msg.roomCode as string;
        const playerName = (msg.playerName as string) || '玩家';
        if (!roomCode) {
          sendTo(ws, { type: 'ERROR', code: 'INVALID_CODE', message: '请输入房间号' });
          return;
        }
        const result = roomManager.joinRoom(roomCode, playerName, ws);
        if ('error' in result) {
          sendTo(ws, { type: 'ERROR', code: result.error, message: getErrorMessage(result.error) });
          return;
        }
        wsSessionMap.set(ws, { roomCode, playerId: result.playerId });
        sendTo(ws, {
          type: 'ROOM_JOINED',
          roomCode,
          playerId: result.playerId,
          playerIndex: result.playerIndex,
          players: result.room.getLobbyPlayers(),
        });
        result.room.broadcast({
          type: 'PLAYER_JOINED',
          player: {
            playerId: result.playerId,
            playerName,
            playerIndex: result.playerIndex,
            isHost: false,
          },
        }, result.playerId);
        break;
      }

      case 'START_GAME': {
        const session = wsSessionMap.get(ws);
        if (!session) return;
        const room = roomManager.getRoom(session.roomCode);
        if (!room) return;
        if (room.hostPlayerId !== session.playerId) {
          sendTo(ws, { type: 'ERROR', code: 'NOT_HOST', message: '只有房主可以开始游戏' });
          return;
        }
        if (room.players.size < 2) {
          sendTo(ws, { type: 'ERROR', code: 'NOT_ENOUGH_PLAYERS', message: '至少需要2名玩家' });
          return;
        }

        room.state = 'playing';
        console.log('[START_GAME] Starting game for room', session.roomCode, 'players:', room.players.size);
        let runner: GameRunner;
        try {
          runner = new GameRunner(room);
        } catch (e) {
          console.error('[START_GAME] GameRunner constructor error:', e);
          room.state = 'lobby';
          sendTo(ws, { type: 'ERROR', code: 'START_FAILED', message: '创建游戏失败: ' + String(e) });
          return;
        }
        room.gameRunner = runner;

        room.broadcast({ type: 'GAME_STARTED' });
        console.log('[START_GAME] GAME_STARTED broadcast sent');

        try {
          runner.start();
          console.log('[START_GAME] runner.start() completed');
        } catch (e) {
          console.error('[START_GAME] runner.start() error:', e);
          room.state = 'lobby';
          room.broadcast({ type: 'ERROR', code: 'START_FAILED', message: '游戏启动失败: ' + String(e) });
        }
        break;
      }

      case 'PLAYER_ACTION': {
        const session = wsSessionMap.get(ws);
        if (!session) return;
        const room = roomManager.getRoom(session.roomCode);
        if (!room?.gameRunner) return;
        room.gameRunner.handleAction(session.playerId, msg.action as any);
        break;
      }

      case 'LEAVE_ROOM': {
        const session = wsSessionMap.get(ws);
        if (!session) return;
        const room = roomManager.leaveRoom(session.roomCode, session.playerId);
        wsSessionMap.delete(ws);
        if (room) {
          room.broadcast({ type: 'PLAYER_LEFT', playerId: session.playerId });
        }
        break;
      }

      case 'PING': {
        sendTo(ws, { type: 'PONG' });
        break;
      }
    }
  });

  ws.on('close', () => {
    const session = wsSessionMap.get(ws);
    if (session) {
      const room = roomManager.leaveRoom(session.roomCode, session.playerId);
      wsSessionMap.delete(ws);
      if (room) {
        room.broadcast({ type: 'PLAYER_LEFT', playerId: session.playerId });
      }
    }
  });
});

function sendTo(ws: WebSocket, msg: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function getErrorMessage(code: string): string {
  switch (code) {
    case 'ROOM_NOT_FOUND': return '房间不存在';
    case 'GAME_ALREADY_STARTED': return '游戏已经开始';
    case 'ROOM_FULL': return '房间已满';
    default: return '未知错误';
  }
}

httpServer.listen(PORT, () => {
  console.log(`[Sanguosha Server] listening on port ${PORT}`);
});
