// ============================================================
// Game log - scrollable action history
// ============================================================

import { useEffect, useRef } from 'react';
import type { ActionLogEntry } from '../../types/game';
import { describeAction } from '../../types/actions';

interface GameLogProps {
  entries: ActionLogEntry[];
}

export function GameLog({ entries }: GameLogProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [entries.length]);

  return (
    <div className="game-log" ref={ref}>
      {entries.slice(-20).map((entry, i) => (
        <div key={i} className="log-entry">
          <span className="log-player">{entry.playerName || entry.playerId}</span>
          <span className="log-action">{describeAction(entry.action)}</span>
        </div>
      ))}
    </div>
  );
}
