// ============================================================
// Game over screen - victory announcement, identity reveal
// ============================================================

import { useGame } from '../../store/GameContext';
import { getIdentityName } from '../../engine/systems/IdentitySystem';

export function GameOver({ onRestart }: { onRestart: () => void }) {
  const { state } = useGame();

  if (state.gamePhase !== 'finished' || !state.winner) return null;

  const winnerName = getIdentityName(state.winner);

  return (
    <div className="game-over-overlay">
      <div className="game-over-card">
        <h1 className="victory-title">
          {state.winner === 'ruler' && '主公阵营胜利！'}
          {state.winner === 'rebel' && '反贼阵营胜利！'}
          {state.winner === 'spy' && '内奸胜利！'}
        </h1>
        <p className="victory-subtitle">{winnerName}获得最终胜利</p>

        <div className="identity-reveal">
          <h3>身份揭晓</h3>
          {state.players.map(p => (
            <div key={p.id} className={`reveal-row ${p.aliveStatus === 'dead' ? 'reveal-dead' : 'reveal-alive'}`}>
              <span className="reveal-name">{p.name}</span>
              <span className="reveal-char">{p.characterName}</span>
              <span className="reveal-identity">{getIdentityName(p.identity)}</span>
              <span className="reveal-status">{p.aliveStatus === 'alive' ? '存活' : '阵亡'}</span>
            </div>
          ))}
        </div>

        <button className="btn btn-start" onClick={onRestart}>
          再来一局
        </button>
      </div>
    </div>
  );
}
