#pragma once
#include "types.hpp"
#include <string>
#include <vector>
#include <map>
#include <algorithm>
#include <functional>
#include <optional>

// ============================================================
// Skill trigger types — when a skill can fire
// ============================================================
enum class SkillTrigger : uint8_t {
  on_damage_received,
  on_damage_dealt,
  on_healed,
  on_card_played,
  on_turn_start,
  on_turn_end,
  on_death,
  on_sha_targeted,
  on_sha_played,
  active,
  passive,
  on_play_phase_start,
  on_draw_phase,
  on_discard_phase,
  on_judgment_start
};

// ============================================================
// Skill definition
// ============================================================
struct SkillDef {
  std::string id;
  std::string name;
  std::string description;
  std::vector<SkillTrigger> triggers;
  bool isMandatory = false;
  bool isRulerSkill = false;
};

// ============================================================
// Skill registry — global map of skill_id → SkillDef
// ============================================================
inline std::map<std::string, SkillDef> skillRegistry;

inline void registerSkill(const SkillDef& skill) {
  skillRegistry[skill.id] = skill;
}

// ============================================================
// TriggeredSkill — result of trigger matching
// ============================================================
struct TriggeredSkill {
  std::string playerId;
  std::string skillId;
  int priority = 0; // mandatory=100, optional=50
};

// ============================================================
// Helper: find a player by ID
// ============================================================
inline const PlayerState* findPlayer(const GameState& state, const std::string& playerId) {
  for (const auto& p : state.players) {
    if (p.id == playerId) return &p;
  }
  return nullptr;
}

inline PlayerState* findPlayerMut(GameState& state, const std::string& playerId) {
  for (auto& p : state.players) {
    if (p.id == playerId) return &p;
  }
  return nullptr;
}

// ============================================================
// Check if a single trigger matches an action
// ============================================================
inline bool doesTriggerMatch(
    SkillTrigger trigger,
    const GameAction& action,
    const std::string& playerId,
    const GameState& state) {

  switch (trigger) {
    // --- Damage triggers ---
    case SkillTrigger::on_damage_received:
      if (action.type == ActionType::DealDamage) {
        auto* d = std::get_if<DealDamageData>(&action.data);
        if (d && d->targetId == playerId) return true;
      }
      break;

    case SkillTrigger::on_damage_dealt:
      if (action.type == ActionType::DealDamage) {
        auto* d = std::get_if<DealDamageData>(&action.data);
        if (d && d->sourceId == playerId) return true;
      }
      break;

    // --- Heal trigger ---
    case SkillTrigger::on_healed:
      if (action.type == ActionType::HealHp) {
        auto* d = std::get_if<HealHpData>(&action.data);
        if (d && d->targetId == playerId) return true;
      }
      break;

    // --- Card played trigger ---
    case SkillTrigger::on_card_played:
      if (action.type == ActionType::PlayCard && action.playerId == playerId) return true;
      break;

    // --- Turn triggers ---
    case SkillTrigger::on_turn_start:
      if (action.type == ActionType::TurnStart && action.playerId == playerId) return true;
      break;

    case SkillTrigger::on_turn_end:
      if (action.type == ActionType::EndTurn && action.playerId == playerId) return true;
      break;

    // --- Death trigger ---
    case SkillTrigger::on_death:
      if (action.type == ActionType::PlayerDied) return true;
      break;

    // --- Sha targeted trigger ---
    case SkillTrigger::on_sha_targeted:
      if (action.type == ActionType::PlayCard) {
        auto* d = std::get_if<PlayCardData>(&action.data);
        if (d) {
          for (const auto& tid : d->targetIds) {
            if (tid == playerId) return true;
          }
        }
      }
      break;

    // --- Sha played trigger ---
    case SkillTrigger::on_sha_played:
      if (action.type == ActionType::PlayCard && action.playerId == playerId) return true;
      break;

    // --- Active / Passive are not event-driven ---
    case SkillTrigger::active:
    case SkillTrigger::passive:
      return false;

    // --- Phase triggers ---
    case SkillTrigger::on_play_phase_start:
      if (action.type == ActionType::PhaseChange) {
        auto* d = std::get_if<PhaseChangeData>(&action.data);
        if (d && d->phase == TurnPhase::Play) return true;
      }
      break;

    case SkillTrigger::on_draw_phase:
      if (action.type == ActionType::PhaseChange) {
        auto* d = std::get_if<PhaseChangeData>(&action.data);
        if (d && d->phase == TurnPhase::Draw) return true;
      }
      if (action.type == ActionType::DrawCards && action.playerId == playerId) return true;
      break;

    case SkillTrigger::on_discard_phase:
      if (action.type == ActionType::PhaseChange) {
        auto* d = std::get_if<PhaseChangeData>(&action.data);
        if (d && d->phase == TurnPhase::Discard) return true;
      }
      break;

    // --- Judgment trigger ---
    case SkillTrigger::on_judgment_start:
      if (action.type == ActionType::EnterJudgmentPhase) return true;
      if (action.type == ActionType::ResolveJudgment) return true;
      break;
  }

  return false;
}

