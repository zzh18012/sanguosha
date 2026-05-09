// ============================================================
// Game context provider
// ============================================================

import React, { createContext, useContext, useReducer, useMemo, useState, useEffect, useCallback } from 'react';
import type { GameState } from '../types/game';
import type { GameAction } from '../types/actions';
import { gameReducer } from './gameReducer';
import { createInitialState } from '../engine/core/GameState';
import { getValidActions } from '../engine/core/RulesEngine';
import type { NetworkClient } from '../network/NetworkClient';

interface GameContextType {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  validActions: GameAction[];
}

const GameContext = createContext<GameContextType | null>(null);

interface GameProviderProps {
  children: React.ReactNode;
  gameConfig: { mode: 'hotseat' | 'singleplayer' | 'online'; playerCount: number; names: string[]; aiIndices: number[] };
  networkClient?: NetworkClient;
}

export function GameProvider({ children, gameConfig, networkClient }: GameProviderProps) {
  if (networkClient) {
    return (
      <OnlineGameProvider client={networkClient}>
        {children}
      </OnlineGameProvider>
    );
  }

  return (
    <LocalGameProvider gameConfig={gameConfig}>
      {children}
    </LocalGameProvider>
  );
}

function LocalGameProvider({ children, gameConfig }: {
  children: React.ReactNode;
  gameConfig: { mode: string; playerCount: number; names: string[]; aiIndices: number[] };
}) {
  const initialState = useMemo(() => createInitialState({
    mode: gameConfig.mode as 'hotseat' | 'singleplayer',
    playerNames: gameConfig.names,
    aiPlayerIndices: gameConfig.aiIndices,
  }), [gameConfig]);

  const [state, dispatch] = useReducer(gameReducer, initialState);

  const validActions = useMemo(() => {
    if (state.pendingAction) {
      return getValidActions(state, state.pendingAction.playerId);
    }
    const currentId = state.turnOrder[state.currentPlayerIndex];
    return getValidActions(state, currentId);
  }, [state]);

  return (
    <GameContext.Provider value={{ state, dispatch, validActions }}>
      {children}
    </GameContext.Provider>
  );
}

function OnlineGameProvider({ children, client }: {
  children: React.ReactNode;
  client: NetworkClient;
}) {
  const [state, setState] = useState<GameState | null>(null);
  const [validActions, setValidActions] = useState<GameAction[]>([]);

  useEffect(() => {
    const handler = (msg: any) => {
      if (msg.type === 'GAME_STATE') {
        const s = msg.state as GameState;
        (s as any)._deckCount = msg.deckCount;
        (s as any)._discardCount = msg.discardCount;
        setState(s);
        setValidActions(msg.validActions);
      }
    };
    client.on('GAME_STATE', handler);
    return () => { client.off('GAME_STATE'); };
  }, [client]);

  const dispatch = useCallback((action: GameAction) => {
    client.send({ type: 'PLAYER_ACTION', action });
  }, [client]);

  if (!state) {
    return (
      <div className="app">
        <div className="main-menu" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <p style={{ color: '#c9a86b', fontSize: '18px' }}>等待游戏开始...</p>
        </div>
      </div>
    );
  }

  return (
    <GameContext.Provider value={{ state, dispatch, validActions }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextType {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be inside GameProvider');
  return ctx;
}
