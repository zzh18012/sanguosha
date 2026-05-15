// ============================================================
// Character selection screen
// ============================================================

import { useState, useEffect } from 'react';
import { useGame } from '../../store/GameContext';
import { getCharacterInfo } from '../../data/characterDefinitions';
import type { CharacterInfo } from '../../data/characterDefinitions';
import type { Kingdom } from '../../types/characters';

function getKingdomChinese(kingdom: Kingdom): string {
  switch (kingdom) {
    case 'wei': return '魏';
    case 'shu': return '蜀';
    case 'wu': return '吴';
    case 'qun': return '群';
    default: return kingdom;
  }
}

export function CharacterSelect() {
  const { state, dispatch } = useGame();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const isCharSelectPhase = state.gamePhase === 'character_select';
  const currentPlayer = isCharSelectPhase
    ? state.players.find(p => !p.characterId)
    : undefined;

  // Dispatch START_GAME when all players have selected
  useEffect(() => {
    if (isCharSelectPhase && !currentPlayer) {
      dispatch({ type: 'START_GAME' });
    }
  }, [isCharSelectPhase, currentPlayer, dispatch]);

  if (!isCharSelectPhase || !currentPlayer) {
    return null;
  }

  const allCharIds = [
    'caocao','simayi','xiahoudun','zhangliao','xuchu','guojia','zhenji',
    'liubei','guanyu','zhangfei','zhugeliang','zhaoyun','machao','huangyueying',
    'sunquan','zhouyu','huanggai','lvmeng','luxun','daqiao','sunshangxiang',
    'huatuo','lvbu','diaochan','zhangjiao','yuanshao',
  ];
  const availableChars = allCharIds
    .map(id => getCharacterInfo(id))
    .filter((c): c is CharacterInfo => c != null);

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
        {availableChars.map(char => (
          <div
            key={char.id}
            className={`char-card ${selectedId === char.id ? 'char-selected' : ''}`}
            style={{
              backgroundImage: char.portraitUrl ? `url(${char.portraitUrl})` : undefined,
            }}
            onClick={() => setSelectedId(char.id)}
          >
            <span className={`char-kingdom-ribbon kingdom-ribbon-${char.kingdom}`}>
              {getKingdomChinese(char.kingdom)}
            </span>
            <h3>{char.name}</h3>
            <p className="char-title">{char.title}</p>
            <p className="char-kingdom">HP {char.maxHp}</p>
            <div className="char-skills">
              {char.skillNames.map((s, i) => (
                <span key={i} className="skill-tag">{s}</span>
              ))}
            </div>
            <p className="char-skills-desc">
              {char.skillDescriptions[0]}
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
