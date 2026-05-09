// ============================================================
// Action bar - context-sensitive action buttons
// ============================================================

import { useGame } from '../../store/GameContext';

export function ActionBar() {
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

    // Response modes
    const responseLabel =
      pa.type === 'respond_to_sha' ? '闪' :
      pa.type === 'respond_to_nanman' ? '杀' :
      pa.type === 'respond_to_wanjian' ? '闪' :
      pa.type === 'respond_to_juedou' ? '杀' :
      pa.type === 'use_tao_dying' ? '桃' : '';

    const hasBaguazhen = pa.type === 'respond_to_sha' && pa.extra?.hasBaguazhen === true;

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
