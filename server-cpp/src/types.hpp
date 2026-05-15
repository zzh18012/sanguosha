#pragma once
#include <string>
#include <vector>
#include <array>
#include <variant>
#include <optional>
#include <cstdint>
#include <memory>

// ============================================================
// Core enums
// ============================================================
enum class CardSuit : uint8_t { Spade, Heart, Club, Diamond, None };
enum class CardCategory : uint8_t { Basic, Tool, Equipment };
enum class CardTiming : uint8_t { Any, PlayPhase, Response, Dying };
enum class Identity : uint8_t { Ruler, Loyalist, Rebel, Spy };
enum class Kingdom : uint8_t { Wei, Shu, Wu, Qun };
enum class Gender : uint8_t { Male, Female };
enum class TurnPhase : uint8_t { Judge, Draw, Play, Discard, End };
enum class GamePhase : uint8_t { Lobby, CharacterSelect, Playing, Finished };
enum class AliveStatus : uint8_t { Alive, Dying, Dead };
enum class EquipSlot : uint8_t { Weapon, Armor, PlusHorse, MinusHorse };

using CardSubtype = std::string; // "sha","shan","tao","jiu", etc.

// ============================================================
// Card
// ============================================================
struct GameCard {
  std::string id;         // unique instance id
  std::string name;
  CardSubtype subtype;
  CardSuit suit = CardSuit::None;
  int rank = 0;           // 1-13
  CardCategory category = CardCategory::Basic;
  CardTiming timing = CardTiming::Any;
  std::optional<EquipSlot> equipSlot;
  int weaponRange = 0;
  bool isFire = false;
  bool isThunder = false;
  int targetCount = 1;
  int maxTargets = 1;
};

// ============================================================
// Equipment
// ============================================================
struct EquipmentSlots {
  std::optional<GameCard> weapon;
  std::optional<GameCard> armor;
  std::optional<GameCard> plusHorse;
  std::optional<GameCard> minusHorse;
};

// ============================================================
// Player
// ============================================================
struct PlayerState {
  std::string id;
  std::string name;
  Identity identity = Identity::Rebel;
  bool identityRevealed = false;
  std::string characterId;
  std::string characterName;
  Kingdom kingdom = Kingdom::Wei;
  int hp = 0;
  int maxHp = 0;
  std::vector<GameCard> hand;
  EquipmentSlots equipment;
  std::vector<GameCard> judgmentArea;
  AliveStatus aliveStatus = AliveStatus::Alive;
  bool isAI = false;
  // Per-turn flags
  bool shaUsed = false;
  bool jiuUsed = false;
  bool isIntoxicated = false;
  bool isChainLinked = false;
  bool isTurnedOver = false;
  int luoyiBonus = 0;
  // Skill state
  std::vector<std::string> skills;
  std::vector<std::string> activeSkills;
  std::optional<std::string> characterSkillState;
};

// ============================================================
// PendingAction — response/counter window
// ============================================================
enum class PendingType : uint8_t {
  None, RespondSha, RespondNanman, RespondWanjian,
  RespondJuedou, WuxieOpportunity, UseTaoDying, JiedaoChoose
};

struct PendingAction {
  PendingType type = PendingType::None;
  std::string playerId;          // who must respond
  std::string sourcePlayerId;   // who caused this
  std::string sourceCardId;
  std::vector<std::string> validResponseCards;
  std::vector<std::string> respondedPlayers; // for AOE chain
  int chainIndex = 0;
  bool wuxieCancels = false;
  int juedouRound = 0;
  // Extra data
  std::string extraTargetId;
  int extraValue = 0;
};

// ============================================================
// Action types enum
// ============================================================
enum class ActionType : uint8_t {
  None, PlayCard, EquipCard, DiscardCard, UseTaoSelf, UseTaoOther, RecastCard,
  Respond, PassResponse, PlayWuxie, PassWuxie, PassSaveDying,
  EndPhase, EndTurn, PhaseChange, TurnStart,
  UseSkill, SelectCharacter, StartGame, RequestCharacterSelection,
  DrawCards, DrawCardsSpecific, DealDamage, HealHp, EnterDying,
  PlayerDied, DiscardAllCards, DiscardToMaxHp,
  DestroyEquipment, StealCard, ChainPlayers, TurnOver, CheckVictory,
  EnterJudgmentPhase, ResolveJudgment, PlaceDelayedTool, RemoveDelayedTool,
  JudgeBaguazhen, SelectTargetCard, PickWuguCard,
  JiedaoAttack, JiedaoGiveWeapon, AIThink
};

