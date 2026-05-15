#pragma once
#include "types.hpp"
#include "distance.hpp"
#include <algorithm>
#include <set>

// ============================================================
// RulesEngine — action validation
// ============================================================
namespace rules {

// Forward declarations of helper checks
inline bool hasCard(const PlayerState& p, const std::string& cardId) {
  for (auto& c : p.hand) if (c.id == cardId) return true;
  return false;
}

inline const GameCard* getCard(const PlayerState& p, const std::string& cardId) {
  for (auto& c : p.hand) if (c.id == cardId) return &c;
  return nullptr;
}

inline const PlayerState* findPlayer(const GameState& s, const std::string& id) {
  for (auto& p : s.players) if (p.id == id) return &p;
  return nullptr;
}

inline bool hasSkill(const PlayerState& p, const std::string& skillId) {
  return std::find(p.skills.begin(), p.skills.end(), skillId) != p.skills.end();
}

inline bool hasEquipment(const PlayerState& p, const std::string& subtype) {
  if (p.equipment.weapon && p.equipment.weapon->subtype == subtype) return true;
  if (p.equipment.armor && p.equipment.armor->subtype == subtype) return true;
  return false;
}

inline bool isCurrentPlayer(const GameState& s, const std::string& id) {
  if (s.currentPlayerIndex < 0 || s.currentPlayerIndex >= (int)s.turnOrder.size()) return false;
  return s.turnOrder[s.currentPlayerIndex] == id;
}

inline bool isAlive(const PlayerState& p) { return p.aliveStatus == AliveStatus::Alive; }

// ============================================================
// Main validateAction dispatcher
// ============================================================
inline bool validateAction(const GameState& state, const GameAction& action) {
  const PlayerState* player = findPlayer(state, action.playerId);
  if (!player || !isAlive(*player)) return false;

  switch (action.type) {
    case ActionType::PlayCard: {
      auto* d = std::get_if<PlayCardData>(&action.data);
      if (!d || d->cardId.empty()) return false;
      const GameCard* card = getCard(*player, d->cardId);
      if (!card) return false;

      // Turn phase check
      if (state.currentTurnPhase != TurnPhase::Play && card->timing != CardTiming::Response) return false;
      if (!isCurrentPlayer(state, action.playerId) && card->timing != CardTiming::Response) return false;

      // Sha once-per-turn (unless Zhuge Liannu or Paoxiao)
      if (card->subtype == "sha") {
        if (player->shaUsed && !hasEquipment(*player, "zhugeliannu") && !hasSkill(*player, "paoxiao"))
          return false;
        if (d->targetIds.empty()) return false;
        for (auto& tid : d->targetIds) {
          if (tid == action.playerId) return false; // can't target self
          const PlayerState* target = findPlayer(state, tid);
          if (!target || target->aliveStatus == AliveStatus::Dead) return false;
          if (!dist::isInRange(state, action.playerId, tid)) return false;
        }
      }

      // Shan can only be used in response
      if (card->subtype == "shan") return false;

      // Tao — must be dying or in danger
      if (card->subtype == "tao") {
        if (player->hp >= player->maxHp) return false;
        return true;
      }

      // Jiu
      if (card->subtype == "jiu") {
        if (!isCurrentPlayer(state, action.playerId)) return false;
        if (player->jiuUsed) return false;
        return true;
      }

      // Tool cards — various targeting checks
      if (card->category == CardCategory::Tool) {
        if (card->subtype == "guohe_chaiqiao" || card->subtype == "shunshou_qianyang") {
          if (d->targetIds.size() != 1) return false;
          const PlayerState* target = findPlayer(state, d->targetIds[0]);
          if (!target || !isAlive(*target)) return false;
          if (d->targetIds[0] == action.playerId) return false;
          if (!hasSkill(*player, "qicai")) {
            if (!dist::isInRange(state, action.playerId, d->targetIds[0])) return false;
          }
          return true;
        }
        if (card->subtype == "wuzhong_shengyou") {
          return d->targetIds.empty();
        }
        if (card->subtype == "juedou") {
          if (d->targetIds.size() != 1) return false;
          if (d->targetIds[0] == action.playerId) return false;
          return true;
        }
        if (card->subtype == "nanman_ruqin" || card->subtype == "wanjian_qifa") {
          return d->targetIds.empty(); // AOE auto-targets all
        }
        if (card->subtype == "taoyuan_jieyi") {
          return d->targetIds.empty();
        }
        if (card->subtype == "wugu_fengdeng") {
          return d->targetIds.empty();
        }
        if (card->subtype == "jiedao_sharen") {
          if (d->targetIds.size() != 1) return false;
          const PlayerState* target = findPlayer(state, d->targetIds[0]);
          if (!target || !isAlive(*target)) return false;
          // Target must have a weapon
          if (!target->equipment.weapon) return false;
          return true;
        }
        if (card->subtype == "tiesuo_lianhuan") {
          if (d->targetIds.empty() || d->targetIds.size() > 2) return false;
          for (auto& tid : d->targetIds) {
            const PlayerState* t = findPlayer(state, tid);
            if (!t || t->aliveStatus == AliveStatus::Dead) return false;
          }
          return true;
        }
        if (card->subtype == "wuxie_keji") {
          return false; // Only playable in response
        }
        // Delayed tools — place in judgment area
        if (card->subtype == "lebu_sishu" || card->subtype == "bingliang_cunduan" || card->subtype == "shandian") {
          if (d->targetIds.size() != 1) return false;
          if (d->targetIds[0] == action.playerId) return false;
          return true;
        }
        return true;
      }

      // Equipment cards — must be played on self during play phase
      if (card->category == CardCategory::Equipment) {
        return false; // Use EQUIP_CARD action type
      }

      return true;
    }

    case ActionType::EquipCard: {
      auto* d = std::get_if<EquipCardData>(&action.data);
      if (!d) return false;
      if (!isCurrentPlayer(state, action.playerId)) return false;
      if (state.currentTurnPhase != TurnPhase::Play) return false;
      const GameCard* card = getCard(*player, d->cardId);
      if (!card || card->category != CardCategory::Equipment) return false;
      return true;
    }

    case ActionType::DiscardCard: {
      auto* d = std::get_if<DiscardCardData>(&action.data);
      if (!d) return false;
      if (!isCurrentPlayer(state, action.playerId)) return false;
      if (state.currentTurnPhase != TurnPhase::Discard) return false;
      if (!hasCard(*player, d->cardId)) return false;
      return true;
    }

    case ActionType::UseTaoSelf: {
      auto* d = std::get_if<UseTaoData>(&action.data);
      if (!d) return false;
      if (!hasCard(*player, d->cardId)) return false;
      const GameCard* card = getCard(*player, d->cardId);
      if (!card || card->subtype != "tao") return false;
      return player->hp < player->maxHp;
    }

    case ActionType::UseTaoOther: {
      auto* d = std::get_if<UseTaoData>(&action.data);
      if (!d) return false;
      if (!state.pendingAction || state.pendingAction->type != PendingType::UseTaoDying) return false;
      const PlayerState* target = findPlayer(state, d->targetId);
      if (!target || target->aliveStatus != AliveStatus::Dying) return false;
      if (!hasCard(*player, d->cardId)) return false;
      const GameCard* card = getCard(*player, d->cardId);
      if (!card || card->subtype != "tao") return false;
      return true;
    }

    case ActionType::Respond: {
      auto* d = std::get_if<RespondData>(&action.data);
      if (!d) return false;
      if (!state.pendingAction) return false;
      if (state.pendingAction->playerId != action.playerId) return false;
      if (!hasCard(*player, d->cardId)) return false;
      return true;
    }

    case ActionType::PassResponse: {
      if (!state.pendingAction) return false;
      return state.pendingAction->playerId == action.playerId;
    }

    case ActionType::PlayWuxie: {
      if (!state.pendingAction || state.pendingAction->type != PendingType::WuxieOpportunity) return false;
      auto* d = std::get_if<PlayWuxieData>(&action.data);
      if (!d) return false;
      if (!hasCard(*player, d->cardId)) return false;
      return true;
    }

    case ActionType::PassWuxie: {
      if (!state.pendingAction || state.pendingAction->type != PendingType::WuxieOpportunity) return false;
      return true;
    }

    case ActionType::PassSaveDying: {
      if (!state.pendingAction || state.pendingAction->type != PendingType::UseTaoDying) return false;
      return true;
    }

    case ActionType::UseSkill: {
      auto* d = std::get_if<UseSkillData>(&action.data);
      if (!d) return false;
      if (!hasSkill(*player, d->skillId)) return false;
      if (!isCurrentPlayer(state, action.playerId)) return false;
      return true;
    }

    case ActionType::EndTurn: {
      if (!isCurrentPlayer(state, action.playerId)) return false;
      return true;
    }

    case ActionType::SelectCharacter: {
      auto* d = std::get_if<SelectCharacterData>(&action.data);
      if (!d) return false;
      if (state.gamePhase != GamePhase::CharacterSelect) return false;
      if (!player->characterId.empty()) return false; // already selected
      return true;
    }

    case ActionType::StartGame: {
      if (state.gamePhase != GamePhase::CharacterSelect) return false;
      return true;
    }

    default:
      return true; // System actions are always valid
  }
}

// ============================================================
// getValidActions — enumerate all legal actions for a player
// ============================================================
inline std::vector<GameAction> getValidActions(const GameState& state, const std::string& playerId) {
  std::vector<GameAction> actions;
  const PlayerState* player = findPlayer(state, playerId);
  if (!player || !isAlive(*player)) return actions;

  // If there's a pending action requiring response
  if (state.pendingAction && state.pendingAction->playerId == playerId) {
    PendingType pt = state.pendingAction->type;

    if (pt == PendingType::RespondSha) {
      for (auto& c : player->hand) {
        if (c.subtype == "shan") {
          actions.push_back({ActionType::Respond, playerId, RespondData{c.id, {state.pendingAction->sourcePlayerId}}});
        }
      }
      actions.push_back({ActionType::PassResponse, playerId, PassResponseData{}});
    } else if (pt == PendingType::RespondNanman) {
      for (auto& c : player->hand) {
        if (c.subtype == "sha") {
          actions.push_back({ActionType::Respond, playerId, RespondData{c.id, {state.pendingAction->sourcePlayerId}}});
        }
      }
      actions.push_back({ActionType::PassResponse, playerId, PassResponseData{}});
    } else if (pt == PendingType::RespondWanjian) {
      for (auto& c : player->hand) {
        if (c.subtype == "shan") {
          actions.push_back({ActionType::Respond, playerId, RespondData{c.id, {state.pendingAction->sourcePlayerId}}});
        }
      }
      actions.push_back({ActionType::PassResponse, playerId, PassResponseData{}});
    } else if (pt == PendingType::RespondJuedou) {
      for (auto& c : player->hand) {
        if (c.subtype == "sha") {
          actions.push_back({ActionType::Respond, playerId, RespondData{c.id, {state.pendingAction->sourcePlayerId}}});
        }
      }
      actions.push_back({ActionType::PassResponse, playerId, PassResponseData{}});
    } else if (pt == PendingType::UseTaoDying) {
      if (state.pendingAction->playerId == playerId) {
        for (auto& c : player->hand) {
          if (c.subtype == "tao") {
            actions.push_back({ActionType::UseTaoSelf, playerId, UseTaoData{c.id, playerId}});
          }
        }
      }
      // Other players can use tao on dying player
      for (auto& c : player->hand) {
        if (c.subtype == "tao") {
          actions.push_back({ActionType::UseTaoOther, playerId, UseTaoData{c.id, state.pendingAction->playerId}});
        }
      }
      actions.push_back({ActionType::PassSaveDying, playerId, {}});
    } else if (pt == PendingType::WuxieOpportunity) {
      for (auto& c : player->hand) {
        if (c.subtype == "wuxie_keji") {
          actions.push_back({ActionType::PlayWuxie, playerId, PlayWuxieData{c.id}});
        }
      }
      actions.push_back({ActionType::PassWuxie, playerId, {}});
    }
    return actions;
  }

  // Player's own turn actions
  if (isCurrentPlayer(state, playerId)) {
    // End turn
    actions.push_back({ActionType::EndTurn, playerId, {}});

    if (state.currentTurnPhase == TurnPhase::Play) {
      for (auto& c : player->hand) {
        // Sha
        if (c.subtype == "sha" || c.subtype == "huosha" || c.subtype == "leisha") {
          if (!player->shaUsed || hasEquipment(*player, "zhugeliannu") || hasSkill(*player, "paoxiao")) {
            for (auto& target : state.players) {
              if (target.id == playerId || target.aliveStatus == AliveStatus::Dead) continue;
              if (dist::isInRange(state, playerId, target.id)) {
                actions.push_back({ActionType::PlayCard, playerId, PlayCardData{c.id, {target.id}}});
              }
            }
          }
        }
        // Tao (self-heal)
        if (c.subtype == "tao" && player->hp < player->maxHp) {
          actions.push_back({ActionType::UseTaoSelf, playerId, UseTaoData{c.id, playerId}});
        }
        // Jiu
        if (c.subtype == "jiu" && !player->jiuUsed) {
          actions.push_back({ActionType::PlayCard, playerId, PlayCardData{c.id, {}}});
        }
        // Equipment
        if (c.category == CardCategory::Equipment) {
          actions.push_back({ActionType::EquipCard, playerId, EquipCardData{c.id}});
        }
        // Tools
        if (c.category == CardCategory::Tool) {
          if (c.subtype == "wuzhong_shengyou") {
            actions.push_back({ActionType::PlayCard, playerId, PlayCardData{c.id, {}}});
          }
          if (c.subtype == "taoyuan_jieyi") {
            actions.push_back({ActionType::PlayCard, playerId, PlayCardData{c.id, {}}});
          }
          if (c.subtype == "wugu_fengdeng") {
            actions.push_back({ActionType::PlayCard, playerId, PlayCardData{c.id, {}}});
          }
          if (c.subtype == "nanman_ruqin" || c.subtype == "wanjian_qifa") {
            actions.push_back({ActionType::PlayCard, playerId, PlayCardData{c.id, {}}});
          }
          // Target tools
          for (auto& target : state.players) {
            if (target.id == playerId || target.aliveStatus == AliveStatus::Dead) continue;
            bool inRange = dist::isInRange(state, playerId, target.id) || hasSkill(*player, "qicai");
            if (c.subtype == "guohe_chaiqiao" || c.subtype == "shunshou_qianyang") {
              if (inRange) actions.push_back({ActionType::PlayCard, playerId, PlayCardData{c.id, {target.id}}});
            }
            if (c.subtype == "juedou") {
              actions.push_back({ActionType::PlayCard, playerId, PlayCardData{c.id, {target.id}}});
            }
            if (c.subtype == "jiedao_sharen" && target.equipment.weapon) {
              actions.push_back({ActionType::PlayCard, playerId, PlayCardData{c.id, {target.id}}});
            }
            if (c.subtype == "tiesuo_lianhuan") {
              actions.push_back({ActionType::PlayCard, playerId, PlayCardData{c.id, {target.id}}});
            }
            if (c.subtype == "lebu_sishu" || c.subtype == "bingliang_cunduan" || c.subtype == "shandian") {
              actions.push_back({ActionType::PlayCard, playerId, PlayCardData{c.id, {target.id}}});
            }
          }
        }
      }

      // Skill actions
      for (auto& sid : player->skills) {
        // Check if skill is active (playable during play phase)
        if (sid == "wusheng" || sid == "longdan" || sid == "jijiang" || sid == "rende" ||
            sid == "zhiheng" || sid == "fanjian" || sid == "kurou" || sid == "lijian" ||
            sid == "qingnang" || sid == "luanji") {
          actions.push_back({ActionType::UseSkill, playerId, UseSkillData{sid, {}, {}}});
        }
      }
    }

    if (state.currentTurnPhase == TurnPhase::Discard) {
      int handLimit = player->hp;
      if ((int)player->hand.size() > handLimit) {
        for (auto& c : player->hand) {
          actions.push_back({ActionType::DiscardCard, playerId, DiscardCardData{c.id}});
        }
      } else {
        actions.push_back({ActionType::EndTurn, playerId, {}});
      }
    }
  }

  return actions;
}

} // namespace rules
