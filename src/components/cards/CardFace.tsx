// ============================================================
// CardFace — 还原三国杀实体卡牌原版设计
// 参考：62×87mm 实体牌，竖向，花/点左上，牌名居中，
//       中央插画区为主体，左下类别标注
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
  const suitColor = card.suit === 'heart' || card.suit === 'diamond' ? 'red' : 'black';
  const isDelayed = card.toolTiming === 'delayed';

  return (
    <div
      className={`card-face card-${size} card-type-${card.category} ${isDelayed ? 'card-landscape' : ''} ${selected ? 'card-selected' : ''}`}
      onClick={onClick}
    >
      {/* 内框细线 */}
      <div className="card-inner-line" />

      {/* 左上角：花色 + 点数 (竖向排列) */}
      <div className="card-corner-tl">
        <span className={`card-suit-symbol ${suitColor}`}>{suitSymbol}</span>
        <span className={`card-rank-num ${suitColor}`}>{card.rankDisplay}</span>
      </div>

      {/* 牌名 — 顶部居中 */}
      <div className={`card-title ${suitColor}`}>
        {card.name}
      </div>

      {/* 中央插画区 */}
      <div className={`card-illustration card-illus-${card.category}`}>
        <div className="card-illus-inner">
          <span className="card-illus-glyph">{getCardGlyph(card)}</span>
        </div>
      </div>

      {/* 左下类别标注 */}
      <div className="card-footer-left">
        {/* 武器攻击范围 */}
        {card.equipSlot === 'weapon' && card.weaponRange && (
          <span className="card-weapon-range">攻击范围 {card.weaponRange}</span>
        )}
        {/* 类别 */}
        <span className="card-type-label">
          {getCategoryLabel(card)}
        </span>
        {/* 属性 */}
        {card.isFireElement && <span className="card-attr-fire">火</span>}
        {card.isThunderElement && <span className="card-attr-thunder">雷</span>}
      </div>

      {/* 右下角：延时锦囊沙漏标记 */}
      {isDelayed && (
        <div className="card-hourglass">⏳</div>
      )}
    </div>
  );
}

export function CardBack() {
  return (
    <div className="card-face card-medium card-back">
      <div className="card-back-inner">
        <div className="card-back-border" />
        <div className="card-back-centerpiece">
          <span className="card-back-logo">三国杀</span>
          <span className="card-back-eng">S A N G U O S H A</span>
        </div>
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

function getCategoryLabel(card: GameCard): string {
  if (card.category === 'basic') return '基本牌';
  if (card.equipSlot === 'weapon') return '装备·武器';
  if (card.equipSlot === 'armor') return '装备·防具';
  if (card.equipSlot === 'plusHorse') return '装备·+1坐骑';
  if (card.equipSlot === 'minusHorse') return '装备·-1坐骑';
  if (card.category === 'equipment') return '装备牌';
  if (card.toolTiming === 'delayed') return '锦囊·延时';
  return '锦囊牌';
}

function getCardGlyph(card: GameCard): string {
  if (card.category === 'basic') {
    switch (card.subtype) {
      case 'sha':
        if (card.isFireElement) return '火';
        if (card.isThunderElement) return '雷';
        return '杀';
      case 'shan': return '闪';
      case 'tao': return '桃';
      case 'jiu': return '酒';
      default: return card.name;
    }
  }
  if (card.category === 'equipment') {
    switch (card.subtype) {
      case 'zhugeliannu': return '弩';
      case 'qinggangjian': return '剑';
      case 'zhangbashemao': return '矛';
      case 'guanshifu': return '斧';
      case 'qinglongyanyuedao': return '刀';
      case 'qilingong': return '弓';
      case 'hanbingjian': return '冰';
      case 'gudingdao': return '锭';
      case 'zhuqueyushan': return '扇';
      case 'baguazhen': return '阵';
      case 'renwangdun': return '盾';
      case 'tengjia': return '甲';
      case 'baiyinshizi': return '狮';
      case 'dilu': case 'jueying': case 'zhaohuangfeidian': case 'hualiu':
        return '马';
      case 'dawan': case 'chitu': case 'zixing':
        return '马';
      default: return '装';
    }
  }
  // Tool cards
  switch (card.subtype) {
    case 'guohe_chaiqiao': return '拆';
    case 'shunshou_qianyang': return '牵';
    case 'wuzhong_shengyou': return '无';
    case 'wuxie_keji': return '懈';
    case 'juedou': return '斗';
    case 'nanman_ruqin': return '蛮';
    case 'wanjian_qifa': return '万';
    case 'taoyuan_jieyi': return '园';
    case 'wugu_fengdeng': return '谷';
    case 'jiedao_sharen': return '刀';
    case 'tiesuo_lianhuan': return '锁';
    case 'lebu_sishu': return '乐';
    case 'bingliang_cunduan': return '兵';
    case 'shandian': return '电';
    default: return '锦';
  }
}
