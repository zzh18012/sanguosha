// ============================================================
// GameRunner — server-side game engine driver
// ============================================================

import type { GameState, PlayerState, Identity } from '../src/types/game';
import { createPlayerState } from '../src/types/game';
import type { GameAction } from '../src/types/actions';
import { gameReducer } from '../src/store/gameReducer';
import { validateAction, getValidActions } from '../src/engine/core/RulesEngine';
import { aiDecide, aiSelectCharacter } from '../src/engine/ai/AIController';
import type { Room } from './RoomManager';
import { maskState } from './StateMasker';

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function assignIdentities(count: number): Identity[] {
  switch (count) {
    case 2: return ['ruler', 'rebel'];
    case 3: return ['ruler', 'loyalist', 'rebel'];
    case 4: return ['ruler', 'loyalist', 'rebel', 'spy'];
    case 5: return ['ruler', 'loyalist', 'rebel', 'rebel', 'spy'];
    case 6: return ['ruler', 'loyalist', 'rebel', 'rebel', 'rebel', 'spy'];
    case 7: return ['ruler', 'loyalist', 'loyalist', 'rebel', 'rebel', 'rebel', 'spy'];
    case 8: return ['ruler', 'loyalist', 'loyalist', 'rebel', 'rebel', 'rebel', 'rebel', 'spy'];
    default: {
      const rebels = Math.floor(count * 0.4);
      const loyalists = Math.max(1, Math.floor(count * 0.3));
      const result: Identity[] = ['ruler'];
      for (let i = 0; i < loyalists; i++) result.push('loyalist');
      for (let i = 0; i < rebels; i++) result.push('rebel');
      if (count > 3) result.push('spy');
      while (result.length < count) result.push('rebel');
      return result.slice(0, count);
    }
  }
}

function createOnlineGameState(room: Room): GameState {
  const humanSessions = Array.from(room.players.values()).sort((a, b) => a.playerIndex - b.playerIndex);
  const totalCount = room.playerCount;
  const names: string[] = humanSessions.map(p => p.playerName);
  const aiIndices: number[] = [];

  for (let i = names.length; i < totalCount; i++) {
    names.push(`AI_${i + 1}`);
    aiIndices.push(i);
  }

  const identities = shuffleArray(assignIdentities(totalCount));
  const rulerIdx = identities.indexOf('ruler');
  if (rulerIdx > 0) {
    [identities[0], identities[rulerIdx]] = [identities[rulerIdx], identities[0]];
  }

  const players: PlayerState[] = [];
  const turnOrder: string[] = [];

  for (let i = 0; i < totalCount; i++) {
    const isHuman = i < humanSessions.length;
    const id = isHuman ? humanSessions[i].playerId : `ai_${i}_${Date.now()}`;
    const player = createPlayerState(id, names[i], !isHuman);
    player.identity = identities[i];
    if (i === 0) {
      player.identityRevealed = true;
      player.maxHp = 5;
      player.hp = 5;
    }
    players.push(player);
    turnOrder.push(id);
  }

  return {
    gamePhase: 'character_select',
    mode: 'online',
    config: { mode: 'online', playerNames: names, aiPlayerIndices: aiIndices },
    players,
    turnOrder,
    currentPlayerIndex: 0,
    currentTurnPhase: 'judge',
    turnNumber: 0,
    roundNumber: 0,
    deck: [],
    discardPile: [],
    pendingAction: null,
    actionHistory: [],
    eventQueue: [],
    winner: null,
  };
}

const ALL_CHARACTERS = [
  'caocao', 'simayi', 'xiahoudun', 'zhangliao', 'xuchu', 'guojia', 'zhenji',
  'liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'zhaoyun', 'machao', 'huangyueying',
  'sunquan', 'zhouyu', 'huanggai', 'lvmeng', 'luxun', 'daqiao', 'sunshangxiang',
  'huatuo', 'lvbu', 'diaochan', 'zhangjiao', 'yuanshao',
];

export class GameRunner {
  private room: Room;
  private state: GameState;
  private aiTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private destroyed = false;

  constructor(room: Room) {
    this.room = room;
    this.state = createOnlineGameState(room);
  }

