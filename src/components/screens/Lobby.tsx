// ============================================================
// Lobby — online game lobby (create/join room)
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { NetworkClient, type LobbyPlayer } from '../../network/NetworkClient';

interface LobbyProps {
  wsUrl: string;
  onGameStart: (client: NetworkClient, playerCount: number) => void;
  onBack: () => void;
}

export function Lobby({ wsUrl, onGameStart, onBack }: LobbyProps) {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [playerName, setPlayerName] = useState('玩家');
  const [playerCount, setPlayerCount] = useState(4);
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [myPlayerId, setMyPlayerId] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);

  const clientRef = useRef<NetworkClient | null>(null);
  const currentRoomRef = useRef<string>('');

  useEffect(() => {
    return () => {
      clientRef.current?.disconnect();
    };
  }, []);

  const connectAndCreate = async () => {
    setConnecting(true);
    setError('');
    const client = new NetworkClient(wsUrl);
    try {
      await client.connect();
      clientRef.current = client;
      currentRoomRef.current = '';

      client.on('ROOM_CREATED', (msg) => {
        if (msg.type === 'ROOM_CREATED') {
          setRoomCode(msg.roomCode);
          setMyPlayerId(msg.playerId);
          setIsHost(true);
          setPlayers([{
            playerId: msg.playerId,
            playerName,
            playerIndex: msg.playerIndex,
            isHost: true,
          }]);
          setMode('create');
        }
      });

      client.on('PLAYER_JOINED', (msg) => {
        if (msg.type === 'PLAYER_JOINED') {
          setPlayers(prev => [...prev, msg.player]);
        }
      });

      client.on('PLAYER_LEFT', (msg) => {
        if (msg.type === 'PLAYER_LEFT') {
          setPlayers(prev => prev.filter(p => p.playerId !== msg.playerId));
        }
      });

      client.on('GAME_STARTED', () => {
        onGameStart(client, playerCount);
      });

      client.on('ERROR', (msg) => {
        if (msg.type === 'ERROR') {
          setError(msg.message);
        }
      });

      client.send({ type: 'CREATE_ROOM', playerName, playerCount });
    } catch {
      setError('连接服务器失败，请确认服务器已启动');
    } finally {
      setConnecting(false);
    }
  };

  const connectAndJoin = async () => {
    if (!joinCode.trim()) return;
    setConnecting(true);
    setError('');
    const client = new NetworkClient(wsUrl);
    try {
      await client.connect();
      clientRef.current = client;
      currentRoomRef.current = joinCode.trim();

      client.on('ROOM_JOINED', (msg) => {
        if (msg.type === 'ROOM_JOINED') {
          setRoomCode(msg.roomCode);
          setMyPlayerId(msg.playerId);
          setIsHost(false);
          setPlayers(msg.players);
          setMode('create'); // show room view
        }
      });

      client.on('PLAYER_JOINED', (msg) => {
        if (msg.type === 'PLAYER_JOINED') {
          setPlayers(prev => [...prev, msg.player]);
        }
      });

      client.on('PLAYER_LEFT', (msg) => {
        if (msg.type === 'PLAYER_LEFT') {
          setPlayers(prev => prev.filter(p => p.playerId !== msg.playerId));
        }
      });

      client.on('GAME_STARTED', () => {
        onGameStart(client, playerCount);
      });

      client.on('ERROR', (msg) => {
        if (msg.type === 'ERROR') {
          setError(msg.message);
        }
      });

      client.send({ type: 'JOIN_ROOM', roomCode: joinCode.trim(), playerName });
    } catch {
      setError('连接服务器失败，请确认服务器已启动');
    } finally {
      setConnecting(false);
    }
  };

  const handleStartGame = () => {
    clientRef.current?.send({ type: 'START_GAME' });
  };

  const handleLeave = () => {
    clientRef.current?.send({ type: 'LEAVE_ROOM' });
    clientRef.current?.disconnect();
    clientRef.current = null;
    setMode('choose');
    setPlayers([]);
    setRoomCode('');
  };

  // ---- Render: mode selection ----
  if (mode === 'choose') {
    return (
      <div className="main-menu">
        <h1 className="game-title">三国杀</h1>
        <p className="game-subtitle">· 在线联机 ·</p>

        {error && <p style={{ color: '#e74c3c', marginBottom: '16px' }}>{error}</p>}

        <div className="menu-section">
          <label className="menu-label">你的名称</label>
          <input
            type="text"
            className="name-input"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            maxLength={8}
            style={{ width: '100%', maxWidth: '300px', textAlign: 'center' }}
          />
        </div>

        <div className="menu-section">
          <label className="menu-label">选择操作</label>
          <div className="mode-buttons" style={{ flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ color: '#c9a86b', fontSize: '14px' }}>总人数：</span>
                <div className="count-buttons">
                  {[2, 3, 4, 5, 6, 7, 8].map(n => (
                    <button
                      key={n}
                      className={`btn btn-sm ${playerCount === n ? 'btn-active' : ''}`}
                      onClick={() => setPlayerCount(n)}
                    >
                      {n}人
                    </button>
                  ))}
                </div>
              </div>
              <button
                className="btn btn-start"
                onClick={connectAndCreate}
                disabled={connecting}
                style={{ width: '100%' }}
              >
                {connecting ? '连接中...' : '创建房间'}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#c9a86b', fontSize: '14px' }}>—— 或 ——</span>
            </div>

            <div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="text"
                  className="name-input"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="房间号（4位数字）"
                  maxLength={4}
                  style={{ flex: 1, textAlign: 'center' }}
                />
              </div>
              <button
                className="btn btn-start"
                onClick={connectAndJoin}
                disabled={connecting || joinCode.length !== 4}
                style={{ width: '100%', backgroundColor: joinCode.length === 4 ? undefined : '#555' }}
              >
                {connecting ? '连接中...' : '加入房间'}
              </button>
            </div>
          </div>
        </div>

        <button className="btn" onClick={onBack} style={{ marginTop: '16px' }}>
          返回
        </button>
      </div>
    );
  }

  // ---- Render: room view (created or joined) ----
  return (
    <div className="main-menu">
      <h1 className="game-title">房间 {roomCode}</h1>
      <p className="game-subtitle">
        {isHost ? '等待玩家加入...' : '等待房主开始游戏...'}
      </p>

      {error && <p style={{ color: '#e74c3c', marginBottom: '12px' }}>{error}</p>}

      <div className="menu-section">
        <label className="menu-label">
          玩家列表（{players.length}/{playerCount}）
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
          {players.map((p, i) => (
            <div
              key={p.playerId}
              style={{
                padding: '8px 24px',
                borderRadius: '6px',
                backgroundColor: p.playerId === myPlayerId ? 'rgba(201,168,107,0.2)' : 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(201,168,107,0.3)',
                color: '#e0d5c1',
                fontSize: '14px',
                minWidth: '200px',
                textAlign: 'center',
              }}
            >
              {i === 0 && '👑 '}{p.playerName}
              {p.isHost ? ' (房主)' : ''}
              {p.playerId === myPlayerId ? ' (你)' : ''}
            </div>
          ))}
          {Array.from({ length: playerCount - players.length }, (_, i) => (
            <div
              key={`empty-${i}`}
              style={{
                padding: '8px 24px',
                borderRadius: '6px',
                backgroundColor: 'rgba(255,255,255,0.03)',
                border: '1px dashed rgba(255,255,255,0.2)',
                color: '#666',
                fontSize: '14px',
                minWidth: '200px',
                textAlign: 'center',
              }}
            >
              等待玩家加入...
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
        {isHost && (
          <button
            className="btn btn-start"
            onClick={handleStartGame}
            disabled={players.length < 2}
          >
            开始游戏
          </button>
        )}
        <button className="btn" onClick={handleLeave}>
          离开房间
        </button>
        {!isHost && (
          <button className="btn" onClick={onBack}>
            返回菜单
          </button>
        )}
      </div>
    </div>
  );
}