// ============================================================
// checkTriggers — find all skills that match an action.
// Iterates every alive player, checks each skill against the action.
// Returns (playerId, skillId) pairs sorted by priority (mandatory first).
// ============================================================
inline std::vector<TriggeredSkill> checkTriggers(
    const GameState& state,
    const GameAction& action) {

  std::vector<TriggeredSkill> triggered;

  for (const auto& player : state.players) {
    if (player.aliveStatus == AliveStatus::Dead) continue;

    for (const auto& skillId : player.skills) {
      auto it = skillRegistry.find(skillId);
      if (it == skillRegistry.end()) continue;

      const auto& skill = it->second;

      // Ruler skills only trigger for the ruler
      if (skill.isRulerSkill && player.identity != Identity::Ruler) continue;

      for (const auto& trigger : skill.triggers) {
        if (doesTriggerMatch(trigger, action, player.id, state)) {
          triggered.push_back({
            player.id,
            skillId,
            skill.isMandatory ? 100 : 50
          });
          break; // one match per skill per action is sufficient
        }
      }
    }
  }

  // Sort by priority: mandatory (100) before optional (50)
  std::sort(triggered.begin(), triggered.end(),
    [](const TriggeredSkill& a, const TriggeredSkill& b) {
      return a.priority > b.priority;
    });

  return triggered;
}

// ============================================================
// playerHasSkill — check if a player possesses a given skill
// ============================================================
inline bool playerHasSkill(
    const GameState& state,
    const std::string& playerId,
    const std::string& skillId) {

  const auto* player = findPlayer(state, playerId);
  if (!player) return false;

  for (const auto& sid : player->skills) {
    if (sid == skillId) return true;
  }
  return false;
}

// ============================================================
// executeSkill — placeholder. Actual skill effects are handled
// by ActionResolver; this returns the unmodified state.
// ============================================================
inline GameState executeSkill(
    const GameState& state,
    const std::string& /*skillId*/,
    const std::string& /*playerId*/,
    const std::vector<std::string>& /*targets*/,
    const std::vector<std::string>& /*cards*/) {

  GameState newState = state;
  return newState;
}

// ============================================================
// SkillHelpers — convenience functions for skill execution.
// Each helper pushes a new action onto the event queue.
// ============================================================
struct SkillHelpers {
  std::function<void(const std::string& playerId, int count)> drawCards;
  std::function<void(const std::string& sourceId, const std::string& targetId, int amount)> dealDamage;
  std::function<void(const std::string& targetId, int amount)> heal;
  std::function<void(const std::string& stealerId, const std::string& targetId, const std::string& cardId)> stealCard;
  std::function<void(const std::string& targetId, EquipSlot slot)> destroyEquipment;
};

inline SkillHelpers createSkillHelpers(GameState& state) {
  return SkillHelpers{
    /* drawCards */
    [&state](const std::string& playerId, int count) {
      GameAction action;
      action.type = ActionType::DrawCards;
      action.playerId = playerId;
      action.data = DrawCardsData{count};
      state.eventQueue.push_back(std::move(action));
    },
    /* dealDamage */
    [&state](const std::string& sourceId, const std::string& targetId, int amount) {
      GameAction action;
      action.type = ActionType::DealDamage;
      action.playerId = sourceId;
      action.data = DealDamageData{targetId, amount, false, false, sourceId};
      state.eventQueue.push_back(std::move(action));
    },
    /* heal */
    [&state](const std::string& targetId, int amount) {
      GameAction action;
      action.type = ActionType::HealHp;
      action.playerId = targetId;
      action.data = HealHpData{targetId, amount};
      state.eventQueue.push_back(std::move(action));
    },
    /* stealCard */
    [&state](const std::string& stealerId, const std::string& targetId, const std::string& cardId) {
      GameAction action;
      action.type = ActionType::StealCard;
      action.playerId = stealerId;
      action.data = StealCardData{targetId, cardId, stealerId};
      state.eventQueue.push_back(std::move(action));
    },
    /* destroyEquipment */
    [&state](const std::string& targetId, EquipSlot slot) {
      GameAction action;
      action.type = ActionType::DestroyEquipment;
      action.playerId = targetId;
      action.data = DestroyEquipmentData{targetId, slot};
      state.eventQueue.push_back(std::move(action));
    }
  };
}

// ============================================================
// getAllCharacterIds — all 26 character IDs
// ============================================================
inline std::vector<std::string> getAllCharacterIds() {
  return {
    "caocao", "simayi", "xiahoudun", "zhangliao", "xuchu", "guojia", "zhenji",
    "liubei", "guanyu", "zhangfei", "zhugeliang", "zhaoyun", "machao", "huangyueying",
    "sunquan", "zhouyu", "huanggai", "lvmeng", "luxun", "daqiao", "sunshangxiang",
    "huatuo", "lvbu", "diaochan", "zhangjiao", "yuanshao"
  };
}