  start(): void {
    console.log('[GameRunner.start] Starting with', this.state.players.length, 'players');
    // Auto-assign characters
    for (const player of this.state.players) {
      if (player.characterId) continue;
      const charId = player.isAI
        ? aiSelectCharacter(player)
        : ALL_CHARACTERS[Math.floor(Math.random() * ALL_CHARACTERS.length)];
      console.log('[GameRunner.start] Assigning', charId, 'to player', player.id, '(isAI:', player.isAI, ')');
      this.state = gameReducer(this.state, {
        type: 'SELECT_CHARACTER', playerId: player.id, characterId: charId,
      });
    }

    console.log('[GameRunner.start] Characters assigned, dispatching START_GAME');
    const { state: newState } = this.applyReducer(this.state, { type: 'START_GAME' });
    this.state = newState;
    console.log('[GameRunner.start] START_GAME resolved, phase:', this.state.gamePhase);

    this.broadcastState();
    console.log('[GameRunner.start] broadcastState done');
    this.scheduleAI();
    console.log('[GameRunner.start] scheduleAI done');
  }

  handleAction(playerId: string, action: GameAction): void {
    if (this.destroyed) return;

    if (!validateAction(this.state, action)) {
      this.room.sendToPlayer(playerId, { type: 'ERROR', code: 'INVALID_ACTION', message: '非法操作' });
      return;
    }

    const { state: newState, newActions } = this.applyReducer(this.state, action);
    this.state = newState;

    this.processFollowUps(newActions);
    this.broadcastState();

    if (this.state.gamePhase === 'finished') {
      this.cleanup();
      return;
    }

    this.scheduleAI();
  }

  cleanup(): void {
    this.destroyed = true;
    for (const timer of this.aiTimers.values()) {
      clearTimeout(timer);
    }
    this.aiTimers.clear();
  }

  private applyReducer(state: GameState, action: GameAction): { state: GameState; newActions: GameAction[] } {
    // gameReducer is a pure (state, action) => state function
    // but we need to intercept follow-up actions so we can process AI in between
    const result = gameReducer(state, action);
    return { state: result, newActions: [] };
  }

  private processFollowUps(_actions: GameAction[]): void {
    // gameReducer already processes follow-ups internally (up to depth 50)
    // The returned state is fully resolved
  }

  private broadcastState(): void {
    console.log('[GameRunner.broadcastState] Sending state to', this.room.players.size, 'players');
    for (const [playerId] of this.room.players) {
      const { state: masked, deckCount, discardCount } = maskState(this.state, playerId);
      (masked as any)._viewerPlayerId = playerId;
      const validActions = getValidActions(this.state, playerId);
      console.log('[GameRunner.broadcastState] Sending to', playerId, 'validActions:', validActions.length);
      this.room.sendToPlayer(playerId, {
        type: 'GAME_STATE',
        state: masked,
        validActions,
        deckCount,
        discardCount,
      });
    }
  }

  private scheduleAI(): void {
    if (this.destroyed) return;

    // Check pending action — someone needs to respond
    if (this.state.pendingAction) {
      const pendingPlayer = this.state.players.find(p => p.id === this.state.pendingAction!.playerId);
      if (pendingPlayer?.isAI && pendingPlayer.aliveStatus === 'alive') {
        const key = `pending_${pendingPlayer.id}`;
        if (!this.aiTimers.has(key)) {
          const delay = 500 + Math.random() * 800;
          const timer = setTimeout(() => {
            this.aiTimers.delete(key);
            this.runAI(pendingPlayer.id);
          }, delay);
          this.aiTimers.set(key, timer);
        }
        return;
      }

      // Also check if other AI players can use 桃 on dying players
      if (this.state.pendingAction.type === 'use_tao_dying') {
        for (const player of this.state.players) {
          if (player.isAI && player.aliveStatus === 'alive' && player.id !== pendingPlayer?.id) {
            const key = `tao_${player.id}`;
            if (!this.aiTimers.has(key)) {
              const timer = setTimeout(() => {
                this.aiTimers.delete(key);
                this.runAI(player.id);
              }, 300 + Math.random() * 500);
              this.aiTimers.set(key, timer);
            }
          }
        }
        return;
      }
      return;
    }

    // Check current turn player
    const currentId = this.state.turnOrder[this.state.currentPlayerIndex];
    const currentPlayer = this.state.players.find(p => p.id === currentId);
    if (currentPlayer?.isAI && currentPlayer.aliveStatus === 'alive') {
      const key = `turn_${currentId}`;
      if (!this.aiTimers.has(key)) {
        const delay = 800 + Math.random() * 1200;
        const timer = setTimeout(() => {
          this.aiTimers.delete(key);
          this.runAI(currentId);
        }, delay);
        this.aiTimers.set(key, timer);
      }
    }
  }

  private runAI(playerId: string): void {
    if (this.destroyed) return;

    const action = aiDecide(this.state, playerId);
    this.handleAction(playerId, action);
  }
}
