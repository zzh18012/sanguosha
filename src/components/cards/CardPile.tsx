// ============================================================
// Card pile - draw pile and discard pile visual
// ============================================================


interface CardPileProps {
  deckCount: number;
  discardCount: number;
}

export function CardPile({ deckCount, discardCount }: CardPileProps) {
  return (
    <div className="card-piles">
      <div className="pile deck-pile">
        <div className="pile-icon">🂠</div>
        <span className="pile-label">牌堆</span>
        <span className="pile-count">{deckCount}</span>
      </div>
      <div className="pile discard-pile">
        <div className="pile-icon">🗑</div>
        <span className="pile-label">弃牌堆</span>
        <span className="pile-count">{discardCount}</span>
      </div>
    </div>
  );
}
