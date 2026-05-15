#pragma once
#include "types.hpp"
#include <nlohmann/json.hpp>

namespace sj {

using json = nlohmann::json;

inline std::string suitStr(CardSuit s) {
  switch (s) {
    case CardSuit::Spade: return "spade";
    case CardSuit::Heart: return "heart";
    case CardSuit::Club: return "club";
    case CardSuit::Diamond: return "diamond";
    default: return "none";
  }
}
inline CardSuit parseSuit(const std::string& s) {
  if (s == "spade") return CardSuit::Spade;
  if (s == "heart") return CardSuit::Heart;
  if (s == "club") return CardSuit::Club;
  if (s == "diamond") return CardSuit::Diamond;
  return CardSuit::None;
}

inline std::string idStr(Identity i) {
  switch (i) { case Identity::Ruler: return "ruler"; case Identity::Loyalist: return "loyalist"; case Identity::Rebel: return "rebel"; case Identity::Spy: return "spy"; }
  return "rebel";
}
inline Identity parseIdentity(const std::string& s) {
  if (s == "ruler") return Identity::Ruler; if (s == "loyalist") return Identity::Loyalist; if (s == "spy") return Identity::Spy; return Identity::Rebel;
}

inline std::string kingdomStr(Kingdom k) {
  switch (k) { case Kingdom::Wei: return "wei"; case Kingdom::Shu: return "shu"; case Kingdom::Wu: return "wu"; case Kingdom::Qun: return "qun"; }
  return "wei";
}
inline Kingdom parseKingdom(const std::string& s) {
  if (s == "shu") return Kingdom::Shu; if (s == "wu") return Kingdom::Wu; if (s == "qun") return Kingdom::Qun; return Kingdom::Wei;
}

inline std::string phaseStr(TurnPhase p) {
  switch (p) { case TurnPhase::Judge: return "judge"; case TurnPhase::Draw: return "draw"; case TurnPhase::Play: return "play"; case TurnPhase::Discard: return "discard"; default: return "end"; }
}
inline TurnPhase parsePhase(const std::string& s) {
  if (s == "draw") return TurnPhase::Draw; if (s == "play") return TurnPhase::Play; if (s == "discard") return TurnPhase::Discard; if (s == "end") return TurnPhase::End; return TurnPhase::Judge;
}

inline json toJson(const GameCard& c) {
  return {
    {"id", c.id}, {"name", c.name}, {"subtype", c.subtype}, {"suit", suitStr(c.suit)},
    {"rank", c.rank}, {"category", c.category == CardCategory::Basic ? "basic" : c.category == CardCategory::Tool ? "tool" : "equipment"},
    {"timing", c.timing == CardTiming::Any ? "any" : c.timing == CardTiming::PlayPhase ? "play_phase" : c.timing == CardTiming::Response ? "response" : "dying"},
    {"weaponRange", c.weaponRange}, {"isFire", c.isFire}, {"isThunder", c.isThunder},
    {"targetCount", c.targetCount}, {"maxTargets", c.maxTargets}
  };
}

inline json toJson(const EquipmentSlots& eq) {
  json j;
  if (eq.weapon) j["weapon"] = toJson(*eq.weapon);
  if (eq.armor) j["armor"] = toJson(*eq.armor);
  if (eq.plusHorse) j["plusHorse"] = toJson(*eq.plusHorse);
  if (eq.minusHorse) j["minusHorse"] = toJson(*eq.minusHorse);
  return j;
}

inline json toJson(const PlayerState& p) {
  json hand = json::array();
  for (auto& c : p.hand) hand.push_back(toJson(c));
  json ja = json::array();
  for (auto& c : p.judgmentArea) ja.push_back(toJson(c));
  return {
    {"id", p.id}, {"name", p.name}, {"identity", idStr(p.identity)},
    {"identityRevealed", p.identityRevealed}, {"characterId", p.characterId},
    {"characterName", p.characterName}, {"kingdom", kingdomStr(p.kingdom)},
    {"hp", p.hp}, {"maxHp", p.maxHp}, {"hand", hand},
    {"equipment", toJson(p.equipment)}, {"judgmentArea", ja},
    {"aliveStatus", p.aliveStatus == AliveStatus::Alive ? "alive" : p.aliveStatus == AliveStatus::Dying ? "dying" : "dead"},
    {"isAI", p.isAI}, {"shaUsed", p.shaUsed}, {"jiuUsed", p.jiuUsed},
    {"isIntoxicated", p.isIntoxicated}, {"isChainLinked", p.isChainLinked},
    {"isTurnedOver", p.isTurnedOver}, {"skills", p.skills}
  };
}

inline json toJson(const PendingAction& pa) {
  json j;
  j["type"] = (int)pa.type;
  j["playerId"] = pa.playerId;
  j["sourcePlayerId"] = pa.sourcePlayerId;
  if (!pa.sourceCardId.empty()) j["sourceCardId"] = pa.sourceCardId;
  j["validResponseCards"] = pa.validResponseCards;
  j["respondedPlayers"] = pa.respondedPlayers;
  j["chainIndex"] = pa.chainIndex;
  j["wuxieCancels"] = pa.wuxieCancels;
  if (!pa.extraTargetId.empty()) j["extraTargetId"] = pa.extraTargetId;
  j["extraValue"] = pa.extraValue;
  return j;
}

inline json toJson(const GameAction& a);

inline json gameStateToJson(const GameState& gs) {
  json players = json::array();
  for (auto& p : gs.players) players.push_back(toJson(p));
  json deckCards = json::array();
  for (auto& c : gs.deck) deckCards.push_back(toJson(c));
  return {
    {"gamePhase", gs.gamePhase == GamePhase::Lobby ? "lobby" : gs.gamePhase == GamePhase::CharacterSelect ? "character_select" : gs.gamePhase == GamePhase::Playing ? "playing" : "finished"},
    {"mode", gs.mode}, {"players", players}, {"turnOrder", gs.turnOrder},
    {"currentPlayerIndex", gs.currentPlayerIndex}, {"currentTurnPhase", phaseStr(gs.currentTurnPhase)},
    {"turnNumber", gs.turnNumber}, {"roundNumber", gs.roundNumber},
    {"deck", deckCards}, {"discardPile", json::array()}, {"winner", gs.winner.value_or("")}
  };
}

// Parse incoming action from client
inline GameAction parseAction(const json& j) {
  GameAction a;
  a.playerId = j.value("playerId", "");
  std::string typeStr = j.value("type", "");

  if (typeStr == "PLAY_CARD") {
    a.type = ActionType::PlayCard;
    PlayCardData d;
    d.cardId = j.value("cardId", "");
    if (j.contains("targetIds")) for (auto& t : j["targetIds"]) d.targetIds.push_back(t.get<std::string>());
    a.data = d;
  } else if (typeStr == "EQUIP_CARD") {
    a.type = ActionType::EquipCard;
    a.data = EquipCardData{j.value("cardId", "")};
  } else if (typeStr == "DISCARD_CARD") {
    a.type = ActionType::DiscardCard;
    a.data = DiscardCardData{j.value("cardId", "")};
  } else if (typeStr == "USE_TAO_SELF") {
    a.type = ActionType::UseTaoSelf;
    a.data = UseTaoData{j.value("cardId", ""), a.playerId};
  } else if (typeStr == "USE_TAO_OTHER") {
    a.type = ActionType::UseTaoOther;
    a.data = UseTaoData{j.value("cardId", ""), j.value("targetId", "")};
  } else if (typeStr == "RESPOND") {
    a.type = ActionType::Respond;
    RespondData d;
    d.cardId = j.value("cardId", "");
    if (j.contains("targetIds")) for (auto& t : j["targetIds"]) d.targetIds.push_back(t.get<std::string>());
    a.data = d;
  } else if (typeStr == "PASS_RESPONSE") {
    a.type = ActionType::PassResponse;
    a.data = PassResponseData{};
  } else if (typeStr == "PLAY_WUXIE") {
    a.type = ActionType::PlayWuxie;
    a.data = PlayWuxieData{j.value("cardId", "")};
  } else if (typeStr == "PASS_WUXIE") {
    a.type = ActionType::PassWuxie;
    a.data = PassWuxieData{};
  } else if (typeStr == "USE_SKILL") {
    a.type = ActionType::UseSkill;
    UseSkillData d;
    d.skillId = j.value("skillId", "");
    if (j.contains("targetIds")) for (auto& t : j["targetIds"]) d.targetIds.push_back(t.get<std::string>());
    if (j.contains("cardIds")) for (auto& t : j["cardIds"]) d.cardIds.push_back(t.get<std::string>());
    a.data = d;
  } else if (typeStr == "SELECT_CHARACTER") {
    a.type = ActionType::SelectCharacter;
    a.data = SelectCharacterData{j.value("characterId", "")};
  } else if (typeStr == "START_GAME") {
    a.type = ActionType::StartGame;
  } else if (typeStr == "END_TURN") {
    a.type = ActionType::EndTurn;
  }
  return a;
}

} // namespace sj
