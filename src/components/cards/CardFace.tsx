// ============================================================
// CardFace component - shows a single card
// ============================================================

import type { GameCard } from '../../types/cards';

interface CardFaceProps {
  card: GameCard;
  size?: 'small' | 'medium' | 'large';
  onClick?: () => void;
  selected?: boolean;
}

export function CardFace({ card, size = 'medium', onClick, selected }: CardFaceProps) {
  const suitSymbol = getSuitSymbol(card.suit);
  const suitColor = card.suit === 'heart' || card.suit === 'diamond' ? 'red' : 'black';

  return (
    <div
      className={`card-face card-${size} card-type-${card.category} ${selected ? 'card-selected' : ''}`}
      onClick={onClick}
    >
      <div className="card-corner card-corner-tl">
        <span className={`card-rank ${suitColor}`}>{card.rankDisplay}</span>
        <span className={`card-suit ${suitColor}`}>{suitSymbol}</span>
      </div>

      <div className="card-body">
        <span className={`card-name-text ${suitColor}`}>{card.name}</span>
      </div>

      <div className="card-corner card-corner-br">
        <span className={`card-rank ${suitColor}`}>{card.rankDisplay}</span>
        <span className={`card-suit ${suitColor}`}>{suitSymbol}</span>
      </div>

      {card.category === 'equipment' && (
        <div className="card-tag equip-tag">
          {card.equipSlot === 'weapon' && `武器 ${card.weaponRange ? `范围${card.weaponRange}` : ''}`}
          {card.equipSlot === 'armor' && '防具'}
          {card.equipSlot === 'plusHorse' && '+1马'}
          {card.equipSlot === 'minusHorse' && '-1马'}
        </div>
      )}

      {card.toolTiming === 'delayed' && (
        <div className="card-tag delayed-tag">延时</div>
      )}

      {(card.isFireElement || card.isThunderElement) && (
        <div className={`card-tag ${card.isFireElement ? 'fire-tag' : 'thunder-tag'}`}>
          {card.isFireElement ? '火' : '雷'}
        </div>
      )}
    </div>
  );
}

export function CardBack() {
  return (
    <div className="card-face card-medium card-back">
      <div className="card-back-pattern">三国杀</div>
    </div>
  );
}

function getSuitSymbol(suit: string): string {
  switch (suit) {
    case 'spade': return '♠';
    case 'heart': return '♥';
    case 'club': return '♣';
    case 'diamond': return '♦';
    default: return '?';
  }
}
