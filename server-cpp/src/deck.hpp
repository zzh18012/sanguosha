#pragma once
#include "types.hpp"
#include <random>
#include <algorithm>

// ============================================================
// Deck factory — standard 160-card San Guo Sha deck
// ============================================================

// Card rank constants (face cards)
constexpr int A = 1;
constexpr int J = 11;
constexpr int Q = 12;
constexpr int K = 13;

namespace deck {

inline GameCard makeCard(const std::string& name, CardSubtype subtype, CardCategory cat,
                  CardSuit suit, int rank, CardTiming timing = CardTiming::Any,
                  int weaponRange = 0, int targetCount = 1) {
  GameCard c;
  c.name = name; c.subtype = subtype; c.category = cat;
  c.suit = suit; c.rank = rank; c.timing = timing;
  c.weaponRange = weaponRange; c.targetCount = targetCount;
  c.maxTargets = targetCount;
  if (subtype == "huosha" || subtype == "huogong") c.isFire = true;
  if (subtype == "leisha" || subtype == "shandian") c.isThunder = true;
  return c;
}

inline std::vector<GameCard> buildFullDeck() {
  std::vector<GameCard> d;

  // Lambda for basic & tool cards
  auto add = [&](const std::string& name, CardSubtype sub, CardCategory cat,
                 CardSuit suit, int rank, int count = 1) {
    for (int i = 0; i < count; i++) {
      auto c = makeCard(name, sub, cat, suit, rank);
      c.id = name + "_" + std::to_string(d.size());
      d.push_back(c);
    }
  };

  // Lambda for equipment cards (sets equipSlot + weaponRange)
  auto addEquip = [&](const std::string& name, CardSubtype sub, CardSuit suit,
                      int rank, EquipSlot slot, int weaponRange = 0) {
    auto c = makeCard(name, sub, CardCategory::Equipment, suit, rank,
                      CardTiming::Any, weaponRange);
    c.id = name + "_" + std::to_string(d.size());
    c.equipSlot = slot;
    d.push_back(c);
  };

  // === Basic Cards (80) ===
  // Sha (30)
  add("杀","sha",CardCategory::Basic,CardSuit::Spade,7); add("杀","sha",CardCategory::Basic,CardSuit::Spade,8);
  add("杀","sha",CardCategory::Basic,CardSuit::Spade,8); add("杀","sha",CardCategory::Basic,CardSuit::Spade,9);
  add("杀","sha",CardCategory::Basic,CardSuit::Spade,9); add("杀","sha",CardCategory::Basic,CardSuit::Spade,10);
  add("杀","sha",CardCategory::Basic,CardSuit::Spade,10);
  add("杀","sha",CardCategory::Basic,CardSuit::Club,2); add("杀","sha",CardCategory::Basic,CardSuit::Club,3);
  add("杀","sha",CardCategory::Basic,CardSuit::Club,4); add("杀","sha",CardCategory::Basic,CardSuit::Club,5);
  add("杀","sha",CardCategory::Basic,CardSuit::Club,6); add("杀","sha",CardCategory::Basic,CardSuit::Club,7);
  add("杀","sha",CardCategory::Basic,CardSuit::Club,8); add("杀","sha",CardCategory::Basic,CardSuit::Club,8);
  add("杀","sha",CardCategory::Basic,CardSuit::Club,9); add("杀","sha",CardCategory::Basic,CardSuit::Club,9);
  add("杀","sha",CardCategory::Basic,CardSuit::Club,10); add("杀","sha",CardCategory::Basic,CardSuit::Club,10);
  add("杀","sha",CardCategory::Basic,CardSuit::Club,J); add("杀","sha",CardCategory::Basic,CardSuit::Club,J);
  add("杀","sha",CardCategory::Basic,CardSuit::Heart,10); add("杀","sha",CardCategory::Basic,CardSuit::Heart,10);
  add("杀","sha",CardCategory::Basic,CardSuit::Heart,J);
  add("杀","sha",CardCategory::Basic,CardSuit::Diamond,6); add("杀","sha",CardCategory::Basic,CardSuit::Diamond,7);
  add("杀","sha",CardCategory::Basic,CardSuit::Diamond,8); add("杀","sha",CardCategory::Basic,CardSuit::Diamond,9);
  add("杀","sha",CardCategory::Basic,CardSuit::Diamond,10); add("杀","sha",CardCategory::Basic,CardSuit::Diamond,K);
  // Fire Sha (5)
  add("火杀","huosha",CardCategory::Basic,CardSuit::Heart,4); add("火杀","huosha",CardCategory::Basic,CardSuit::Heart,7);
  add("火杀","huosha",CardCategory::Basic,CardSuit::Heart,10); add("火杀","huosha",CardCategory::Basic,CardSuit::Diamond,4);
  add("火杀","huosha",CardCategory::Basic,CardSuit::Diamond,5);
  // Thunder Sha (5)
  add("雷杀","leisha",CardCategory::Basic,CardSuit::Spade,4); add("雷杀","leisha",CardCategory::Basic,CardSuit::Spade,5);
  add("雷杀","leisha",CardCategory::Basic,CardSuit::Spade,6); add("雷杀","leisha",CardCategory::Basic,CardSuit::Spade,7);
  add("雷杀","leisha",CardCategory::Basic,CardSuit::Club,5);
  // Shan (24)
  add("闪","shan",CardCategory::Basic,CardSuit::Heart,2); add("闪","shan",CardCategory::Basic,CardSuit::Heart,2);
  add("闪","shan",CardCategory::Basic,CardSuit::Heart,4); add("闪","shan",CardCategory::Basic,CardSuit::Heart,5);
  add("闪","shan",CardCategory::Basic,CardSuit::Heart,6); add("闪","shan",CardCategory::Basic,CardSuit::Heart,7);
  add("闪","shan",CardCategory::Basic,CardSuit::Heart,8); add("闪","shan",CardCategory::Basic,CardSuit::Heart,9);
  add("闪","shan",CardCategory::Basic,CardSuit::Heart,J); add("闪","shan",CardCategory::Basic,CardSuit::Heart,J);
  add("闪","shan",CardCategory::Basic,CardSuit::Heart,Q); add("闪","shan",CardCategory::Basic,CardSuit::Heart,K);
  add("闪","shan",CardCategory::Basic,CardSuit::Diamond,2); add("闪","shan",CardCategory::Basic,CardSuit::Diamond,2);
  add("闪","shan",CardCategory::Basic,CardSuit::Diamond,3); add("闪","shan",CardCategory::Basic,CardSuit::Diamond,4);
  add("闪","shan",CardCategory::Basic,CardSuit::Diamond,5); add("闪","shan",CardCategory::Basic,CardSuit::Diamond,6);
  add("闪","shan",CardCategory::Basic,CardSuit::Diamond,7); add("闪","shan",CardCategory::Basic,CardSuit::Diamond,8);
  add("闪","shan",CardCategory::Basic,CardSuit::Diamond,9); add("闪","shan",CardCategory::Basic,CardSuit::Diamond,10);
  add("闪","shan",CardCategory::Basic,CardSuit::Diamond,J); add("闪","shan",CardCategory::Basic,CardSuit::Diamond,Q);
  // Tao (12)
  add("桃","tao",CardCategory::Basic,CardSuit::Heart,3); add("桃","tao",CardCategory::Basic,CardSuit::Heart,4);
  add("桃","tao",CardCategory::Basic,CardSuit::Heart,6); add("桃","tao",CardCategory::Basic,CardSuit::Heart,7);
  add("桃","tao",CardCategory::Basic,CardSuit::Heart,8); add("桃","tao",CardCategory::Basic,CardSuit::Heart,9);
  add("桃","tao",CardCategory::Basic,CardSuit::Heart,Q);
  add("桃","tao",CardCategory::Basic,CardSuit::Diamond,2); add("桃","tao",CardCategory::Basic,CardSuit::Diamond,3);
  add("桃","tao",CardCategory::Basic,CardSuit::Diamond,4); add("桃","tao",CardCategory::Basic,CardSuit::Diamond,5);
  add("桃","tao",CardCategory::Basic,CardSuit::Diamond,Q);
  // Jiu (4)
  add("酒","jiu",CardCategory::Basic,CardSuit::Spade,3); add("酒","jiu",CardCategory::Basic,CardSuit::Spade,9);
  add("酒","jiu",CardCategory::Basic,CardSuit::Club,3); add("酒","jiu",CardCategory::Basic,CardSuit::Club,9);

  // === Tool Cards (50) ===
  add("过河拆桥","guohe_chaiqiao",CardCategory::Tool,CardSuit::Spade,3); add("过河拆桥","guohe_chaiqiao",CardCategory::Tool,CardSuit::Spade,4);
  add("过河拆桥","guohe_chaiqiao",CardCategory::Tool,CardSuit::Spade,Q); add("过河拆桥","guohe_chaiqiao",CardCategory::Tool,CardSuit::Club,3);
  add("过河拆桥","guohe_chaiqiao",CardCategory::Tool,CardSuit::Club,4); add("过河拆桥","guohe_chaiqiao",CardCategory::Tool,CardSuit::Heart,Q);
  add("顺手牵羊","shunshou_qianyang",CardCategory::Tool,CardSuit::Spade,3); add("顺手牵羊","shunshou_qianyang",CardCategory::Tool,CardSuit::Spade,4);
  add("顺手牵羊","shunshou_qianyang",CardCategory::Tool,CardSuit::Spade,J); add("顺手牵羊","shunshou_qianyang",CardCategory::Tool,CardSuit::Diamond,3);
  add("顺手牵羊","shunshou_qianyang",CardCategory::Tool,CardSuit::Diamond,4);
  add("无中生有","wuzhong_shengyou",CardCategory::Tool,CardSuit::Heart,7); add("无中生有","wuzhong_shengyou",CardCategory::Tool,CardSuit::Heart,8);
  add("无中生有","wuzhong_shengyou",CardCategory::Tool,CardSuit::Heart,9); add("无中生有","wuzhong_shengyou",CardCategory::Tool,CardSuit::Heart,J);
  add("决斗","juedou",CardCategory::Tool,CardSuit::Spade,A); add("决斗","juedou",CardCategory::Tool,CardSuit::Club,A);
  add("决斗","juedou",CardCategory::Tool,CardSuit::Diamond,A);
  add("南蛮入侵","nanman_ruqin",CardCategory::Tool,CardSuit::Spade,7); add("南蛮入侵","nanman_ruqin",CardCategory::Tool,CardSuit::Spade,K);
  add("南蛮入侵","nanman_ruqin",CardCategory::Tool,CardSuit::Club,7);
  add("万箭齐发","wanjian_qifa",CardCategory::Tool,CardSuit::Heart,A); add("万箭齐发","wanjian_qifa",CardCategory::Tool,CardSuit::Diamond,12);
  add("桃园结义","taoyuan_jieyi",CardCategory::Tool,CardSuit::Heart,A);
  add("五谷丰登","wugu_fengdeng",CardCategory::Tool,CardSuit::Heart,3); add("五谷丰登","wugu_fengdeng",CardCategory::Tool,CardSuit::Heart,4);
  add("借刀杀人","jiedao_sharen",CardCategory::Tool,CardSuit::Club,Q); add("借刀杀人","jiedao_sharen",CardCategory::Tool,CardSuit::Club,K);
  add("无懈可击","wuxie_keji",CardCategory::Tool,CardSuit::Spade,J); add("无懈可击","wuxie_keji",CardCategory::Tool,CardSuit::Spade,Q);
  add("无懈可击","wuxie_keji",CardCategory::Tool,CardSuit::Club,Q); add("无懈可击","wuxie_keji",CardCategory::Tool,CardSuit::Club,J);
  add("无懈可击","wuxie_keji",CardCategory::Tool,CardSuit::Heart,K); add("无懈可击","wuxie_keji",CardCategory::Tool,CardSuit::Heart,Q);
  add("无懈可击","wuxie_keji",CardCategory::Tool,CardSuit::Diamond,Q);
  add("铁索连环","tiesuo_lianhuan",CardCategory::Tool,CardSuit::Spade,Q); add("铁索连环","tiesuo_lianhuan",CardCategory::Tool,CardSuit::Spade,K);
  add("铁索连环","tiesuo_lianhuan",CardCategory::Tool,CardSuit::Club,Q); add("铁索连环","tiesuo_lianhuan",CardCategory::Tool,CardSuit::Club,K);
  add("铁索连环","tiesuo_lianhuan",CardCategory::Tool,CardSuit::Heart,Q); add("铁索连环","tiesuo_lianhuan",CardCategory::Tool,CardSuit::Heart,K);
  add("乐不思蜀","lebu_sishu",CardCategory::Tool,CardSuit::Heart,6); add("乐不思蜀","lebu_sishu",CardCategory::Tool,CardSuit::Club,6);
  add("乐不思蜀","lebu_sishu",CardCategory::Tool,CardSuit::Spade,6);
  add("兵粮寸断","bingliang_cunduan",CardCategory::Tool,CardSuit::Spade,4); add("兵粮寸断","bingliang_cunduan",CardCategory::Tool,CardSuit::Club,4);
  add("闪电","shandian",CardCategory::Tool,CardSuit::Spade,A); add("闪电","shandian",CardCategory::Tool,CardSuit::Heart,Q);

  // === Equipment (30) ===
  // Weapons
  addEquip("诸葛连弩","zhugeliannu",CardSuit::Club,A,EquipSlot::Weapon,1);
  addEquip("诸葛连弩","zhugeliannu",CardSuit::Diamond,A,EquipSlot::Weapon,1);
  addEquip("青釭剑","qinggangjian",CardSuit::Spade,6,EquipSlot::Weapon,2);
  addEquip("丈八蛇矛","zhangbashemao",CardSuit::Spade,Q,EquipSlot::Weapon,3);
  addEquip("贯石斧","guanshifu",CardSuit::Diamond,5,EquipSlot::Weapon,3);
  addEquip("青龙偃月刀","qinglongyanyuedao",CardSuit::Spade,5,EquipSlot::Weapon,3);
  addEquip("麒麟弓","qilingong",CardSuit::Heart,5,EquipSlot::Weapon,5);
  addEquip("寒冰剑","hanbingjian",CardSuit::Spade,2,EquipSlot::Weapon,2);
  addEquip("古锭刀","gudingdao",CardSuit::Spade,A,EquipSlot::Weapon,2);
  addEquip("朱雀羽扇","zhuqueyushan",CardSuit::Diamond,A,EquipSlot::Weapon,4);
  // Armor
  addEquip("八卦阵","baguazhen",CardSuit::Spade,2,EquipSlot::Armor);
  addEquip("八卦阵","baguazhen",CardSuit::Club,2,EquipSlot::Armor);
  addEquip("仁王盾","renwangdun",CardSuit::Club,2,EquipSlot::Armor);
  addEquip("藤甲","tengjia",CardSuit::Spade,2,EquipSlot::Armor);
  addEquip("藤甲","tengjia",CardSuit::Club,2,EquipSlot::Armor);
  addEquip("白银狮子","baiyinshizi",CardSuit::Club,A,EquipSlot::Armor);
  // +1 Horses (defensive)
  addEquip("绝影","jueying",CardSuit::Spade,5,EquipSlot::PlusHorse);
  addEquip("的卢","dilu",CardSuit::Club,5,EquipSlot::PlusHorse);
  addEquip("爪黄飞电","zhaohuangfeidian",CardSuit::Heart,K,EquipSlot::PlusHorse);
  addEquip("骅骝","hualiu",CardSuit::Diamond,K,EquipSlot::PlusHorse);
  // -1 Horses (offensive)
  addEquip("大宛","dawan",CardSuit::Spade,K,EquipSlot::MinusHorse);
  addEquip("赤兔","chitu",CardSuit::Heart,5,EquipSlot::MinusHorse);
  addEquip("紫骍","zixing",CardSuit::Diamond,K,EquipSlot::MinusHorse);

  return d;
}

inline void shuffle(std::vector<GameCard>& d, std::mt19937& rng) {
  std::shuffle(d.begin(), d.end(), rng);
}

inline GameCard draw(std::vector<GameCard>& deck, std::vector<GameCard>& discard, std::mt19937& rng) {
  if (deck.empty()) {
    deck = std::move(discard);
    discard.clear();
    shuffle(deck, rng);
  }
  auto c = std::move(deck.back());
  deck.pop_back();
  return c;
}

inline void discardCard(std::vector<GameCard>& pile, GameCard&& c) {
  pile.push_back(std::move(c));
}

} // namespace deck
