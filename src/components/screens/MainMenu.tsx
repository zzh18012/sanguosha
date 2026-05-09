// ============================================================
// Main menu - game mode, player count, name setup
// ============================================================

import { useState } from 'react';

interface MainMenuProps {
  onStart: (config: { mode: 'hotseat' | 'singleplayer'; playerCount: number; names: string[]; aiIndices: number[] }) => void;
  onOnlineStart: () => void;
}

export function MainMenu({ onStart, onOnlineStart }: MainMenuProps) {
  const [mode, setMode] = useState<'hotseat' | 'singleplayer'>('hotseat');
  const [playerCount, setPlayerCount] = useState(4);
  const [names, setNames] = useState<string[]>(['玩家1', '玩家2', '玩家3', '玩家4']);

  const handleNameChange = (idx: number, name: string) => {
    const next = [...names];
    next[idx] = name;
    setNames(next);
  };

  const handleStart = () => {
    const aiIndices = mode === 'singleplayer'
      ? Array.from({ length: playerCount - 1 }, (_, i) => i + 1)
      : [];
    onStart({ mode, playerCount, names, aiIndices });
  };

  return (
    <div className="main-menu">
      <h1 className="game-title">三国杀</h1>
      <p className="game-subtitle">· Sanguosha Card Game ·</p>

      <div className="menu-section">
        <label className="menu-label">游戏模式</label>
        <div className="mode-buttons">
          <button
            className={`btn ${mode === 'hotseat' ? 'btn-active' : ''}`}
            onClick={() => setMode('hotseat')}
          >
            本地多人
          </button>
          <button
            className={`btn ${mode === 'singleplayer' ? 'btn-active' : ''}`}
            onClick={() => setMode('singleplayer')}
          >
            单人 vs AI
          </button>
          <button
            className="btn"
            onClick={() => onOnlineStart()}
          >
            在线联机
          </button>
        </div>
      </div>

      <div className="menu-section">
        <label className="menu-label">玩家人数</label>
        <div className="count-buttons">
          {[2, 3, 4, 5, 6, 7, 8].map(n => (
            <button
              key={n}
              className={`btn btn-sm ${playerCount === n ? 'btn-active' : ''}`}
              onClick={() => {
                setPlayerCount(n);
                setNames(Array.from({ length: n }, (_, i) => names[i] || `玩家${i + 1}`));
              }}
            >
              {n}人
            </button>
          ))}
        </div>
      </div>

      <div className="menu-section">
        <label className="menu-label">玩家名称</label>
        <div className="name-inputs">
          {Array.from({ length: playerCount }, (_, i) => (
            <div key={i} className="name-row">
              <span className="name-prefix">
                {i === 0 ? '主公' : `玩家${i + 1}`}
                {mode === 'singleplayer' && i > 0 ? ' (AI)' : ''}
              </span>
              <input
                type="text"
                className="name-input"
                value={names[i] || ''}
                onChange={e => handleNameChange(i, e.target.value)}
                placeholder={`玩家${i + 1}`}
                maxLength={8}
              />
            </div>
          ))}
        </div>
      </div>

      <button className="btn btn-start" onClick={handleStart}>
        开始游戏
      </button>
    </div>
  );
}
