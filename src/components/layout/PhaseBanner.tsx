// ============================================================
// Phase banner - shows current phase and player turn
// ============================================================

import type { TurnPhase } from '../../types/game';

interface PhaseBannerProps {
  phase: TurnPhase;
  playerName: string;
  isViewerTurn?: boolean;
}

const PHASE_NAMES: Record<TurnPhase, string> = {
  judge: '判定阶段',
  draw: '摸牌阶段',
  play: '出牌阶段',
  discard: '弃牌阶段',
  end: '回合结束',
};

export function PhaseBanner({ phase, playerName, isViewerTurn }: PhaseBannerProps) {
  return (
    <div className="phase-banner">
      <span className="phase-turn">{playerName}的回合{!isViewerTurn ? '（观战中）' : ''}</span>
      <span className="phase-current">{PHASE_NAMES[phase]}</span>
    </div>
  );
}
