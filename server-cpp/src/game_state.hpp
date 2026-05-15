#pragma once
// ============================================================
// game_state.hpp — game state initialization and query helpers
// ============================================================

#include "types.hpp"
#include "deck.hpp"
#include <random>
#include <algorithm>
#include <iterator>
#include <set>

namespace sj {

// ============================================================
// 1. Empty equipment
// ============================================================
inline EquipmentSlots createEmptyEquipment() {
  return EquipmentSlots{};
}

// ============================================================
// 2. Create a single player with defaults
// ============================================================
inline PlayerState createPlayerState(const std::string& id, const std::string& name, bool isAI) {
  PlayerState p;
  p.id = id;
  p.name = name;
  p.identity = Identity::Rebel;       // placeholder, reassigned by createGameState
  p.identityRevealed = false;
  p.characterId = "";
  p.characterName = "";
  p.kingdom = Kingdom::Wei;
  p.hp = 4;
  p.maxHp = 4;
  p.hand = {};
  p.equipment = createEmptyEquipment();
  p.judgmentArea = {};
  p.aliveStatus = AliveStatus::Alive;
  p.isAI = isAI;
  p.shaUsed = false;
  p.jiuUsed = false;
  p.isIntoxicated = false;
  p.isChainLinked = false;
  p.isTurnedOver = false;
  p.luoyiBonus = 0;
  p.skills = {};
  p.activeSkills = {};
  p.characterSkillState = std::nullopt;
  return p;
}

// ============================================================
// 3. Assign identities for a given player count
//
// Standard San Guo Sha distribution:
//   2p: Ruler  Rebel
//   3p: Ruler  Loyalist  Rebel
//   4p: Ruler  Loyalist  Rebel  Spy
//   5p: Ruler  Loyalist  Rebel*2  Spy
//   6p: Ruler  Loyalist  Rebel*3  Spy
//   7p: Ruler  Loyalist*2  Rebel*3  Spy
//   8p: Ruler  Loyalist*2  Rebel*4  Spy
//   9p+: Ruler, ~30% Loyalist, ~40% Rebel, 1 Spy, remainder Rebel
// ============================================================
inline std::vector<Identity> assignIdentities(int playerCount) {
  switch (playerCount) {
    case 2:  return {Identity::Ruler, Identity::Rebel};
    case 3:  return {Identity::Ruler, Identity::Loyalist, Identity::Rebel};
    case 4:  return {Identity::Ruler, Identity::Loyalist, Identity::Rebel, Identity::Spy};
    case 5:  return {Identity::Ruler, Identity::Loyalist, Identity::Rebel, Identity::Rebel, Identity::Spy};
    case 6:  return {Identity::Ruler, Identity::Loyalist, Identity::Rebel, Identity::Rebel, Identity::Rebel, Identity::Spy};
    case 7:  return {Identity::Ruler, Identity::Loyalist, Identity::Loyalist, Identity::Rebel, Identity::Rebel, Identity::Rebel, Identity::Spy};
    case 8:  return {Identity::Ruler, Identity::Loyalist, Identity::Loyalist, Identity::Rebel, Identity::Rebel, Identity::Rebel, Identity::Rebel, Identity::Spy};
    default: {
      const int rebels    = std::max(1, static_cast<int>(playerCount * 0.4));
      const int loyalists = std::max(1, static_cast<int>(playerCount * 0.3));
      std::vector<Identity> result;
      result.reserve(playerCount);
      result.push_back(Identity::Ruler);
      for (int i = 0; i < loyalists; i++)  result.push_back(Identity::Loyalist);
      for (int i = 0; i < rebels; i++)     result.push_back(Identity::Rebel);
      if (playerCount > 3) result.push_back(Identity::Spy);
      while (static_cast<int>(result.size()) < playerCount)
        result.push_back(Identity::Rebel);
      result.resize(playerCount);
      return result;
    }
  }
}

// ============================================================
// 4. Create full initial GameState
//
// - Assigns identities, shuffles, then swaps ruler to index 0
// - Ruler gets maxHp = 5, everyone else gets 4
// - Ruler identity is revealed from the start
// - Game starts in CharacterSelect phase
// ============================================================
inline GameState createGameState(const std::vector<std::string>& playerNames,
                                 const std::vector<int>& aiIndices) {
  const int playerCount = static_cast<int>(playerNames.size());
  if (playerCount < 2) {
    // Return a minimal valid state; caller should validate
    GameState gs;
    gs.gamePhase = GamePhase::Lobby;
    gs.mode = "online";
    return gs;
  }

  // Identity assignment + shuffle
  auto identities = assignIdentities(playerCount);
  {
    std::random_device rd;
    std::mt19937 rng(rd());
    std::shuffle(identities.begin(), identities.end(), rng);
  }

  // Ensure ruler sits at position 0
  auto rulerIt = std::find(identities.begin(), identities.end(), Identity::Ruler);
  if (rulerIt != identities.begin()) {
    std::iter_swap(identities.begin(), rulerIt);
  }

  // Build set of AI indices for O(1) lookup
  std::set<int> aiSet(aiIndices.begin(), aiIndices.end());

  // Create players
  GameState state;
  state.gamePhase = GamePhase::CharacterSelect;
  state.mode = "online";
  state.currentPlayerIndex = 0;
  state.currentTurnPhase = TurnPhase::Judge;
  state.turnNumber = 0;
  state.roundNumber = 0;
  state.pendingAction = std::nullopt;
  state.winner = std::nullopt;

  state.players.reserve(playerCount);
  state.turnOrder.reserve(playerCount);

  for (int i = 0; i < playerCount; i++) {
    const bool isAI = aiSet.count(i) > 0;
    auto player = createPlayerState("player_" + std::to_string(i),
                                    playerNames[i],
                                    isAI);
    player.identity = identities[i];

    if (i == 0) {
      // Ruler bonuses
      player.identityRevealed = true;
      player.maxHp = 5;
      player.hp = 5;
    }

    state.players.push_back(std::move(player));
    state.turnOrder.push_back(state.players.back().id);
  }

  return state;
}

// ============================================================
// 5. Build deck, shuffle, and deal 4 cards to each player
// ============================================================
inline void initializeDeck(GameState& state, std::mt19937& rng) {
  state.deck = deck::buildFullDeck();
  deck::shuffle(state.deck, rng);

  for (auto& player : state.players) {
    for (int i = 0; i < 4; i++) {
      player.hand.push_back(deck::draw(state.deck, state.discardPile, rng));
    }
  }
}

// ============================================================
// 6. Count of non-dead players
// ============================================================
inline int getAlivePlayers(const GameState& state) {
  int count = 0;
  for (const auto& p : state.players) {
    if (p.aliveStatus != AliveStatus::Dead) count++;
  }
  return count;
}

// ============================================================
// 7. Find player by id (returns pointer, nullptr if not found)
// ============================================================
inline const PlayerState* findPlayer(const GameState& state, const std::string& id) {
  for (const auto& p : state.players) {
    if (p.id == id) return &p;
  }
  return nullptr;
}

inline PlayerState* findPlayer(GameState& state, const std::string& id) {
  for (auto& p : state.players) {
    if (p.id == id) return &p;
  }
  return nullptr;
}

// ============================================================
// 8. Pointer to current turn player
// ============================================================
inline const PlayerState* getCurrentPlayer(const GameState& state) {
  if (state.currentPlayerIndex < 0 ||
      state.currentPlayerIndex >= static_cast<int>(state.turnOrder.size())) {
    return nullptr;
  }
  const auto& id = state.turnOrder[state.currentPlayerIndex];
  return findPlayer(state, id);
}

inline PlayerState* getCurrentPlayer(GameState& state) {
  if (state.currentPlayerIndex < 0 ||
      state.currentPlayerIndex >= static_cast<int>(state.turnOrder.size())) {
    return nullptr;
  }
  const auto& id = state.turnOrder[state.currentPlayerIndex];
  return findPlayer(state, id);
}

// ============================================================
// 9. Find player index by id (returns -1 if not found)
// ============================================================
inline int findPlayerIndex(const GameState& state, const std::string& id) {
  const int n = static_cast<int>(state.players.size());
  for (int i = 0; i < n; i++) {
    if (state.players[i].id == id) return i;
  }
  return -1;
}

// ============================================================
// 10. Check whether targetId is a valid target from sourceId
//     (target must be alive)
// ============================================================
inline bool isTargetable(const GameState& state,
                         const std::string& targetId,
                         const std::string& /*sourceId*/) {
  const auto* target = findPlayer(state, targetId);
  if (!target) return false;
  return target->aliveStatus != AliveStatus::Dead;
}

// ============================================================
// 11. Next alive player in turn order (clockwise), wrapping
//     Returns fromIndex if no other alive player exists
// ============================================================
inline int getNextAlivePlayerIndex(const GameState& state, int fromIndex) {
  const int n = static_cast<int>(state.turnOrder.size());
  if (n == 0) return 0;

  for (int offset = 1; offset <= n; offset++) {
    const int idx = (fromIndex + offset) % n;
    const auto& pid = state.turnOrder[idx];
    const auto* p = findPlayer(state, pid);
    if (p && p->aliveStatus != AliveStatus::Dead) {
      return idx;
    }
  }
  return fromIndex; // fallback — no other alive player
}

// ============================================================
// 12. Evaluate victory conditions
//
// Ruler     wins  when all rebels AND all spies are dead
// Rebels    win   when the ruler is dead (unless spy is last)
// Spy       wins  when they are the sole survivor
//
// Sets state.winner and state.gamePhase = Finished when done.
// ============================================================
inline void checkVictory(GameState& state) {
  bool   rulerAlive = false;
  int    rebelCount = 0;
  int    spyCount   = 0;
  int    totalAlive = 0;

  for (const auto& p : state.players) {
    if (p.aliveStatus == AliveStatus::Dead) continue;
    totalAlive++;

    switch (p.identity) {
      case Identity::Ruler:    rulerAlive = true; break;
      case Identity::Rebel:    rebelCount++;      break;
      case Identity::Spy:      spyCount++;        break;
      default: break; // Loyalist — counted in totalAlive but no special rule
    }
  }

  // Ruler alive + all threats eliminated
  if (rulerAlive && rebelCount == 0 && spyCount == 0) {
    state.winner = "ruler";
    state.gamePhase = GamePhase::Finished;
    return;
  }

  // Ruler is dead — rebels win UNLESS spy is the sole survivor
  if (!rulerAlive) {
    if (totalAlive == 1 && spyCount == 1) {
      state.winner = "spy";
      state.gamePhase = GamePhase::Finished;
    } else {
      state.winner = "rebel";
      state.gamePhase = GamePhase::Finished;
    }
  }
}

} // namespace sj
