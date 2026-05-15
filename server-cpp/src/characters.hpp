#pragma once
#include "skills.hpp"
#include <string>
#include <vector>

// ============================================================
// CharacterDef — definition for a selectable general
// ============================================================
struct CharacterDef {
  std::string id;             // e.g. "caocao"
  std::string name;           // e.g. "曹操"
  std::string title;          // e.g. "魏武帝"
  Kingdom kingdom;
  int maxHp;
  Gender gender;
  std::vector<std::string> skillIds;
  bool isRulerOption = false;
};

// ============================================================
// Forward-declare character array (populated below)
// ============================================================
namespace {

// ============================================================
// registerAllSkills — 41 skill definitions
// ============================================================
void registerAllSkills() {
  // --- Wei skills (11) ---

  registerSkill({"jianxiong", "奸雄",
    "当你受到伤害后，你可以获得造成此伤害的牌。",
    {SkillTrigger::on_damage_received}, false, false});

  registerSkill({"hujia", "护驾",
    "主公技，当你需要使用或打出闪时，你可以令其他魏势力角色打出一张闪（视为由你使用或打出）。",
    {SkillTrigger::on_sha_targeted}, false, true});

  registerSkill({"fankui", "反馈",
    "当你受到伤害后，你可以获得伤害来源的一张牌。",
    {SkillTrigger::on_damage_received}, false, false});

  registerSkill({"guicai", "鬼才",
    "当一名角色的判定牌生效前，你可以打出一张手牌代替之。",
    {SkillTrigger::on_judgment_start}, false, false});

  registerSkill({"ganglie", "刚烈",
    "当你受到伤害后，你可以进行判定，若结果不为红桃，伤害来源选择弃置两张手牌或受到你造成的1点伤害。",
    {SkillTrigger::on_damage_received}, false, false});

  registerSkill({"tuxi", "突袭",
    "摸牌阶段，你可以少摸任意张牌，然后选择等量的手牌数不小于你的角色，获得这些角色的各一张手牌。",
    {SkillTrigger::on_draw_phase}, false, false});

  registerSkill({"luoyi", "裸衣",
    "摸牌阶段，你可以少摸一张牌，本回合使用杀或决斗造成伤害时，此伤害+1。",
    {SkillTrigger::on_draw_phase}, false, false});

  registerSkill({"tiandu", "天妒",
    "当你的判定牌生效后，你可以获得此牌。",
    {SkillTrigger::on_damage_received}, true, false});

  registerSkill({"yiji", "遗计",
    "当你受到1点伤害后，你可以摸两张牌，然后你可以将至多两张手牌交给任意角色。",
    {SkillTrigger::on_damage_received}, false, false});

  registerSkill({"luoshen", "洛神",
    "准备阶段，你可以进行判定，若结果为黑色，你获得此牌并重复此流程。",
    {SkillTrigger::on_play_phase_start}, false, false});

  registerSkill({"qingguo", "倾国",
    "你可以将一张黑色手牌当闪使用或打出。",
    {SkillTrigger::passive}, false, false});

  // --- Shu skills (10) ---

  registerSkill({"rende", "仁德",
    "出牌阶段，你可以将任意张手牌交给其他角色，若你给出的牌张数达到两张或更多时，你回复1点体力。",
    {SkillTrigger::on_play_phase_start}, false, false});

  registerSkill({"jijiang", "激将",
    "主公技，当你需要使用或打出杀时，你可以令其他蜀势力角色打出一张杀（视为由你使用或打出）。",
    {SkillTrigger::on_sha_targeted}, false, true});

  registerSkill({"wusheng", "武圣",
    "你可以将一张红色牌当杀使用或打出。",
    {SkillTrigger::active}, false, false});

  registerSkill({"paoxiao", "咆哮",
    "锁定技，你使用杀无次数限制。若你使用的杀被闪抵消，你可以摸一张牌。",
    {SkillTrigger::passive}, false, false});

  registerSkill({"guanxing", "观星",
    "准备阶段，你可以观看牌堆顶的X张牌（X为存活角色数且至多为5），然后将这些牌以任意顺序放回牌堆顶或牌堆底。",
    {SkillTrigger::on_turn_start}, false, false});

  registerSkill({"kongcheng", "空城",
    "锁定技，若你没有手牌，你不能成为杀或决斗的目标。",
    {SkillTrigger::passive}, false, false});

  registerSkill({"longdan", "龙胆",
    "你可以将一张杀当闪使用或打出，或将一张闪当杀使用或打出。",
    {SkillTrigger::active}, false, false});

  registerSkill({"mashu", "马术",
    "锁定技，你计算与其他角色的距离时始终-1。",
    {SkillTrigger::passive}, true, false});

  registerSkill({"tieqi", "铁骑",
    "当你使用杀指定一名目标后，你可以进行判定，若结果为红色，该角色不能使用闪响应此杀。",
    {SkillTrigger::on_sha_played}, false, false});

  registerSkill({"jizhi", "集智",
    "当你使用一张非延时锦囊牌时，你可以摸一张牌。",
    {SkillTrigger::on_card_played}, false, false});

  registerSkill({"qicai", "奇才",
    "锁定技，你使用锦囊牌无距离限制。",
    {SkillTrigger::passive}, true, false});

  // --- Wu skills (12) ---

  registerSkill({"zhiheng", "制衡",
    "出牌阶段限一次，你可以弃置任意张牌，然后摸等量的牌。",
    {SkillTrigger::on_play_phase_start}, false, false});

  registerSkill({"jiuyuan", "救援",
    "主公技，其他吴势力角色使用桃指定你为目标时，回复+1。",
    {SkillTrigger::on_healed}, true, true});

  registerSkill({"yingzi", "英姿",
    "摸牌阶段，你可以多摸一张牌。",
    {SkillTrigger::on_draw_phase}, true, false});

  registerSkill({"fanjian", "反间",
    "出牌阶段限一次，你可以令一名其他角色选择一种花色，然后获得你的一张手牌并展示，若此牌的花色与其选择的不同，则其受到1点伤害。",
    {SkillTrigger::on_play_phase_start}, false, false});

  registerSkill({"kurou", "苦肉",
    "出牌阶段，你可以失去1点体力，然后摸三张牌。",
    {SkillTrigger::on_play_phase_start}, false, false});

  registerSkill({"keji", "克己",
    "若你于出牌阶段未使用或打出过任何一张杀，你可以跳过此回合的弃牌阶段。",
    {SkillTrigger::on_discard_phase}, false, false});

  registerSkill({"qianxun", "谦逊",
    "锁定技，你不能成为顺手牵羊和乐不思蜀的目标。",
    {SkillTrigger::passive}, true, false});

  registerSkill({"lianying", "连营",
    "当你失去最后一张手牌时，你可以摸一张牌。",
    {SkillTrigger::on_card_played}, false, false});

  registerSkill({"guose", "国色",
    "你可以将一张方片牌当乐不思蜀使用。",
    {SkillTrigger::active}, false, false});

  registerSkill({"liuli", "流离",
    "当你成为杀的目标时，你可以弃置一张牌并将此杀转移给你攻击范围内的另一名角色。",
    {SkillTrigger::on_sha_targeted}, false, false});

  registerSkill({"xiaoji", "枭姬",
    "当你失去一张坐骑区或武器区的装备牌后，你可以摸两张牌。",
    {SkillTrigger::on_card_played}, false, false});

  registerSkill({"jieyin", "结姻",
    "出牌阶段限一次，你可以弃置两张手牌，然后令一名已受伤的男性角色回复1点体力，然后你回复1点体力。",
    {SkillTrigger::on_play_phase_start}, false, false});

  // --- Qun skills (8) ---

  registerSkill({"jijiu", "急救",
    "你的回合外，你可以将一张红色牌当桃使用。",
    {SkillTrigger::passive}, true, false});

  registerSkill({"qingnang", "青囊",
    "出牌阶段限一次，你可以弃置一张手牌，令一名角色回复1点体力。",
    {SkillTrigger::on_play_phase_start}, false, false});

  registerSkill({"wushuang", "无双",
    "锁定技，当你使用杀指定一名目标后，该角色需要连续使用两张闪才能抵消。与你进行决斗的角色每次需要连续打出两张杀。",
    {SkillTrigger::on_sha_played}, true, false});

  registerSkill({"lijian", "离间",
    "出牌阶段限一次，你可以弃置一张牌，令两名男性角色决斗。",
    {SkillTrigger::on_play_phase_start}, false, false});

  registerSkill({"biyue", "闭月",
    "结束阶段，你可以摸一张牌。",
    {SkillTrigger::on_turn_end}, true, false});

  registerSkill({"leiji", "雷击",
    "当你使用或打出闪时，你可以令一名其他角色进行判定，若为黑桃，你对该角色造成2点雷电伤害。",
    {SkillTrigger::on_damage_received}, false, false});

  registerSkill({"luanji", "乱击",
    "出牌阶段，你可以将两张同花色的手牌当万箭齐发使用。",
    {SkillTrigger::active}, false, false});
}

// ============================================================
// Character definitions (26 characters, 4 kingdoms)
// ============================================================

// --- Wei (7) ---
const CharacterDef caocao = {
  "caocao", "曹操", "魏武帝", Kingdom::Wei, 4, Gender::Male,
  {"jianxiong", "hujia"}, true
};

const CharacterDef simayi = {
  "simayi", "司马懿", "冢虎", Kingdom::Wei, 3, Gender::Male,
  {"fankui", "guicai"}, false
};

const CharacterDef xiahoudun = {
  "xiahoudun", "夏侯惇", "刚烈", Kingdom::Wei, 4, Gender::Male,
  {"ganglie"}, false
};

const CharacterDef zhangliao = {
  "zhangliao", "张辽", "突袭", Kingdom::Wei, 4, Gender::Male,
  {"tuxi"}, false
};

const CharacterDef xuchu = {
  "xuchu", "许褚", "裸衣", Kingdom::Wei, 4, Gender::Male,
  {"luoyi"}, false
};

const CharacterDef guojia = {
  "guojia", "郭嘉", "天妒", Kingdom::Wei, 3, Gender::Male,
  {"tiandu", "yiji"}, false
};

const CharacterDef zhenji = {
  "zhenji", "甄姬", "洛神", Kingdom::Wei, 3, Gender::Female,
  {"luoshen", "qingguo"}, false
};

// --- Shu (7) ---
const CharacterDef liubei = {
  "liubei", "刘备", "仁德", Kingdom::Shu, 4, Gender::Male,
  {"rende", "jijiang"}, true
};

const CharacterDef guanyu = {
  "guanyu", "关羽", "武圣", Kingdom::Shu, 4, Gender::Male,
  {"wusheng"}, false
};

const CharacterDef zhangfei = {
  "zhangfei", "张飞", "咆哮", Kingdom::Shu, 4, Gender::Male,
  {"paoxiao"}, false
};

const CharacterDef zhugeliang = {
  "zhugeliang", "诸葛亮", "卧龙", Kingdom::Shu, 3, Gender::Male,
  {"guanxing", "kongcheng"}, false
};

const CharacterDef zhaoyun = {
  "zhaoyun", "赵云", "龙胆", Kingdom::Shu, 4, Gender::Male,
  {"longdan"}, false
};

const CharacterDef machao = {
  "machao", "马超", "马术", Kingdom::Shu, 4, Gender::Male,
  {"mashu", "tieqi"}, false
};

const CharacterDef huangyueying = {
  "huangyueying", "黄月英", "集智", Kingdom::Shu, 3, Gender::Female,
  {"jizhi", "qicai"}, false
};

// --- Wu (7) ---
const CharacterDef sunquan = {
  "sunquan", "孙权", "制衡", Kingdom::Wu, 4, Gender::Male,
  {"zhiheng", "jiuyuan"}, true
};

const CharacterDef zhouyu = {
  "zhouyu", "周瑜", "英姿", Kingdom::Wu, 3, Gender::Male,
  {"yingzi", "fanjian"}, false
};

const CharacterDef huanggai = {
  "huanggai", "黄盖", "苦肉", Kingdom::Wu, 4, Gender::Male,
  {"kurou"}, false
};

const CharacterDef lvmeng = {
  "lvmeng", "吕蒙", "克己", Kingdom::Wu, 4, Gender::Male,
  {"keji"}, false
};

const CharacterDef luxun = {
  "luxun", "陆逊", "谦逊", Kingdom::Wu, 3, Gender::Male,
  {"qianxun", "lianying"}, false
};

const CharacterDef daqiao = {
  "daqiao", "大乔", "国色", Kingdom::Wu, 3, Gender::Female,
  {"guose", "liuli"}, false
};

const CharacterDef sunshangxiang = {
  "sunshangxiang", "孙尚香", "枭姬", Kingdom::Wu, 3, Gender::Female,
  {"xiaoji", "jieyin"}, false
};

// --- Qun (5) ---
const CharacterDef huatuo = {
  "huatuo", "华佗", "神医", Kingdom::Qun, 3, Gender::Male,
  {"jijiu", "qingnang"}, false
};

const CharacterDef lvbu = {
  "lvbu", "吕布", "无双", Kingdom::Qun, 4, Gender::Male,
  {"wushuang"}, false
};

const CharacterDef diaochan = {
  "diaochan", "貂蝉", "离间", Kingdom::Qun, 3, Gender::Female,
  {"lijian", "biyue"}, false
};

const CharacterDef zhangjiao = {
  "zhangjiao", "张角", "雷击", Kingdom::Qun, 3, Gender::Male,
  {"leiji"}, false
};

const CharacterDef yuanshao = {
  "yuanshao", "袁绍", "乱击", Kingdom::Qun, 4, Gender::Male,
  {"luanji"}, false
};

// ============================================================
// All characters array (populated on first access)
// ============================================================
const std::vector<CharacterDef>& allCharacters() {
  static bool initialized = false;
  static std::vector<CharacterDef> chars;
  if (!initialized) {
    registerAllSkills();
    chars = {
      caocao, simayi, xiahoudun, zhangliao, xuchu, guojia, zhenji,
      liubei, guanyu, zhangfei, zhugeliang, zhaoyun, machao, huangyueying,
      sunquan, zhouyu, huanggai, lvmeng, luxun, daqiao, sunshangxiang,
      huatuo, lvbu, diaochan, zhangjiao, yuanshao
    };
    initialized = true;
  }
  return chars;
}

} // anonymous namespace

// ============================================================
// Public API
// ============================================================

// Returns all 26 character definitions (lazily initialized).
inline const std::vector<CharacterDef>& getAllCharacters() {
  return allCharacters();
}

// Finds a character by ID. Returns nullptr if not found.
inline const CharacterDef* findCharacter(const std::string& id) {
  for (const auto& ch : allCharacters()) {
    if (ch.id == id) return &ch;
  }
  return nullptr;
}
