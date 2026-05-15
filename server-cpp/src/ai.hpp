#pragma once
#include "types.hpp"
#include "distance.hpp"
#include "identity.hpp"
#include <random>
#include <algorithm>
#include <cmath>

// ============================================================
// AIController — rule-based AI decision making
// ============================================================
namespace ai {

// Scoring weights
struct AIScorer {
  static constexpr int DAMAGE_ENEMY = 60;
  static constexpr int DAMAGE_ALLY = -80;
  static constexpr int KILL_ENEMY_BONUS = 200;
  static constexpr int AVOID_DEATH = 500;
  static constexpr int DYING_HEAL = 300;
  static constexpr int HEAL_SELF = 40;
  static constexpr int HEAL_ALLY = 50;
  static constexpr int STEAL_FROM_ENEMY = 45;
  static constexpr int EQUIP_CARD = 18;
  static constexpr int DISCARD_CARD = -5;
  static constexpr int PLAY_TOOL = 30;
  static constexpr int PASS_RESPONSE = 0;

  // Card keep values (how much AI wants to keep each card type)
  static int getCardKeepValue(const std::string& subtype) {
    if (subtype == "tao") return 10;
    if (subtype == "wuzhong_shengyou") return 9;
    if (subtype == "shan") return 7;
    if (subtype == "wuxie_keji") return 8;
    if (subtype == "sha") return 5;
    if (subtype == "shunshou_qianyang") return 8;
    if (subtype == "guohe_chaiqiao") return 8;
    if (subtype == "juedou") return 3;
    if (subtype == "jiu") return 4;
    if (subtype == "nanman_ruqin") return 4;
    if (subtype == "wanjian_qifa") return 4;
    if (subtype == "taoyuan_jieyi") return 6;
    if (subtype == "wugu_fengdeng") return 6;
    if (subtype == "jiedao_sharen") return 4;
    if (subtype == "tiesuo_lianhuan") return 4;
    // Equipment
    if (subtype == "zhugeliannu") return 15;
    if (subtype == "baguazhen") return 12;
    if (subtype == "renwangdun") return 12;
    if (subtype == "hanbingjian") return 10;
    if (subtype == "chaqi") return 3;
    return 1;
  }

  static int scoreKeeping(const GameCard& card) {
    return getCardKeepValue(card.subtype);
  }
};

// Identity persona multipliers
struct Persona {
  float aggression;
  float teamPlay;
  float selfPreservation;
  float riskTolerance;

  static Persona forIdentity(Identity id) {
    switch (id) {
      case Identity::Ruler: return {1.0f, 1.3f, 1.5f, 0.4f};
      case Identity::Loyalist: return {1.2f, 1.6f, 1.1f, 0.6f};
      case Identity::Rebel: return {1.5f, 1.0f, 0.9f, 0.8f};
      case Identity::Spy: return {1.0f, 0.5f, 1.8f, 0.2f};
    }
    return {1.0f, 1.0f, 1.0f, 0.5f};
  }
};

// Find the best card to discard
inline int chooseDiscardIndex(const PlayerState& player, std::mt19937& rng) {
  if (player.hand.empty()) return -1;
  int worstIdx = 0;
  int worstScore = 9999;
  for (int i = 0; i < (int)player.hand.size(); i++) {
    int s = AIScorer::scoreKeeping(player.hand[i]);
    if (s < worstScore) { worstScore = s; worstIdx = i; }
  }
  return worstIdx;
}

// Handle pending action (response to sha/nanman/wanjian/juedou/dying/wuxie)
inline GameAction handlePendingAction(const GameState& state, const std::string& playerId, std::mt19937& rng) {
  if (!state.pendingAction) return {ActionType::PassResponse, playerId, PassResponseData{}};

  const auto& pa = *state.pendingAction;
  const PlayerState* player = nullptr;
  for (auto& p : state.players) if (p.id == playerId) { player = &p; break; }
  if (!player) return {ActionType::PassResponse, playerId, PassResponseData{}};

  // Dying — use tao if available
  if (pa.type == PendingType::UseTaoDying && pa.playerId == playerId) {
    for (auto& c : player->hand) {
      if (c.subtype == "tao") {
        return {ActionType::UseTaoSelf, playerId, UseTaoData{c.id, playerId}};
      }
    }
    return {ActionType::PassSaveDying, playerId, {}};
  }

  // Response to Sha — use shan
  if (pa.type == PendingType::RespondSha && pa.playerId == playerId) {
    for (auto& c : player->hand) {
      if (c.subtype == "shan") {
        return {ActionType::Respond, playerId, RespondData{c.id, {pa.sourcePlayerId}}};
      }
    }
    // Check baguazhen
    if (player->equipment.armor && player->equipment.armor->subtype == "baguazhen") {
      // Judge baguazhen (50% chance via simplified — just pass)
    }
    // Use tao if dying would kill us
    if (player->hp <= 1) {
      for (auto& c : player->hand) {
        if (c.subtype == "tao") {
          return {ActionType::UseTaoSelf, playerId, UseTaoData{c.id, playerId}};
        }
      }
    }
    return {ActionType::PassResponse, playerId, PassResponseData{}};
  }

  // Nanman — use sha if low HP
  if (pa.type == PendingType::RespondNanman && pa.playerId == playerId) {
    if (player->hp <= 2) {
      for (auto& c : player->hand) {
        if (c.subtype == "sha") {
          return {ActionType::Respond, playerId, RespondData{c.id, {pa.sourcePlayerId}}};
        }
      }
    }
    return {ActionType::PassResponse, playerId, PassResponseData{}};
  }

  // Wanjian — use shan
  if (pa.type == PendingType::RespondWanjian && pa.playerId == playerId) {
    for (auto& c : player->hand) {
      if (c.subtype == "shan") {
        return {ActionType::Respond, playerId, RespondData{c.id, {pa.sourcePlayerId}}};
      }
    }
    return {ActionType::PassResponse, playerId, PassResponseData{}};
  }

  // Juedou — use sha
  if (pa.type == PendingType::RespondJuedou && pa.playerId == playerId) {
    for (auto& c : player->hand) {
      if (c.subtype == "sha") {
        return {ActionType::Respond, playerId, RespondData{c.id, {pa.sourcePlayerId}}};
      }
    }
    return {ActionType::PassResponse, playerId, PassResponseData{}};
  }

  // Wuxie — 50% to use
  if (pa.type == PendingType::WuxieOpportunity) {
    auto dist = std::uniform_real_distribution<>(0.0, 1.0);
    if (dist(rng) < 0.5) {
      for (auto& c : player->hand) {
        if (c.subtype == "wuxie_keji") {
          return {ActionType::PlayWuxie, playerId, PlayWuxieData{c.id}};
        }
      }
    }
    return {ActionType::PassWuxie, playerId, {}};
  }

  return {ActionType::PassResponse, playerId, PassResponseData{}};
}

// Check if two players are enemies based on revealed identity
inline bool isEnemyOf(const PlayerState& viewer, const PlayerState& target) {
  if (!target.identityRevealed) return false;
  return identity::areEnemies(viewer.identity, target.identity);
}

// Check if two players are allies
inline bool isAllyOf(const PlayerState& viewer, const PlayerState& target) {
  if (!target.identityRevealed) return false;
  return identity::areAllies(viewer.identity, target.identity);
}

} // namespace ai
