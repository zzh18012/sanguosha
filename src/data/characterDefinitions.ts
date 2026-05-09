// ============================================================
// Character data for UI reference (names, portraits, descriptions)
// ============================================================

import type { Kingdom } from '../types/characters';

export interface CharacterInfo {
  id: string;
  name: string;
  title: string;
  kingdom: Kingdom;
  maxHp: number;
  gender: string;
  skillNames: string[];
  skillDescriptions: string[];
  isRulerOption: boolean;
}

export const CHARACTER_INFO: CharacterInfo[] = [
  // Wei
  { id: 'caocao', name: '曹操', title: '魏武帝', kingdom: 'wei', maxHp: 4, gender: 'male', skillNames: ['奸雄', '护驾'], skillDescriptions: ['当你受到伤害后，你可以获得造成此伤害的牌。', '主公技，当你需要使用或打出闪时，你可以令其他魏势力角色打出一张闪（视为由你使用或打出）。'], isRulerOption: true },
  { id: 'simayi', name: '司马懿', title: '狼顾之鬼', kingdom: 'wei', maxHp: 3, gender: 'male', skillNames: ['反馈', '鬼才'], skillDescriptions: ['当你受到伤害后，你可以获得伤害来源的一张牌。', '当一名角色的判定牌生效前，你可以打出一张手牌代替之。'], isRulerOption: false },
  { id: 'xiahoudun', name: '夏侯惇', title: '独眼的罗刹', kingdom: 'wei', maxHp: 4, gender: 'male', skillNames: ['刚烈'], skillDescriptions: ['当你受到伤害后，你可以进行判定，若结果不为红桃，伤害来源选择弃置两张手牌或受到你造成的1点伤害。'], isRulerOption: false },
  { id: 'zhangliao', name: '张辽', title: '前将军', kingdom: 'wei', maxHp: 4, gender: 'male', skillNames: ['突袭'], skillDescriptions: ['摸牌阶段，你可以少摸任意张牌，然后选择等量的手牌数不小于你的角色，获得这些角色的各一张手牌。'], isRulerOption: false },
  { id: 'xuchu', name: '许褚', title: '虎痴', kingdom: 'wei', maxHp: 4, gender: 'male', skillNames: ['裸衣'], skillDescriptions: ['摸牌阶段，你可以少摸一张牌，本回合使用杀或决斗造成伤害时，此伤害+1。'], isRulerOption: false },
  { id: 'guojia', name: '郭嘉', title: '早终的先知', kingdom: 'wei', maxHp: 3, gender: 'male', skillNames: ['天妒', '遗计'], skillDescriptions: ['当你的判定牌生效后，你可以获得此牌。', '当你受到1点伤害后，你可以摸两张牌，然后你可以将至多两张手牌交给任意角色。'], isRulerOption: false },
  { id: 'zhenji', name: '甄姬', title: '薄幸的美人', kingdom: 'wei', maxHp: 3, gender: 'female', skillNames: ['洛神', '倾国'], skillDescriptions: ['准备阶段，你可以进行判定，若结果为黑色，你获得此牌并重复此流程。', '你可以将一张黑色手牌当闪使用或打出。'], isRulerOption: false },
  // Shu
  { id: 'liubei', name: '刘备', title: '乱世的枭雄', kingdom: 'shu', maxHp: 4, gender: 'male', skillNames: ['仁德', '激将'], skillDescriptions: ['出牌阶段，你可以将任意张手牌交给其他角色，若你给出的牌张数达到两张或更多时，你回复1点体力。', '主公技，当你需要使用或打出杀时，你可以令其他蜀势力角色打出一张杀。'], isRulerOption: true },
  { id: 'guanyu', name: '关羽', title: '美髯公', kingdom: 'shu', maxHp: 4, gender: 'male', skillNames: ['武圣'], skillDescriptions: ['你可以将一张红色牌当杀使用或打出。'], isRulerOption: false },
  { id: 'zhangfei', name: '张飞', title: '万夫不当', kingdom: 'shu', maxHp: 4, gender: 'male', skillNames: ['咆哮'], skillDescriptions: ['锁定技，你使用杀无次数限制。若你使用的杀被闪抵消，你可以摸一张牌。'], isRulerOption: false },
  { id: 'zhugeliang', name: '诸葛亮', title: '卧龙', kingdom: 'shu', maxHp: 3, gender: 'male', skillNames: ['观星', '空城'], skillDescriptions: ['准备阶段，你可以观看牌堆顶的X张牌，然后将这些牌以任意顺序放回牌堆顶或牌堆底。', '锁定技，若你没有手牌，你不能成为杀或决斗的目标。'], isRulerOption: false },
  { id: 'zhaoyun', name: '赵云', title: '虎威将军', kingdom: 'shu', maxHp: 4, gender: 'male', skillNames: ['龙胆'], skillDescriptions: ['你可以将一张杀当闪使用或打出，或将一张闪当杀使用或打出。'], isRulerOption: false },
  { id: 'machao', name: '马超', title: '锦马超', kingdom: 'shu', maxHp: 4, gender: 'male', skillNames: ['马术', '铁骑'], skillDescriptions: ['锁定技，你计算与其他角色的距离时始终-1。', '当你使用杀指定一名目标后，你可以进行判定，若结果为红色，该角色不能使用闪响应此杀。'], isRulerOption: false },
  { id: 'huangyueying', name: '黄月英', title: '归隐的杰女', kingdom: 'shu', maxHp: 3, gender: 'female', skillNames: ['集智', '奇才'], skillDescriptions: ['当你使用一张非延时锦囊牌时，你可以摸一张牌。', '锁定技，你使用锦囊牌无距离限制。'], isRulerOption: false },
  // Wu
  { id: 'sunquan', name: '孙权', title: '年轻贤君', kingdom: 'wu', maxHp: 4, gender: 'male', skillNames: ['制衡', '救援'], skillDescriptions: ['出牌阶段限一次，你可以弃置任意张牌，然后摸等量的牌。', '主公技，其他吴势力角色使用桃指定你为目标时，回复+1。'], isRulerOption: true },
  { id: 'zhouyu', name: '周瑜', title: '大都督', kingdom: 'wu', maxHp: 3, gender: 'male', skillNames: ['英姿', '反间'], skillDescriptions: ['摸牌阶段，你可以多摸一张牌。', '出牌阶段限一次，你可以令一名其他角色选择一种花色，然后获得你的一张手牌并展示，若此牌的花色与其选择的不同，则其受到1点伤害。'], isRulerOption: false },
  { id: 'huanggai', name: '黄盖', title: '轻身为国', kingdom: 'wu', maxHp: 4, gender: 'male', skillNames: ['苦肉'], skillDescriptions: ['出牌阶段，你可以失去1点体力，然后摸三张牌。'], isRulerOption: false },
  { id: 'lvmeng', name: '吕蒙', title: '白衣渡江', kingdom: 'wu', maxHp: 4, gender: 'male', skillNames: ['克己'], skillDescriptions: ['若你于出牌阶段未使用或打出过任何一张杀，你可以跳过此回合的弃牌阶段。'], isRulerOption: false },
  { id: 'luxun', name: '陆逊', title: '儒生雄才', kingdom: 'wu', maxHp: 3, gender: 'male', skillNames: ['谦逊', '连营'], skillDescriptions: ['锁定技，你不能成为顺手牵羊和乐不思蜀的目标。', '当你失去最后一张手牌时，你可以摸一张牌。'], isRulerOption: false },
  { id: 'daqiao', name: '大乔', title: '矜持之花', kingdom: 'wu', maxHp: 3, gender: 'female', skillNames: ['国色', '流离'], skillDescriptions: ['你可以将一张方片牌当乐不思蜀使用。', '当你成为杀的目标时，你可以弃置一张牌并将此杀转移给你攻击范围内的另一名角色。'], isRulerOption: false },
  { id: 'sunshangxiang', name: '孙尚香', title: '弓腰姬', kingdom: 'wu', maxHp: 3, gender: 'female', skillNames: ['结姻', '枭姬'], skillDescriptions: ['出牌阶段限一次，你可以弃置两张手牌，然后令一名已受伤的男性角色回复1点体力，然后你回复1点体力。', '当你失去一张坐骑区或武器区的装备牌后，你可以摸两张牌。'], isRulerOption: false },
  // Qun
  { id: 'huatuo', name: '华佗', title: '神医', kingdom: 'qun', maxHp: 3, gender: 'male', skillNames: ['急救', '青囊'], skillDescriptions: ['你的回合外，你可以将一张红色牌当桃使用。', '出牌阶段限一次，你可以弃置一张手牌，令一名角色回复1点体力。'], isRulerOption: false },
  { id: 'lvbu', name: '吕布', title: '飞将', kingdom: 'qun', maxHp: 4, gender: 'male', skillNames: ['无双'], skillDescriptions: ['锁定技，当你使用杀指定一名目标后，该角色需要连续使用两张闪才能抵消。与你进行决斗的角色每次需要连续打出两张杀。'], isRulerOption: false },
  { id: 'diaochan', name: '貂蝉', title: '绝世的舞姬', kingdom: 'qun', maxHp: 3, gender: 'female', skillNames: ['离间', '闭月'], skillDescriptions: ['出牌阶段限一次，你可以弃置一张牌，令两名男性角色决斗。', '结束阶段，你可以摸一张牌。'], isRulerOption: false },
  { id: 'zhangjiao', name: '张角', title: '天公将军', kingdom: 'qun', maxHp: 3, gender: 'male', skillNames: ['雷击', '鬼道', '黄天'], skillDescriptions: ['当你使用或打出闪时，你可以令一名其他角色进行判定，若为黑桃，你对该角色造成2点雷电伤害。', '当一名角色的判定牌生效前，你可以打出一张黑色牌替换之。', '主公技，其他群势力角色可以在他们的出牌阶段给你一张闪或闪电。'], isRulerOption: true },
  { id: 'yuanshao', name: '袁绍', title: '高贵的名门', kingdom: 'qun', maxHp: 4, gender: 'male', skillNames: ['乱击'], skillDescriptions: ['出牌阶段，你可以将两张同花色的手牌当万箭齐发使用。'], isRulerOption: false },
];

export function getCharacterInfo(id: string): CharacterInfo | undefined {
  return CHARACTER_INFO.find(c => c.id === id);
}
