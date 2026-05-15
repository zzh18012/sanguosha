// ============================================================
// Action bar - context-sensitive action buttons
// ============================================================

import { useGame } from '../../store/GameContext';

interface ActionBarProps {
  remainingSec?: number | null;
}

export function ActionBar({ remainingSec }: ActionBarProps) {
  const { state, dispatch, validActions } = useGame();

  const currentPlayerId = state.turnOrder[state.currentPlayerIndex];

  const handleEndTurn = () => {
    dispatch({ type: 'END_TURN', playerId: currentPlayerId });
  };

  const handleEndPhase = () => {
    dispatch({ type: 'END_PHASE', playerId: currentPlayerId });
  };

  const isPlayPhase = state.currentTurnPhase === 'play';
  const isDiscardPhase = state.currentTurnPhase === 'discard';

  const canEndPhase = validActions.some(a => a.type === 'END_PHASE');
  const canEndTurn = validActions.some(a => a.type === 'END_TURN');

  if (state.pendingAction) {
    const pa = state.pendingAction;

    // Card picking modes (过河拆桥/顺手牵羊)
    if (pa.type === 'pick_card_to_discard' || pa.type === 'pick_card_to_steal') {
      return (
        <div className="action-bar">
          <div className="pending-info">
            {pa.type === 'pick_card_to_discard' ? '过河拆桥：请从上方选择目标的一张牌弃置' : '顺手牵羊：请从上方选择目标的一张牌拿走'}
          </div>
        </div>
      );
    }

    // 借刀杀人 mode
    if (pa.type === 'jiedao_sharen_choice') {
      return (
        <div className="action-bar">
          <div className="pending-info">
            借刀杀人：请选择使用杀的目标，或交出武器
          </div>
        </div>
      );
    }

    // 五谷丰登 mode
    if (pa.type === 'wugu_pick_card') {
      return (
        <div className="action-bar">
          <div className="pending-info">
            五谷丰登：请从上方选择一张牌
          </div>
        </div>
      );
    }

    // Wuxie opportunity / chain modes
    if (pa.type === 'wuxie_opportunity' || pa.type === 'respond_to_wuxie_chain') {
      const hasWuxie = validActions.some(a => a.type === 'PLAY_WUXIE');
      const isChain = pa.type === 'respond_to_wuxie_chain';
      return (
        <div className="action-bar">
          <div className="pending-info">
            {isChain
              ? '无懈可击连锁中 — 是否再打出一张无懈可击？'
              : '等待无懈可击 — 是否使用无懈可击抵消此锦囊？'}
          </div>
          <div className="action-buttons">
            {!hasWuxie && (
              <button className="btn btn-sm" onClick={() => {
                dispatch({ type: 'PASS_WUXIE', playerId: state.players.find(p => p.aliveStatus !== 'dead')?.id || '' });
              }}>
                {isChain ? '不无懈（结算）' : '确认（不无懈）'}
              </button>
            )}
          </div>
        </div>
      );
    }

    // Response modes
    const responseLabel =
      pa.type === 'respond_to_sha' ? '闪' :
      pa.type === 'respond_to_nanman' ? '杀' :
      pa.type === 'respond_to_wanjian' ? '闪' :
      pa.type === 'respond_to_juedou' ? '杀' :
      pa.type === 'use_tao_dying' ? '桃' : '';

    const hasBaguazhen = pa.type === 'respond_to_sha' && pa.extra?.hasBaguazhen === true;

    // 濒死救援模式
    if (pa.type === 'use_tao_dying') {
      const dyingPlayer = state.players.find(p => p.id === pa.playerId);
      const isDyingPlayer = state.players.find(p => !p.isAI)?.id === pa.playerId;
      return (
        <div className="action-bar dying-bar">
          <div className="pending-info" style={{ color: '#e74c3c' }}>
            {dyingPlayer?.name || pa.playerId} 濒死，等待使用桃救援
            {isDyingPlayer && ' — 你可以使用桃/酒自救，或选择不救'}
          </div>
          <div className="action-buttons">
            {/* 不救 button — only for the dying player themselves */}
            {validActions.some(a => a.type === 'PASS_SAVE_DYING') && (
              <button className="btn btn-sm btn-danger" onClick={() => {
                dispatch({ type: 'PASS_SAVE_DYING', playerId: pa.playerId });
              }}>
                不救
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="action-bar">
        <div className="pending-info">
          {pa.type === 'use_tao_dying'
            ? `玩家 ${pa.playerId} 濒死，等待使用桃救援`
            : `需要打出 ${responseLabel}${hasBaguazhen ? '（也可使用八卦阵判定）' : ''}`}
        </div>
        <div className="action-buttons">
          {(pa.type === 'respond_to_sha' ||
            pa.type === 'respond_to_nanman' ||
            pa.type === 'respond_to_wanjian' ||
            pa.type === 'respond_to_juedou') && (
            <button className="btn btn-sm btn-danger" onClick={() => {
              dispatch({ type: 'PASS_RESPONSE', playerId: state.pendingAction!.playerId });
            }}>
              放弃响应
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="action-bar">
      <div className="action-phase-info">
        <span className="phase-label">
          {state.currentTurnPhase === 'judge' && '判定阶段'}
          {state.currentTurnPhase === 'draw' && '摸牌阶段'}
          {state.currentTurnPhase === 'play' && '出牌阶段'}
          {state.currentTurnPhase === 'discard' && '弃牌阶段'}
        </span>
        {remainingSec != null && (
          <span className={`timer-display ${remainingSec <= 5 ? 'timer-urgent' : ''}`}>
            ⏱ {remainingSec}s
          </span>
        )}
      </div>
      <div className="action-buttons">
        {isPlayPhase && canEndPhase && (
          <button className="btn" onClick={handleEndPhase}>
            结束出牌
          </button>
        )}
        {isDiscardPhase && canEndTurn && (
          <button className="btn" onClick={handleEndTurn}>
            结束回合
          </button>
        )}
      </div>
    </div>
  );
}
