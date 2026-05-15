// ============================================================
// CardFace — 还原三国杀实体卡牌原版牌面设计
//
//  布局参考:
//  ┌─────────────────────────┐
//  │ ♠7       【杀】         │  顶栏: 左角(花色+点数) + 牌名
//  │  ┌───────────────────┐  │
//  │  │                   │  │
//  │  │     中央插画      │  │  主体: 插画区(占卡面60%+)
//  │  │                   │  │
//  │  └───────────────────┘  │
//  │  对你攻击范围内的一名   │  底栏: 效果描述
//  │  其他角色使用...       │
//  └─────────────────────────┘
// ============================================================

import type { GameCard } from '../../types/cards';

interface CardFaceProps {
  card: GameCard;
  size?: 'small' | 'medium' | 'large';
  onClick?: () => void;
  selected?: boolean;
}

export function CardFace({ card, size = 'medium', onClick, selected }: CardFaceProps) {
  const suitSymbol = getSuitSymbol(card.suit);
  const isRed = card.suit === 'heart' || card.suit === 'diamond';
  const isDelayed = card.toolTiming === 'delayed';

  return (
    <div
      className={`card-face card-${size} card-type-${card.category} ${isDelayed ? 'card-landscape' : ''} ${selected ? 'card-selected' : ''}`}
      onClick={onClick}
    >
      {/* 内框 */}
      <div className="card-inner-border" />

      {/* ═══ 顶栏: 花色点数 + 牌名 ═══ */}
      <div className="card-top-area">
        <div className={`card-corner suit-${isRed ? 'red' : 'black'}`}>
          <span className="card-suit">{suitSymbol}</span>
          <span className="card-rank">{card.rankDisplay}</span>
        </div>
        <div className={`card-name-badge name-${card.category}`}>
          【{card.name}】
        </div>
      </div>

      {/* ═══ 中央插画区 — 主体 ═══ */}
      <div className={`card-art card-art-${card.category}`}>
        <div className="card-art-inner">
          {card.isFireElement && <span className="art-attr-tag fire-tag-2">火</span>}
          {card.isThunderElement && <span className="art-attr-tag thunder-tag-2">雷</span>}
          {card.toolTiming === 'delayed' && <span className="art-attr-tag delay-tag-2">延时</span>}
          <span className="card-art-char">{getArtChar(card)}</span>
        </div>
      </div>

      {/* ═══ 底栏: 类别 + 描述 ═══ */}
      <div className="card-bottom-area">
        <span className="card-type-tag">
          {getTypeTag(card)}
        </span>
        <span className="card-desc">{getCardDesc(card)}</span>
      </div>
    </div>
  );
}

// ---------- CardBack ----------

export function CardBack() {
  return (
    <div className="card-face card-medium card-back">
      <div className="card-back-inner">
        <div className="card-back-frame" />
        <div className="card-back-emblem">三国杀</div>
        <div className="card-back-eng">S A N G U O S H A</div>
        <div className="card-back-pattern" />
      </div>
    </div>
  );
}

// ---------- helpers ----------

function getSuitSymbol(suit: string): string {
  switch (suit) {
    case 'spade': return '♠';
    case 'heart': return '♥';
    case 'club': return '♣';
    case 'diamond': return '♦';
    default: return '';
  }
}

function getTypeTag(card: GameCard): string {
  if (card.equipSlot === 'weapon') return `装备·武器${card.weaponRange ? ` 范围${card.weaponRange}` : ''}`;
  if (card.equipSlot === 'armor') return '装备·防具';
  if (card.equipSlot === 'plusHorse') return '装备·防御马';
  if (card.equipSlot === 'minusHorse') return '装备·进攻马';
  if (card.category === 'equipment') return '装备牌';
  if (card.toolTiming === 'delayed') return '锦囊·延时';
  if (card.category === 'tool') return '锦囊牌';
  return '';
}

