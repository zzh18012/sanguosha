// ============================================================
// Hot-seat gate screen - passes device between players
// ============================================================

import { useGame } from '../../store/GameContext';
import { findPlayer } from '../../engine/core/GameState';

interface HotSeatGateProps {
  viewerId: string;
  onReady: () => void;
}

export function HotSeatGate({ viewerId, onReady }: HotSeatGateProps) {
  const { state } = useGame();
  const player = findPlayer(state, viewerId);

  if (!player) return null;

  return (
    <div className="hotseat-overlay">
      <div className="hotseat-card">
        <h2>请将设备交给</h2>
        <h1 className="hotseat-name">{player.name}</h1>
        <p className="hotseat-char">
          武将：{player.characterName || '未选择'}
        </p>
        {player.identityRevealed && (
          <p className="hotseat-identity">
            身份：{player.identity === 'ruler' ? '主公' : player.identity === 'loyalist' ? '忠臣' : player.identity === 'rebel' ? '反贼' : '内奸'}
          </p>
        )}
        <p className="hotseat-hint">不要让其他玩家看到你的手牌和身份</p>
        <button className="btn btn-start" onClick={onReady}>
          我准备好了
        </button>
      </div>
    </div>
  );
}
