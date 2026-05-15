#pragma once
#include "types.hpp"
#include "rules_engine.hpp"
#include "deck.hpp"
#include <random>
#include <algorithm>

// ============================================================
// ActionResolver — applies validated actions to game state
// ============================================================
namespace resolver {

using namespace rules; // reuse findPlayer, hasSkill, etc.

// Remove card from player's hand by id
inline bool removeFromHand(PlayerState& p, const std::string& cardId, GameCard* out = nullptr) {
  auto it = std::find_if(p.hand.begin(), p.hand.end(), [&](auto& c){ return c.id == cardId; });
  if (it == p.hand.end()) return false;
  if (out) *out = std::move(*it);
  p.hand.erase(it);
  return true;
}

// Add card to discard pile
inline void toDiscard(std::vector<GameCard>& pile, GameCard&& c) {
  pile.push_back(std::move(c));
}

// Draw cards for player from deck
inline void drawCards(PlayerState& p, int count, std::vector<GameCard>& deck, std::vector<GameCard>& discard, std::mt19937& rng) {
  for (int i = 0; i < count; i++) {
    auto c = deck::draw(deck, discard, rng);
    c.id = c.subtype + "_" + p.id + "_" + std::to_string(p.hand.size());
    p.hand.push_back(std::move(c));
  }
}

// Apply damage to player
inline void applyDamage(PlayerState& target, int amount) {
  target.hp = std::max(0, target.hp - amount);
  if (target.hp <= 0) target.aliveStatus = AliveStatus::Dying;
}

// Heal player
inline void healPlayer(PlayerState& target, int amount) {
  target.hp = std::min(target.maxHp, target.hp + amount);
  if (target.hp > 0 && target.aliveStatus == AliveStatus::Dying)
    target.aliveStatus = AliveStatus::Alive;
}

// Check victory conditions
inline void checkVictoryCondition(GameState& state) {
  int aliveRuler = 0, aliveLoyalist = 0, aliveRebel = 0, aliveSpy = 0;
  int totalAlive = 0;
  for (auto& p : state.players) {
    if (p.aliveStatus != AliveStatus::Dead) {
      totalAlive++;
      if (p.identity == Identity::Ruler) aliveRuler++;
      if (p.identity == Identity::Loyalist) aliveLoyalist++;
      if (p.identity == Identity::Rebel) aliveRebel++;
      if (p.identity == Identity::Spy) aliveSpy++;
    }
  }

  // Ruler wins: all rebels and spies are dead
  if (aliveRebel == 0 && aliveSpy == 0 && aliveRuler > 0) {
    state.winner = "ruler";
    state.gamePhase = GamePhase::Finished;
  }
  // Rebel wins: ruler is dead (unless spy is sole survivor)
  else if (aliveRuler == 0) {
    if (totalAlive == 1 && aliveSpy == 1) {
      state.winner = "spy";
      state.gamePhase = GamePhase::Finished;
    } else {
      state.winner = "rebel";
      state.gamePhase = GamePhase::Finished;
    }
  }
  // Spy wins: last one standing
  else if (totalAlive == 1 && aliveSpy == 1) {
    state.winner = "spy";
    state.gamePhase = GamePhase::Finished;
  }
}

// ============================================================
// resolveAction — the main state machine
// Returns: list of follow-up actions to process
// ============================================================
inline std::vector<GameAction> resolveAction(GameState& state, const GameAction& action, std::mt19937& rng) {
  std::vector<GameAction> followUps;
  PlayerState* player = nullptr;
  for (auto& p : state.players) if (p.id == action.playerId) { player = &p; break; }
  if (!player) return followUps;

  switch (action.type) {

    // ---- PLAY_CARD ----
    case ActionType::PlayCard: {
      auto* d = std::get_if<PlayCardData>(&action.data);
      if (!d) break;
      GameCard card;
      if (!removeFromHand(*player, d->cardId, &card)) break;

      // Basic cards
      if (card.subtype == "sha" || card.subtype == "huosha" || card.subtype == "leisha") {
        player->shaUsed = true;
        if (!d->targetIds.empty()) {
          const std::string& targetId = d->targetIds[0];
          // Check for kongcheng (空城) — Zhuge Liang immune to sha when hand is empty
          const PlayerState* target = findPlayer(state, targetId);
          if (target && hasSkill(*target, "kongcheng") && target->hand.empty()) {
            toDiscard(state.discardPile, std::move(card));
            break;
          }
          // Create respond_sha pending action
          state.pendingAction = PendingAction{
            PendingType::RespondSha, targetId, action.playerId, card.id, {}, {}, 0, false
          };
          // If player has wushuang (无双), target needs 2 shan
          if (hasSkill(*player, "wushuang")) {
            state.pendingAction->extraValue = 2;
          }
        }
        toDiscard(state.discardPile, std::move(card));
      }
      else if (card.subtype == "jiu") {
        player->jiuUsed = true;
        player->isIntoxicated = true;
        toDiscard(state.discardPile, std::move(card));
      }
      else if (card.subtype == "tao") {
        healPlayer(*player, 1);
        toDiscard(state.discardPile, std::move(card));
      }
      // Tool cards
      else if (card.category == CardCategory::Tool) {
        if (card.subtype == "wuzhong_shengyou") {
          drawCards(*player, 2, state.deck, state.discardPile, rng);
          toDiscard(state.discardPile, std::move(card));
        }
        else if (card.subtype == "guohe_chaiqiao") {
          if (!d->targetIds.empty()) {
            // Wuxie opportunity
            state.pendingAction = PendingAction{
              PendingType::WuxieOpportunity, d->targetIds[0], action.playerId, card.id, {}, {}, 0, false,
              0, d->targetIds[0], 0
            };
            // Store card temporarily — need to keep it alive for wuxie chain
          }
          toDiscard(state.discardPile, std::move(card));
        }
        else if (card.subtype == "shunshou_qianyang") {
          if (!d->targetIds.empty()) {
            state.pendingAction = PendingAction{
              PendingType::WuxieOpportunity, d->targetIds[0], action.playerId, card.id, {}, {}, 0, false,
              0, d->targetIds[0], 1
            };
          }
          toDiscard(state.discardPile, std::move(card));
        }
        else if (card.subtype == "juedou") {
          if (!d->targetIds.empty()) {
            state.pendingAction = PendingAction{
              PendingType::RespondJuedou, d->targetIds[0], action.playerId, card.id, {}, {}, 0, false
            };
          }
          toDiscard(state.discardPile, std::move(card));
        }
        else if (card.subtype == "nanman_ruqin") {
          // AOE: all other players must respond with sha
          state.pendingAction = PendingAction{
            PendingType::RespondNanman, "", action.playerId, card.id, {}, {}, 0, false
          };
          // Find first other player
          int startIdx = 0;
          for (int i = 0; i < (int)state.turnOrder.size(); i++) {
            if (state.turnOrder[i] == action.playerId) { startIdx = (i + 1) % state.turnOrder.size(); break; }
          }
          for (int k = 0; k < (int)state.turnOrder.size(); k++) {
            int idx = (startIdx + k) % state.turnOrder.size();
            const PlayerState* tp = findPlayer(state, state.turnOrder[idx]);
            if (tp && tp->id != action.playerId && tp->aliveStatus == AliveStatus::Alive) {
              state.pendingAction->playerId = tp->id;
              state.pendingAction->chainIndex = k;
              break;
            }
          }
          toDiscard(state.discardPile, std::move(card));
        }
        else if (card.subtype == "wanjian_qifa") {
          // AOE: all other players must respond with shan
          state.pendingAction = PendingAction{
            PendingType::RespondWanjian, "", action.playerId, card.id, {}, {}, 0, false
          };
          int startIdx = 0;
          for (int i = 0; i < (int)state.turnOrder.size(); i++) {
            if (state.turnOrder[i] == action.playerId) { startIdx = (i + 1) % state.turnOrder.size(); break; }
          }
          for (int k = 0; k < (int)state.turnOrder.size(); k++) {
            int idx = (startIdx + k) % state.turnOrder.size();
            const PlayerState* tp = findPlayer(state, state.turnOrder[idx]);
            if (tp && tp->id != action.playerId && tp->aliveStatus == AliveStatus::Alive) {
              state.pendingAction->playerId = tp->id;
              state.pendingAction->chainIndex = k;
              break;
            }
          }
          toDiscard(state.discardPile, std::move(card));
        }
        else if (card.subtype == "taoyuan_jieyi") {
          for (auto& p : state.players) if (p.aliveStatus == AliveStatus::Alive) healPlayer(p, 1);
          toDiscard(state.discardPile, std::move(card));
        }
        else if (card.subtype == "wugu_fengdeng") {
          // Draw cards equal to alive players, deal one to each
          int aliveCount = 0;
          for (auto& p : state.players) if (p.aliveStatus == AliveStatus::Alive) aliveCount++;
          for (int i = 0; i < aliveCount; i++) {
            auto newCard = deck::draw(state.deck, state.discardPile, rng);
            newCard.id = "wugu_" + std::to_string(i);
            state.discardPile.push_back(std::move(newCard)); // simplified: just add to discard for now
          }
          toDiscard(state.discardPile, std::move(card));
        }
        else if (card.subtype == "jiedao_sharen") {
          if (!d->targetIds.empty()) {
            // Create jiedao pending — target must attack or give weapon
            state.pendingAction = PendingAction{
              PendingType::JiedaoChoose, d->targetIds[0], action.playerId, card.id, {}, {}, 0, false
            };
          }
          toDiscard(state.discardPile, std::move(card));
        }
        else if (card.subtype == "tiesuo_lianhuan") {
          // Refresh: unchain all if targeting self, otherwise toggle chain
          for (auto& tid : d->targetIds) {
            PlayerState* tp = nullptr;
            for (auto& p : state.players) if (p.id == tid) tp = &p;
            if (tp) tp->isChainLinked = !tp->isChainLinked;
          }
          toDiscard(state.discardPile, std::move(card));
        }
        else if (card.subtype == "lebu_sishu" || card.subtype == "bingliang_cunduan" || card.subtype == "shandian") {
          if (!d->targetIds.empty()) {
            // Place delayed tool on target's judgment area
            card.id = card.subtype + "_j_" + d->targetIds[0];
            PlayerState* tp = nullptr;
            for (auto& p : state.players) if (p.id == d->targetIds[0]) tp = &p;
            if (tp) tp->judgmentArea.push_back(std::move(card));
          }
        }
        else {
          toDiscard(state.discardPile, std::move(card));
        }
      }
      break;
    }

    // ---- EQUIP_CARD ----
    case ActionType::EquipCard: {
      auto* d = std::get_if<EquipCardData>(&action.data);
      if (!d) break;
      GameCard card;
      if (!removeFromHand(*player, d->cardId, &card)) break;
      if (!card.equipSlot) break;

      // Unequip old item first
      auto unequip = [&](std::optional<GameCard>& slot) {
        if (slot) {
          slot->id = slot->subtype + "_unequip_" + player->id;
          player->hand.push_back(std::move(*slot));
          slot.reset();
        }
      };

      switch (*card.equipSlot) {
        case EquipSlot::Weapon: unequip(player->equipment.weapon); player->equipment.weapon = std::move(card); break;
        case EquipSlot::Armor: unequip(player->equipment.armor); player->equipment.armor = std::move(card); break;
        case EquipSlot::PlusHorse: unequip(player->equipment.plusHorse); player->equipment.plusHorse = std::move(card); break;
        case EquipSlot::MinusHorse: unequip(player->equipment.minusHorse); player->equipment.minusHorse = std::move(card); break;
      }
      break;
    }

    // ---- DISCARD_CARD ----
    case ActionType::DiscardCard: {
      auto* d = std::get_if<DiscardCardData>(&action.data);
      if (!d) break;
      GameCard card;
      if (removeFromHand(*player, d->cardId, &card)) {
        toDiscard(state.discardPile, std::move(card));
      }
      break;
    }

    // ---- RESPOND ----
    case ActionType::Respond: {
      auto* d = std::get_if<RespondData>(&action.data);
      if (!d || !state.pendingAction) break;
      GameCard card;
      if (!removeFromHand(*player, d->cardId, &card)) break;
      toDiscard(state.discardPile, std::move(card));

      // Add to responded list
      state.pendingAction->respondedPlayers.push_back(action.playerId);

      // Advance AOE chain
      if (state.pendingAction->type == PendingType::RespondNanman ||
          state.pendingAction->type == PendingType::RespondWanjian) {
        int nextIdx = state.pendingAction->chainIndex + 1;
        bool found = false;
        int startIdx = 0;
        for (int i = 0; i < (int)state.turnOrder.size(); i++) {
          if (state.turnOrder[i] == state.pendingAction->sourcePlayerId) { startIdx = (i + 1) % state.turnOrder.size(); break; }
        }
        for (int k = nextIdx; k < (int)state.turnOrder.size(); k++) {
          int idx = (startIdx + k) % state.turnOrder.size();
          const PlayerState* tp = findPlayer(state, state.turnOrder[idx]);
          if (tp && tp->id != state.pendingAction->sourcePlayerId && tp->aliveStatus == AliveStatus::Alive &&
              std::find(state.pendingAction->respondedPlayers.begin(), state.pendingAction->respondedPlayers.end(), tp->id) == state.pendingAction->respondedPlayers.end()) {
            state.pendingAction->playerId = tp->id;
            state.pendingAction->chainIndex = k;
            found = true;
            break;
          }
        }
        if (!found) state.pendingAction.reset(); // AOE complete
      }
      // Juedou — swap responder
      else if (state.pendingAction->type == PendingType::RespondJuedou) {
        std::string prev = state.pendingAction->playerId;
        state.pendingAction->playerId = state.pendingAction->sourcePlayerId;
        state.pendingAction->sourcePlayerId = prev;
        state.pendingAction->juedouRound++;
      }
      // Sha response — clear pending
      else if (state.pendingAction->type == PendingType::RespondSha) {
        if (state.pendingAction->extraValue <= 1) {
          state.pendingAction.reset();
        } else {
          state.pendingAction->extraValue--; // wushuang: still need another shan
        }
      }
      break;
    }

    // ---- PASS_RESPONSE ----
    case ActionType::PassResponse: {
      if (!state.pendingAction) break;

      if (state.pendingAction->type == PendingType::RespondSha) {
        // Apply sha damage
        const PlayerState* source = findPlayer(state, state.pendingAction->sourcePlayerId);
        int dmg = 1;
        if (source && source->isIntoxicated) dmg++;
        if (source && source->luoyiBonus > 0) dmg += source->luoyiBonus;
        applyDamage(*player, dmg);
        if (player->hp <= 0) {
          // Enter dying
          state.pendingAction = PendingAction{
            PendingType::UseTaoDying, action.playerId, action.playerId, "", {}, {}, 0, false
          };
        } else {
          state.pendingAction.reset();
        }
      }
      else if (state.pendingAction->type == PendingType::RespondNanman) {
        PlayerState* resp = nullptr;
        for (auto& p : state.players) if (p.id == state.pendingAction->playerId) resp = &p;
        if (resp) {
          applyDamage(*resp, 1);
          if (resp->hp <= 0) {
            state.pendingAction = PendingAction{
              PendingType::UseTaoDying, resp->id, resp->id, "", {}, {}, 0, false
            };
            break;
          }
        }
        // Advance to next player
        int nextIdx = state.pendingAction->chainIndex + 1;
        int startIdx = 0;
        for (int i = 0; i < (int)state.turnOrder.size(); i++) {
          if (state.turnOrder[i] == state.pendingAction->sourcePlayerId) { startIdx = (i + 1) % state.turnOrder.size(); break; }
        }
        bool found = false;
        for (int k = nextIdx; k < (int)state.turnOrder.size(); k++) {
          int idx = (startIdx + k) % state.turnOrder.size();
          const PlayerState* tp = findPlayer(state, state.turnOrder[idx]);
          if (tp && tp->id != state.pendingAction->sourcePlayerId && tp->aliveStatus == AliveStatus::Alive &&
              std::find(state.pendingAction->respondedPlayers.begin(), state.pendingAction->respondedPlayers.end(), tp->id) == state.pendingAction->respondedPlayers.end()) {
            state.pendingAction->playerId = tp->id;
            state.pendingAction->chainIndex = k;
            found = true;
            break;
          }
        }
        if (!found) state.pendingAction.reset();
      }
      else if (state.pendingAction->type == PendingType::RespondWanjian) {
        // Same as nanman but applies damage to current responder
        PlayerState* resp = nullptr;
        for (auto& p : state.players) if (p.id == state.pendingAction->playerId) resp = &p;
        if (resp) {
          applyDamage(*resp, 1);
          if (resp->hp <= 0) {
            state.pendingAction = PendingAction{
              PendingType::UseTaoDying, resp->id, resp->id, "", {}, {}, 0, false
            };
            break;
          }
        }
        // Advance chain like nanman
        int nextIdx = state.pendingAction->chainIndex + 1;
        int startIdx = 0;
        for (int i = 0; i < (int)state.turnOrder.size(); i++) {
          if (state.turnOrder[i] == state.pendingAction->sourcePlayerId) { startIdx = (i + 1) % state.turnOrder.size(); break; }
        }
        bool found = false;
        for (int k = nextIdx; k < (int)state.turnOrder.size(); k++) {
          int idx = (startIdx + k) % state.turnOrder.size();
          const PlayerState* tp = findPlayer(state, state.turnOrder[idx]);
          if (tp && tp->id != state.pendingAction->sourcePlayerId && tp->aliveStatus == AliveStatus::Alive &&
              std::find(state.pendingAction->respondedPlayers.begin(), state.pendingAction->respondedPlayers.end(), tp->id) == state.pendingAction->respondedPlayers.end()) {
            state.pendingAction->playerId = tp->id;
            state.pendingAction->chainIndex = k;
            found = true;
            break;
          }
        }
        if (!found) state.pendingAction.reset();
      }
      else if (state.pendingAction->type == PendingType::RespondJuedou) {
        // Player who passed takes 1 damage
        PlayerState* loser = nullptr;
        for (auto& p : state.players) if (p.id == state.pendingAction->playerId) loser = &p;
        if (loser) {
          applyDamage(*loser, 1);
          if (loser->hp <= 0) {
            state.pendingAction = PendingAction{
              PendingType::UseTaoDying, loser->id, loser->id, "", {}, {}, 0, false
            };
          } else {
            state.pendingAction.reset();
          }
        }
      }
      break;
    }

    // ---- PING/PONG / misc ----
    case ActionType::PassWuxie:
      state.pendingAction->wuxieCancels = true;
      state.pendingAction.reset();
      break;

    case ActionType::PlayWuxie:
      state.pendingAction->wuxieCancels = !state.pendingAction->wuxieCancels;
      break;

    case ActionType::PassSaveDying: {
      // Player dies
      player->aliveStatus = AliveStatus::Dead;
      // Discard all cards
      for (auto& c : player->hand) toDiscard(state.discardPile, std::move(c));
      player->hand.clear();
      // Discard equipment
      if (player->equipment.weapon) { toDiscard(state.discardPile, std::move(*player->equipment.weapon)); player->equipment.weapon.reset(); }
      if (player->equipment.armor) { toDiscard(state.discardPile, std::move(*player->equipment.armor)); player->equipment.armor.reset(); }
      if (player->equipment.plusHorse) { toDiscard(state.discardPile, std::move(*player->equipment.plusHorse)); player->equipment.plusHorse.reset(); }
      if (player->equipment.minusHorse) { toDiscard(state.discardPile, std::move(*player->equipment.minusHorse)); player->equipment.minusHorse.reset(); }
      state.pendingAction.reset();
      checkVictoryCondition(state);
      break;
    }

    case ActionType::UseTaoSelf: {
      auto* d = std::get_if<UseTaoData>(&action.data);
      if (!d) break;
      GameCard card;
      if (removeFromHand(*player, d->cardId, &card)) {
        toDiscard(state.discardPile, std::move(card));
        healPlayer(*player, 1);
        if (player->aliveStatus == AliveStatus::Dying && player->hp > 0) {
          player->aliveStatus = AliveStatus::Alive;
          state.pendingAction.reset();
        }
      }
      break;
    }

    case ActionType::UseTaoOther: {
      auto* d = std::get_if<UseTaoData>(&action.data);
      if (!d) break;
      GameCard card;
      if (!removeFromHand(*player, d->cardId, &card)) break;
      toDiscard(state.discardPile, std::move(card));
      PlayerState* target = nullptr;
      for (auto& p : state.players) if (p.id == d->targetId) target = &p;
      if (target) {
        healPlayer(*target, 1);
        if (target->aliveStatus == AliveStatus::Dying && target->hp > 0) {
          target->aliveStatus = AliveStatus::Alive;
          state.pendingAction.reset();
        }
      }
      break;
    }

    // ---- END_TURN ----
    case ActionType::EndTurn: {
      // Reset per-turn flags
      player->shaUsed = false;
      player->jiuUsed = false;
      player->isIntoxicated = false;
      player->luoyiBonus = 0;

      // Advance to next alive player
      int n = (int)state.turnOrder.size();
      for (int k = 1; k <= n; k++) {
        int nextIdx = (state.currentPlayerIndex + k) % n;
        const PlayerState* np = findPlayer(state, state.turnOrder[nextIdx]);
        if (np && np->aliveStatus != AliveStatus::Dead) {
          state.currentPlayerIndex = nextIdx;
          break;
        }
      }

      // New turn start
      state.turnNumber++;
      if (state.currentPlayerIndex == 0) state.roundNumber++;

      // Start judgment phase — check delayed tools
      const PlayerState* cp = findPlayer(state, state.turnOrder[state.currentPlayerIndex]);
      if (cp) {
        PlayerState* cur = nullptr;
        for (auto& p : state.players) if (p.id == cp->id) cur = &p;
        if (cur && !cur->judgmentArea.empty()) {
          // Resolve judgment cards
          // Lebu_sishu: must judge, if not heart → skip play phase
          // Bingliang_cunduan: if not club → skip draw phase
          // Shandian: if spade 2-9 → 3 damage
          // Simplified: just remove all judgment cards
          for (auto& jc : cur->judgmentArea) {
            toDiscard(state.discardPile, std::move(jc));
          }
          cur->judgmentArea.clear();
        }
      }

      // Draw phase — draw 2 cards
      PlayerState* cur = nullptr;
      for (auto& p : state.players) if (p.id == state.turnOrder[state.currentPlayerIndex]) cur = &p;
      if (cur && cur->aliveStatus == AliveStatus::Alive) {
        int drawCount = 2;
        // Yingzi (英姿) — Zhou Yu draws 3
        if (hasSkill(*cur, "yingzi")) drawCount = 3;
        drawCards(*cur, drawCount, state.deck, state.discardPile, rng);
      }

      state.currentTurnPhase = TurnPhase::Play;
      break;
    }

    // ---- SELECT_CHARACTER ----
    case ActionType::SelectCharacter: {
      auto* d = std::get_if<SelectCharacterData>(&action.data);
      if (!d) break;
      player->characterId = d->characterId;
      break;
    }

    // ---- START_GAME ----
    case ActionType::StartGame: {
      state.gamePhase = GamePhase::Playing;
      // Initialize deck and deal
      if (state.deck.empty()) {
        state.deck = deck::buildFullDeck();
        deck::shuffle(state.deck, rng);
      }
      for (auto& p : state.players) {
        for (int i = 0; i < 4; i++) {
          auto c = deck::draw(state.deck, state.discardPile, rng);
          c.id = c.subtype + "_" + p.id + "_" + std::to_string(p.hand.size());
          p.hand.push_back(std::move(c));
        }
      }
      // Start first turn
      state.currentPlayerIndex = 0;
      state.currentTurnPhase = TurnPhase::Play;
      // Draw 2 for first player
      PlayerState* first = nullptr;
      for (auto& p : state.players) if (p.id == state.turnOrder[0]) first = &p;
      if (first) drawCards(*first, 2, state.deck, state.discardPile, rng);
      break;
    }

    // ---- USE_SKILL ----
    case ActionType::UseSkill: {
      auto* d = std::get_if<UseSkillData>(&action.data);
      if (!d) break;

      // Handle specific skills
      if (d->skillId == "rende") {
        // Liu Bei's Rende: give cards to others, heal if gave 2+
        // For now: simplified
      }
      else if (d->skillId == "zhiheng") {
        // Sun Quan's Zhiheng: discard cards to draw equal amount
        if (!d->cardIds.empty()) {
          int discarded = 0;
          for (auto& cid : d->cardIds) {
            GameCard c;
            if (removeFromHand(*player, cid, &c)) { toDiscard(state.discardPile, std::move(c)); discarded++; }
          }
          drawCards(*player, discarded, state.deck, state.discardPile, rng);
        }
      }
      else if (d->skillId == "kurou") {
        // Huang Gai's Kurou: lose 1 HP, draw 2 cards
        applyDamage(*player, 1);
        drawCards(*player, 2, state.deck, state.discardPile, rng);
      }
      else if (d->skillId == "luanji") {
        // Yuan Shao's Luanji: discard 2 same-suit cards for wanjiang effect
        if (d->cardIds.size() >= 2) {
          for (auto& cid : d->cardIds) {
            GameCard c;
            if (removeFromHand(*player, cid, &c)) toDiscard(state.discardPile, std::move(c));
          }
          // Create wanjiang AOE
          state.pendingAction = PendingAction{
            PendingType::RespondWanjian, "", action.playerId, "luanji", {}, {}, 0, false
          };
        }
      }
      break;
    }

    default:
      break;
  }

  return followUps;
}

// ============================================================
// Process follow-up actions recursively
// ============================================================
inline void processFollowUps(GameState& state, std::mt19937& rng, int maxDepth = 50) {
  for (int depth = 0; depth < maxDepth; depth++) {
    if (state.eventQueue.empty()) break;
    auto actions = std::move(state.eventQueue);
    state.eventQueue.clear();
    for (auto& a : actions) {
      auto fu = resolveAction(state, a, rng);
      for (auto& f : fu) state.eventQueue.push_back(std::move(f));
    }
  }
}

} // namespace resolver
