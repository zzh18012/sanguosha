#pragma once
#include "types.hpp"
#include <string>
#include <vector>

// ============================================================
// IdentitySystem — enemy/ally logic, victory text
// ============================================================
namespace identity {

inline bool areEnemies(Identity a, Identity b, bool bRevealed = true) {
  if (a == Identity::Ruler) {
    return b == Identity::Rebel || (b == Identity::Spy && bRevealed);
  }
  if (a == Identity::Loyalist) {
    return b == Identity::Rebel || (b == Identity::Spy && bRevealed);
  }
  if (a == Identity::Rebel) {
    return b != Identity::Rebel;
  }
  // Spy: everyone except self is enemy
  return true;
}

inline bool areAllies(Identity a, Identity b) {
  if (a == b) return true;
  if (a == Identity::Ruler && b == Identity::Loyalist) return true;
  if (a == Identity::Loyalist && b == Identity::Ruler) return true;
  return false;
}

inline std::string getIdentityName(Identity id) {
  switch (id) {
    case Identity::Ruler: return "主公";
    case Identity::Loyalist: return "忠臣";
    case Identity::Rebel: return "反贼";
    case Identity::Spy: return "内奸";
  }
  return "未知";
}

inline std::string getVictoryCondition(Identity id) {
  switch (id) {
    case Identity::Ruler: return "消灭所有反贼和内奸";
    case Identity::Loyalist: return "保护主公，消灭所有反贼和内奸";
    case Identity::Rebel: return "杀死主公";
    case Identity::Spy: return "成为最后的幸存者（先消灭所有反贼和忠臣，最后杀死主公）";
  }
  return "";
}

// Get known enemies: identities that are revealed and hostile
inline std::vector<std::string> getKnownEnemies(const GameState& state, const PlayerState& viewer) {
  std::vector<std::string> enemies;
  for (auto& p : state.players) {
    if (p.aliveStatus == AliveStatus::Dead) continue;
    if (p.id == viewer.id) continue;
    if (p.identityRevealed && areEnemies(viewer.identity, p.identity)) {
      enemies.push_back(p.id);
    }
  }
  return enemies;
}

} // namespace identity
