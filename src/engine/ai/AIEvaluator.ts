// ============================================================
// AI Action Evaluator - enumerate and evaluate all possible actions
// ============================================================

import type { GameState } from '../../types/game';
import type { GameAction } from '../../types/actions';
import { findPlayer } from '../core/GameState';
import { getCurrentPlayer, getAlivePlayers } from '../../types/game';
import { getValidActions } from '../core/RulesEngine';
import { scoreAction, getCardKeepValue } from './AIScorer';
import { getPersona, applyPersona } from './AIPersonas';
import { getKnownEnemies, getKnownAllies } from '../systems/IdentitySystem';

interface ScoredAction {
  action: GameAction;
  score: number;
}

export function evaluateBestAction(state: GameState, playerId: string): GameAction {
  const player = findPlayer(state, playerId);
  if (!player) return { type: 'END_TURN', playerId };

  const validActions = getValidActions(state, playerId);
  const persona = getPersona(player.identity);
  const enemies = getKnownEnemies(state, playerId);
  const allies = getKnownAllies(state, playerId);

  const scored: ScoredAction[] = [];

  for (const action of validActions) {
    let score = scoreAction(state, action, playerId);

    // Expand targets for PLAY_CARD actions
    if (action.type === 'PLAY_CARD') {
      const card = player.hand.find(c => c.instanceId === action.cardId);
      if (card) {
        if (card.subtype === 'sha') {
          // For 杀, prefer targeting enemies
          const alive = getAlivePlayers(state).filter(p => p.id !== playerId);
          let bestTargetScore = -Infinity;
          let bestTargets: string[] = [];

          for (const target of alive) {
            const isEnemy = enemies.includes(target.id);
            const isAlly = allies.includes(target.id);
            let targetScore = score;

            if (isEnemy) {
              targetScore = applyPersona(targetScore, persona, 'damage');
              if (target.hp <= 1) targetScore += 100;
            } else if (isAlly) {
              targetScore = applyPersona(targetScore, persona, 'team');
              targetScore -= 80; // penalize hitting allies
            } else {
              targetScore *= 0.7;
            }

            if (targetScore > bestTargetScore) {
              bestTargetScore = targetScore;
              bestTargets = [target.id];
            }
          }

          if (bestTargets.length > 0) {
            scored.push({
              action: { ...action, targets: bestTargets },
              score: bestTargetScore,
            });
            continue;
          }
        } else if (card.category === 'tool') {
          // For tool cards, find best target
          const alive = getAlivePlayers(state);
          let bestTargetScore = score;
          let bestTargets: string[] = [];

          // Prefer enemies for harmful tools, allies for helpful ones
          const isHarmful = ['guohe_chaiqiao', 'shunshou_qianyang', 'juedou', 'jiedao_sharen'].includes(card.subtype);
          const isAOE = ['nanman_ruqin', 'wanjian_qifa'].includes(card.subtype);
          const isChain = card.subtype === 'tiesuo_lianhuan';
          const isDelayed = ['lebu_sishu', 'bingliang_cunduan', 'shandian'].includes(card.subtype);

          if (isHarmful) {
            for (const target of alive) {
              if (target.id === playerId) continue;
              const isEnemy = enemies.includes(target.id);
              if (isEnemy) {
                bestTargetScore = applyPersona(score, persona, 'damage');
                bestTargets = [target.id];
                break;
              }
            }
          } else if (isAOE) {
            // AOE: count enemies vs allies affected
            const enemyCount = alive.filter(p => enemies.includes(p.id)).length;
            const allyCount = alive.filter(p => allies.includes(p.id)).length;
            const net = enemyCount - allyCount;
            score = applyPersona(score + net * 15, persona, 'damage');
            bestTargets = [];
          } else if (isChain) {
            // 铁索连环: chain enemies together for fire/thunder propagation
            const enemyTargets = alive.filter(p => enemies.includes(p.id) && !p.isChainLinked);
            if (enemyTargets.length > 0) {
              bestTargetScore = applyPersona(score + 10, persona, 'damage');
              bestTargets = enemyTargets.slice(0, 2).map(p => p.id);
            }
          } else if (isDelayed) {
            // Delayed tools: target enemies
            for (const target of alive) {
              if (target.id === playerId) continue;
              if (enemies.includes(target.id)) {
                bestTargetScore = applyPersona(score, persona, 'damage');
                bestTargets = [target.id];
                break;
              }
            }
          }

          scored.push({
            action: { ...action, targets: bestTargets },
            score: bestTargetScore,
          });
          continue;
        }
      }
    }

    // Adjust score by persona
    if (action.type === 'USE_TAO_SELF') {
      score = applyPersona(score, persona, 'self');
    } else if (action.type === 'USE_TAO_OTHER') {
      score = applyPersona(score, persona, 'team');
    } else if (action.type === 'EQUIP_CARD') {
      score = applyPersona(score, persona, 'self');
    } else if (action.type === 'USE_SKILL') {
      score = applyPersona(score, persona, 'self');
    }

    scored.push({ action, score });
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Add some randomness for top-tier actions (±10%)
  if (scored.length > 1) {
    const topScore = scored[0].score;
    const candidates = scored.filter(s => s.score >= topScore * 0.85);
    if (candidates.length > 1) {
      // Pick randomly from top candidates
      return candidates[Math.floor(Math.random() * candidates.length)].action;
    }
  }

  // If no valid actions, pass/end phase
  if (scored.length === 0) {
    const currentPlayer = getCurrentPlayer(state);
    if (currentPlayer.id === playerId) {
      if (state.currentTurnPhase === 'play') {
        return { type: 'END_PHASE', playerId };
      }
      return { type: 'END_TURN', playerId };
    }
    // If pending action on this player, pass response
    if (state.pendingAction?.playerId === playerId) {
      return { type: 'PASS_RESPONSE', playerId };
    }
    return { type: 'END_TURN', playerId };
  }

  return scored[0].action;
}

// Choose which cards to discard (for discard phase)
export function chooseDiscards(state: GameState, playerId: string, count: number): string[] {
  const player = findPlayer(state, playerId);
  if (!player) return [];

  const scored = player.hand.map(card => ({
    id: card.instanceId,
    value: getCardKeepValue(card),
  }));

  scored.sort((a, b) => a.value - b.value); // keep highest, discard lowest

  return scored.slice(0, count).map(c => c.id);
}
