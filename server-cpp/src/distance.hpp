#pragma once
#include "types.hpp"
#include <algorithm>

// ============================================================
// DistanceSystem — seat-distance calculation
// ============================================================
namespace dist {

// Calculate base distance between two players (clockwise / counter-clockwise min)
inline int getBaseDistance(const GameState& state, const std::string& fromId, const std::string& toId) {
  int fromIdx = -1, toIdx = -1;
  for (int i = 0; i < (int)state.turnOrder.size(); i++) {
    if (state.turnOrder[i] == fromId) fromIdx = i;
    if (state.turnOrder[i] == toId) toIdx = i;
  }
  if (fromIdx < 0 || toIdx < 0 || fromIdx == toIdx) return 0;

  int n = (int)state.turnOrder.size();
  int cw = (toIdx - fromIdx + n) % n;
  int ccw = (fromIdx - toIdx + n) % n;

  // Count alive players in each direction
  auto alive = [&](const std::string& pid) {
    for (auto& p : state.players)
      if (p.id == pid && p.aliveStatus != AliveStatus::Dead) return true;
    return false;
  };

  int cwDist = 0;
  for (int i = 1; i <= cw; i++) {
    if (alive(state.turnOrder[(fromIdx + i) % n])) cwDist++;
  }

  int ccwDist = 0;
  for (int i = 1; i <= ccw; i++) {
    if (alive(state.turnOrder[(fromIdx - i + n) % n])) ccwDist++;
  }

  return std::min(cwDist, ccwDist);
}

// Get effective attack distance considering equipment and skills
inline int getAttackDistance(const GameState& state, const std::string& fromId, const std::string& toId) {
  int base = getBaseDistance(state, fromId, toId);
  if (base == 0) return 0;

  const PlayerState* from = nullptr;
  const PlayerState* to = nullptr;
  for (auto& p : state.players) {
    if (p.id == fromId) from = &p;
    if (p.id == toId) to = &p;
  }
  if (!from || !to) return base;

  int dist = base;
  // Target's +1 horse
  if (to->equipment.plusHorse) dist++;
  // Source's -1 horse
  if (from->equipment.minusHorse) dist--;
  // Ma Shu skill reduces distance by 1
  auto hasSkill = [](const PlayerState& p, const std::string& sid) {
    return std::find(p.skills.begin(), p.skills.end(), sid) != p.skills.end();
  };
  if (hasSkill(*from, "mashu")) dist--;

  return std::max(1, dist);
}

// Check if target is in weapon range
inline int getWeaponRange(const PlayerState& player) {
  if (player.equipment.weapon) return player.equipment.weapon->weaponRange;
  return 1; // bare hand range
}

inline bool isInRange(const GameState& state, const std::string& fromId, const std::string& toId) {
  const PlayerState* from = nullptr;
  for (auto& p : state.players) if (p.id == fromId) from = &p;
  if (!from) return false;
  return getAttackDistance(state, fromId, toId) <= getWeaponRange(*from);
}

inline bool isAdjacent(const GameState& state, const std::string& fromId, const std::string& toId) {
  return getAttackDistance(state, fromId, toId) <= 1;
}

} // namespace dist