// ============================================================
// GameAction — discriminated union via variant
// ============================================================
struct PlayCardData { std::string cardId; std::vector<std::string> targetIds; };
struct EquipCardData { std::string cardId; };
struct DiscardCardData { std::string cardId; };
struct UseTaoData { std::string cardId; std::string targetId; };
struct RecastCardData { std::string cardId; };
struct RespondData { std::string cardId; std::vector<std::string> targetIds; };
struct PassResponseData {};
struct PlayWuxieData { std::string cardId; };
struct PassWuxieData {};
struct UseSkillData { std::string skillId; std::vector<std::string> targetIds; std::vector<std::string> cardIds; };
struct SelectCharacterData { std::string characterId; };
struct DrawCardsData { int count = 0; };
struct DealDamageData { std::string targetId; int amount = 0; bool isFire = false; bool isThunder = false; std::string sourceId; };
struct HealHpData { std::string targetId; int amount = 1; };
struct EnterDyingData { std::string playerId; };
struct PlayerDiedData { std::string playerId; };
struct DiscardToMaxHpData { std::string playerId; };
struct DestroyEquipmentData { std::string targetId; EquipSlot slot; };
struct StealCardData { std::string targetId; std::string cardId; std::string stealerId; };
struct ChainPlayersData { std::vector<std::string> targetIds; };
struct TurnOverData { std::string playerId; };
struct CheckVictoryData {};
struct RemoveDelayedToolData { std::string cardId; };
struct PlaceDelayedToolData { std::string cardId; std::string targetId; };
struct JudgeBaguazhenData { std::string attackerId; std::string defenderId; std::string shaCardId; };
struct SelectTargetCardData { std::string targetId; std::string cardId; };
struct PickWuguCardData { std::string cardId; };
struct JiedaoAttackData { std::string attackerId; std::string targetId; };
struct JiedaoGiveWeaponData { std::string targetId; };
struct ResolveJudgmentData { std::string cardId; };
struct PhaseChangeData { TurnPhase phase; };

using ActionData = std::variant<
  PlayCardData, EquipCardData, DiscardCardData, UseTaoData, RecastCardData,
  RespondData, PassResponseData, PlayWuxieData, PassWuxieData,
  UseSkillData, SelectCharacterData, DrawCardsData,
  DealDamageData, HealHpData, EnterDyingData, PlayerDiedData,
  DiscardToMaxHpData, DestroyEquipmentData, StealCardData,
  ChainPlayersData, TurnOverData, CheckVictoryData,
  RemoveDelayedToolData, PlaceDelayedToolData, JudgeBaguazhenData,
  SelectTargetCardData, PickWuguCardData, JiedaoAttackData, JiedaoGiveWeaponData,
  ResolveJudgmentData, PhaseChangeData,
  std::monostate
>;

struct GameAction {
  ActionType type = ActionType::None;
  std::string playerId;
  ActionData data;
};

// ============================================================
// Action log
// ============================================================
struct ActionLogEntry {
  int64_t timestamp = 0;
  std::string playerId;
  std::string playerName;
  std::string actionDescription;
};

// ============================================================
// GameState — the complete game state
// ============================================================
struct GameState {
  GamePhase gamePhase = GamePhase::Lobby;
  std::string mode = "online";
  std::vector<PlayerState> players;
  std::vector<std::string> turnOrder;
  int currentPlayerIndex = 0;
  TurnPhase currentTurnPhase = TurnPhase::Judge;
  int turnNumber = 0;
  int roundNumber = 0;
  std::vector<GameCard> deck;
  std::vector<GameCard> discardPile;
  std::optional<PendingAction> pendingAction;
  std::vector<ActionLogEntry> actionHistory;
  std::vector<GameAction> eventQueue;
  std::optional<std::string> winner;
};
