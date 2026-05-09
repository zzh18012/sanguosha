// ============================================================
// Hand display - shows player's cards in a fan layout
// Also handles all interaction modes: response, card picking, etc.
// ============================================================

import { useState, useMemo } from 'react';
import { useGame } from '../../store/GameContext';
import { findPlayer } from '../../engine/core/GameState';
import { getAlivePlayers } from '../../types/game';
import { isInRange, getAttackDistance } from '../../engine/systems/DistanceSystem';
import { getSkill } from '../../engine/characters/SkillEngine';
import type { GameCard } from '../../types/cards';
import type { GameAction } from '../../types/actions';

interface HandDisplayProps {
  playerId: string;
}

export function HandDisplay({ playerId }: HandDisplayProps) {
  const { state, dispatch, validActions } = useGame();
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);

  const player = findPlayer(state, playerId);
  if (!player) return null;

  const pendingType = state.pendingAction?.type;
  const pendingPlayerId = state.pendingAction?.playerId;

  const handleCardClick = (cardId: string) => {
    if (selectedCard === cardId) {
      setSelectedCard(null);
      setSelectedTargets([]);
    } else {
      setSelectedCard(cardId);
      setSelectedTargets([]);
    }
  };

  // Get valid targets for a card (for display/selection), returns list of valid target IDs
  const getValidTargets = (card: typeof player.hand[0]): string[] => {
    const others = getAlivePlayers(state).filter(p => p.id !== playerId);

    // Cards that don't need targets
    if (card.subtype === 'wuzhong_shengyou' ||
        card.subtype === 'nanman_ruqin' ||
        card.subtype === 'wanjian_qifa' ||
        card.subtype === 'taoyuan_jieyi' ||
        card.subtype === 'wugu_fengdeng' ||
        card.subtype === 'jiu') {
      return [];
    }

    // 杀: targets in weapon range
    if (card.subtype === 'sha') {
      return others.filter(p => isInRange(state, playerId, p.id)).map(p => p.id);
    }

    // 过河拆桥: any other alive player (with cards)
    if (card.subtype === 'guohe_chaiqiao') {
      return others.filter(p =>
        p.hand.length > 0 || Object.values(p.equipment).some(Boolean)
      ).map(p => p.id);
    }

    // 顺手牵羊: distance ≤ 1, with cards
    if (card.subtype === 'shunshou_qianyang') {
      return others.filter(p =>
        getAttackDistance(state, playerId, p.id) === 1 &&
        (p.hand.length > 0 || Object.values(p.equipment).some(Boolean))
      ).map(p => p.id);
    }

    // 决斗: any other alive player
    if (card.subtype === 'juedou') {
      return others.map(p => p.id);
    }

    // 借刀杀人: target must have weapon and a valid attack target
    if (card.subtype === 'jiedao_sharen') {
      return others.filter(p => {
        if (!p.equipment.weapon) return false;
        return others.some(o => o.id !== p.id && isInRange(state, p.id, o.id));
      }).map(p => p.id);
    }

    // 铁索连环: any other alive player (select 1-2)
    if (card.subtype === 'tiesuo_lianhuan') {
      return others.map(p => p.id);
    }

    // 乐不思蜀/兵粮寸断/闪电: any other alive player
    if (card.subtype === 'lebu_sishu' ||
        card.subtype === 'bingliang_cunduan' ||
        card.subtype === 'shandian') {
      return others.map(p => p.id);
    }

    return [];
  };

  const handleTargetClick = (targetId: string) => {
    setSelectedTargets(prev => {
      if (prev.includes(targetId)) {
        return prev.filter(t => t !== targetId);
      }
      // Determine max targets
      const card = player.hand.find(c => c.instanceId === selectedCard);
      const maxTargets = card?.subtype === 'tiesuo_lianhuan' ? 2 : 1;
      if (prev.length >= maxTargets) {
        // For single-target cards, replace; for multi-target, reject
        if (maxTargets === 1) return [targetId];
        return prev;
      }
      return [...prev, targetId];
    });
  };

  // Get selected card info for display
  const selectedCardObj = selectedCard ? player.hand.find(c => c.instanceId === selectedCard) : null;
  const validTargetIds = selectedCardObj ? getValidTargets(selectedCardObj) : [];
  const needsTargetSelection = selectedCardObj
    && validTargetIds.length > 0
    && selectedCardObj.subtype !== 'jiu'
    && selectedCardObj.subtype !== 'wuzhong_shengyou'
    && selectedCardObj.subtype !== 'nanman_ruqin'
    && selectedCardObj.subtype !== 'wanjian_qifa'
    && selectedCardObj.subtype !== 'taoyuan_jieyi'
    && selectedCardObj.subtype !== 'wugu_fengdeng';

  // --- Interaction mode detection ---

  const pendingResponse =
    pendingPlayerId === playerId &&
    (pendingType === 'respond_to_sha' ||
     pendingType === 'respond_to_nanman' ||
     pendingType === 'respond_to_wanjian' ||
     pendingType === 'respond_to_juedou');

  const pickMode =
    pendingPlayerId === playerId &&
    (pendingType === 'pick_card_to_discard' || pendingType === 'pick_card_to_steal');

  const jiedaoMode =
    pendingPlayerId === playerId &&
    pendingType === 'jiedao_sharen_choice';

  const wuguMode =
    pendingPlayerId === playerId &&
    pendingType === 'wugu_pick_card';

  const hasBaguazhen =
    pendingType === 'respond_to_sha' &&
    pendingPlayerId === playerId &&
    state.pendingAction?.extra?.hasBaguazhen === true;

  const isValidResponseCard = (cardId: string): boolean => {
    if (!state.pendingAction?.validResponseCards) return false;
    return state.pendingAction.validResponseCards.includes(cardId);
  };

  // Extract skill actions available to this player
  const skillActions = useMemo(() => {
    return validActions
      .filter(a => a.type === 'USE_SKILL' && 'skillId' in a)
      .map(a => {
        const skillAction = a as Extract<GameAction, { type: 'USE_SKILL' }>;
        const skillDef = getSkill(skillAction.skillId);
        return { skillId: skillAction.skillId, name: skillDef?.name || skillAction.skillId, description: skillDef?.description || '' };
      });
  }, [validActions]);

  const handlePlayCard = () => {
    if (!selectedCard) return;
    const card = player.hand.find(c => c.instanceId === selectedCard);
    if (!card) return;

    if (card.category === 'equipment') {
      dispatch({ type: 'EQUIP_CARD', playerId, cardId: selectedCard });
    } else if (card.subtype === 'tao' && player.hp < player.maxHp) {
      dispatch({ type: 'USE_TAO_SELF', playerId, cardId: selectedCard });
    } else {
      dispatch({ type: 'PLAY_CARD', playerId, cardId: selectedCard, targets: selectedTargets });
    }
    setSelectedCard(null);
    setSelectedTargets([]);
  };

  const handleRespond = () => {
    if (!selectedCard) return;
    dispatch({ type: 'RESPOND', playerId, cardIds: [selectedCard] });
    setSelectedCard(null);
  };

  const handlePassResponse = () => {
    dispatch({ type: 'PASS_RESPONSE', playerId });
    setSelectedCard(null);
  };

  const handleBaguazhen = () => {
    dispatch({ type: 'JUDGE_BAGUAZHEN', playerId });
    setSelectedCard(null);
  };

  // --- Render helpers ---
  const renderCardSelector = (cards: Array<{ cardId: string; cardName: string; zone: string }>, onClick: (cardId: string) => void, label: string) => (
    <div className="target-card-picker">
      <span className="response-hint">{label}</span>
      <div className="hand-cards" style={{ justifyContent: 'center', gap: '8px' }}>
        {cards.map((c) => (
          <div key={c.cardId} className="hand-card" onClick={() => onClick(c.cardId)}
            style={{ cursor: 'pointer', marginLeft: '0' }}>
            <div className={`mini-card ${c.zone === 'equipment' ? 'card-equipment' : 'card-basic'}`}>
              <span className="card-name">{c.cardName}</span>
              <span className="card-zone-badge">{c.zone === 'equipment' ? '装备' : '手牌'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderWuguCards = (cards: GameCard[]) => (
    <div className="target-card-picker">
      <span className="response-hint">五谷丰登 — 请选择一张牌</span>
      <div className="hand-cards" style={{ justifyContent: 'center', gap: '8px' }}>
        {cards.map((c) => (
          <div key={c.instanceId} className="hand-card" onClick={() => {
            dispatch({ type: 'PICK_WUGU_CARD', playerId, cardId: c.instanceId });
          }} style={{ cursor: 'pointer', marginLeft: '0' }}>
            <div className={`mini-card card-${c.category}`}>
              <span className="card-suit">{getSuitSymbol(c.suit)}</span>
              <span className="card-rank">{c.rankDisplay}</span>
              <span className="card-name">{c.name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Render target selection buttons
  const renderTargetSelector = () => {
    if (!needsTargetSelection) return null;
    const maxTargets = selectedCardObj?.subtype === 'tiesuo_lianhuan' ? 2 : 1;
    const validPlayers = validTargetIds.map(tid => findPlayer(state, tid)).filter(Boolean);

    return (
      <div className="target-card-picker">
        <span className="response-hint">
          选择目标{maxTargets > 1 ? `（最多${maxTargets}个）` : ''}：
        </span>
        <div className="target-selector-buttons">
          {validPlayers.map(tp => {
            const isSelected = selectedTargets.includes(tp!.id);
            return (
              <button
                key={tp!.id}
                className={`btn btn-sm ${isSelected ? 'btn-active' : ''}`}
                onClick={() => handleTargetClick(tp!.id)}
              >
                {tp!.name}
                {tp!.identityRevealed ? ` (${getIdentityLabel(tp!.identity)})` : ''}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // ========== JIEDAO MODE ==========
  if (jiedaoMode) {
    const extra = state.pendingAction!.extra || {};
    const validTargetIds_jd = (extra.validTargetIds as string[]) || [];
    const hasSha = extra.hasSha as boolean;

    return (
      <div className="hand-display">
        <div className="hand-actions">
          <span className="response-hint">
            {player.name} 被借刀杀人：{hasSha ? '请选择使用杀的目标，或交出武器' : '你没有杀，只能交出武器'}
          </span>
          <div className="action-buttons">
            {hasSha && validTargetIds_jd.map((tid: string) => {
              const tp = findPlayer(state, tid);
              return (
                <button key={tid} className="btn btn-sm" onClick={() => {
                  dispatch({ type: 'JIEDAO_ATTACK', playerId, targetId: tid });
                }}>
                  对 {tp?.name || tid} 使用杀
                </button>
              );
            })}
            <button className="btn btn-sm btn-danger" onClick={() => {
              dispatch({ type: 'JIEDAO_GIVE_WEAPON', playerId });
            }}>
              交出武器
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ========== WUGU MODE ==========
  if (wuguMode) {
    const wuguCards = (state.pendingAction!.extra?.wuguCards as GameCard[]) || [];
    return (
      <div className="hand-display">
        {renderWuguCards(wuguCards)}
        <div className="hand-cards">
          {player.hand.map((card, i) => (
            <div key={card.instanceId} className="hand-card"
              style={{ transform: `rotate(${(i - player.hand.length / 2) * 3}deg) translateY(${Math.abs(i - player.hand.length / 2) * 3}px)` }}>
              <div className={`mini-card card-${card.category}`}>
                <span className="card-suit">{getSuitSymbol(card.suit)}</span>
                <span className="card-rank">{card.rankDisplay}</span>
                <span className="card-name">{card.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ========== PICK MODE (过河拆桥/顺手牵羊) ==========
  if (pickMode) {
    const extra = state.pendingAction!.extra || {};
    const availableCards = (extra.availableCards as Array<{ cardId: string; cardName: string; zone: string }>) || [];
    const targetId = extra.targetId as string;
    const targetPlayer = targetId ? findPlayer(state, targetId) : null;

    return (
      <div className="hand-display">
        <div className="target-card-picker">
          <span className="response-hint">
            {pendingType === 'pick_card_to_discard' ? '过河拆桥' : '顺手牵羊'}
            — 选择要{pendingType === 'pick_card_to_discard' ? '弃置' : '拿走'}的牌（目标：{targetPlayer?.name}）
          </span>
          <div className="hand-cards" style={{ justifyContent: 'center', gap: '8px' }}>
            {availableCards.map((c) => (
              <div key={c.cardId} className="hand-card" onClick={() => {
                dispatch({ type: 'SELECT_TARGET_CARD', playerId, cardId: c.cardId, targetPlayerId: targetId });
              }} style={{ cursor: 'pointer', marginLeft: '0' }}>
                <div className={`mini-card ${c.zone === 'equipment' ? 'card-equipment' : 'card-basic'}`}>
                  <span className="card-name">{c.cardName}</span>
                  <span className="card-zone-badge">{c.zone === 'equipment' ? '装备' : '手牌'}</span>
                </div>
              </div>
            ))}
            {availableCards.length === 0 && (
              <span className="response-hint" style={{ color: '#e74c3c' }}>目标没有可用的牌</span>
            )}
          </div>
        </div>
        <div className="hand-cards">
          {player.hand.map((card, i) => (
            <div key={card.instanceId} className="hand-card"
              style={{ transform: `rotate(${(i - player.hand.length / 2) * 3}deg) translateY(${Math.abs(i - player.hand.length / 2) * 3}px)` }}>
              <div className={`mini-card card-${card.category}`}>
                <span className="card-suit">{getSuitSymbol(card.suit)}</span>
                <span className="card-rank">{card.rankDisplay}</span>
                <span className="card-name">{card.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ========== NORMAL / RESPONSE MODE ==========
  return (
    <div className="hand-display">
      <div className="hand-cards">
        {player.hand.map((card, i) => (
          <div
            key={card.instanceId}
            className={`hand-card ${selectedCard === card.instanceId ? 'card-selected' : ''}`}
            style={{ transform: `rotate(${(i - player.hand.length / 2) * 3}deg) translateY(${Math.abs(i - player.hand.length / 2) * 3}px)` }}
            onClick={() => handleCardClick(card.instanceId)}
          >
            <div className={`mini-card card-${card.category}`}>
              <span className="card-suit">{getSuitSymbol(card.suit)}</span>
              <span className="card-rank">{card.rankDisplay}</span>
              <span className="card-name">{card.name}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Target selection mode */}
      {selectedCard && !pendingResponse && needsTargetSelection && (
        <>
          {renderTargetSelector()}
          <div className="hand-actions">
            {validTargetIds.length === 0 && (
              <span className="response-hint" style={{ color: '#e74c3c' }}>无有效目标</span>
            )}
            {selectedCardObj?.subtype === 'sha' && validTargetIds.length === 0 && (
              <span className="response-hint" style={{ color: '#e74c3c' }}>无有效目标（超出距离或装备限制）</span>
            )}
            <button
              className="btn btn-sm"
              onClick={handlePlayCard}
              disabled={selectedTargets.length === 0}
            >
              使用
            </button>
            <button className="btn btn-sm btn-danger" onClick={() => {
              dispatch({ type: 'DISCARD_CARD', playerId, cardId: selectedCard });
              setSelectedCard(null);
              setSelectedTargets([]);
            }}>弃置</button>
            <button className="btn btn-sm" onClick={() => { setSelectedCard(null); setSelectedTargets([]); }}>取消</button>
          </div>
        </>
      )}

      {/* Self-targeting or no-target cards */}
      {selectedCard && !pendingResponse && !needsTargetSelection && (
        <div className="hand-actions">
          <button className="btn btn-sm" onClick={handlePlayCard}>
            使用
          </button>
          <button className="btn btn-sm btn-danger" onClick={() => {
            dispatch({ type: 'DISCARD_CARD', playerId, cardId: selectedCard });
            setSelectedCard(null);
          }}>弃置</button>
          <button className="btn btn-sm" onClick={() => setSelectedCard(null)}>取消</button>
        </div>
      )}

      {/* Response mode with valid card selected */}
      {selectedCard && pendingResponse && isValidResponseCard(selectedCard) && (
        <div className="hand-actions">
          <button className="btn btn-sm" onClick={handleRespond}>响应</button>
          {hasBaguazhen && (
            <button className="btn btn-sm" onClick={handleBaguazhen}>八卦阵判定</button>
          )}
          <button className="btn btn-sm" onClick={() => setSelectedCard(null)}>取消</button>
        </div>
      )}

      {/* Response mode with 八卦阵 but no card selected */}
      {!selectedCard && pendingResponse && hasBaguazhen && (
        <div className="hand-actions">
          <span className="response-hint">选择一张牌响应，或使用八卦阵</span>
          <button className="btn btn-sm" onClick={handleBaguazhen}>八卦阵判定</button>
          <button className="btn btn-sm btn-danger" onClick={handlePassResponse}>放弃响应</button>
        </div>
      )}

      {/* Response mode, no card selected */}
      {pendingResponse && !selectedCard && !hasBaguazhen && (
        <div className="hand-actions">
          <span className="response-hint">请选择一张手牌响应</span>
          <button className="btn btn-sm btn-danger" onClick={handlePassResponse}>放弃响应</button>
        </div>
      )}

      {/* Response mode, selected card is invalid */}
      {pendingResponse && selectedCard && !isValidResponseCard(selectedCard) && (
        <div className="hand-actions">
          <span className="response-hint">此牌无法用于响应，请选择其他牌</span>
          {hasBaguazhen && (
            <button className="btn btn-sm" onClick={handleBaguazhen}>八卦阵判定</button>
          )}
          <button className="btn btn-sm" onClick={() => setSelectedCard(null)}>取消</button>
          <button className="btn btn-sm btn-danger" onClick={handlePassResponse}>放弃响应</button>
        </div>
      )}

      {/* Skill buttons for current player during play phase */}
      {!pendingResponse && !pickMode && !jiedaoMode && !wuguMode &&
        state.currentTurnPhase === 'play' && skillActions.length > 0 && (
        <div className="hand-actions">
          <span className="response-hint" style={{ fontSize: '12px', marginRight: '8px' }}>技能：</span>
          {skillActions.map(skill => (
            <button
              key={skill.skillId}
              className="btn btn-sm btn-skill"
              title={skill.description}
              onClick={() => {
                dispatch({ type: 'USE_SKILL', playerId, skillId: skill.skillId, targets: [] });
              }}
            >
              {skill.name}
            </button>
          ))}
        </div>
      )}

      {/* End phase button */}
      {!pendingResponse && !pickMode && !jiedaoMode && !wuguMode &&
        state.currentTurnPhase === 'play' && player.hand.length <= player.hp && (
        <div className="end-phase-action">
          <button
            className="btn btn-end-phase"
            onClick={() => dispatch({ type: 'END_PHASE', playerId })}
          >
            结束出牌阶段
          </button>
        </div>
      )}
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

function getIdentityLabel(identity: string): string {
  switch (identity) {
    case 'ruler': return '主公';
    case 'loyalist': return '忠臣';
    case 'rebel': return '反贼';
    case 'spy': return '内奸';
    default: return identity;
  }
}
