// ============================================================
// Character selection screen
// ============================================================

import { useState } from 'react';
import { useGame } from '../../store/GameContext';
import { getCharacterInfo } from '../../data/characterDefinitions';
import type { Kingdom } from '../../types/characters';

const KINGDOM_COLORS: Record<Kingdom, string> = {
  wei: '#3b5998',
  shu: '#e74c3c',
  wu: '#2ecc71',
  qun: '#95a5a6',
};

export function CharacterSelect() {
  const { state, dispatch } = useGame();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (state.gamePhase !== 'character_select') {
    return null;
  }

  // Find the next player who hasn't selected a character yet
  const currentPlayer = state.players.find(p => !p.characterId);
  if (!currentPlayer) {
    // All players have selected - dispatch START_GAME
    dispatch({ type: 'START_GAME' });
    return null;
  }

  const availableChars = [getCharacterInfo('caocao'), getCharacterInfo('liubei'), getCharacterInfo('sunquan'), getCharacterInfo('zhangjiao'),
    getCharacterInfo('guanyu'), getCharacterInfo('zhaoyun'), getCharacterInfo('lvbu')]
    .filter(Boolean);

  const handleConfirm = () => {
    if (!selectedId) return;
    dispatch({ type: 'SELECT_CHARACTER', playerId: currentPlayer.id, characterId: selectedId });
    setSelectedId(null);
  };

  return (
    <div className="character-select">
      <h2>选择武将</h2>
      <p className="select-info">请主公 <strong>{currentPlayer.name}</strong> 选择武将</p>

      <div className="char-grid">
        {availableChars.filter(Boolean).map(char => (
          <div
            key={char!.id}
            className={`char-card ${selectedId === char!.id ? 'char-selected' : ''}`}
            style={{ borderColor: KINGDOM_COLORS[char!.kingdom] || '#666' }}
            onClick={() => setSelectedId(char!.id)}
          >
            <div className="char-portrait-bg" style={{ backgroundColor: KINGDOM_COLORS[char!.kingdom] }}>
              {char!.name[0]}
            </div>
            <h3>{char!.name}</h3>
            <p className="char-title">{char!.title}</p>
            <p className="char-kingdom">{char!.kingdom} · HP {char!.maxHp}</p>
            <div className="char-skills">
              {char!.skillNames.map((s, i) => (
                <span key={i} className="skill-tag">{s}</span>
              ))}
            </div>
            <p className="char-skills-desc">
              {char!.skillDescriptions[0]}
            </p>
          </div>
        ))}
      </div>

      <button
        className="btn btn-start"
        disabled={!selectedId}
        onClick={handleConfirm}
      >
        确认选择
      </button>
    </div>
  );
}