function getCardDesc(card: GameCard): string {
  // Basic cards
  if (card.subtype === 'sha')
    return '对你攻击范围内的一名角色使用，对其造成1点伤害。';
  if (card.subtype === 'huosha')
    return '对你攻击范围内的一名角色使用，对其造成1点火焰伤害。';
  if (card.subtype === 'leisha')
    return '对你攻击范围内的一名角色使用，对其造成1点雷电伤害。';
  if (card.subtype === 'shan')
    return '抵消一张【杀】的效果。';
  if (card.subtype === 'tao')
    return '回复1点体力。濒死状态时可以对自己使用，回复1点体力。';
  if (card.subtype === 'jiu')
    return '本回合下一张【杀】伤害+1。濒死状态时可以对自己使用，回复1点体力。';

  // Tool cards
  if (card.subtype === 'guohe_chaiqiao')
    return '弃置一名其他角色区域内的一张牌。';
  if (card.subtype === 'shunshou_qianyang')
    return '获得一名距离1以内其他角色区域内的一张牌。';
  if (card.subtype === 'wuzhong_shengyou')
    return '摸两张牌。';
  if (card.subtype === 'wuxie_keji')
    return '抵消一张锦囊牌的效果。';
  if (card.subtype === 'juedou')
    return '与一名其他角色拼点，若你赢，对其造成1点伤害。';
  if (card.subtype === 'nanman_ruqin')
    return '所有其他角色需打出一张【杀】，否则受到1点伤害。';
  if (card.subtype === 'wanjian_qifa')
    return '所有其他角色需打出一张【闪】，否则受到1点伤害。';
  if (card.subtype === 'taoyuan_jieyi')
    return '所有角色回复1点体力。';
  if (card.subtype === 'wugu_fengdeng')
    return '亮出牌堆顶等于角色数的牌，每人获得一张。';
  if (card.subtype === 'jiedao_sharen')
    return '令一名装备武器的角色对另一名角色使用【杀】，否则将其武器交给你。';
  if (card.subtype === 'tiesuo_lianhuan')
    return '将一至两名角色横置或重置。';
  if (card.subtype === 'lebu_sishu')
    return '判定：若不为红桃，目标跳过出牌阶段。';
  if (card.subtype === 'bingliang_cunduan')
    return '判定：若不为梅花，目标跳过摸牌阶段。';
  if (card.subtype === 'shandian')
    return '判定：若为黑桃2-9，目标受到3点雷电伤害。';

  // Equipment
  if (card.subtype === 'zhugeliannu') return '锁定技，你使用【杀】无次数限制。';
  if (card.subtype === 'qinggangjian') return '锁定技，你使用的【杀】无视目标防具。';
  if (card.subtype === 'zhangbashemao') return '你可以将两张牌当【杀】使用或打出。';
  if (card.subtype === 'guanshifu') return '你使用的【杀】被抵消后，可弃置两张牌令其强制命中。';
  if (card.subtype === 'qinglongyanyuedao') return '你使用的【杀】被抵消后，可立即再出一张【杀】。';
  if (card.subtype === 'qilingong') return '你使用的【杀】无距离限制。';
  if (card.subtype === 'hanbingjian') return '你使用的【杀】被抵消后，可弃置目标两张牌。';
  if (card.subtype === 'gudingdao') return '锁定技，对手无手牌时，你使用的【杀】伤害+1。';
  if (card.subtype === 'zhuqueyushan') return '你可以将【杀】当【火杀】使用。';
  if (card.subtype === 'baguazhen') return '当你需要使用【闪】时，可进行判定：若为红色，视为打出【闪】。';
  if (card.subtype === 'renwangdun') return '锁定技，黑色的【杀】对你无效。';
  if (card.subtype === 'tengjia') return '锁定技，【南蛮入侵】、【万箭齐发】对你无效。受到火焰伤害时+1。';
  if (card.subtype === 'baiyinshizi') return '锁定技，你受到的伤害始终为1。失去装备区里的此牌时回复1点体力。';

  return '';
}

function getArtChar(card: GameCard): string {
  if (card.category === 'basic') {
    switch (card.subtype) {
      case 'sha': return card.isFireElement ? '火殺' : card.isThunderElement ? '雷殺' : '殺';
      case 'shan': return '閃';
      case 'tao': return '桃';
      case 'jiu': return '酒';
      default: return card.name;
    }
  }
  if (card.category === 'equipment') {
    return card.name;
  }
  return card.name;
}
