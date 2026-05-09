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
import type { NetworkClient } from './network/NetworkClient';
import './styles/global.css';

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

  return (
    <div className="app">
      <CharacterSelect />
      <GameBoard />
      <GameOver onRestart={() => window.location.reload()} />
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<'menu' | 'lobby' | 'game'>('menu');
  const [gameConfig, setGameConfig] = useState<GameConfig | OnlineConfig | null>(null);
  const [networkClient, setNetworkClient] = useState<NetworkClient | null>(null);
  const [gameKey, setGameKey] = useState(0);

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
    </div>
  );
}
