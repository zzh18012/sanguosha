// ============================================================
// Deck building and shuffling
// ============================================================

import { CARD_DEFINITIONS } from '../../data/cardDefinitions';
import { createCardInstance, type GameCard } from '../../types/cards';

// Build a complete 160-card deck from definitions
export function buildDeck(): GameCard[] {
  return CARD_DEFINITIONS.map(def => createCardInstance(def));
}

// Build a standard 108-card deck (base game only)
export function buildStandardDeck(): GameCard[] {
  // Standard deck subsets: exclude cards with expansion-only markers
  const expansionExclude = new Set([
    // 军争 expansion indicators - cards with specific suits/ranks
    'sha_spade_5', 'sha_spade_6', 'sha_club_5', 'sha_club_6',
    'sha_club_7', 'sha_club_8',
    'sha_heart_4', 'sha_heart_7', 'sha_heart_10b',
    'sha_diamond_4', 'sha_diamond_5',
    'sha_spade_7b', 'sha_spade_8c',
    // 酒 (all 5 are expansion)
    'jiu_spade_3', 'jiu_spade_9', 'jiu_club_3', 'jiu_club_9', 'jiu_heart_4',
    // Extra 闪 (expansion)
    'shan_heart_8', 'shan_heart_9', 'shan_heart_J',
    'shan_heart_Q', 'shan_heart_Qb',
    'shan_diamond_3b', 'shan_diamond_6b',
    'shan_diamond_7b', 'shan_diamond_8b',
    // Extra 桃 (expansion)
    'tao_heart_2', 'tao_heart_3b', 'tao_heart_8', 'tao_heart_Qb',
    // 兵粮寸断 (expansion)
    'bingliang_spade_10', 'bingliang_club_4',
    // Extra 杀 with duplicate ranks
    'sha_spade_8b', 'sha_spade_9b', 'sha_spade_10b',
    'sha_club_8b', 'sha_club_9b', 'sha_club_10b', 'sha_club_Jb',
    // 藤甲, 仁王盾, 寒冰剑, 古锭刀 (expansion)
    'tengjia_spade_2', 'tengjia_club_2',
    'renwangdun_club_2',
    'hanbingjian_spade_2', 'gudingdao_spade_2b',
    // 铁索连环 (expansion)
    'tiesuo_spade_Q', 'tiesuo_spade_K', 'tiesuo_club_Q', 'tiesuo_club_K',
    'tiesuo_club_10', 'tiesuo_club_J',
  ]);

  return CARD_DEFINITIONS
    .filter(def => !expansionExclude.has(def.id))
    .map(def => createCardInstance(def));
}

// Shuffle deck using Fisher-Yates algorithm
export function shuffleDeck(deck: GameCard[]): GameCard[] {
  const cards = [...deck];
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

// Draw cards from deck, reshuffling discard pile if needed
export function drawCards(deck: GameCard[], discardPile: GameCard[], count: number): {
  drawnCards: GameCard[];
  newDeck: GameCard[];
  newDiscardPile: GameCard[];
} {
  const newDeck = [...deck];
  let newDiscard = [...discardPile];
  const drawn: GameCard[] = [];

  for (let i = 0; i < count; i++) {
    if (newDeck.length === 0) {
      // Reshuffle discard pile into deck
      if (newDiscard.length === 0) break; // no cards left at all
      newDeck.push(...shuffleDeck(newDiscard));
      newDiscard = [];
    }
    const card = newDeck.pop()!;
    drawn.push(card);
  }

  return { drawnCards: drawn, newDeck, newDiscardPile: newDiscard };
}

// Get deck stats for display
export function getDeckStats(deck: GameCard[], discardPile: GameCard[]): {
  deckCount: number;
  discardCount: number;
} {
  return {
    deckCount: deck.length,
    discardCount: discardPile.length,
  };
}

// Reclaim all cards from a specific zone (e.g., when a player dies)
export function collectCardsFromZones(
  deck: GameCard[],
  discardPile: GameCard[],
  ...cardLists: GameCard[][]
): { newDeck: GameCard[]; newDiscardPile: GameCard[] } {
  let allDiscard = [...discardPile];
  for (const cards of cardLists) {
    allDiscard = allDiscard.concat(cards);
  }
  return { newDeck: deck, newDiscardPile: allDiscard };
}
