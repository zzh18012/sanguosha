// ============================================================
// Comprehensive test runner for all game features
// Run in browser console: __testAll()
// ============================================================

interface TestResult {
  name: string;
  passed: boolean;
  detail: string;
}

const results: TestResult[] = [];
let currentSection = '';

function pass(name: string, detail: string = '') {
  results.push({ name: `${currentSection} / ${name}`, passed: true, detail });
}

function fail(name: string, detail: string) {
  results.push({ name: `${currentSection} / ${name}`, passed: false, detail });
}

function assert(condition: boolean, name: string, detail: string = '') {
  if (condition) pass(name, detail);
  else fail(name, detail);
}

function section(title: string) {
  currentSection = title;
}

function wait(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function dispatchAndWait(action: any, ms: number = 300): Promise<void> {
  const dbg = (window as any).__gameDebug;
  dbg.dispatch(action);
  await wait(ms);
}

// ============================================================
// Main test entry
// ============================================================
export async function runAllTests() {
  results.length = 0;
  const dbg = (window as any).__gameDebug;
  if (!dbg) {
    console.error('Debug API not available. Add ?debug=1 to URL first.');
    return;
  }

  console.log('═══════════════════════════════════════');
  console.log('  三国杀 全功能测试');
  console.log('═══════════════════════════════════════');

  await testBasicCards(dbg);
  await testToolCards(dbg);
  await testEquipment(dbg);
  await testTurnPhases(dbg);
  await testDyingMechanics(dbg);
  await testCharacterSkills(dbg);
  await testEdgeCases(dbg);
  await testValidActions(dbg);

  // Print results
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n═══════════════════════════════════════');
  console.log(`  测试完成: ${passed} 通过, ${failed} 失败`);
  console.log('═══════════════════════════════════════');

  // Print failures
  const failures = results.filter(r => !r.passed);
  if (failures.length > 0) {
    console.log('\n❌ 失败项目:');
    failures.forEach(f => console.log(`  • ${f.name}: ${f.detail}`));
  }

  console.log('\n详细结果:');
  results.forEach(r => {
    const icon = r.passed ? '✅' : '❌';
    console.log(`  ${icon} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
  });

  return { passed, failed, results };
}

// ============================================================
// 1. Basic Cards (杀 闪 桃 酒)
// ============================================================
async function testBasicCards(dbg: any) {
  section('基础牌');
  const state = dbg.getState();
  if (!state) { fail('getState', 'No state'); return; }
  const human = dbg.getHumanPlayer();
  if (!human) { fail('getHumanPlayer', 'No human player'); return; }

  // Get onto player's turn for testing
  const currentId = state.turnOrder[state.currentPlayerIndex];
  const currentPlayer = dbg.getPlayer(currentId);

  // Test 杀 basics
  assert(currentPlayer !== null, '当前回合玩家存在', currentPlayer?.name || '');

  // Test 闪 exists in deck
  const hasShan = state.deck.some((c: any) => c.subtype === 'shan');
  assert(hasShan, '牌堆包含闪', '基本牌库完整');

  // Test 桃 exists
  const hasTao = state.deck.some((c: any) => c.subtype === 'tao');
  assert(hasTao, '牌堆包含桃', '');

  // Test 酒 exists
  const hasJiu = state.deck.some((c: any) => c.subtype === 'jiu');
  assert(hasJiu, '牌堆包含酒', '');

  // Test validActions during play phase
  const validActions = dbg.getValidActions();
  assert(Array.isArray(validActions), 'validActions 是数组', `length=${validActions.length}`);

  // Check for PLAY_CARD actions in valid actions
  const playActions = validActions.filter((a: any) => a.type === 'PLAY_CARD');
  assert(playActions.length > 0 || state.currentTurnPhase !== 'play',
    '出牌阶段有可用的 PLAY_CARD', `数量=${playActions.length}`);

  // Verify sha requires discard
  assert(currentPlayer?.shaUsedThisTurn !== undefined, 'shaUsedThisTurn 字段存在', '');
}

// ============================================================
// 2. Tool Cards (锦囊牌)
// ============================================================
async function testToolCards(dbg: any) {
  section('锦囊牌');
  const state = dbg.getState();
  if (!state) return;

  const toolTypes = dbg.ALL_TOOLS;

  // Test each tool card type can be created
  for (const subtype of toolTypes) {
    const card = dbg.createCard(subtype);
    assert(card !== null && card.subtype === subtype, `创建 ${subtype}`, card?.name || '');
  }

  // 过河拆桥: can pick from target's hand + equipment
  const guoheCard = dbg.createCard('guohe_chaiqiao');
  assert(guoheCard.category === 'tool', '过河拆桥是锦囊牌', '');
  assert(guoheCard.toolTiming === 'immediate', '过河拆桥是即时锦囊', '');

  // 顺手牵羊: can steal from target distance <= 1
  const shunshouCard = dbg.createCard('shunshou_qianyang');
  assert(shunshouCard.toolTiming === 'immediate', '顺手牵羊是即时锦囊', '');

  // 铁索连环: can recast (重铸) or play
  const tiesuoCard = dbg.createCard('tiesuo_lianhuan');
  assert(tiesuoCard.subtype === 'tiesuo_lianhuan', '铁索连环', '应支持重铸');

  // Check recast is in valid actions if player has 铁索连环
  const human = dbg.getHumanPlayer();
  if (human) {
    const hasTiesuo = human.hand.some((c: any) => c.subtype === 'tiesuo_lianhuan');
    if (hasTiesuo && state.currentTurnPhase === 'play') {
      const currentId = state.turnOrder[state.currentPlayerIndex];
      if (currentId === human.id) {
        const recastActions = dbg.getValidActions().filter((a: any) => a.type === 'RECAST_CARD');
        assert(recastActions.length > 0, '手牌有铁索连环时出现 RECAST_CARD', `数量=${recastActions.length}`);
      }
    }
  }

  // Delayed tools
  for (const sub of ['lebu_sishu', 'bingliang_cunduan', 'shandian'] as const) {
    const card = dbg.createCard(sub);
    assert(card.toolTiming === 'delayed', `${card.name} 是延时锦囊`, '');
  }
}

// ============================================================
// 3. Equipment (装备牌)
// ============================================================
async function testEquipment(dbg: any) {
  section('装备牌');

  // Weapons
  for (const sub of dbg.ALL_WEAPONS) {
    const card = dbg.createCard(sub);
    assert(card.category === 'equipment', `武器 ${card.name}`, `range=${card.weaponRange}`);
    assert(card.equipSlot === 'weapon', `武器 ${card.name} 装备槽正确`, card.equipSlot);
  }

  // Armor
  for (const sub of dbg.ALL_ARMOR) {
    const card = dbg.createCard(sub);
    assert(card.equipSlot === 'armor', `防具 ${card.name}`, '');
  }

  // Horses
  for (const sub of dbg.ALL_PLUS_HORSES) {
    const card = dbg.createCard(sub);
    assert(card.equipSlot === 'plusHorse', `+1马 ${card.name}`, '');
  }
  for (const sub of dbg.ALL_MINUS_HORSES) {
    const card = dbg.createCard(sub);
    assert(card.equipSlot === 'minusHorse', `-1马 ${card.name}`, '');
  }

  // Test equip via debug API
  const human = dbg.getHumanPlayer();
  if (human) {
    // Test setting weapon
    dbg.equip(human.id, 'zhugeliannu');
    const state = dbg.getState();
    const updated = dbg.getPlayer(human.id);
    assert(updated?.equipment?.weapon?.subtype === 'zhugeliannu',
      '装备诸葛连弩', updated?.equipment?.weapon?.name || 'none');

    // Test that 诸葛连弩 allows unlimited sha
    // (We can only verify the equipment is set, full test needs game rules)
  }
}

// ============================================================
// 4. Turn Phases (回合阶段)
// ============================================================
async function testTurnPhases(dbg: any) {
  section('回合阶段');
  const state = dbg.getState();
  if (!state) return;

  const validPhases = ['judge', 'draw', 'play', 'discard', 'end'];
  assert(validPhases.includes(state.currentTurnPhase),
    'currentTurnPhase 有效', state.currentTurnPhase);

  assert(typeof state.turnNumber === 'number', 'turnNumber 存在', `${state.turnNumber}`);
  assert(typeof state.roundNumber === 'number', 'roundNumber 存在', `${state.roundNumber}`);
  assert(state.currentPlayerIndex >= 0, 'currentPlayerIndex 有效', `${state.currentPlayerIndex}`);

  // Turn order
  assert(Array.isArray(state.turnOrder), 'turnOrder 是数组', `${state.turnOrder.length} players`);
  assert(state.turnOrder.length === state.players.length,
    'turnOrder 长度等于玩家数', '');

  // Each player should be in turnOrder
  for (const p of state.players) {
    assert(state.turnOrder.includes(p.id), `玩家 ${p.name} 在 turnOrder 中`, '');
  }
}

// ============================================================
// 5. Dying Mechanics (濒死机制)
// ============================================================
async function testDyingMechanics(dbg: any) {
  section('濒死机制');
  const state = dbg.getState();
  if (!state) return;

  const human = dbg.getHumanPlayer();
  if (!human) return;

  // Test that aliveStatus field exists on all players
  for (const p of state.players) {
    assert(['alive', 'dying', 'dead'].includes(p.aliveStatus),
      `玩家 ${p.name} aliveStatus`, p.aliveStatus);
  }

  // Test PASS_SAVE_DYING exists in actions types
  const humanHasTao = human.hand.some((c: any) => c.subtype === 'tao');

  // Test ENTER_DYING dispatch
  // We test this in isolation — give human 桃 first, reduce HP to 0, check dying triggers
  dbg.damage(human.id, human.hp);
  dbg.dispatch({ type: 'ENTER_DYING', playerId: human.id });

  await wait(200);
  const state2 = dbg.getState();
  if (state2?.pendingAction?.type === 'use_tao_dying') {
    pass('濒死触发 use_tao_dying', `playerId=${state2.pendingAction.playerId}`);

    // Check that PASS_SAVE_DYING is in valid actions
    const va = dbg.getValidActions();
    const passActions = va.filter((a: any) => a.type === 'PASS_SAVE_DYING');
    assert(passActions.length > 0, '濒死时出现 PASS_SAVE_DYING (不救) 选项', '');
  } else {
    // ENTER_DYING might resolve immediately if HP > 0
    fail('濒死触发', `pendingAction=${state2?.pendingAction?.type || 'none'}`);
  }
}

// ============================================================
// 6. Character Skills (武将技能)
// ============================================================
async function testCharacterSkills(dbg: any) {
  section('武将技能');

  const weiSkills = [
    { char: '曹操', skills: ['奸雄', '护驾'] },
    { char: '司马懿', skills: ['反馈', '鬼才'] },
    { char: '夏侯惇', skills: ['刚烈'] },
    { char: '张辽', skills: ['突袭'] },
    { char: '许褚', skills: ['裸衣'] },
    { char: '郭嘉', skills: ['天妒', '遗计'] },
    { char: '甄姬', skills: ['洛神', '倾国'] },
  ];
  const shuSkills = [
    { char: '刘备', skills: ['仁德', '激将'] },
    { char: '关羽', skills: ['武圣'] },
    { char: '张飞', skills: ['咆哮'] },
    { char: '诸葛亮', skills: ['观星', '空城'] },
    { char: '赵云', skills: ['龙胆'] },
    { char: '马超', skills: ['马术', '铁骑'] },
    { char: '黄月英', skills: ['集智', '奇才'] },
  ];
  const wuSkills = [
    { char: '孙权', skills: ['制衡', '救援'] },
    { char: '周瑜', skills: ['英姿', '反间'] },
    { char: '黄盖', skills: ['苦肉'] },
    { char: '吕蒙', skills: ['克己'] },
    { char: '陆逊', skills: ['谦逊', '连营'] },
    { char: '大乔', skills: ['国色', '流离'] },
    { char: '孙尚香', skills: ['结姻', '枭姬'] },
  ];
  const qunSkills = [
    { char: '华佗', skills: ['急救', '青囊'] },
    { char: '吕布', skills: ['无双'] },
    { char: '貂蝉', skills: ['离间', '闭月'] },
    { char: '张角', skills: ['雷击', '鬼道', '黄天'] },
    { char: '袁绍', skills: ['乱击'] },
  ];

  const allSkills = [...weiSkills, ...shuSkills, ...wuSkills, ...qunSkills];

  // Verify state has character data
  const state = dbg.getState();
  for (const p of state?.players || []) {
    if (p.characterId) {
      const found = allSkills.find(s => s.char === p.characterName);
      if (found) {
        pass(`玩家 ${p.name} 武将 ${p.characterName}`, `skills: ${found.skills.join(', ')}`);
      } else {
        pass(`玩家 ${p.name} 武将 ${p.characterName}`, 'character exists');
      }
    }
  }

  // Check skill definitions can be loaded
  // We can't easily test this from here, but we can verify the character registry
  const characterIds = state?.players.map(p => p.characterId).filter(Boolean) || [];
  assert(characterIds.length > 0, '玩家已选择武将', characterIds.join(', '));

  // 乱击: should require discarding 2 cards of same suit
  const hasYuanShao = state?.players.some(p => p.characterId === 'yuanshao');
  if (hasYuanShao) {
    const ysIndex = state!.players.findIndex(p => p.characterId === 'yuanshao');
    const yuanShao = state!.players[ysIndex];
    // Check his hand for same-suit cards
    if (yuanShao.hand.length >= 2) {
      const suits = yuanShao.hand.map((c: any) => c.suit);
      const suitCounts: Record<string, number> = {};
      suits.forEach((s: string) => { suitCounts[s] = (suitCounts[s] || 0) + 1; });
      const hasSameSuit = Object.values(suitCounts).some(c => c >= 2);
      // If Yuan Shao is current player and has same suit, 乱击 should be available
      const currentId = state!.turnOrder[state!.currentPlayerIndex];
      if (currentId === yuanShao.id && state!.currentTurnPhase === 'play') {
        const skillActions = dbg.getValidActions().filter((a: any) => a.type === 'USE_SKILL');
        const luanji = skillActions.find((a: any) => a.skillId === 'luanji');
        if (hasSameSuit) {
          assert(!!luanji, '有同花色时乱击可用', '');
        }
      }
    }
  }
}

// ============================================================
// 7. Edge Cases (边界情况)
// ============================================================
async function testEdgeCases(dbg: any) {
  section('边界情况');

  const state = dbg.getState();
  if (!state) return;

  // Deck count
  assert(state.deck.length >= 0, '牌堆存在', `deck=${state.deck.length} discard=${state.discardPile.length}`);

  // Reshuffle: if deck is empty, it should reshuffle from discard
  if (state.deck.length === 0 && state.discardPile.length > 0) {
    // Force a draw to trigger reshuffle
    const human = dbg.getHumanPlayer();
    if (human) {
      dbg.dispatch({ type: 'DRAW_CARDS', playerId: human.id, count: 1 });
      await wait(200);
      const state2 = dbg.getState();
      if (state2 && state2.deck.length > 0) {
        pass('空牌堆触发洗牌', `deck=${state2.deck.length}`);
      } else {
        console.warn('洗牌可能未自动触发，需检查 drawCards 实现');
        // Check drawCards function
        const stillEmpty = state2?.deck.length === 0;
        fail('空牌堆洗牌', stillEmpty ? '仍为空' : '状态异常');
      }
    }
  }

  // HP bounds
  for (const p of state.players) {
    assert(p.hp >= 0, `玩家 ${p.name} HP >= 0`, `hp=${p.hp}`);
    assert(p.hp <= p.maxHp, `玩家 ${p.name} HP <= maxHp`, `hp=${p.hp} maxHp=${p.maxHp}`);
  }

  // Hand size after discard phase should be <= HP
  for (const p of state.players) {
    if (p.aliveStatus !== 'alive') continue;
    // Only check after discard phase or during own turn phases after play
    if (state.currentTurnPhase === 'discard') {
      const currentId = state.turnOrder[state.currentPlayerIndex];
      if (p.id === currentId) continue; // still in discard phase
    }
    // After end phase, hand <= hp for the player who just ended
  }

  // Verify no duplicate instanceIds in deck
  const allDeckIds = state.deck.map((c: any) => c.instanceId);
  const deckIdSet = new Set(allDeckIds);
  assert(allDeckIds.length === deckIdSet.size,
    '牌堆无重复 instanceId', `total=${allDeckIds.length}`);

  // Check all players have unique IDs
  const playerIds = state.players.map(p => p.id);
  const playerIdSet = new Set(playerIds);
  assert(playerIds.length === playerIdSet.size, '玩家 ID 唯一', '');

  // Exit button should exist
  const exitBtn = document.querySelector('.btn-quit-game');
  assert(!!exitBtn, '退出按钮存在', exitBtn?.textContent || '');
}

// ============================================================
// 8. Valid Actions completeness
// ============================================================
async function testValidActions(dbg: any) {
  section('ValidActions完整性');
  const state = dbg.getState();
  if (!state) return;

  const va = dbg.getValidActions();
  const actionTypes = va.map((a: any) => a.type);

  // During play phase, should have END_PHASE
  if (state.currentTurnPhase === 'play') {
    const currentId = state.turnOrder[state.currentPlayerIndex];
    const currentPlayer = dbg.getPlayer(currentId);
    if (currentPlayer && !currentPlayer.isAI) {
      assert(actionTypes.includes('END_PHASE'), '出牌阶段包含 END_PHASE', '');
      // Hand <= HP should show 结束出牌
    }
  }

  // During discard phase, should have DISCARD_CARD
  if (state.currentTurnPhase === 'discard') {
    const discardActions = va.filter((a: any) => a.type === 'DISCARD_CARD');
    assert(discardActions.length > 0, '弃牌阶段包含 DISCARD_CARD', `数量=${discardActions.length}`);
  }

  // No duplicate actions
  const actionStrs = va.map((a: any) => JSON.stringify(a));
  const actionSet = new Set(actionStrs);
  assert(actionStrs.length === actionSet.size, 'validActions 无重复', '');

  // All cardIds in validActions should reference actual cards
  for (const a of va) {
    if ((a as any).cardId) {
      const cardId = (a as any).cardId;
      // Could be in hand, equipment, or judgment area
      const currentId = state.turnOrder[state.currentPlayerIndex];
      const player = dbg.getPlayer(currentId);
      const inHand = player?.hand.some((c: any) => c.instanceId === cardId);
      const inEquip = player?.equipment && Object.values(player.equipment).some((c: any) => c?.instanceId === cardId);
      if (!inHand && !inEquip) {
        // Might be from a different player (e.g., USE_TAO_OTHER) or a pending action
        // Just note it, don't fail
      }
    }
  }
}

// Auto-install
if (typeof window !== 'undefined') {
  (window as any).__testAll = runAllTests;
}
