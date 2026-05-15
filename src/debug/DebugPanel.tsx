// ============================================================
// Debug panel — floating UI for game state manipulation
// Only renders when URL has ?debug=1
// ============================================================

import { useState, useEffect } from 'react';
import { useGame } from '../store/GameContext';

type Tab = 'state' | 'cards' | 'hp' | 'phase' | 'test';

export function DebugPanel() {
  const { state, dispatch, validActions } = useGame();
  const [tab, setTab] = useState<Tab>('state');
  const [minimized, setMinimized] = useState(false);
  const [playerIdInput, setPlayerIdInput] = useState('');
  const [cardTypeInput, setCardTypeInput] = useState('sha');
  const [hpInput, setHpInput] = useState('1');
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) => setLog(prev => [...prev.slice(-50), msg]);

  const humanPlayer = state.players.find(p => !p.isAI);
  const currentPlayerId = state.turnOrder[state.currentPlayerIndex];

  if (minimized) {
    return (
      <div style={{
        position: 'fixed', bottom: 10, right: 10, zIndex: 9999,
        background: '#1a1a2e', color: '#c9a86b', padding: '4px 10px',
        borderRadius: 4, cursor: 'pointer', fontSize: 12, border: '1px solid #c9a86b',
      }} onClick={() => setMinimized(false)}>
        🛠 Debug
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: 10, right: 10, zIndex: 9999,
      width: 340, maxHeight: 500, overflow: 'auto',
      background: '#1a1a2e', border: '1px solid #c9a86b', borderRadius: 6,
      color: '#e0d5b7', fontSize: 12, fontFamily: 'monospace',
    }}>
      {/* Header */}
      <div style={{
        background: '#2a2a3e', padding: '6px 10px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid #c9a86b',
      }}>
        <strong>🛠 Debug Panel</strong>
        <button onClick={() => setMinimized(true)}
          style={{ background: 'none', border: 'none', color: '#c9a86b', cursor: 'pointer' }}>
          −
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #333', flexWrap: 'wrap' }}>
        {(['state', 'cards', 'hp', 'phase', 'test'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: '4px 8px', border: 'none', cursor: 'pointer',
              background: tab === t ? '#c9a86b' : 'transparent',
              color: tab === t ? '#1a1a2e' : '#c9a86b',
              fontSize: 11,
            }}>
            {t === 'state' ? '状态' : t === 'cards' ? '手牌' : t === 'hp' ? '体力' : t === 'phase' ? '阶段' : '测试'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: 8 }}>
        {tab === 'state' && (
          <div>
            <div>回合: {state.turnNumber} | 轮: {state.roundNumber}</div>
            <div>阶段: {state.currentTurnPhase} | 模式: {state.mode}</div>
            <div>当前: {state.players.find(p => p.id === currentPlayerId)?.name || '?'}</div>
            <div>Pending: {state.pendingAction?.type || 'none'}</div>
            <div>牌堆: {state.deck.length} | 弃牌: {state.discardPile.length}</div>
            <div style={{ marginTop: 4 }}>
              <strong>玩家:</strong>
              {state.players.map(p => (
                <div key={p.id} style={{ fontSize: 10, marginLeft: 4 }}>
                  {p.name} ({p.characterName}) HP:{p.hp}/{p.maxHp}
                  {' '}手牌:{p.hand.length} 装备:{Object.values(p.equipment).filter(Boolean).length}
                  {' '}[{p.aliveStatus}]
                </div>
              ))}
            </div>
            <div style={{ marginTop: 4, fontSize: 10, maxHeight: 120, overflow: 'auto' }}>
              <strong>ValidActions ({validActions.length}):</strong>
              {validActions.map((a, i) => (
                <div key={i}>{a.type}{'cardId' in a ? ` cardId=${(a as any).cardId?.slice(0,8)}` : ''}</div>
              ))}
            </div>
          </div>
        )}

        {tab === 'cards' && (
          <div>
            <div style={{ marginBottom: 4 }}>设置手牌 (给当前玩家):</div>
            <select value={cardTypeInput} onChange={e => setCardTypeInput(e.target.value)}
              style={{ width: '100%', padding: 2, fontSize: 11, marginBottom: 4 }}>
              <optgroup label="基本牌">
                <option value="sha">杀</option>
                <option value="shan">闪</option>
                <option value="tao">桃</option>
                <option value="jiu">酒</option>
              </optgroup>
              <optgroup label="即时锦囊">
                <option value="guohe_chaiqiao">过河拆桥</option>
                <option value="shunshou_qianyang">顺手牵羊</option>
                <option value="wuzhong_shengyou">无中生有</option>
                <option value="wuxie_keji">无懈可击</option>
                <option value="juedou">决斗</option>
                <option value="nanman_ruqin">南蛮入侵</option>
                <option value="wanjian_qifa">万箭齐发</option>
                <option value="taoyuan_jieyi">桃园结义</option>
                <option value="wugu_fengdeng">五谷丰登</option>
                <option value="jiedao_sharen">借刀杀人</option>
                <option value="tiesuo_lianhuan">铁索连环</option>
              </optgroup>
              <optgroup label="延时锦囊">
                <option value="lebu_sishu">乐不思蜀</option>
                <option value="bingliang_cunduan">兵粮寸断</option>
                <option value="shandian">闪电</option>
              </optgroup>
              <optgroup label="装备">
                <option value="zhugeliannu">诸葛连弩</option>
                <option value="baguazhen">八卦阵</option>
                <option value="chitu">赤兔(-1马)</option>
                <option value="dilu">的卢(+1马)</option>
              </optgroup>
            </select>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => {
                const pid = playerIdInput || humanPlayer?.id || '';
                const dbg = (window as any).__gameDebug;
                dbg.addCard(pid, cardTypeInput as any);
                addLog(`添加 ${cardTypeInput} 到 ${pid}`);
              }} style={btnStyle}>添加</button>
              <button onClick={() => {
                const pid = playerIdInput || humanPlayer?.id || '';
                const dbg = (window as any).__gameDebug;
                dbg.giveCards(pid, ['sha', 'shan', 'tao', 'jiu', 'tiesuo_lianhuan', 'wuxie_keji', 'wuzhong_shengyou'] as any);
                addLog(`设置测试手牌到 ${pid}`);
              }} style={btnStyle}>预设测试手牌</button>
            </div>
            <div style={{ marginTop: 4 }}>
              <button onClick={() => {
                const pid = playerIdInput || humanPlayer?.id || '';
                const dbg = (window as any).__gameDebug;
                dbg.clearHand(pid);
                addLog(`清空 ${pid} 手牌`);
              }} style={{ ...btnStyle, background: '#c0392b' }}>清空手牌</button>
            </div>
            <div style={{ marginTop: 4, fontSize: 10 }}>
              PlayerID: <input value={playerIdInput} onChange={e => setPlayerIdInput(e.target.value)}
                placeholder={humanPlayer?.id || ''} style={{ width: 120, fontSize: 10 }} />
            </div>
          </div>
        )}

        {tab === 'hp' && (
          <div>
            <div style={{ marginBottom: 4 }}>体力操控:</div>
            {state.players.map(p => (
              <div key={p.id} style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 60, fontSize: 10 }}>{p.name} ({p.hp}/{p.maxHp})</span>
                <button onClick={() => {
                  const dbg = (window as any).__gameDebug;
                  dbg.setHp(p.id, Math.max(0, p.hp - 1));
                  addLog(`${p.name} HP -1`);
                }} style={{ ...btnStyle, padding: '1px 6px' }}>-1</button>
                <button onClick={() => {
                  const dbg = (window as any).__gameDebug;
                  dbg.setHp(p.id, Math.min(p.maxHp, p.hp + 1));
                  addLog(`${p.name} HP +1`);
                }} style={{ ...btnStyle, padding: '1px 6px' }}>+1</button>
                <button onClick={() => {
                  const dbg = (window as any).__gameDebug;
                  dbg.setHp(p.id, 1);
                  addLog(`${p.name} HP=1`);
                }} style={{ ...btnStyle, background: '#c0392b', padding: '1px 6px' }}>HP=1</button>
                <button onClick={() => {
                  dispatch({ type: 'ENTER_DYING', playerId: p.id });
                  addLog(`触发 ${p.name} 濒死`);
                }} style={{ ...btnStyle, background: '#e74c3c', padding: '1px 6px' }}>濒死</button>
              </div>
            ))}
          </div>
        )}

        {tab === 'phase' && (
          <div>
            <div>当前回合: {state.turnOrder[state.currentPlayerIndex]}</div>
            <div>当前阶段: {state.currentTurnPhase}</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              <button onClick={() => dispatch({ type: 'END_PHASE', playerId: currentPlayerId })}
                style={btnStyle}>结束阶段</button>
              <button onClick={() => dispatch({ type: 'END_TURN', playerId: currentPlayerId })}
                style={btnStyle}>结束回合</button>
            </div>
          </div>
        )}

        {tab === 'test' && (
          <div>
            <button onClick={async () => {
              addLog('运行全功能测试...');
              const { runAllTests } = await import('./testAll');
              const result = await runAllTests();
              addLog(`测试完成: ${result.passed} 通过, ${result.failed} 失败`);
            }} style={btnStyle}>运行全功能测试</button>
            <div style={{ marginTop: 4, maxHeight: 200, overflow: 'auto', fontSize: 10 }}>
              {log.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: '#c9a86b', color: '#1a1a2e', border: 'none',
  padding: '3px 8px', borderRadius: 3, cursor: 'pointer', fontSize: 11,
};
