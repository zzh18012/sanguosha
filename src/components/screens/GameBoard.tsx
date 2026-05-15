// ============================================================
// Game board - main playing area layout
// ============================================================

import { useGame } from '../../store/GameContext';
import { PlayerSeat } from '../player/PlayerSeat';
import { HandDisplay } from '../player/HandDisplay';
import { CardPile } from '../cards/CardPile';
import { ActionBar } from '../actions/ActionBar';
import { PhaseBanner } from '../layout/PhaseBanner';
import { GameLog } from '../log/GameLog';
import { getCurrentPlayer, getAlivePlayers } from '../../types/game';
import { findPlayer } from '../../engine/core/GameState';
import { useTurnTimer } from '../../hooks/useTurnTimer';

export function GameBoard() {
  const { state, dispatch } = useGame();
  const { remainingSec } = useTurnTimer(state, dispatch);

  if (state.gamePhase !== 'playing') return null;

  const currentPlayer = getCurrentPlayer(state);
  // Human player ID — in singleplayer mode, lock viewer to the human
  const humanPlayer = state.players.find(p => !p.isAI);
  const humanPlayerId = humanPlayer?.id;

  // Determine whose perspective to show:
  // - If human needs to respond to a pending action, show that player's view
  // - In singleplayer mode, always show human's perspective (hand hidden for others)
  // - In hotseat mode, show current turn player's perspective
  const isSinglePlayer = state.mode === 'singleplayer';
  const pendingNeedsHuman = state.pendingAction && humanPlayerId
    && (state.pendingAction.playerId === humanPlayerId
        || (state.pendingAction.type === 'use_tao_dying'
            && state.players.some(p => p.id === humanPlayerId && p.hand.some(c => c.subtype === 'tao'))));
  const currentViewerId = pendingNeedsHuman
    ? humanPlayerId
    : isSinglePlayer
      ? humanPlayerId || currentPlayer.id
      : state.pendingAction?.playerId || currentPlayer.id;

  // Is it the viewer's own turn?
  const isViewerTurn = currentViewerId === currentPlayer.id;

  // Other alive players (shown at top)
  const otherPlayers = getAlivePlayers(state).filter(p => p.id !== currentViewerId);

  // Current player whose turn it is (for phase banner)
  const turnPlayer = findPlayer(state, currentPlayer.id);

  return (
    <div className="game-board">
      {/* Quit button */}
      <button
        className="btn-quit-game"
        onClick={() => { if (window.confirm('确定要退出游戏吗？')) window.location.reload(); }}
        title="退出游戏"
      >
        ✕ 退出
      </button>

      {/* Top: other players */}
      <div className="board-top">
        {otherPlayers.map((player) => (
          <PlayerSeat
            key={player.id}
            playerId={player.id}
            position="top"
            isCurrent={player.id === currentPlayer.id}
          />
        ))}
      </div>

      {/* Center: card piles + phase info */}
      <div className="board-center">
        <CardPile deckCount={state.deck.length} discardCount={state.discardPile.length} />
        <PhaseBanner
          phase={state.currentTurnPhase}
          playerName={turnPlayer?.name || currentPlayer.name}
          isViewerTurn={isViewerTurn}
        />
        <GameLog entries={state.actionHistory} />
      </div>

      {/* Bottom: current viewer's area */}
      <div className="board-bottom">
        <PlayerSeat playerId={currentViewerId} position="bottom" isCurrent={isViewerTurn} />
        <HandDisplay playerId={currentViewerId} />
        <ActionBar remainingSec={remainingSec} />
      </div>
    </div>
  );
}
