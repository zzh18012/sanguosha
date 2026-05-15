// ============================================================
// Main App - game flow controller
// ============================================================

import { useState, useEffect } from 'react';
import { GameProvider, useGame } from './store/GameContext';
import { MainMenu } from './components/screens/MainMenu';
import { CharacterSelect } from './components/screens/CharacterSelect';
import { GameBoard } from './components/screens/GameBoard';
import { GameOver } from './components/screens/GameOver';
import { Lobby } from './components/screens/Lobby';
import { useAIThink } from './hooks/useAIThink';
import { aiSelectCharacter } from './engine/ai/AIController';
import { registerAllCharacters } from './engine/characters/generals';
import { setApiKey, hasApiKey } from './engine/ai/LLMController';
import type { NetworkClient } from './network/NetworkClient';
import './styles/global.css';

const isDebug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');

// Register all character skills on app startup
registerAllCharacters();

const getWsUrl = () => {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  // Dev mode: Vite dev server on 5173, WS server on 3001
  if (import.meta.env.DEV) return `ws://${window.location.hostname}:3001`;
  // Production: frontend and WS on same server, same origin
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
};

interface GameConfig {
  mode: 'hotseat' | 'singleplayer';
  playerCount: number;
  names: string[];
  aiIndices: number[];
}

interface OnlineConfig {
  mode: 'online';
  playerCount: number;
  names: string[];
  aiIndices: number[];
}

function GameFlow() {
  const { state, dispatch } = useGame();

  // AI auto-select character during character select phase (local modes only)
  useEffect(() => {
    if (state.mode === 'online') return;
    if (state.gamePhase !== 'character_select') return;
    const currentPlayer = state.players.find(p => !p.characterId);
    if (currentPlayer?.isAI) {
      const charId = aiSelectCharacter(currentPlayer);
      const timer = setTimeout(() => {
        dispatch({ type: 'SELECT_CHARACTER', playerId: currentPlayer.id, characterId: charId });
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [state.players, state.gamePhase, state.mode]);

  // AI thinking during gameplay (no-op in online mode since AI runs on server)
  useAIThink(state, dispatch, 1200);

  const [DebugPanel, setDebugPanel] = useState<React.ComponentType | null>(null);
  useEffect(() => {
    if (isDebug) {
      import('./debug/DebugPanel').then(m => setDebugPanel(() => m.DebugPanel));
    }
  }, []);

  return (
    <div className="app">
      <CharacterSelect />
      <GameBoard />
      <GameOver onRestart={() => window.location.reload()} />
      {DebugPanel && <DebugPanel />}
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<'menu' | 'lobby' | 'game'>('menu');
  const [gameConfig, setGameConfig] = useState<GameConfig | OnlineConfig | null>(null);
  const [networkClient, setNetworkClient] = useState<NetworkClient | null>(null);
  const [gameKey, setGameKey] = useState(0);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [keySaved, setKeySaved] = useState(hasApiKey());

  const handleSaveKey = () => {
    const trimmed = keyInput.trim();
    if (trimmed) {
      setApiKey(trimmed);
      setKeySaved(true);
      setShowKeyInput(false);
      setKeyInput('');
    }
  };

  const handleClearKey = () => {
    import('./engine/ai/LLMController').then(m => m.clearApiKey());
    setKeySaved(false);
    setKeyInput('');
  };

  const handleStart = (cfg: GameConfig) => {
    setGameConfig(cfg);
    setNetworkClient(null);
    setScreen('game');
    setGameKey(k => k + 1);
  };

  const handleOnlineStart = () => {
    setScreen('lobby');
  };

  const handleLobbyGameStart = (client: NetworkClient, playerCount: number) => {
    setNetworkClient(client);
    setGameConfig({ mode: 'online', playerCount, names: [], aiIndices: [] });
    setScreen('game');
    setGameKey(k => k + 1);
  };

  const handleLobbyBack = () => {
    setNetworkClient(null);
    setScreen('menu');
  };

  if (screen === 'lobby') {
    return (
      <div className="app">
        <Lobby
          wsUrl={getWsUrl()}
          onGameStart={handleLobbyGameStart}
          onBack={handleLobbyBack}
        />
      </div>
    );
  }

  if (screen === 'game' && gameConfig) {
    return (
      <GameProvider
        key={gameKey}
        gameConfig={gameConfig}
        networkClient={networkClient || undefined}
      >
        <GameFlow />
      </GameProvider>
    );
  }

  return (
    <div className="app">
      <MainMenu onStart={handleStart} onOnlineStart={handleOnlineStart} />
      <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 100 }}>
        {!showKeyInput ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {keySaved && (
              <span style={{ color: '#4a8', fontSize: 12 }}>LLM AI 已启用</span>
            )}
            <button
              className="btn btn-sm"
              style={{ fontSize: 11, padding: '4px 10px', background: keySaved ? '#555' : '#c9a86b', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}
              onClick={() => setShowKeyInput(!showKeyInput)}
            >
              {keySaved ? '更换Key' : '设置AI Key'}
            </button>
            {keySaved && (
              <button
                className="btn btn-sm"
                style={{ fontSize: 11, padding: '4px 10px', background: '#933', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}
                onClick={handleClearKey}
              >
                清除
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#1a1a2e', padding: '8px 12px', borderRadius: 8, border: '1px solid #333' }}>
            <span style={{ color: '#c9a86b', fontSize: 12, whiteSpace: 'nowrap' }}>DeepSeek API Key:</span>
            <input
              type="password"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              placeholder="sk-..."
              style={{ padding: '4px 8px', fontSize: 12, borderRadius: 4, border: '1px solid #555', background: '#111', color: '#ddd', width: 260 }}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveKey(); }}
            />
            <button
              className="btn btn-sm"
              style={{ fontSize: 11, padding: '4px 10px', background: '#c9a86b', border: 'none', borderRadius: 4, color: '#111', cursor: 'pointer' }}
              onClick={handleSaveKey}
            >
              保存
            </button>
            <button
              className="btn btn-sm"
              style={{ fontSize: 11, padding: '4px 10px', background: '#444', border: 'none', borderRadius: 4, color: '#ddd', cursor: 'pointer' }}
              onClick={() => setShowKeyInput(false)}
            >
              取消
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
