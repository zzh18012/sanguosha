// ============================================================
// Player seat - shows character portrait, HP, equipment, status
// ============================================================

import { useGame } from '../../store/GameContext';
import { findPlayer } from '../../engine/core/GameState';
import { getCharacterInfo } from '../../data/characterDefinitions';
import { getIdentityName } from '../../engine/systems/IdentitySystem';

interface PlayerSeatProps {
  playerId: string;
  position: 'top' | 'bottom';
  isCurrent: boolean;
  onClick?: () => void;
  highlight?: boolean;
}

export function PlayerSeat({ playerId, position, isCurrent, onClick, highlight }: PlayerSeatProps) {
  const { state } = useGame();
  const player = findPlayer(state, playerId);
  if (!player || player.aliveStatus === 'dead') return null;

  const charInfo = getCharacterInfo(player.characterId);
  const hpHearts = Array.from({ length: player.maxHp }, (_, i) => i < player.hp);

  return (
    <div
      className={`player-seat ${isCurrent ? 'seat-current' : ''} ${highlight ? 'seat-highlight' : ''} ${player.aliveStatus === 'dying' ? 'seat-dying' : ''}`}
      data-kingdom={player.kingdom}
      onClick={onClick}
    >
      <div className="seat-header">
        <span className="seat-name">{player.name}</span>
        {player.identityRevealed && (
          <span className="seat-identity">{getIdentityName(player.identity)}</span>
        )}
      </div>

      <div className="seat-character">
        <div className="char-portrait">
          <div className="char-portrait-placeholder" data-kingdom={player.kingdom}>
            {charInfo?.name?.[0] || '?'}
          </div>
        </div>
        <div className="char-info">
          <span className="char-name">{player.characterName || '未选将'}</span>
          <span className="char-title">{charInfo?.title || ''}</span>
        </div>
      </div>

      <div className="seat-hp">
        {hpHearts.map((filled, i) => (
          <span key={i} className={`hp-heart ${filled ? 'hp-filled' : 'hp-empty'}`}>
            {filled ? '❤' : '♡'}
          </span>
        ))}
        <span className="hp-text">{player.hp}/{player.maxHp}</span>
      </div>

      <div className="seat-equipment">
        {player.equipment.weapon && (
          <span className="equip-icon weapon-icon" title={player.equipment.weapon.name}>{player.equipment.weapon.name}</span>
        )}
        {player.equipment.armor && (
          <span className="equip-icon armor-icon" title={player.equipment.armor.name}>{player.equipment.armor.name}</span>
        )}
        {player.equipment.plusHorse && (
          <span className="equip-icon horse-icon">+1</span>
        )}
        {player.equipment.minusHorse && (
          <span className="equip-icon horse-icon">-1</span>
        )}
      </div>

      {player.judgmentArea.length > 0 && (
        <div className="seat-judgment">
          {player.judgmentArea.map(card => (
            <span key={card.instanceId} className="judgment-card">{card.name}</span>
          ))}
        </div>
      )}

      <div className="seat-hand-count">
        手牌: {player.hand.length}
      </div>

      {player.isChainLinked && <span className="chain-icon">锁</span>}
      {player.isTurnedOver && <span className="turned-icon">翻</span>}
    </div>
  );
}
