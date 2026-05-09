// index.ts
import { createServer } from "http";
import { WebSocketServer, WebSocket as WebSocket2 } from "ws";
import { readFileSync, existsSync } from "fs";
import { join, extname, dirname } from "path";
import { fileURLToPath } from "url";

// RoomManager.ts
import { WebSocket } from "ws";
var Room = class {
  roomCode;
  hostPlayerId;
  playerCount;
  players = /* @__PURE__ */ new Map();
  gameRunner = null;
  state = "lobby";
  constructor(roomCode, hostId, hostName, ws, playerCount) {
    this.roomCode = roomCode;
    this.hostPlayerId = hostId;
    this.playerCount = playerCount;
    this.players.set(hostId, { playerId: hostId, playerName: hostName, playerIndex: 0, ws });
  }
  sendToPlayer(playerId, msg) {
    const session = this.players.get(playerId);
    if (session?.ws.readyState === WebSocket.OPEN) {
      session.ws.send(JSON.stringify(msg));
    }
  }
  broadcast(msg, excludePlayerId) {
    for (const [pid, session] of this.players) {
      if (pid === excludePlayerId) continue;
      if (session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(JSON.stringify(msg));
      }
    }
  }
  getLobbyPlayers() {
    return Array.from(this.players.values()).map((p) => ({
      playerId: p.playerId,
      playerName: p.playerName,
      playerIndex: p.playerIndex,
      isHost: p.playerId === this.hostPlayerId
    }));
  }
  getOrderedPlayerNames() {
    const entries = Array.from(this.players.values()).sort((a, b) => a.playerIndex - b.playerIndex);
    return entries.map((p) => p.playerName);
  }
  getOrderedPlayerIds() {
    const entries = Array.from(this.players.values()).sort((a, b) => a.playerIndex - b.playerIndex);
    return entries.map((p) => p.playerId);
  }
};
var RoomManager = class {
  rooms = /* @__PURE__ */ new Map();
  createRoom(playerName, playerCount, ws) {
    const playerId = this.generateId();
    const roomCode = this.generateRoomCode();
    const room = new Room(roomCode, playerId, playerName, ws, playerCount);
    this.rooms.set(roomCode, room);
    return { roomCode, playerId, playerIndex: 0 };
  }
  joinRoom(roomCode, playerName, ws) {
    const room = this.rooms.get(roomCode);
    if (!room) return { error: "ROOM_NOT_FOUND" };
    if (room.state !== "lobby") return { error: "GAME_ALREADY_STARTED" };
    if (room.players.size >= room.playerCount) return { error: "ROOM_FULL" };
    const playerId = this.generateId();
    const playerIndex = room.players.size;
    room.players.set(playerId, { playerId, playerName, playerIndex, ws });
    return { playerId, playerIndex, room };
  }
  leaveRoom(roomCode, playerId) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    room.players.delete(playerId);
    if (room.players.size === 0) {
      room.gameRunner?.cleanup?.();
      this.rooms.delete(roomCode);
      return null;
    }
    if (playerId === room.hostPlayerId) {
      const firstPlayer = room.players.values().next().value;
      if (firstPlayer) {
        room.hostPlayerId = firstPlayer.playerId;
      }
    }
    return room;
  }
  getRoom(roomCode) {
    return this.rooms.get(roomCode);
  }
  generateRoomCode() {
    for (let i = 0; i < 100; i++) {
      const code = String(1e3 + Math.floor(Math.random() * 9e3));
      if (!this.rooms.has(code)) return code;
    }
    for (let code = 1e3; code <= 9999; code++) {
      if (!this.rooms.has(String(code))) return String(code);
    }
    return String(1e3 + Math.floor(Math.random() * 9e3));
  }
  generateId() {
    return `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
};

// ../src/types/game.ts
function createEmptyEquipment() {
  return { weapon: null, armor: null, plusHorse: null, minusHorse: null };
}
function createPlayerState(id, name, isAI) {
  return {
    id,
    name,
    identity: "rebel",
    // placeholder, assigned later
    identityRevealed: false,
    characterId: "",
    characterName: "",
    kingdom: "",
    hp: 4,
    maxHp: 4,
    hand: [],
    equipment: createEmptyEquipment(),
    judgmentArea: [],
    aliveStatus: "alive",
    isAI,
    shaUsedThisTurn: false,
    jiuUsedThisTurn: false,
    isChainLinked: false,
    isIntoxicated: false,
    isTurnedOver: false
  };
}
function getAlivePlayers(state) {
  return state.players.filter((p) => p.aliveStatus !== "dead");
}
function getCurrentPlayer(state) {
  const id = state.turnOrder[state.currentPlayerIndex];
  return state.players.find((p) => p.id === id);
}
function checkVictory(state) {
  const alive = getAlivePlayers(state);
  const ruler = alive.find((p) => p.identity === "ruler");
  const rebels = alive.filter((p) => p.identity === "rebel");
  const spies = alive.filter((p) => p.identity === "spy");
  if (ruler && rebels.length === 0 && spies.length === 0) {
    return "ruler";
  }
  if (!ruler) {
    if (alive.length === 1 && alive[0].identity === "spy") {
      return "spy";
    }
    return "rebel";
  }
  return null;
}

// ../src/data/cardDefinitions.ts
function c(id, name, category, subtype, suit, rank, opts) {
  const rankMap = { 1: "A", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10", 11: "J", 12: "Q", 13: "K" };
  return {
    id,
    name,
    category,
    subtype,
    suit,
    rankNumber: rank,
    rankDisplay: rankMap[rank] || String(rank),
    toolTiming: opts?.toolTiming || null,
    equipSlot: opts?.equipSlot || null,
    weaponRange: opts?.weaponRange ?? null,
    isFireElement: opts?.fire ?? false,
    isThunderElement: opts?.thunder ?? false
  };
}
var CARD_DEFINITIONS = [
  // ==========================================
  // 基本牌 - 杀 (30 cards in standard)
  // ==========================================
  // 黑桃杀 (8)
  c("sha_spade_7", "\u6740", "basic", "sha", "spade", 7),
  c("sha_spade_8", "\u6740", "basic", "sha", "spade", 8),
  c("sha_spade_8b", "\u6740", "basic", "sha", "spade", 8),
  c("sha_spade_9", "\u6740", "basic", "sha", "spade", 9),
  c("sha_spade_9b", "\u6740", "basic", "sha", "spade", 9),
  c("sha_spade_10", "\u6740", "basic", "sha", "spade", 10),
  c("sha_spade_10b", "\u6740", "basic", "sha", "spade", 10),
  // 梅花杀 (14)
  c("sha_club_2", "\u6740", "basic", "sha", "club", 2),
  c("sha_club_3", "\u6740", "basic", "sha", "club", 3),
  c("sha_club_4", "\u6740", "basic", "sha", "club", 4),
  c("sha_club_5", "\u6740", "basic", "sha", "club", 5),
  c("sha_club_6", "\u6740", "basic", "sha", "club", 6),
  c("sha_club_7", "\u6740", "basic", "sha", "club", 7),
  c("sha_club_8", "\u6740", "basic", "sha", "club", 8),
  c("sha_club_8b", "\u6740", "basic", "sha", "club", 8),
  c("sha_club_9", "\u6740", "basic", "sha", "club", 9),
  c("sha_club_9b", "\u6740", "basic", "sha", "club", 9),
  c("sha_club_10", "\u6740", "basic", "sha", "club", 10),
  c("sha_club_10b", "\u6740", "basic", "sha", "club", 10),
  c("sha_club_J", "\u6740", "basic", "sha", "club", 11),
  c("sha_club_Jb", "\u6740", "basic", "sha", "club", 11),
  // 红心杀 - 火杀 (3 in standard, 5 in expansion)
  c("sha_heart_10", "\u6740", "basic", "sha", "heart", 10, { fire: true }),
  c("sha_heart_J", "\u6740", "basic", "sha", "heart", 11, { fire: true }),
  // 方片杀 - 火杀 (4 in standard, plus 2 in expansion)
  c("sha_diamond_6", "\u6740", "basic", "sha", "diamond", 6, { fire: true }),
  c("sha_diamond_7", "\u6740", "basic", "sha", "diamond", 7, { fire: true }),
  c("sha_diamond_8", "\u6740", "basic", "sha", "diamond", 8, { fire: true }),
  c("sha_diamond_9", "\u6740", "basic", "sha", "diamond", 9, { fire: true }),
  c("sha_diamond_10", "\u6740", "basic", "sha", "diamond", 10, { fire: true }),
  c("sha_diamond_K", "\u6740", "basic", "sha", "diamond", 13, { fire: true }),
  // 军争: 雷杀 (9 cards)
  c("sha_spade_5", "\u96F7\u6740", "basic", "sha", "spade", 5, { thunder: true }),
  c("sha_spade_6", "\u96F7\u6740", "basic", "sha", "spade", 6, { thunder: true }),
  c("sha_spade_7b", "\u96F7\u6740", "basic", "sha", "spade", 7, { thunder: true }),
  c("sha_spade_8c", "\u96F7\u6740", "basic", "sha", "spade", 8, { thunder: true }),
  c("sha_club_5", "\u96F7\u6740", "basic", "sha", "club", 5, { thunder: true }),
  c("sha_club_6", "\u96F7\u6740", "basic", "sha", "club", 6, { thunder: true }),
  c("sha_club_7", "\u96F7\u6740", "basic", "sha", "club", 7, { thunder: true }),
  c("sha_club_8", "\u96F7\u6740", "basic", "sha", "club", 8, { thunder: true }),
  // 军争: 火杀 (5 cards)
  c("sha_heart_4", "\u706B\u6740", "basic", "sha", "heart", 4, { fire: true }),
  c("sha_heart_7", "\u706B\u6740", "basic", "sha", "heart", 7, { fire: true }),
  c("sha_heart_10b", "\u706B\u6740", "basic", "sha", "heart", 10, { fire: true }),
  c("sha_diamond_4", "\u706B\u6740", "basic", "sha", "diamond", 4, { fire: true }),
  c("sha_diamond_5", "\u706B\u6740", "basic", "sha", "diamond", 5, { fire: true }),
  // ==========================================
  // 闪 (24 cards in standard)
  // ==========================================
  c("shan_heart_2", "\u95EA", "basic", "shan", "heart", 2),
  c("shan_heart_2b", "\u95EA", "basic", "shan", "heart", 2),
  c("shan_heart_13", "\u95EA", "basic", "shan", "heart", 13),
  c("shan_diamond_2", "\u95EA", "basic", "shan", "diamond", 2),
  c("shan_diamond_2b", "\u95EA", "basic", "shan", "diamond", 2),
  c("shan_diamond_3", "\u95EA", "basic", "shan", "diamond", 3),
  c("shan_diamond_4", "\u95EA", "basic", "shan", "diamond", 4),
  c("shan_diamond_5", "\u95EA", "basic", "shan", "diamond", 5),
  c("shan_diamond_6", "\u95EA", "basic", "shan", "diamond", 6),
  c("shan_diamond_7", "\u95EA", "basic", "shan", "diamond", 7),
  c("shan_diamond_8", "\u95EA", "basic", "shan", "diamond", 8),
  c("shan_diamond_9", "\u95EA", "basic", "shan", "diamond", 9),
  c("shan_diamond_10", "\u95EA", "basic", "shan", "diamond", 10),
  c("shan_diamond_J", "\u95EA", "basic", "shan", "diamond", 11),
  c("shan_diamond_Jb", "\u95EA", "basic", "shan", "diamond", 11),
  // 军争: 闪 (9 extra)
  c("shan_heart_8", "\u95EA", "basic", "shan", "heart", 8),
  c("shan_heart_9", "\u95EA", "basic", "shan", "heart", 9),
  c("shan_heart_J", "\u95EA", "basic", "shan", "heart", 11),
  c("shan_heart_Q", "\u95EA", "basic", "shan", "heart", 12),
  c("shan_heart_Qb", "\u95EA", "basic", "shan", "heart", 12),
  c("shan_diamond_3b", "\u95EA", "basic", "shan", "diamond", 3),
  c("shan_diamond_6b", "\u95EA", "basic", "shan", "diamond", 6),
  c("shan_diamond_7b", "\u95EA", "basic", "shan", "diamond", 7),
  c("shan_diamond_8b", "\u95EA", "basic", "shan", "diamond", 8),
  // ==========================================
  // 桃 (8 in standard + 4 in expansion = 12)
  // ==========================================
  c("tao_heart_3", "\u6843", "basic", "tao", "heart", 3),
  c("tao_heart_4", "\u6843", "basic", "tao", "heart", 4),
  c("tao_heart_5", "\u6843", "basic", "tao", "heart", 5),
  c("tao_heart_6", "\u6843", "basic", "tao", "heart", 6),
  c("tao_heart_7", "\u6843", "basic", "tao", "heart", 7),
  c("tao_heart_9", "\u6843", "basic", "tao", "heart", 9),
  c("tao_heart_Q", "\u6843", "basic", "tao", "heart", 12),
  c("tao_diamond_Q", "\u6843", "basic", "tao", "diamond", 12),
  // 军争 extra 桃
  c("tao_heart_2", "\u6843", "basic", "tao", "heart", 2),
  c("tao_heart_3b", "\u6843", "basic", "tao", "heart", 3),
  c("tao_heart_8", "\u6843", "basic", "tao", "heart", 8),
  c("tao_heart_Qb", "\u6843", "basic", "tao", "heart", 12),
  // ==========================================
  // 酒 (5 cards, all in expansion)
  // ==========================================
  c("jiu_spade_3", "\u9152", "basic", "jiu", "spade", 3),
  c("jiu_spade_9", "\u9152", "basic", "jiu", "spade", 9),
  c("jiu_club_3", "\u9152", "basic", "jiu", "club", 3),
  c("jiu_club_9", "\u9152", "basic", "jiu", "club", 9),
  c("jiu_heart_4", "\u9152", "basic", "jiu", "heart", 4),
  // ==========================================
  // 非延时锦囊牌
  // ==========================================
  // 过河拆桥 (6 cards)
  c("guohe_spade_3", "\u8FC7\u6CB3\u62C6\u6865", "tool", "guohe_chaiqiao", "spade", 3, { toolTiming: "immediate" }),
  c("guohe_spade_4", "\u8FC7\u6CB3\u62C6\u6865", "tool", "guohe_chaiqiao", "spade", 4, { toolTiming: "immediate" }),
  c("guohe_spade_Q", "\u8FC7\u6CB3\u62C6\u6865", "tool", "guohe_chaiqiao", "spade", 12, { toolTiming: "immediate" }),
  c("guohe_club_3", "\u8FC7\u6CB3\u62C6\u6865", "tool", "guohe_chaiqiao", "club", 3, { toolTiming: "immediate" }),
  c("guohe_club_4", "\u8FC7\u6CB3\u62C6\u6865", "tool", "guohe_chaiqiao", "club", 4, { toolTiming: "immediate" }),
  c("guohe_heart_Q", "\u8FC7\u6CB3\u62C6\u6865", "tool", "guohe_chaiqiao", "heart", 12, { toolTiming: "immediate" }),
  // 顺手牵羊 (5 cards)
  c("shunshou_spade_3", "\u987A\u624B\u7275\u7F8A", "tool", "shunshou_qianyang", "spade", 3, { toolTiming: "immediate" }),
  c("shunshou_spade_4", "\u987A\u624B\u7275\u7F8A", "tool", "shunshou_qianyang", "spade", 4, { toolTiming: "immediate" }),
  c("shunshou_spade_J", "\u987A\u624B\u7275\u7F8A", "tool", "shunshou_qianyang", "spade", 11, { toolTiming: "immediate" }),
  c("shunshou_diamond_3", "\u987A\u624B\u7275\u7F8A", "tool", "shunshou_qianyang", "diamond", 3, { toolTiming: "immediate" }),
  c("shunshou_diamond_4", "\u987A\u624B\u7275\u7F8A", "tool", "shunshou_qianyang", "diamond", 4, { toolTiming: "immediate" }),
  // 无中生有 (4 cards)
  c("wuzhong_heart_7", "\u65E0\u4E2D\u751F\u6709", "tool", "wuzhong_shengyou", "heart", 7, { toolTiming: "immediate" }),
  c("wuzhong_heart_8", "\u65E0\u4E2D\u751F\u6709", "tool", "wuzhong_shengyou", "heart", 8, { toolTiming: "immediate" }),
  c("wuzhong_heart_9", "\u65E0\u4E2D\u751F\u6709", "tool", "wuzhong_shengyou", "heart", 9, { toolTiming: "immediate" }),
  c("wuzhong_heart_J", "\u65E0\u4E2D\u751F\u6709", "tool", "wuzhong_shengyou", "heart", 11, { toolTiming: "immediate" }),
  // 无懈可击 (7 cards)
  c("wuxie_spade_J", "\u65E0\u61C8\u53EF\u51FB", "tool", "wuxie_keji", "spade", 11, { toolTiming: "immediate" }),
  c("wuxie_spade_K", "\u65E0\u61C8\u53EF\u51FB", "tool", "wuxie_keji", "spade", 13, { toolTiming: "immediate" }),
  c("wuxie_club_Q", "\u65E0\u61C8\u53EF\u51FB", "tool", "wuxie_keji", "club", 12, { toolTiming: "immediate" }),
  c("wuxie_club_K", "\u65E0\u61C8\u53EF\u51FB", "tool", "wuxie_keji", "club", 13, { toolTiming: "immediate" }),
  c("wuxie_heart_Q", "\u65E0\u61C8\u53EF\u51FB", "tool", "wuxie_keji", "heart", 12, { toolTiming: "immediate" }),
  c("wuxie_diamond_Q", "\u65E0\u61C8\u53EF\u51FB", "tool", "wuxie_keji", "diamond", 12, { toolTiming: "immediate" }),
  c("wuxie_diamond_K", "\u65E0\u61C8\u53EF\u51FB", "tool", "wuxie_keji", "diamond", 13, { toolTiming: "immediate" }),
  // 决斗 (3 cards)
  c("juedou_spade_A", "\u51B3\u6597", "tool", "juedou", "spade", 1, { toolTiming: "immediate" }),
  c("juedou_club_A", "\u51B3\u6597", "tool", "juedou", "club", 1, { toolTiming: "immediate" }),
  c("juedou_diamond_A", "\u51B3\u6597", "tool", "juedou", "diamond", 1, { toolTiming: "immediate" }),
  // 南蛮入侵 (3 cards)
  c("nanman_spade_7", "\u5357\u86EE\u5165\u4FB5", "tool", "nanman_ruqin", "spade", 7, { toolTiming: "immediate" }),
  c("nanman_spade_13", "\u5357\u86EE\u5165\u4FB5", "tool", "nanman_ruqin", "spade", 13, { toolTiming: "immediate" }),
  c("nanman_club_7", "\u5357\u86EE\u5165\u4FB5", "tool", "nanman_ruqin", "club", 7, { toolTiming: "immediate" }),
  // 万箭齐发 (1 card)
  c("wanjian_heart_A", "\u4E07\u7BAD\u9F50\u53D1", "tool", "wanjian_qifa", "heart", 1, { toolTiming: "immediate" }),
  // 桃园结义 (1 card)
  c("taoyuan_heart_A2", "\u6843\u56ED\u7ED3\u4E49", "tool", "taoyuan_jieyi", "heart", 1, { toolTiming: "immediate" }),
  // 五谷丰登 (2 cards)
  c("wugu_heart_3", "\u4E94\u8C37\u4E30\u767B", "tool", "wugu_fengdeng", "heart", 3, { toolTiming: "immediate" }),
  c("wugu_heart_4", "\u4E94\u8C37\u4E30\u767B", "tool", "wugu_fengdeng", "heart", 4, { toolTiming: "immediate" }),
  // 借刀杀人 (2 cards)
  c("jiedao_club_Q", "\u501F\u5200\u6740\u4EBA", "tool", "jiedao_sharen", "club", 12, { toolTiming: "immediate" }),
  c("jiedao_club_K", "\u501F\u5200\u6740\u4EBA", "tool", "jiedao_sharen", "club", 13, { toolTiming: "immediate" }),
  // 铁索连环 (6 cards)
  c("tiesuo_spade_Q", "\u94C1\u7D22\u8FDE\u73AF", "tool", "tiesuo_lianhuan", "spade", 12, { toolTiming: "immediate" }),
  c("tiesuo_spade_K", "\u94C1\u7D22\u8FDE\u73AF", "tool", "tiesuo_lianhuan", "spade", 13, { toolTiming: "immediate" }),
  c("tiesuo_club_Q", "\u94C1\u7D22\u8FDE\u73AF", "tool", "tiesuo_lianhuan", "club", 12, { toolTiming: "immediate" }),
  c("tiesuo_club_K", "\u94C1\u7D22\u8FDE\u73AF", "tool", "tiesuo_lianhuan", "club", 13, { toolTiming: "immediate" }),
  c("tiesuo_club_10", "\u94C1\u7D22\u8FDE\u73AF", "tool", "tiesuo_lianhuan", "club", 10, { toolTiming: "immediate" }),
  c("tiesuo_club_J", "\u94C1\u7D22\u8FDE\u73AF", "tool", "tiesuo_lianhuan", "club", 11, { toolTiming: "immediate" }),
  // ==========================================
  // 延时锦囊牌
  // ==========================================
  // 乐不思蜀 (3 cards)
  c("lebu_heart_6", "\u4E50\u4E0D\u601D\u8700", "tool", "lebu_sishu", "heart", 6, { toolTiming: "delayed" }),
  c("lebu_spade_6", "\u4E50\u4E0D\u601D\u8700", "tool", "lebu_sishu", "spade", 6, { toolTiming: "delayed" }),
  c("lebu_club_6", "\u4E50\u4E0D\u601D\u8700", "tool", "lebu_sishu", "club", 6, { toolTiming: "delayed" }),
  // 兵粮寸断 (2 cards)
  c("bingliang_spade_10", "\u5175\u7CAE\u5BF8\u65AD", "tool", "bingliang_cunduan", "spade", 10, { toolTiming: "delayed" }),
  c("bingliang_club_4", "\u5175\u7CAE\u5BF8\u65AD", "tool", "bingliang_cunduan", "club", 4, { toolTiming: "delayed" }),
  // 闪电 (2 cards)
  c("shandian_spade_A", "\u95EA\u7535", "tool", "shandian", "spade", 1, { toolTiming: "delayed" }),
  c("shandian_heart_Q", "\u95EA\u7535", "tool", "shandian", "heart", 12, { toolTiming: "delayed" }),
  // ==========================================
  // 装备牌 - 武器
  // ==========================================
  c("zhugeliannu_spade_A", "\u8BF8\u845B\u8FDE\u5F29", "equipment", "zhugeliannu", "spade", 1, { equipSlot: "weapon", weaponRange: 1 }),
  c("zhugeliannu_club_A", "\u8BF8\u845B\u8FDE\u5F29", "equipment", "zhugeliannu", "club", 1, { equipSlot: "weapon", weaponRange: 1 }),
  c("qinggangjian_spade_6", "\u9752\u91ED\u5251", "equipment", "qinggangjian", "spade", 6, { equipSlot: "weapon", weaponRange: 2 }),
  c("zhangbashemao_spade_Q", "\u4E08\u516B\u86C7\u77DB", "equipment", "zhangbashemao", "spade", 12, { equipSlot: "weapon", weaponRange: 3 }),
  c("guanshifu_diamond_5", "\u8D2F\u77F3\u65A7", "equipment", "guanshifu", "diamond", 5, { equipSlot: "weapon", weaponRange: 3 }),
  c("qinglong_spade_5", "\u9752\u9F99\u5043\u6708\u5200", "equipment", "qinglongyanyuedao", "spade", 5, { equipSlot: "weapon", weaponRange: 3 }),
  c("qilingong_spade_5b", "\u9E92\u9E9F\u5F13", "equipment", "qilingong", "spade", 5, { equipSlot: "weapon", weaponRange: 5 }),
  c("hanbingjian_spade_2", "\u5BD2\u51B0\u5251", "equipment", "hanbingjian", "spade", 2, { equipSlot: "weapon", weaponRange: 2 }),
  c("gudingdao_spade_2b", "\u53E4\u952D\u5200", "equipment", "gudingdao", "spade", 2, { equipSlot: "weapon", weaponRange: 2 }),
  // ==========================================
  // 装备牌 - 防具
  // ==========================================
  c("baguazhen_spade_2", "\u516B\u5366\u9635", "equipment", "baguazhen", "spade", 2, { equipSlot: "armor" }),
  c("baguazhen_club_2", "\u516B\u5366\u9635", "equipment", "baguazhen", "club", 2, { equipSlot: "armor" }),
  c("renwangdun_club_2", "\u4EC1\u738B\u76FE", "equipment", "renwangdun", "club", 2, { equipSlot: "armor" }),
  c("tengjia_spade_2", "\u85E4\u7532", "equipment", "tengjia", "spade", 2, { equipSlot: "armor" }),
  c("tengjia_club_2", "\u85E4\u7532", "equipment", "tengjia", "club", 2, { equipSlot: "armor" }),
  // ==========================================
  // 装备牌 - +1 坐骑
  // ==========================================
  c("dilu_spade_5", "\u7684\u5362", "equipment", "dilu", "spade", 5, { equipSlot: "plusHorse" }),
  c("dilu_club_5", "\u7684\u5362", "equipment", "dilu", "club", 5, { equipSlot: "plusHorse" }),
  c("dawan_spade_13", "\u5927\u5B9B", "equipment", "dawan", "spade", 13, { equipSlot: "plusHorse" }),
  c("zhuahuangfeidian_heart_13", "\u722A\u9EC4\u98DE\u7535", "equipment", "zhuahuangfeidian", "heart", 13, { equipSlot: "plusHorse" }),
  // ==========================================
  // 装备牌 - -1 坐骑
  // ==========================================
  c("chitu_heart_5", "\u8D64\u5154", "equipment", "chitu", "heart", 5, { equipSlot: "minusHorse" }),
  c("jueying_spade_K", "\u7EDD\u5F71", "equipment", "jueying", "spade", 13, { equipSlot: "minusHorse" }),
  c("diangongli_heart_13", "\u70B9\u94A2\u9A8A", "equipment", "diangongli", "heart", 13, { equipSlot: "minusHorse" })
];
var registry = /* @__PURE__ */ new Map();
for (const def of CARD_DEFINITIONS) {
  registry.set(def.id, def);
}
var STANDARD_DECK_IDS = CARD_DEFINITIONS.filter((d) => !d.id.includes("_2b") && !d.id.includes("_3b") && !d.id.includes("_5b") && !d.id.includes("_6b") && !d.id.includes("_7b") && !d.id.includes("_8b") && !d.id.includes("_8c") && !d.id.includes("_9b") && !d.id.includes("_10b") && !d.id.includes("_Jb") && !d.id.includes("_Qb") && ![
  "sha_spade_5",
  "sha_spade_6",
  "sha_club_5",
  "sha_club_6",
  "sha_club_7",
  "sha_club_8",
  "sha_heart_4",
  "sha_heart_7",
  "sha_diamond_4",
  "sha_diamond_5",
  "jiu_spade_3",
  "jiu_spade_9",
  "jiu_club_3",
  "jiu_club_9",
  "jiu_heart_4",
  "bingliang_spade_10",
  "bingliang_club_4",
  "gudingdao_spade_2b",
  "hanbingjian_spade_2",
  "tengjia_spade_2",
  "tengjia_club_2",
  "renwangdun_club_2"
].includes(d.id)).map((d) => d.id);
var FULL_DECK_IDS = CARD_DEFINITIONS.map((d) => d.id);

// ../src/types/cards.ts
function createCardInstance(def) {
  return {
    instanceId: `card_${crypto.randomUUID().slice(0, 8)}`,
    definitionId: def.id,
    name: def.name,
    category: def.category,
    subtype: def.subtype,
    suit: def.suit,
    rankNumber: def.rankNumber,
    rankDisplay: def.rankDisplay,
    toolTiming: def.toolTiming,
    equipSlot: def.equipSlot,
    weaponRange: def.weaponRange,
    isFireElement: def.isFireElement,
    isThunderElement: def.isThunderElement
  };
}

// ../src/engine/core/DeckFactory.ts
function buildDeck() {
  return CARD_DEFINITIONS.map((def) => createCardInstance(def));
}
function shuffleDeck(deck) {
  const cards = [...deck];
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
function drawCards(deck, discardPile, count) {
  const newDeck = [...deck];
  let newDiscard = [...discardPile];
  const drawn = [];
  for (let i = 0; i < count; i++) {
    if (newDeck.length === 0) {
      if (newDiscard.length === 0) break;
      newDeck.push(...shuffleDeck(newDiscard));
      newDiscard = [];
    }
    const card = newDeck.pop();
    drawn.push(card);
  }
  return { drawnCards: drawn, newDeck, newDiscardPile: newDiscard };
}

// ../src/engine/core/GameState.ts
function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}
function findPlayer(state, playerId) {
  return state.players.find((p) => p.id === playerId);
}
function findPlayerIndex(state, playerId) {
  return state.players.findIndex((p) => p.id === playerId);
}

// ../src/engine/systems/DistanceSystem.ts
function getBaseDistance(state, sourceId, targetId) {
  const sourceIdx = findPlayerIndex(state, sourceId);
  const targetIdx = findPlayerIndex(state, targetId);
  if (sourceIdx === -1 || targetIdx === -1) return Infinity;
  const playerCount = state.players.filter((p) => p.aliveStatus !== "dead").length;
  const clockwise = (targetIdx - sourceIdx + playerCount) % playerCount;
  const counterClockwise = (sourceIdx - targetIdx + playerCount) % playerCount;
  return Math.min(clockwise, counterClockwise);
}
function getAttackDistance(state, sourceId, targetId) {
  const baseDist = getBaseDistance(state, sourceId, targetId);
  if (baseDist === Infinity) return Infinity;
  const source = findPlayer(state, sourceId);
  const target = findPlayer(state, targetId);
  if (!source || !target) return Infinity;
  let distance = baseDist;
  if (target.equipment.plusHorse) {
    distance += 1;
  }
  if (source.equipment.minusHorse) {
    distance -= 1;
  }
  return Math.max(1, distance);
}
function isInRange(state, sourceId, targetId) {
  if (sourceId === targetId) return false;
  const source = findPlayer(state, sourceId);
  if (!source) return false;
  const distance = getAttackDistance(state, sourceId, targetId);
  let range = 1;
  if (source.equipment.weapon) {
    range = source.equipment.weapon.weaponRange || 1;
  }
  return distance <= range;
}

// ../src/engine/characters/SkillEngine.ts
var skillRegistry = /* @__PURE__ */ new Map();
function getSkill(skillId) {
  return skillRegistry.get(skillId);
}
function checkTriggers(state, action) {
  const triggered = [];
  for (const player of state.players) {
    if (player.aliveStatus === "dead") continue;
    const charSkills = getCharacterSkills(player.characterId);
    for (const skill of charSkills) {
      if (doesTriggerMatch(skill, action, player.id, state)) {
        triggered.push({
          skill,
          playerId: player.id,
          action,
          priority: getTriggerPriority(skill)
        });
      }
    }
  }
  triggered.sort((a, b) => b.priority - a.priority);
  return triggered;
}
function doesTriggerMatch(skill, action, playerId, state) {
  const player = findPlayer(state, playerId);
  if (!player) return false;
  if (skill.isRulerSkill && player.identity !== "ruler") return false;
  for (const trigger of skill.triggers) {
    switch (trigger.kind) {
      case "on_damage_received":
        if (action.type === "DEAL_DAMAGE" && action.targetId === playerId) return true;
        break;
      case "on_damage_dealt":
        if (action.type === "DEAL_DAMAGE" && action.sourceId === playerId) return true;
        break;
      case "on_healed":
        if (action.type === "HEAL_HP" && action.playerId === playerId) return true;
        break;
      case "on_card_played":
        if (action.type === "PLAY_CARD" && action.playerId === playerId) return true;
        break;
      case "on_turn_start":
        if (action.type === "TURN_START" && action.playerId === playerId) return true;
        break;
      case "on_turn_end":
        if (action.type === "END_TURN" && action.playerId === playerId) return true;
        break;
      case "on_death":
        if (action.type === "PLAYER_DIED") {
          if (trigger.target === "other" && action.playerId !== playerId) return true;
          if (trigger.target === "self" && action.playerId === playerId) return true;
        }
        break;
      case "on_sha_targeted":
        if (action.type === "PLAY_CARD" && action.targets?.includes(playerId)) return true;
        break;
      case "active":
        break;
      case "passive":
        return true;
      // Passive skills are always active
      case "on_play_phase_start":
        if (action.type === "PHASE_CHANGE" && action.phase === "play") return true;
        break;
      case "on_draw_phase":
        if (action.type === "PHASE_CHANGE" && action.phase === "draw") return true;
        if (action.type === "DRAW_CARDS" && action.playerId === playerId) return true;
        break;
      case "on_discard_phase":
        if (action.type === "PHASE_CHANGE" && action.phase === "discard") return true;
        break;
      default:
        break;
    }
  }
  return false;
}
function getTriggerPriority(skill) {
  return skill.isMandatory ? 100 : 50;
}
function executeSkill(state, playerId, skillId, triggerAction) {
  const next = cloneState(state);
  const player = findPlayer(next, playerId);
  const skill = getSkill(skillId);
  if (!player || !skill) {
    return { state: next, actions: [], pendingChoice: null };
  }
  const ctx = {
    gameState: next,
    sourcePlayerId: playerId,
    triggerEvent: triggerAction,
    triggeredSkillId: skillId,
    pendingChoices: null
  };
  const result = skill.execute(ctx);
  return {
    state: next,
    actions: result.actions,
    pendingChoice: ctx.pendingChoices
  };
}
function getCharacterSkills(characterId) {
  const registry2 = getCharacterRegistry();
  const char = registry2.get(characterId);
  if (!char) return [];
  return char.skills;
}
var characterRegistry = /* @__PURE__ */ new Map();
function getCharacterRegistry() {
  return characterRegistry;
}

// ../src/engine/core/RulesEngine.ts
function validateAction(state, action) {
  switch (action.type) {
    case "PLAY_CARD":
      return validatePlayCard(state, action);
    case "EQUIP_CARD":
      return validateEquipCard(state, action);
    case "DISCARD_CARD":
      return validateDiscardCard(state, action);
    case "USE_SKILL":
      return validateUseSkill(state, action);
    case "END_PHASE":
      return validateEndPhase(state, action);
    case "END_TURN":
      return validateEndTurn(state, action);
    case "RESPOND":
      return validateRespond(state, action);
    case "PASS_RESPONSE":
      return validatePassResponse(state, action);
    case "PLAY_WUXIE":
      return validatePlayWuxie(state, action);
    case "PASS_WUXIE":
      return true;
    // always valid
    case "JUDGE_BAGUAZHEN":
      return validateJudgeBaguazhen(state, action);
    case "SELECT_TARGET_CARD":
      return validateSelectTargetCard(state, action);
    case "PICK_WUGU_CARD":
      return validatePickWuguCard(state, action);
    case "JIEDAO_ATTACK":
      return validateJiedaoAttack(state, action);
    case "JIEDAO_GIVE_WEAPON":
      return validateJiedaoGiveWeapon(state, action);
    case "USE_TAO_SELF":
      return validateUseTaoSelf(state, action);
    case "USE_TAO_OTHER":
      return validateUseTaoOther(state, action);
    case "DISCARD_TO_MAX_HP":
      return validateDiscardToMaxHp(state, action);
    case "DRAW_CARDS":
    case "DRAW_CARDS_SPECIFIC":
    case "DEAL_DAMAGE":
    case "HEAL_HP":
    case "ENTER_DYING":
    case "PLAYER_DIED":
    case "DISCARD_ALL_CARDS":
    case "ENTER_JUDGMENT_PHASE":
    case "RESOLVE_JUDGMENT":
    case "PLACE_DELAYED_TOOL":
    case "REMOVE_DELAYED_TOOL":
    case "DESTROY_EQUIPMENT":
    case "STEAL_CARD":
    case "CHAIN_PLAYERS":
    case "TURN_OVER":
    case "PHASE_CHANGE":
    case "TURN_START":
    case "CHECK_VICTORY":
    case "SELECT_CHARACTER":
    case "START_GAME":
    case "REQUEST_CHARACTER_SELECTION":
    case "AI_THINK":
      return true;
    // system actions always valid
    default:
      return false;
  }
}
function validatePlayCard(state, action) {
  const player = findPlayer(state, action.playerId);
  if (!player || player.aliveStatus !== "alive") return false;
  const currentId = state.turnOrder[state.currentPlayerIndex];
  if (currentId !== action.playerId) return false;
  if (state.currentTurnPhase !== "play") return false;
  const cardInHand = player.hand.find((c2) => c2.instanceId === action.cardId);
  if (!cardInHand) return false;
  if (cardInHand.subtype === "sha") {
    if (player.shaUsedThisTurn) {
      const hasZhugeLiannu = player.equipment.weapon?.subtype === "zhugeliannu";
      if (!hasZhugeLiannu) return false;
    }
    if (action.targets.length !== 1) return false;
    if (!isInRange(state, action.playerId, action.targets[0])) return false;
  }
  if (cardInHand.subtype === "tao") {
    if (action.targets.length > 1) return false;
  }
  if (cardInHand.subtype === "jiu") {
    if (player.jiuUsedThisTurn) return false;
  }
  if (cardInHand.category === "tool") {
    if (cardInHand.toolTiming === "delayed") {
      return action.targets.length === 1;
    }
    switch (cardInHand.subtype) {
      case "wuzhong_shengyou":
        return action.targets.length === 0;
      case "wugu_fengdeng":
        return action.targets.length === 0;
      case "guohe_chaiqiao": {
        if (action.targets.length !== 1) return false;
        const t = findPlayer(state, action.targets[0]);
        return !!(t && t.id !== action.playerId && t.aliveStatus !== "dead" && (t.hand.length > 0 || Object.values(t.equipment).some(Boolean)));
      }
      case "shunshou_qianyang": {
        if (action.targets.length !== 1) return false;
        if (getAttackDistance(state, action.playerId, action.targets[0]) > 1) return false;
        const t = findPlayer(state, action.targets[0]);
        return !!(t && t.id !== action.playerId && t.aliveStatus !== "dead" && (t.hand.length > 0 || Object.values(t.equipment).some(Boolean)));
      }
      case "juedou":
        if (action.targets.length !== 1) return false;
        return action.targets[0] !== action.playerId;
      case "nanman_ruqin":
      case "wanjian_qifa":
      case "taoyuan_jieyi":
        return action.targets.length === 0;
      case "jiedao_sharen": {
        if (action.targets.length !== 1) return false;
        const t = findPlayer(state, action.targets[0]);
        if (!t || !t.equipment.weapon) return false;
        const others = state.players.filter((p) => p.aliveStatus !== "dead" && p.id !== t.id);
        return others.some((p) => isInRange(state, t.id, p.id));
      }
      case "tiesuo_lianhuan": {
        if (action.targets.length < 1 || action.targets.length > 2) return false;
        return action.targets.every((tid) => {
          const t = findPlayer(state, tid);
          return !!(t && t.aliveStatus !== "dead");
        });
      }
      case "wuxie_keji":
        return false;
      default:
        return action.targets.length <= 1;
    }
  }
  return true;
}
function validateEquipCard(state, action) {
  const player = findPlayer(state, action.playerId);
  if (!player || player.aliveStatus !== "alive") return false;
  const card = player.hand.find((c2) => c2.instanceId === action.cardId);
  if (!card || card.category !== "equipment") return false;
  return true;
}
function validateDiscardCard(state, action) {
  const player = findPlayer(state, action.playerId);
  if (!player) return false;
  const cardInHand = player.hand.find((c2) => c2.instanceId === action.cardId);
  if (!cardInHand) return false;
  return true;
}
function validateUseSkill(state, action) {
  const player = findPlayer(state, action.playerId);
  if (!player || player.aliveStatus !== "alive") return false;
  const currentId = state.turnOrder[state.currentPlayerIndex];
  if (currentId !== action.playerId) return false;
  if (state.currentTurnPhase !== "play") return false;
  const skill = getSkill(action.skillId);
  if (!skill) return false;
  if (skill.isRulerSkill && player.identity !== "ruler") return false;
  const charReg = getCharacterRegistry();
  const charEntry = charReg.get(player.characterId);
  if (!charEntry || !charEntry.skills.some((s) => s.id === action.skillId)) return false;
  return true;
}
function validateEndPhase(state, action) {
  const currentId = state.turnOrder[state.currentPlayerIndex];
  return currentId === action.playerId && state.currentTurnPhase === "play";
}
function validateEndTurn(state, action) {
  const currentId = state.turnOrder[state.currentPlayerIndex];
  return currentId === action.playerId;
}
function validateRespond(state, action) {
  if (!state.pendingAction) return false;
  if (state.pendingAction.playerId !== action.playerId) return false;
  const player = findPlayer(state, action.playerId);
  if (!player) return false;
  for (const cardId of action.cardIds) {
    const card = player.hand.find((c2) => c2.instanceId === cardId);
    if (!card) return false;
    if (state.pendingAction.validResponseCards && !state.pendingAction.validResponseCards.includes(cardId)) {
      return false;
    }
  }
  return true;
}
function validatePassResponse(state, action) {
  if (!state.pendingAction) return false;
  return state.pendingAction.playerId === action.playerId;
}
function validatePlayWuxie(state, action) {
  const player = findPlayer(state, action.playerId);
  if (!player) return false;
  const card = player.hand.find((c2) => c2.instanceId === action.cardId);
  if (!card || card.subtype !== "wuxie_keji") return false;
  return true;
}
function validateUseTaoSelf(state, action) {
  const player = findPlayer(state, action.playerId);
  if (!player) return false;
  if (player.hp >= player.maxHp && player.aliveStatus !== "dying") return false;
  const card = player.hand.find((c2) => c2.instanceId === action.cardId);
  return !!(card && (card.subtype === "tao" || card.subtype === "jiu" && player.aliveStatus === "dying"));
}
function validateUseTaoOther(state, action) {
  const target = findPlayer(state, action.targetId);
  if (!target || target.aliveStatus !== "dying") return false;
  const player = findPlayer(state, action.playerId);
  if (!player) return false;
  const card = player.hand.find((c2) => c2.instanceId === action.cardId);
  return !!(card && card.subtype === "tao");
}
function validateDiscardToMaxHp(state, action) {
  const player = findPlayer(state, action.playerId);
  if (!player) return false;
  return player.hand.length > player.hp;
}
function validateJudgeBaguazhen(state, action) {
  if (!state.pendingAction) return false;
  if (state.pendingAction.type !== "respond_to_sha") return false;
  if (state.pendingAction.playerId !== action.playerId) return false;
  const player = findPlayer(state, action.playerId);
  if (!player) return false;
  return player.equipment.armor?.subtype === "baguazhen";
}
function validateSelectTargetCard(state, action) {
  if (!state.pendingAction) return false;
  const pending = state.pendingAction;
  if (pending.type !== "pick_card_to_discard" && pending.type !== "pick_card_to_steal") return false;
  if (pending.playerId !== action.playerId) return false;
  const target = findPlayer(state, action.targetPlayerId);
  if (!target) return false;
  const cardInHand = target.hand.some((c2) => c2.instanceId === action.cardId);
  const cardInEquip = Object.values(target.equipment).some((e) => e?.instanceId === action.cardId);
  return cardInHand || cardInEquip;
}
function validatePickWuguCard(state, action) {
  if (!state.pendingAction) return false;
  if (state.pendingAction.type !== "wugu_pick_card") return false;
  if (state.pendingAction.playerId !== action.playerId) return false;
  const wuguCards = state.pendingAction.extra?.wuguCards || [];
  return wuguCards.some((c2) => c2.instanceId === action.cardId);
}
function validateJiedaoAttack(state, action) {
  if (!state.pendingAction) return false;
  if (state.pendingAction.type !== "jiedao_sharen_choice") return false;
  if (state.pendingAction.playerId !== action.playerId) return false;
  const validTargetIds = state.pendingAction.extra?.validTargetIds || [];
  return validTargetIds.includes(action.targetId);
}
function validateJiedaoGiveWeapon(state, action) {
  if (!state.pendingAction) return false;
  if (state.pendingAction.type !== "jiedao_sharen_choice") return false;
  if (state.pendingAction.playerId !== action.playerId) return false;
  return true;
}
function getValidActions(state, playerId) {
  const player = findPlayer(state, playerId);
  if (!player || player.aliveStatus !== "alive") return [];
  const actions = [];
  const isCurrentPlayer = state.turnOrder[state.currentPlayerIndex] === playerId;
  if (state.pendingAction) {
    if (state.pendingAction.playerId === playerId) {
      if (state.pendingAction.type === "respond_to_sha" || state.pendingAction.type === "respond_to_nanman" || state.pendingAction.type === "respond_to_wanjian" || state.pendingAction.type === "respond_to_juedou") {
        actions.push({ type: "PASS_RESPONSE", playerId });
        if (state.pendingAction.validResponseCards) {
          for (const cardId of state.pendingAction.validResponseCards) {
            actions.push({ type: "RESPOND", playerId, cardIds: [cardId] });
          }
        }
        if (state.pendingAction.extra?.hasBaguazhen && state.pendingAction.type === "respond_to_sha") {
          actions.push({ type: "JUDGE_BAGUAZHEN", playerId });
        }
      }
      if (state.pendingAction.type === "pick_card_to_discard" || state.pendingAction.type === "pick_card_to_steal") {
        const availableCards = state.pendingAction.extra?.availableCards || [];
        const targetId = state.pendingAction.extra?.targetId;
        for (const ac of availableCards) {
          actions.push({ type: "SELECT_TARGET_CARD", playerId, cardId: ac.cardId, targetPlayerId: targetId });
        }
      }
      if (state.pendingAction.type === "jiedao_sharen_choice") {
        const extra = state.pendingAction.extra || {};
        if (extra.hasSha) {
          const validTargetIds = extra.validTargetIds || [];
          for (const tid of validTargetIds) {
            actions.push({ type: "JIEDAO_ATTACK", playerId, targetId: tid });
          }
        }
        actions.push({ type: "JIEDAO_GIVE_WEAPON", playerId });
      }
      if (state.pendingAction.type === "wugu_pick_card") {
        const wuguCards = state.pendingAction.extra?.wuguCards || [];
        for (const card of wuguCards) {
          actions.push({ type: "PICK_WUGU_CARD", playerId, cardId: card.instanceId });
        }
      }
      if (state.pendingAction.type === "respond_to_wuxie_chain") {
        actions.push({ type: "PASS_WUXIE", playerId });
        const wuxie = player.hand.filter((c2) => c2.subtype === "wuxie_keji");
        for (const card of wuxie) {
          actions.push({ type: "PLAY_WUXIE", playerId, cardId: card.instanceId, againstActionType: "any" });
        }
      }
      if (state.pendingAction.type === "use_tao_dying") {
        const tao = player.hand.filter((c2) => c2.subtype === "tao");
        for (const card of tao) {
          actions.push({ type: "USE_TAO_SELF", playerId, cardId: card.instanceId });
        }
        const jiu = player.hand.filter((c2) => c2.subtype === "jiu");
        for (const card of jiu) {
          actions.push({ type: "USE_TAO_SELF", playerId, cardId: card.instanceId });
        }
      }
    } else {
      if (state.pendingAction.type === "use_tao_dying") {
        const tao = player.hand.filter((c2) => c2.subtype === "tao");
        for (const card of tao) {
          actions.push({ type: "USE_TAO_OTHER", playerId, cardId: card.instanceId, targetId: state.pendingAction.playerId });
        }
      }
    }
    return actions;
  }
  if (isCurrentPlayer) {
    switch (state.currentTurnPhase) {
      case "play": {
        for (const card of player.hand) {
          if (card.category === "basic") {
            if (card.subtype === "sha" && !player.shaUsedThisTurn) {
              actions.push({ type: "PLAY_CARD", playerId, cardId: card.instanceId, targets: [] });
            } else if (card.subtype === "tao") {
              if (player.hp < player.maxHp) {
                actions.push({ type: "USE_TAO_SELF", playerId, cardId: card.instanceId });
              }
            } else if (card.subtype === "jiu" && !player.jiuUsedThisTurn) {
              actions.push({ type: "PLAY_CARD", playerId, cardId: card.instanceId, targets: [] });
            }
          } else if (card.category === "equipment") {
            actions.push({ type: "EQUIP_CARD", playerId, cardId: card.instanceId });
          } else if (card.category === "tool") {
            actions.push({ type: "PLAY_CARD", playerId, cardId: card.instanceId, targets: [] });
          }
        }
        const charReg = getCharacterRegistry();
        const charEntry = charReg.get(player.characterId);
        if (charEntry) {
          for (const skill of charEntry.skills) {
            const hasActiveTrigger = skill.triggers.some(
              (t) => t.kind === "active" || t.kind === "on_play_phase_start"
            );
            if (hasActiveTrigger) {
              if (skill.isRulerSkill && player.identity !== "ruler") continue;
              actions.push({ type: "USE_SKILL", playerId, skillId: skill.id, targets: [] });
            }
          }
        }
        actions.push({ type: "END_PHASE", playerId });
        break;
      }
      case "discard": {
        if (player.hand.length > player.hp) {
          for (const card of player.hand) {
            actions.push({ type: "DISCARD_CARD", playerId, cardId: card.instanceId });
          }
        } else {
          actions.push({ type: "END_TURN", playerId });
        }
        break;
      }
    }
  }
  return actions;
}

// ../src/data/characterDefinitions.ts
var CHARACTER_INFO = [
  // Wei
  { id: "caocao", name: "\u66F9\u64CD", title: "\u9B4F\u6B66\u5E1D", kingdom: "wei", maxHp: 4, gender: "male", skillNames: ["\u5978\u96C4", "\u62A4\u9A7E"], skillDescriptions: ["\u5F53\u4F60\u53D7\u5230\u4F24\u5BB3\u540E\uFF0C\u4F60\u53EF\u4EE5\u83B7\u5F97\u9020\u6210\u6B64\u4F24\u5BB3\u7684\u724C\u3002", "\u4E3B\u516C\u6280\uFF0C\u5F53\u4F60\u9700\u8981\u4F7F\u7528\u6216\u6253\u51FA\u95EA\u65F6\uFF0C\u4F60\u53EF\u4EE5\u4EE4\u5176\u4ED6\u9B4F\u52BF\u529B\u89D2\u8272\u6253\u51FA\u4E00\u5F20\u95EA\uFF08\u89C6\u4E3A\u7531\u4F60\u4F7F\u7528\u6216\u6253\u51FA\uFF09\u3002"], isRulerOption: true },
  { id: "simayi", name: "\u53F8\u9A6C\u61FF", title: "\u72FC\u987E\u4E4B\u9B3C", kingdom: "wei", maxHp: 3, gender: "male", skillNames: ["\u53CD\u9988", "\u9B3C\u624D"], skillDescriptions: ["\u5F53\u4F60\u53D7\u5230\u4F24\u5BB3\u540E\uFF0C\u4F60\u53EF\u4EE5\u83B7\u5F97\u4F24\u5BB3\u6765\u6E90\u7684\u4E00\u5F20\u724C\u3002", "\u5F53\u4E00\u540D\u89D2\u8272\u7684\u5224\u5B9A\u724C\u751F\u6548\u524D\uFF0C\u4F60\u53EF\u4EE5\u6253\u51FA\u4E00\u5F20\u624B\u724C\u4EE3\u66FF\u4E4B\u3002"], isRulerOption: false },
  { id: "xiahoudun", name: "\u590F\u4FAF\u60C7", title: "\u72EC\u773C\u7684\u7F57\u5239", kingdom: "wei", maxHp: 4, gender: "male", skillNames: ["\u521A\u70C8"], skillDescriptions: ["\u5F53\u4F60\u53D7\u5230\u4F24\u5BB3\u540E\uFF0C\u4F60\u53EF\u4EE5\u8FDB\u884C\u5224\u5B9A\uFF0C\u82E5\u7ED3\u679C\u4E0D\u4E3A\u7EA2\u6843\uFF0C\u4F24\u5BB3\u6765\u6E90\u9009\u62E9\u5F03\u7F6E\u4E24\u5F20\u624B\u724C\u6216\u53D7\u5230\u4F60\u9020\u6210\u76841\u70B9\u4F24\u5BB3\u3002"], isRulerOption: false },
  { id: "zhangliao", name: "\u5F20\u8FBD", title: "\u524D\u5C06\u519B", kingdom: "wei", maxHp: 4, gender: "male", skillNames: ["\u7A81\u88AD"], skillDescriptions: ["\u6478\u724C\u9636\u6BB5\uFF0C\u4F60\u53EF\u4EE5\u5C11\u6478\u4EFB\u610F\u5F20\u724C\uFF0C\u7136\u540E\u9009\u62E9\u7B49\u91CF\u7684\u624B\u724C\u6570\u4E0D\u5C0F\u4E8E\u4F60\u7684\u89D2\u8272\uFF0C\u83B7\u5F97\u8FD9\u4E9B\u89D2\u8272\u7684\u5404\u4E00\u5F20\u624B\u724C\u3002"], isRulerOption: false },
  { id: "xuchu", name: "\u8BB8\u891A", title: "\u864E\u75F4", kingdom: "wei", maxHp: 4, gender: "male", skillNames: ["\u88F8\u8863"], skillDescriptions: ["\u6478\u724C\u9636\u6BB5\uFF0C\u4F60\u53EF\u4EE5\u5C11\u6478\u4E00\u5F20\u724C\uFF0C\u672C\u56DE\u5408\u4F7F\u7528\u6740\u6216\u51B3\u6597\u9020\u6210\u4F24\u5BB3\u65F6\uFF0C\u6B64\u4F24\u5BB3+1\u3002"], isRulerOption: false },
  { id: "guojia", name: "\u90ED\u5609", title: "\u65E9\u7EC8\u7684\u5148\u77E5", kingdom: "wei", maxHp: 3, gender: "male", skillNames: ["\u5929\u5992", "\u9057\u8BA1"], skillDescriptions: ["\u5F53\u4F60\u7684\u5224\u5B9A\u724C\u751F\u6548\u540E\uFF0C\u4F60\u53EF\u4EE5\u83B7\u5F97\u6B64\u724C\u3002", "\u5F53\u4F60\u53D7\u52301\u70B9\u4F24\u5BB3\u540E\uFF0C\u4F60\u53EF\u4EE5\u6478\u4E24\u5F20\u724C\uFF0C\u7136\u540E\u4F60\u53EF\u4EE5\u5C06\u81F3\u591A\u4E24\u5F20\u624B\u724C\u4EA4\u7ED9\u4EFB\u610F\u89D2\u8272\u3002"], isRulerOption: false },
  { id: "zhenji", name: "\u7504\u59EC", title: "\u8584\u5E78\u7684\u7F8E\u4EBA", kingdom: "wei", maxHp: 3, gender: "female", skillNames: ["\u6D1B\u795E", "\u503E\u56FD"], skillDescriptions: ["\u51C6\u5907\u9636\u6BB5\uFF0C\u4F60\u53EF\u4EE5\u8FDB\u884C\u5224\u5B9A\uFF0C\u82E5\u7ED3\u679C\u4E3A\u9ED1\u8272\uFF0C\u4F60\u83B7\u5F97\u6B64\u724C\u5E76\u91CD\u590D\u6B64\u6D41\u7A0B\u3002", "\u4F60\u53EF\u4EE5\u5C06\u4E00\u5F20\u9ED1\u8272\u624B\u724C\u5F53\u95EA\u4F7F\u7528\u6216\u6253\u51FA\u3002"], isRulerOption: false },
  // Shu
  { id: "liubei", name: "\u5218\u5907", title: "\u4E71\u4E16\u7684\u67AD\u96C4", kingdom: "shu", maxHp: 4, gender: "male", skillNames: ["\u4EC1\u5FB7", "\u6FC0\u5C06"], skillDescriptions: ["\u51FA\u724C\u9636\u6BB5\uFF0C\u4F60\u53EF\u4EE5\u5C06\u4EFB\u610F\u5F20\u624B\u724C\u4EA4\u7ED9\u5176\u4ED6\u89D2\u8272\uFF0C\u82E5\u4F60\u7ED9\u51FA\u7684\u724C\u5F20\u6570\u8FBE\u5230\u4E24\u5F20\u6216\u66F4\u591A\u65F6\uFF0C\u4F60\u56DE\u590D1\u70B9\u4F53\u529B\u3002", "\u4E3B\u516C\u6280\uFF0C\u5F53\u4F60\u9700\u8981\u4F7F\u7528\u6216\u6253\u51FA\u6740\u65F6\uFF0C\u4F60\u53EF\u4EE5\u4EE4\u5176\u4ED6\u8700\u52BF\u529B\u89D2\u8272\u6253\u51FA\u4E00\u5F20\u6740\u3002"], isRulerOption: true },
  { id: "guanyu", name: "\u5173\u7FBD", title: "\u7F8E\u9AEF\u516C", kingdom: "shu", maxHp: 4, gender: "male", skillNames: ["\u6B66\u5723"], skillDescriptions: ["\u4F60\u53EF\u4EE5\u5C06\u4E00\u5F20\u7EA2\u8272\u724C\u5F53\u6740\u4F7F\u7528\u6216\u6253\u51FA\u3002"], isRulerOption: false },
  { id: "zhangfei", name: "\u5F20\u98DE", title: "\u4E07\u592B\u4E0D\u5F53", kingdom: "shu", maxHp: 4, gender: "male", skillNames: ["\u5486\u54EE"], skillDescriptions: ["\u9501\u5B9A\u6280\uFF0C\u4F60\u4F7F\u7528\u6740\u65E0\u6B21\u6570\u9650\u5236\u3002\u82E5\u4F60\u4F7F\u7528\u7684\u6740\u88AB\u95EA\u62B5\u6D88\uFF0C\u4F60\u53EF\u4EE5\u6478\u4E00\u5F20\u724C\u3002"], isRulerOption: false },
  { id: "zhugeliang", name: "\u8BF8\u845B\u4EAE", title: "\u5367\u9F99", kingdom: "shu", maxHp: 3, gender: "male", skillNames: ["\u89C2\u661F", "\u7A7A\u57CE"], skillDescriptions: ["\u51C6\u5907\u9636\u6BB5\uFF0C\u4F60\u53EF\u4EE5\u89C2\u770B\u724C\u5806\u9876\u7684X\u5F20\u724C\uFF0C\u7136\u540E\u5C06\u8FD9\u4E9B\u724C\u4EE5\u4EFB\u610F\u987A\u5E8F\u653E\u56DE\u724C\u5806\u9876\u6216\u724C\u5806\u5E95\u3002", "\u9501\u5B9A\u6280\uFF0C\u82E5\u4F60\u6CA1\u6709\u624B\u724C\uFF0C\u4F60\u4E0D\u80FD\u6210\u4E3A\u6740\u6216\u51B3\u6597\u7684\u76EE\u6807\u3002"], isRulerOption: false },
  { id: "zhaoyun", name: "\u8D75\u4E91", title: "\u864E\u5A01\u5C06\u519B", kingdom: "shu", maxHp: 4, gender: "male", skillNames: ["\u9F99\u80C6"], skillDescriptions: ["\u4F60\u53EF\u4EE5\u5C06\u4E00\u5F20\u6740\u5F53\u95EA\u4F7F\u7528\u6216\u6253\u51FA\uFF0C\u6216\u5C06\u4E00\u5F20\u95EA\u5F53\u6740\u4F7F\u7528\u6216\u6253\u51FA\u3002"], isRulerOption: false },
  { id: "machao", name: "\u9A6C\u8D85", title: "\u9526\u9A6C\u8D85", kingdom: "shu", maxHp: 4, gender: "male", skillNames: ["\u9A6C\u672F", "\u94C1\u9A91"], skillDescriptions: ["\u9501\u5B9A\u6280\uFF0C\u4F60\u8BA1\u7B97\u4E0E\u5176\u4ED6\u89D2\u8272\u7684\u8DDD\u79BB\u65F6\u59CB\u7EC8-1\u3002", "\u5F53\u4F60\u4F7F\u7528\u6740\u6307\u5B9A\u4E00\u540D\u76EE\u6807\u540E\uFF0C\u4F60\u53EF\u4EE5\u8FDB\u884C\u5224\u5B9A\uFF0C\u82E5\u7ED3\u679C\u4E3A\u7EA2\u8272\uFF0C\u8BE5\u89D2\u8272\u4E0D\u80FD\u4F7F\u7528\u95EA\u54CD\u5E94\u6B64\u6740\u3002"], isRulerOption: false },
  { id: "huangyueying", name: "\u9EC4\u6708\u82F1", title: "\u5F52\u9690\u7684\u6770\u5973", kingdom: "shu", maxHp: 3, gender: "female", skillNames: ["\u96C6\u667A", "\u5947\u624D"], skillDescriptions: ["\u5F53\u4F60\u4F7F\u7528\u4E00\u5F20\u975E\u5EF6\u65F6\u9526\u56CA\u724C\u65F6\uFF0C\u4F60\u53EF\u4EE5\u6478\u4E00\u5F20\u724C\u3002", "\u9501\u5B9A\u6280\uFF0C\u4F60\u4F7F\u7528\u9526\u56CA\u724C\u65E0\u8DDD\u79BB\u9650\u5236\u3002"], isRulerOption: false },
  // Wu
  { id: "sunquan", name: "\u5B59\u6743", title: "\u5E74\u8F7B\u8D24\u541B", kingdom: "wu", maxHp: 4, gender: "male", skillNames: ["\u5236\u8861", "\u6551\u63F4"], skillDescriptions: ["\u51FA\u724C\u9636\u6BB5\u9650\u4E00\u6B21\uFF0C\u4F60\u53EF\u4EE5\u5F03\u7F6E\u4EFB\u610F\u5F20\u724C\uFF0C\u7136\u540E\u6478\u7B49\u91CF\u7684\u724C\u3002", "\u4E3B\u516C\u6280\uFF0C\u5176\u4ED6\u5434\u52BF\u529B\u89D2\u8272\u4F7F\u7528\u6843\u6307\u5B9A\u4F60\u4E3A\u76EE\u6807\u65F6\uFF0C\u56DE\u590D+1\u3002"], isRulerOption: true },
  { id: "zhouyu", name: "\u5468\u745C", title: "\u5927\u90FD\u7763", kingdom: "wu", maxHp: 3, gender: "male", skillNames: ["\u82F1\u59FF", "\u53CD\u95F4"], skillDescriptions: ["\u6478\u724C\u9636\u6BB5\uFF0C\u4F60\u53EF\u4EE5\u591A\u6478\u4E00\u5F20\u724C\u3002", "\u51FA\u724C\u9636\u6BB5\u9650\u4E00\u6B21\uFF0C\u4F60\u53EF\u4EE5\u4EE4\u4E00\u540D\u5176\u4ED6\u89D2\u8272\u9009\u62E9\u4E00\u79CD\u82B1\u8272\uFF0C\u7136\u540E\u83B7\u5F97\u4F60\u7684\u4E00\u5F20\u624B\u724C\u5E76\u5C55\u793A\uFF0C\u82E5\u6B64\u724C\u7684\u82B1\u8272\u4E0E\u5176\u9009\u62E9\u7684\u4E0D\u540C\uFF0C\u5219\u5176\u53D7\u52301\u70B9\u4F24\u5BB3\u3002"], isRulerOption: false },
  { id: "huanggai", name: "\u9EC4\u76D6", title: "\u8F7B\u8EAB\u4E3A\u56FD", kingdom: "wu", maxHp: 4, gender: "male", skillNames: ["\u82E6\u8089"], skillDescriptions: ["\u51FA\u724C\u9636\u6BB5\uFF0C\u4F60\u53EF\u4EE5\u5931\u53BB1\u70B9\u4F53\u529B\uFF0C\u7136\u540E\u6478\u4E09\u5F20\u724C\u3002"], isRulerOption: false },
  { id: "lvmeng", name: "\u5415\u8499", title: "\u767D\u8863\u6E21\u6C5F", kingdom: "wu", maxHp: 4, gender: "male", skillNames: ["\u514B\u5DF1"], skillDescriptions: ["\u82E5\u4F60\u4E8E\u51FA\u724C\u9636\u6BB5\u672A\u4F7F\u7528\u6216\u6253\u51FA\u8FC7\u4EFB\u4F55\u4E00\u5F20\u6740\uFF0C\u4F60\u53EF\u4EE5\u8DF3\u8FC7\u6B64\u56DE\u5408\u7684\u5F03\u724C\u9636\u6BB5\u3002"], isRulerOption: false },
  { id: "luxun", name: "\u9646\u900A", title: "\u5112\u751F\u96C4\u624D", kingdom: "wu", maxHp: 3, gender: "male", skillNames: ["\u8C26\u900A", "\u8FDE\u8425"], skillDescriptions: ["\u9501\u5B9A\u6280\uFF0C\u4F60\u4E0D\u80FD\u6210\u4E3A\u987A\u624B\u7275\u7F8A\u548C\u4E50\u4E0D\u601D\u8700\u7684\u76EE\u6807\u3002", "\u5F53\u4F60\u5931\u53BB\u6700\u540E\u4E00\u5F20\u624B\u724C\u65F6\uFF0C\u4F60\u53EF\u4EE5\u6478\u4E00\u5F20\u724C\u3002"], isRulerOption: false },
  { id: "daqiao", name: "\u5927\u4E54", title: "\u77DC\u6301\u4E4B\u82B1", kingdom: "wu", maxHp: 3, gender: "female", skillNames: ["\u56FD\u8272", "\u6D41\u79BB"], skillDescriptions: ["\u4F60\u53EF\u4EE5\u5C06\u4E00\u5F20\u65B9\u7247\u724C\u5F53\u4E50\u4E0D\u601D\u8700\u4F7F\u7528\u3002", "\u5F53\u4F60\u6210\u4E3A\u6740\u7684\u76EE\u6807\u65F6\uFF0C\u4F60\u53EF\u4EE5\u5F03\u7F6E\u4E00\u5F20\u724C\u5E76\u5C06\u6B64\u6740\u8F6C\u79FB\u7ED9\u4F60\u653B\u51FB\u8303\u56F4\u5185\u7684\u53E6\u4E00\u540D\u89D2\u8272\u3002"], isRulerOption: false },
  { id: "sunshangxiang", name: "\u5B59\u5C1A\u9999", title: "\u5F13\u8170\u59EC", kingdom: "wu", maxHp: 3, gender: "female", skillNames: ["\u7ED3\u59FB", "\u67AD\u59EC"], skillDescriptions: ["\u51FA\u724C\u9636\u6BB5\u9650\u4E00\u6B21\uFF0C\u4F60\u53EF\u4EE5\u5F03\u7F6E\u4E24\u5F20\u624B\u724C\uFF0C\u7136\u540E\u4EE4\u4E00\u540D\u5DF2\u53D7\u4F24\u7684\u7537\u6027\u89D2\u8272\u56DE\u590D1\u70B9\u4F53\u529B\uFF0C\u7136\u540E\u4F60\u56DE\u590D1\u70B9\u4F53\u529B\u3002", "\u5F53\u4F60\u5931\u53BB\u4E00\u5F20\u5750\u9A91\u533A\u6216\u6B66\u5668\u533A\u7684\u88C5\u5907\u724C\u540E\uFF0C\u4F60\u53EF\u4EE5\u6478\u4E24\u5F20\u724C\u3002"], isRulerOption: false },
  // Qun
  { id: "huatuo", name: "\u534E\u4F57", title: "\u795E\u533B", kingdom: "qun", maxHp: 3, gender: "male", skillNames: ["\u6025\u6551", "\u9752\u56CA"], skillDescriptions: ["\u4F60\u7684\u56DE\u5408\u5916\uFF0C\u4F60\u53EF\u4EE5\u5C06\u4E00\u5F20\u7EA2\u8272\u724C\u5F53\u6843\u4F7F\u7528\u3002", "\u51FA\u724C\u9636\u6BB5\u9650\u4E00\u6B21\uFF0C\u4F60\u53EF\u4EE5\u5F03\u7F6E\u4E00\u5F20\u624B\u724C\uFF0C\u4EE4\u4E00\u540D\u89D2\u8272\u56DE\u590D1\u70B9\u4F53\u529B\u3002"], isRulerOption: false },
  { id: "lvbu", name: "\u5415\u5E03", title: "\u98DE\u5C06", kingdom: "qun", maxHp: 4, gender: "male", skillNames: ["\u65E0\u53CC"], skillDescriptions: ["\u9501\u5B9A\u6280\uFF0C\u5F53\u4F60\u4F7F\u7528\u6740\u6307\u5B9A\u4E00\u540D\u76EE\u6807\u540E\uFF0C\u8BE5\u89D2\u8272\u9700\u8981\u8FDE\u7EED\u4F7F\u7528\u4E24\u5F20\u95EA\u624D\u80FD\u62B5\u6D88\u3002\u4E0E\u4F60\u8FDB\u884C\u51B3\u6597\u7684\u89D2\u8272\u6BCF\u6B21\u9700\u8981\u8FDE\u7EED\u6253\u51FA\u4E24\u5F20\u6740\u3002"], isRulerOption: false },
  { id: "diaochan", name: "\u8C82\u8749", title: "\u7EDD\u4E16\u7684\u821E\u59EC", kingdom: "qun", maxHp: 3, gender: "female", skillNames: ["\u79BB\u95F4", "\u95ED\u6708"], skillDescriptions: ["\u51FA\u724C\u9636\u6BB5\u9650\u4E00\u6B21\uFF0C\u4F60\u53EF\u4EE5\u5F03\u7F6E\u4E00\u5F20\u724C\uFF0C\u4EE4\u4E24\u540D\u7537\u6027\u89D2\u8272\u51B3\u6597\u3002", "\u7ED3\u675F\u9636\u6BB5\uFF0C\u4F60\u53EF\u4EE5\u6478\u4E00\u5F20\u724C\u3002"], isRulerOption: false },
  { id: "zhangjiao", name: "\u5F20\u89D2", title: "\u5929\u516C\u5C06\u519B", kingdom: "qun", maxHp: 3, gender: "male", skillNames: ["\u96F7\u51FB", "\u9B3C\u9053", "\u9EC4\u5929"], skillDescriptions: ["\u5F53\u4F60\u4F7F\u7528\u6216\u6253\u51FA\u95EA\u65F6\uFF0C\u4F60\u53EF\u4EE5\u4EE4\u4E00\u540D\u5176\u4ED6\u89D2\u8272\u8FDB\u884C\u5224\u5B9A\uFF0C\u82E5\u4E3A\u9ED1\u6843\uFF0C\u4F60\u5BF9\u8BE5\u89D2\u8272\u9020\u62102\u70B9\u96F7\u7535\u4F24\u5BB3\u3002", "\u5F53\u4E00\u540D\u89D2\u8272\u7684\u5224\u5B9A\u724C\u751F\u6548\u524D\uFF0C\u4F60\u53EF\u4EE5\u6253\u51FA\u4E00\u5F20\u9ED1\u8272\u724C\u66FF\u6362\u4E4B\u3002", "\u4E3B\u516C\u6280\uFF0C\u5176\u4ED6\u7FA4\u52BF\u529B\u89D2\u8272\u53EF\u4EE5\u5728\u4ED6\u4EEC\u7684\u51FA\u724C\u9636\u6BB5\u7ED9\u4F60\u4E00\u5F20\u95EA\u6216\u95EA\u7535\u3002"], isRulerOption: true },
  { id: "yuanshao", name: "\u8881\u7ECD", title: "\u9AD8\u8D35\u7684\u540D\u95E8", kingdom: "qun", maxHp: 4, gender: "male", skillNames: ["\u4E71\u51FB"], skillDescriptions: ["\u51FA\u724C\u9636\u6BB5\uFF0C\u4F60\u53EF\u4EE5\u5C06\u4E24\u5F20\u540C\u82B1\u8272\u7684\u624B\u724C\u5F53\u4E07\u7BAD\u9F50\u53D1\u4F7F\u7528\u3002"], isRulerOption: false }
];
function getCharacterInfo(id) {
  return CHARACTER_INFO.find((c2) => c2.id === id);
}

// ../src/engine/core/ActionResolver.ts
function resolveAction(state, action) {
  const next = cloneState(state);
  const newActions = [];
  switch (action.type) {
    case "PLAY_CARD":
      return resolvePlayCard(next, action);
    case "EQUIP_CARD":
      return resolveEquipCard(next, action);
    case "DISCARD_CARD":
      return resolveDiscardCard(next, action);
    case "END_PHASE":
      return resolveEndPhase(next, action);
    case "END_TURN":
      return resolveEndTurn(next, action);
    case "RESPOND":
      return resolveRespond(next, action);
    case "PASS_RESPONSE":
      return resolvePassResponse(next, action);
    case "PLAY_WUXIE":
      return resolvePlayWuxie(next, action);
    case "PASS_WUXIE":
      return resolvePassWuxie(next, action);
    case "USE_TAO_SELF":
      return resolveUseTaoSelf(next, action);
    case "USE_TAO_OTHER":
      return resolveUseTaoOther(next, action);
    case "DRAW_CARDS":
      return resolveDrawCards(next, action);
    case "DEAL_DAMAGE":
      return resolveDealDamage(next, action);
    case "HEAL_HP":
      return resolveHealHp(next, action);
    case "ENTER_DYING":
      return resolveEnterDying(next, action);
    case "PLAYER_DIED":
      return resolvePlayerDied(next, action);
    case "DISCARD_TO_MAX_HP":
      return { state: next, newActions };
    case "DISCARD_ALL_CARDS":
      return resolveDiscardAllCards(next, action);
    case "DESTROY_EQUIPMENT":
      return resolveDestroyEquipment(next, action);
    case "CHECK_VICTORY":
      return resolveCheckVictory(next);
    case "SELECT_CHARACTER":
      return resolveSelectCharacter(next, action);
    case "START_GAME":
      return resolveStartGame(next);
    case "PHASE_CHANGE":
      return resolvePhaseChange(next, action);
    case "JUDGE_BAGUAZHEN":
      return resolveJudgeBaguazhen(next, action);
    case "SELECT_TARGET_CARD":
      return resolveSelectTargetCard(next, action);
    case "PICK_WUGU_CARD":
      return resolvePickWuguCard(next, action);
    case "JIEDAO_ATTACK":
      return resolveJiedaoAttack(next, action);
    case "JIEDAO_GIVE_WEAPON":
      return resolveJiedaoGiveWeapon(next, action);
    case "USE_SKILL":
      return resolveUseSkill(next, action);
    case "TURN_START":
    case "ENTER_JUDGMENT_PHASE":
    case "RESOLVE_JUDGMENT":
    case "PLACE_DELAYED_TOOL":
    case "REMOVE_DELAYED_TOOL":
    case "STEAL_CARD":
    case "CHAIN_PLAYERS":
    case "TURN_OVER":
    case "DRAW_CARDS_SPECIFIC":
    case "REQUEST_CHARACTER_SELECTION":
    case "AI_THINK":
    case "TOGGLE_CHAIN":
      return { state: next, newActions };
    default:
      return { state: next, newActions };
  }
}
function resolvePlayCard(state, action) {
  const player = findPlayer(state, action.playerId);
  const newActions = [];
  const cardIdx = player.hand.findIndex((c2) => c2.instanceId === action.cardId);
  if (cardIdx === -1) return { state, newActions };
  const [card] = player.hand.splice(cardIdx, 1);
  if (card.toolTiming !== "delayed") {
    state.discardPile.push(card);
  }
  switch (card.subtype) {
    case "sha": {
      player.shaUsedThisTurn = true;
      const targetId = action.targets[0];
      const target = findPlayer(state, targetId);
      if (!target) break;
      let damageAmount = 1;
      if (player.isIntoxicated) {
        damageAmount += 1;
        player.isIntoxicated = false;
      }
      if (target.equipment.armor?.subtype === "tengjia") {
        if (!card.isFireElement && !card.isThunderElement) break;
        if (card.isFireElement) damageAmount += 1;
      }
      if (target.equipment.armor?.subtype === "renwangdun") {
        if (card.suit === "spade" || card.suit === "club") break;
      }
      const hasBaguazhen = target.equipment.armor?.subtype === "baguazhen";
      const validShan = target.hand.filter((c2) => c2.subtype === "shan");
      state.pendingAction = {
        type: "respond_to_sha",
        playerId: targetId,
        sourceCardId: card.instanceId,
        validResponseCards: validShan.map((c2) => c2.instanceId),
        timeoutAction: { type: "DEAL_DAMAGE", sourceId: action.playerId, targetId, amount: damageAmount, element: card.isFireElement ? "fire" : card.isThunderElement ? "thunder" : "normal" },
        extra: { hasBaguazhen }
      };
      break;
    }
    case "jiu": {
      player.jiuUsedThisTurn = true;
      player.isIntoxicated = true;
      break;
    }
    // === Tool cards ===
    case "wuzhong_shengyou": {
      newActions.push({ type: "DRAW_CARDS", playerId: action.playerId, count: 2 });
      break;
    }
    case "guohe_chaiqiao": {
      const target = findPlayer(state, action.targets[0]);
      const availableCards = [
        ...target.hand.map((c2, i) => ({ cardId: c2.instanceId, cardName: `\u624B\u724C${i + 1}`, zone: "hand" })),
        ...Object.entries(target.equipment).filter(([, v]) => v !== null).map(([, v]) => ({ cardId: v.instanceId, cardName: v.name, zone: "equipment" }))
      ];
      if (availableCards.length === 0) break;
      state.pendingAction = {
        type: "pick_card_to_discard",
        playerId: action.playerId,
        sourceCardId: card.instanceId,
        timeoutAction: { type: "DISCARD_CARD", playerId: action.playerId, cardId: card.instanceId },
        extra: { targetId: target.id, availableCards }
      };
      break;
    }
    case "shunshou_qianyang": {
      const target = findPlayer(state, action.targets[0]);
      const availableCards = [
        ...target.hand.map((c2, i) => ({ cardId: c2.instanceId, cardName: `\u624B\u724C${i + 1}`, zone: "hand" })),
        ...Object.entries(target.equipment).filter(([, v]) => v !== null).map(([, v]) => ({ cardId: v.instanceId, cardName: v.name, zone: "equipment" }))
      ];
      if (availableCards.length === 0) break;
      state.pendingAction = {
        type: "pick_card_to_steal",
        playerId: action.playerId,
        sourceCardId: card.instanceId,
        timeoutAction: { type: "DISCARD_CARD", playerId: action.playerId, cardId: card.instanceId },
        extra: { targetId: target.id, availableCards }
      };
      break;
    }
    case "juedou": {
      const target = findPlayer(state, action.targets[0]);
      const validSha = target.hand.filter((c2) => c2.subtype === "sha");
      state.pendingAction = {
        type: "respond_to_juedou",
        playerId: target.id,
        sourceCardId: card.instanceId,
        validResponseCards: validSha.map((c2) => c2.instanceId),
        timeoutAction: { type: "DEAL_DAMAGE", sourceId: action.playerId, targetId: target.id, amount: 1 },
        extra: { juedouChain: true, lastResponderId: action.playerId }
      };
      break;
    }
    case "nanman_ruqin": {
      const responders = state.players.filter(
        (p) => p.aliveStatus !== "dead" && p.id !== action.playerId && p.equipment.armor?.subtype !== "tengjia"
      );
      if (responders.length === 0) break;
      const first = responders[0];
      const validSha = first.hand.filter((c2) => c2.subtype === "sha");
      state.pendingAction = {
        type: "respond_to_nanman",
        playerId: first.id,
        sourceCardId: card.instanceId,
        validResponseCards: validSha.map((c2) => c2.instanceId),
        timeoutAction: { type: "DEAL_DAMAGE", sourceId: action.playerId, targetId: first.id, amount: 1 },
        extra: { aoeType: "nanman", sourceId: action.playerId, remainingResponderIds: responders.slice(1).map((p) => p.id) }
      };
      break;
    }
    case "wanjian_qifa": {
      const responders = state.players.filter(
        (p) => p.aliveStatus !== "dead" && p.id !== action.playerId && p.equipment.armor?.subtype !== "tengjia"
      );
      if (responders.length === 0) break;
      const first = responders[0];
      const validShan = first.hand.filter((c2) => c2.subtype === "shan");
      state.pendingAction = {
        type: "respond_to_wanjian",
        playerId: first.id,
        sourceCardId: card.instanceId,
        validResponseCards: validShan.map((c2) => c2.instanceId),
        timeoutAction: { type: "DEAL_DAMAGE", sourceId: action.playerId, targetId: first.id, amount: 1 },
        extra: { aoeType: "wanjian", sourceId: action.playerId, remainingResponderIds: responders.slice(1).map((p) => p.id) }
      };
      break;
    }
    case "taoyuan_jieyi": {
      for (const p of state.players) {
        if (p.aliveStatus === "dead") continue;
        if (p.hp < p.maxHp) {
          p.hp = Math.min(p.hp + 1, p.maxHp);
        }
        if (p.aliveStatus === "dying" && p.hp > 0) {
          p.aliveStatus = "alive";
        }
      }
      break;
    }
    case "wugu_fengdeng": {
      const alivePlayers = state.players.filter((p) => p.aliveStatus !== "dead");
      const aliveCount = alivePlayers.length;
      const { drawnCards, newDeck, newDiscardPile } = drawCards(state.deck, state.discardPile, aliveCount);
      state.deck = newDeck;
      state.discardPile = newDiscardPile;
      if (drawnCards.length === 0) break;
      const currentPlayerIdx = alivePlayers.findIndex((p) => p.id === action.playerId);
      const pickOrder = [
        ...alivePlayers.slice(currentPlayerIdx).map((p) => p.id),
        ...alivePlayers.slice(0, currentPlayerIdx).map((p) => p.id)
      ];
      const firstPicker = pickOrder[0];
      state.pendingAction = {
        type: "wugu_pick_card",
        playerId: firstPicker,
        timeoutAction: { type: "DISCARD_CARD", playerId: firstPicker, cardId: "" },
        extra: {
          wuguCards: drawnCards,
          remainingPlayerIds: pickOrder.slice(1),
          sourceId: action.playerId
        }
      };
      break;
    }
    case "jiedao_sharen": {
      const target = findPlayer(state, action.targets[0]);
      const hasSha = target.hand.some((c2) => c2.subtype === "sha");
      const validTargets = state.players.filter(
        (p) => p.aliveStatus !== "dead" && p.id !== target.id && isInRange(state, target.id, p.id)
      );
      state.pendingAction = {
        type: "jiedao_sharen_choice",
        playerId: target.id,
        sourceCardId: card.instanceId,
        timeoutAction: { type: "JIEDAO_GIVE_WEAPON", playerId: target.id },
        extra: {
          sourceId: action.playerId,
          validTargetIds: validTargets.map((p) => p.id),
          hasSha: hasSha && validTargets.length > 0
        }
      };
      break;
    }
    case "tiesuo_lianhuan": {
      for (const targetId of action.targets) {
        const targetPlayer = findPlayer(state, targetId);
        if (targetPlayer && targetPlayer.aliveStatus !== "dead") {
          targetPlayer.isChainLinked = !targetPlayer.isChainLinked;
        }
      }
      break;
    }
    // Delayed tool cards: go to judgment area of target
    case "lebu_sishu":
    case "bingliang_cunduan":
    case "shandian": {
      const target = findPlayer(state, action.targets[0]);
      target.judgmentArea.push(card);
      const dpIdx = state.discardPile.findIndex((c2) => c2.instanceId === card.instanceId);
      if (dpIdx !== -1) state.discardPile.splice(dpIdx, 1);
      break;
    }
    default:
      break;
  }
  return { state, newActions };
}
function resolveEquipCard(state, action) {
  const player = findPlayer(state, action.playerId);
  const newActions = [];
  const cardIdx = player.hand.findIndex((c2) => c2.instanceId === action.cardId);
  if (cardIdx === -1) return { state, newActions };
  const [card] = player.hand.splice(cardIdx, 1);
  if (!card.equipSlot) return { state, newActions };
  const existing = player.equipment[card.equipSlot];
  if (existing) {
    player.hand.push(existing);
  }
  player.equipment[card.equipSlot] = card;
  return { state, newActions };
}
function resolveDiscardCard(state, action) {
  const player = findPlayer(state, action.playerId);
  const newActions = [];
  const cardIdx = player.hand.findIndex((c2) => c2.instanceId === action.cardId);
  if (cardIdx === -1) return { state, newActions };
  const [card] = player.hand.splice(cardIdx, 1);
  state.discardPile.push(card);
  if (state.currentTurnPhase === "discard" && player.hand.length <= player.hp) {
    return resolveEndTurn(state, { type: "END_TURN", playerId: action.playerId });
  }
  return { state, newActions };
}
function resolveEndPhase(state, action) {
  const newActions = [];
  if (state.currentTurnPhase === "play") {
    state.currentTurnPhase = "discard";
    const player = findPlayer(state, action.playerId);
    if (player.hand.length > player.hp) {
    } else {
      return resolveEndTurn(state, { type: "END_TURN", playerId: action.playerId });
    }
  }
  return { state, newActions };
}
function resolveEndTurn(state, action) {
  const newActions = [];
  const currentId = state.turnOrder[state.currentPlayerIndex];
  const player = findPlayer(state, currentId);
  if (player) {
    player.shaUsedThisTurn = false;
    player.jiuUsedThisTurn = false;
    player.isIntoxicated = false;
  }
  const count = state.turnOrder.length;
  let nextIdx = (state.currentPlayerIndex + 1) % count;
  for (let i = 0; i < count; i++) {
    const nextId = state.turnOrder[nextIdx];
    const nextPlayer = findPlayer(state, nextId);
    if (nextPlayer && nextPlayer.aliveStatus !== "dead") break;
    nextIdx = (nextIdx + 1) % count;
  }
  if (nextIdx <= state.currentPlayerIndex) {
    state.roundNumber++;
  }
  state.currentPlayerIndex = nextIdx;
  state.turnNumber++;
  state.currentTurnPhase = "judge";
  const newPlayerId = state.turnOrder[nextIdx];
  const newPlayer = findPlayer(state, newPlayerId);
  newActions.push({ type: "TURN_START", playerId: newPlayerId });
  if (newPlayer && newPlayer.judgmentArea.length > 0) {
    let skipDraw = false;
    let skipPlay = false;
    for (const tool of [...newPlayer.judgmentArea]) {
      if (state.deck.length === 0) {
        state.deck = shuffleDeck(state.discardPile);
        state.discardPile = [];
      }
      if (state.deck.length === 0) continue;
      const judgeCard = state.deck.pop();
      state.discardPile.push(judgeCard);
      const suit = judgeCard.suit;
      const rank = judgeCard.rankNumber;
      const toolIdx = newPlayer.judgmentArea.findIndex((c2) => c2.instanceId === tool.instanceId);
      if (toolIdx !== -1) {
        const [removed] = newPlayer.judgmentArea.splice(toolIdx, 1);
        state.discardPile.push(removed);
      }
      switch (tool.subtype) {
        case "lebu_sishu":
          if (suit !== "heart") {
            skipPlay = true;
          }
          break;
        case "bingliang_cunduan":
          if (suit !== "club") {
            skipDraw = true;
          }
          break;
        case "shandian":
          if (suit === "spade" && rank >= 2 && rank <= 9) {
            newActions.push({ type: "DEAL_DAMAGE", sourceId: "system", targetId: newPlayerId, amount: 3, element: "thunder" });
          } else {
            const nextAliveIdx = (nextIdx + 1) % count;
            let moveTargetIdx = nextAliveIdx;
            for (let i = 0; i < count; i++) {
              const checkIdx = (nextIdx + 1 + i) % count;
              const checkPlayer = findPlayer(state, state.turnOrder[checkIdx]);
              if (checkPlayer && checkPlayer.aliveStatus !== "dead") {
                moveTargetIdx = checkIdx;
                break;
              }
            }
            const moveTarget = findPlayer(state, state.turnOrder[moveTargetIdx]);
            if (moveTarget) {
              moveTarget.judgmentArea.push(tool);
              const dpIdx = state.discardPile.findIndex((c2) => c2.instanceId === tool.instanceId);
              if (dpIdx !== -1) state.discardPile.splice(dpIdx, 1);
            }
          }
          break;
      }
    }
    if (skipPlay) {
      state.currentTurnPhase = "discard";
      if (!newPlayer || newPlayer.hand.length <= newPlayer.hp) {
        return resolveEndTurn(state, { type: "END_TURN", playerId: newPlayerId });
      }
      return { state, newActions };
    }
    if (skipDraw && !skipPlay) {
      state.currentTurnPhase = "play";
      return { state, newActions };
    }
  }
  newActions.push({ type: "DRAW_CARDS", playerId: newPlayerId, count: 2 });
  newActions.push({ type: "PHASE_CHANGE", phase: "play" });
  return { state, newActions };
}
function resolveRespond(state, action) {
  const player = findPlayer(state, action.playerId);
  const newActions = [];
  const pending = state.pendingAction;
  for (const cardId of action.cardIds) {
    const idx = player.hand.findIndex((c2) => c2.instanceId === cardId);
    if (idx !== -1) {
      const [card] = player.hand.splice(idx, 1);
      state.discardPile.push(card);
    }
  }
  if (pending?.type === "respond_to_juedou" && pending.extra?.juedouChain) {
    const otherPlayerId = pending.extra.lastResponderId;
    const otherPlayer = findPlayer(state, otherPlayerId);
    if (otherPlayer && otherPlayer.aliveStatus !== "dead") {
      const otherSha = otherPlayer.hand.filter((c2) => c2.subtype === "sha");
      state.pendingAction = {
        type: "respond_to_juedou",
        playerId: otherPlayerId,
        sourceCardId: pending.sourceCardId,
        validResponseCards: otherSha.map((c2) => c2.instanceId),
        timeoutAction: { type: "DEAL_DAMAGE", sourceId: action.playerId, targetId: otherPlayerId, amount: 1 },
        extra: { juedouChain: true, lastResponderId: action.playerId }
      };
    } else {
      state.pendingAction = null;
    }
    return { state, newActions };
  }
  if (pending?.extra?.aoeType) {
    const remaining = pending.extra.remainingResponderIds || [];
    if (remaining.length > 0) {
      const nextId = remaining[0];
      const nextPlayer = findPlayer(state, nextId);
      if (nextPlayer && nextPlayer.aliveStatus !== "dead") {
        const validCards = pending.type === "respond_to_nanman" ? nextPlayer.hand.filter((c2) => c2.subtype === "sha") : nextPlayer.hand.filter((c2) => c2.subtype === "shan");
        state.pendingAction = {
          type: pending.type,
          playerId: nextId,
          sourceCardId: pending.sourceCardId,
          validResponseCards: validCards.map((c2) => c2.instanceId),
          timeoutAction: { type: "DEAL_DAMAGE", sourceId: pending.extra.sourceId, targetId: nextId, amount: 1 },
          extra: { aoeType: pending.extra.aoeType, sourceId: pending.extra.sourceId, remainingResponderIds: remaining.slice(1) }
        };
        return { state, newActions };
      }
    }
    state.pendingAction = null;
    return { state, newActions };
  }
  state.pendingAction = null;
  return { state, newActions };
}
function resolvePassResponse(state, action) {
  const newActions = [];
  const pending = state.pendingAction;
  if (!pending) return { state, newActions };
  if (pending.type === "respond_to_juedou" && pending.extra?.juedouChain) {
    const sourceId = pending.extra.lastResponderId || pending.timeoutAction.sourceId;
    newActions.push({ type: "DEAL_DAMAGE", sourceId, targetId: action.playerId, amount: 1 });
    state.pendingAction = null;
    return { state, newActions };
  }
  if (pending.extra?.aoeType) {
    newActions.push(pending.timeoutAction);
    const remaining = pending.extra.remainingResponderIds || [];
    if (remaining.length > 0) {
      const nextId = remaining[0];
      const nextPlayer = findPlayer(state, nextId);
      if (nextPlayer && nextPlayer.aliveStatus !== "dead") {
        const validCards = pending.type === "respond_to_nanman" ? nextPlayer.hand.filter((c2) => c2.subtype === "sha") : nextPlayer.hand.filter((c2) => c2.subtype === "shan");
        state.pendingAction = {
          type: pending.type,
          playerId: nextId,
          sourceCardId: pending.sourceCardId,
          validResponseCards: validCards.map((c2) => c2.instanceId),
          timeoutAction: { type: "DEAL_DAMAGE", sourceId: pending.extra.sourceId, targetId: nextId, amount: 1 },
          extra: { aoeType: pending.extra.aoeType, sourceId: pending.extra.sourceId, remainingResponderIds: remaining.slice(1) }
        };
      } else {
        state.pendingAction = null;
      }
    } else {
      state.pendingAction = null;
    }
    return { state, newActions };
  }
  newActions.push(pending.timeoutAction);
  state.pendingAction = null;
  return { state, newActions };
}
function resolvePlayWuxie(state, action) {
  const player = findPlayer(state, action.playerId);
  const newActions = [];
  const cardIdx = player.hand.findIndex((c2) => c2.instanceId === action.cardId);
  if (cardIdx === -1) return { state, newActions };
  const [card] = player.hand.splice(cardIdx, 1);
  state.discardPile.push(card);
  state.pendingAction = {
    type: "respond_to_wuxie_chain",
    playerId: "",
    // anyone can respond (in turn order)
    timeoutAction: { type: "PASS_WUXIE", playerId: action.playerId }
  };
  return { state, newActions };
}
function resolvePassWuxie(_state, _action) {
  const newActions = [];
  return { state: _state, newActions };
}
function resolveUseTaoSelf(state, action) {
  const player = findPlayer(state, action.playerId);
  const newActions = [];
  const cardIdx = player.hand.findIndex((c2) => c2.instanceId === action.cardId);
  if (cardIdx === -1) return { state, newActions };
  const [card] = player.hand.splice(cardIdx, 1);
  state.discardPile.push(card);
  player.hp = Math.min(player.hp + 1, player.maxHp);
  if (player.aliveStatus === "dying") {
    player.aliveStatus = "alive";
  }
  return { state, newActions };
}
function resolveUseTaoOther(state, action) {
  const player = findPlayer(state, action.playerId);
  const target = findPlayer(state, action.targetId);
  const newActions = [];
  const cardIdx = player.hand.findIndex((c2) => c2.instanceId === action.cardId);
  if (cardIdx === -1) return { state, newActions };
  const [card] = player.hand.splice(cardIdx, 1);
  state.discardPile.push(card);
  target.hp = Math.min(target.hp + 1, target.maxHp);
  if (target.aliveStatus === "dying") {
    target.aliveStatus = "alive";
  }
  return { state, newActions };
}
function resolveJudgeBaguazhen(state, action) {
  const newActions = [];
  const pending = state.pendingAction;
  if (!pending || pending.type !== "respond_to_sha") return { state, newActions };
  if (state.deck.length === 0) {
    state.deck = shuffleDeck(state.discardPile);
    state.discardPile = [];
  }
  if (state.deck.length === 0) return { state, newActions };
  const judgeCard = state.deck.pop();
  state.discardPile.push(judgeCard);
  if (judgeCard.suit === "heart" || judgeCard.suit === "diamond") {
    state.pendingAction = null;
  } else {
    if (pending.extra) {
      pending.extra.hasBaguazhen = false;
    }
  }
  return { state, newActions };
}
function resolveSelectTargetCard(state, action) {
  const newActions = [];
  const pending = state.pendingAction;
  if (!pending) return { state, newActions };
  const target = findPlayer(state, action.targetPlayerId);
  if (!target) return { state, newActions };
  let foundCard;
  const handIdx = target.hand.findIndex((c2) => c2.instanceId === action.cardId);
  if (handIdx !== -1) {
    const [card] = target.hand.splice(handIdx, 1);
    foundCard = card;
  } else {
    for (const slot of ["weapon", "armor", "plusHorse", "minusHorse"]) {
      if (target.equipment[slot]?.instanceId === action.cardId) {
        foundCard = target.equipment[slot];
        target.equipment[slot] = null;
        break;
      }
    }
  }
  if (!foundCard) return { state, newActions };
  if (pending.type === "pick_card_to_discard") {
    state.discardPile.push(foundCard);
  } else if (pending.type === "pick_card_to_steal") {
    const player = findPlayer(state, action.playerId);
    if (player) player.hand.push(foundCard);
  }
  state.pendingAction = null;
  return { state, newActions };
}
function resolvePickWuguCard(state, action) {
  const newActions = [];
  const pending = state.pendingAction;
  if (!pending || pending.type !== "wugu_pick_card") return { state, newActions };
  const wuguCards = pending.extra?.wuguCards || [];
  const cardIdx = wuguCards.findIndex((c2) => c2.instanceId === action.cardId);
  if (cardIdx === -1) return { state, newActions };
  const [pickedCard] = wuguCards.splice(cardIdx, 1);
  const player = findPlayer(state, action.playerId);
  if (player) player.hand.push(pickedCard);
  const remainingPlayerIds = pending.extra?.remainingPlayerIds || [];
  if (remainingPlayerIds.length > 0 && wuguCards.length > 0) {
    const nextPlayerId = remainingPlayerIds[0];
    state.pendingAction = {
      type: "wugu_pick_card",
      playerId: nextPlayerId,
      timeoutAction: { type: "DISCARD_CARD", playerId: nextPlayerId, cardId: "" },
      extra: {
        wuguCards,
        remainingPlayerIds: remainingPlayerIds.slice(1),
        sourceId: pending.extra?.sourceId
      }
    };
  } else {
    if (wuguCards.length > 0) {
      state.discardPile.push(...wuguCards);
    }
    state.pendingAction = null;
  }
  return { state, newActions };
}
function resolveJiedaoAttack(state, action) {
  const newActions = [];
  const pending = state.pendingAction;
  if (!pending || pending.type !== "jiedao_sharen_choice") return { state, newActions };
  const player = findPlayer(state, action.playerId);
  if (!player) return { state, newActions };
  const shaCard = player.hand.find((c2) => c2.subtype === "sha");
  if (!shaCard) return { state, newActions };
  const shaIdx = player.hand.findIndex((c2) => c2.instanceId === shaCard.instanceId);
  player.hand.splice(shaIdx, 1);
  state.discardPile.push(shaCard);
  player.shaUsedThisTurn = true;
  const attackTarget = findPlayer(state, action.targetId);
  if (attackTarget && attackTarget.aliveStatus !== "dead") {
    const validShan = attackTarget.hand.filter((c2) => c2.subtype === "shan");
    state.pendingAction = {
      type: "respond_to_sha",
      playerId: action.targetId,
      sourceCardId: shaCard.instanceId,
      validResponseCards: validShan.map((c2) => c2.instanceId),
      timeoutAction: { type: "DEAL_DAMAGE", sourceId: action.playerId, targetId: action.targetId, amount: 1 }
    };
  } else {
    state.pendingAction = null;
  }
  return { state, newActions };
}
function resolveJiedaoGiveWeapon(state, action) {
  const newActions = [];
  const pending = state.pendingAction;
  if (!pending || pending.type !== "jiedao_sharen_choice") return { state, newActions };
  const sourceId = pending.extra?.sourceId;
  const target = findPlayer(state, action.playerId);
  const source = sourceId ? findPlayer(state, sourceId) : null;
  if (target?.equipment.weapon && source) {
    source.hand.push(target.equipment.weapon);
    target.equipment.weapon = null;
  }
  state.pendingAction = null;
  return { state, newActions };
}
function resolveUseSkill(state, action) {
  const skill = getSkill(action.skillId);
  if (!skill) return { state, newActions: [] };
  const result = executeSkill(state, action.playerId, action.skillId, null);
  return { state: result.state, newActions: result.actions };
}
function resolveDrawCards(state, action) {
  const player = findPlayer(state, action.playerId);
  const newActions = [];
  const { drawnCards, newDeck, newDiscardPile } = drawCards(
    state.deck,
    state.discardPile,
    action.count
  );
  state.deck = newDeck;
  state.discardPile = newDiscardPile;
  player.hand.push(...drawnCards);
  return { state, newActions };
}
function resolveDealDamage(state, action) {
  const target = findPlayer(state, action.targetId);
  const newActions = [];
  const applyDamage = (p) => {
    p.hp -= action.amount;
    if (p.hp <= 0) {
      p.hp = 0;
      p.aliveStatus = "dying";
      newActions.push({ type: "ENTER_DYING", playerId: p.id });
    }
  };
  applyDamage(target);
  if (action.element === "fire" || action.element === "thunder") {
    const chainedPlayers = state.players.filter(
      (p) => p.aliveStatus !== "dead" && p.isChainLinked && p.id !== action.targetId
    );
    for (const cp of chainedPlayers) {
      applyDamage(cp);
      cp.isChainLinked = false;
    }
    target.isChainLinked = false;
  }
  newActions.push({ type: "CHECK_VICTORY" });
  return { state, newActions };
}
function resolveHealHp(state, action) {
  const player = findPlayer(state, action.playerId);
  player.hp = Math.min(player.hp + action.amount, player.maxHp);
  if (player.aliveStatus === "dying") {
    player.aliveStatus = "alive";
  }
  return { state, newActions: [] };
}
function resolveEnterDying(state, action) {
  const player = findPlayer(state, action.playerId);
  const newActions = [];
  player.aliveStatus = "dying";
  state.pendingAction = {
    type: "use_tao_dying",
    playerId: action.playerId,
    timeoutAction: { type: "PLAYER_DIED", playerId: action.playerId }
  };
  return { state, newActions };
}
function resolvePlayerDied(state, action) {
  const player = findPlayer(state, action.playerId);
  const newActions = [];
  player.aliveStatus = "dead";
  player.identityRevealed = true;
  const allCards = [
    ...player.hand,
    ...Object.values(player.equipment).filter(Boolean),
    ...player.judgmentArea
  ];
  state.discardPile.push(...allCards);
  player.hand = [];
  player.equipment = { weapon: null, armor: null, plusHorse: null, minusHorse: null };
  player.judgmentArea = [];
  newActions.push({ type: "CHECK_VICTORY" });
  return { state, newActions };
}
function resolveDiscardAllCards(state, action) {
  const player = findPlayer(state, action.playerId);
  const allCards = [
    ...player.hand,
    ...Object.values(player.equipment).filter(Boolean)
  ];
  state.discardPile.push(...allCards);
  player.hand = [];
  player.equipment = { weapon: null, armor: null, plusHorse: null, minusHorse: null };
  return { state, newActions: [] };
}
function resolveDestroyEquipment(state, action) {
  const player = findPlayer(state, action.playerId);
  const slot = action.slot;
  const equip = player.equipment[slot];
  if (equip) {
    state.discardPile.push(equip);
    player.equipment[slot] = null;
  }
  return { state, newActions: [] };
}
function resolvePhaseChange(state, action) {
  state.currentTurnPhase = action.phase;
  return { state, newActions: [] };
}
function resolveCheckVictory(state) {
  const winner = checkVictory(state);
  if (winner) {
    state.winner = winner;
    state.gamePhase = "finished";
  }
  return { state, newActions: [] };
}
function resolveSelectCharacter(state, action) {
  const player = findPlayer(state, action.playerId);
  if (!player) return { state, newActions: [] };
  const charInfo = getCharacterInfo(action.characterId);
  if (!charInfo) return { state, newActions: [] };
  player.characterId = charInfo.id;
  player.characterName = charInfo.name;
  player.kingdom = charInfo.kingdom;
  player.maxHp = charInfo.maxHp + (player.identity === "ruler" ? 1 : 0);
  player.hp = player.maxHp;
  if (player.identity === "ruler") {
    player.identityRevealed = true;
  }
  const alivePlayers = state.players.filter((p) => p.aliveStatus !== "dead");
  const allSelected = alivePlayers.every((p) => p.characterId);
  if (allSelected) {
    return resolveStartGame(state);
  }
  return { state, newActions: [] };
}
function resolveStartGame(state) {
  state.gamePhase = "playing";
  state.deck = shuffleDeck(buildDeck());
  state.discardPile = [];
  state.currentTurnPhase = "judge";
  state.currentPlayerIndex = 0;
  state.turnNumber = 1;
  state.roundNumber = 1;
  for (const player of state.players) {
    if (player.aliveStatus !== "dead") {
      player.hand = state.deck.splice(0, Math.min(4, state.deck.length));
    }
  }
  const firstPlayerId = state.turnOrder[0];
  return { state, newActions: [
    { type: "DRAW_CARDS", playerId: firstPlayerId, count: 2 },
    { type: "PHASE_CHANGE", phase: "play" }
  ] };
}

// ../src/store/gameReducer.ts
function gameReducer(state, action) {
  const systemActions = [
    "DRAW_CARDS",
    "DRAW_CARDS_SPECIFIC",
    "DEAL_DAMAGE",
    "HEAL_HP",
    "ENTER_DYING",
    "PLAYER_DIED",
    "DISCARD_ALL_CARDS",
    "DISCARD_TO_MAX_HP",
    "CHECK_VICTORY",
    "TURN_START",
    "PHASE_CHANGE",
    "DESTROY_EQUIPMENT",
    "ENTER_JUDGMENT_PHASE",
    "RESOLVE_JUDGMENT",
    "PLACE_DELAYED_TOOL",
    "REMOVE_DELAYED_TOOL",
    "STEAL_CARD",
    "CHAIN_PLAYERS",
    "TURN_OVER",
    "START_GAME",
    "SELECT_CHARACTER",
    "REQUEST_CHARACTER_SELECTION",
    "AI_THINK",
    "TOGGLE_CHAIN"
  ];
  if (!systemActions.includes(action.type)) {
    if (!validateAction(state, action)) {
      console.warn("Invalid action rejected:", action);
      return state;
    }
  }
  const { state: newState, newActions } = resolveAction(state, action);
  let current = cloneState(newState);
  const pending = [...newActions];
  const initTriggers = checkTriggers(current, action);
  for (const t of initTriggers) {
    const skillResult = executeSkill(current, t.playerId, t.skill.id, action);
    pending.push(...skillResult.actions);
  }
  let depth = 0;
  while (pending.length > 0 && depth < 50) {
    const nextAction = pending.shift();
    const { state: result, newActions: more } = resolveAction(current, nextAction);
    current = result;
    pending.push(...more);
    const triggered = checkTriggers(current, nextAction);
    for (const t of triggered) {
      const skillResult = executeSkill(current, t.playerId, t.skill.id, nextAction);
      pending.push(...skillResult.actions);
    }
    depth++;
  }
  return current;
}

// ../src/engine/systems/IdentitySystem.ts
function getKnownEnemies(state, playerId) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];
  const enemies = [];
  for (const other of state.players) {
    if (other.id === playerId || other.aliveStatus === "dead") continue;
    if (other.identityRevealed) {
      if (areEnemies(player.identity, other.identity)) {
        enemies.push(other.id);
      }
    } else {
    }
  }
  return enemies;
}
function getKnownAllies(state, playerId) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];
  const allies = [];
  for (const other of state.players) {
    if (other.id === playerId || other.aliveStatus === "dead") continue;
    if (other.identityRevealed) {
      if (areAllies(player.identity, other.identity)) {
        allies.push(other.id);
      }
    }
  }
  return allies;
}
function areEnemies(a, b) {
  if (a === "ruler") {
    return b === "rebel" || b === "spy";
  }
  if (a === "loyalist") {
    return b === "rebel" || b === "spy";
  }
  if (a === "rebel") {
    return b === "ruler" || b === "loyalist" || b === "spy";
  }
  if (a === "spy") {
    return b !== "spy";
  }
  return false;
}
function areAllies(a, b) {
  if (a === b) return true;
  if (a === "ruler") return b === "loyalist";
  if (a === "loyalist") return b === "ruler";
  return false;
}

// ../src/engine/ai/AIScorer.ts
var WEIGHTS = {
  damageEnemy: 60,
  damageAlly: -80,
  healSelf: 40,
  healAlly: 50,
  drawCards: 35,
  discardEnemy: 30,
  equipCard: 18,
  stealFromEnemy: 45,
  chainEnemy: 15,
  killEnemyBonus: 200,
  avoidDeath: 500,
  playToolCard: 25,
  destroyEnemyEquipment: 35,
  dyingHeal: 300
};
function scoreAction(state, action, playerId) {
  switch (action.type) {
    case "PLAY_CARD":
      return scorePlayCard(state, action, playerId);
    case "EQUIP_CARD":
      return scoreEquipCard(state, action, playerId);
    case "USE_SKILL":
      return scoreUseSkill(state, action, playerId);
    case "END_PHASE":
      return -5;
    case "END_TURN":
      return -3;
    case "PASS_RESPONSE":
      return 0;
    case "RESPOND":
      return 5;
    case "USE_TAO_SELF":
      return scoreTaoSelf(state, action, playerId);
    case "USE_TAO_OTHER":
      return scoreTaoOther(state, action, playerId);
    case "DISCARD_CARD":
      return scoreDiscardCard(state, action, playerId);
    default:
      return 0;
  }
}
function scorePlayCard(state, action, playerId) {
  const player = findPlayer(state, playerId);
  if (!player) return 0;
  const card = player.hand.find((c2) => c2.instanceId === action.cardId);
  if (!card) return 0;
  let score = 0;
  switch (card.subtype) {
    case "sha": {
      for (const targetId of action.targets) {
        const target = findPlayer(state, targetId);
        if (!target) continue;
        if (getKnownEnemies(state, playerId).includes(targetId)) {
          score += WEIGHTS.damageEnemy;
          if (target.hp <= 1) score += WEIGHTS.killEnemyBonus / 2;
        } else if (getKnownAllies(state, playerId).includes(targetId)) {
          score += WEIGHTS.damageAlly;
        } else {
          score += WEIGHTS.damageEnemy * 0.5;
        }
      }
      break;
    }
    case "jiu":
      score += 15;
      break;
    default:
      if (card.category === "tool") {
        score += WEIGHTS.playToolCard;
        for (const targetId of action.targets) {
          if (getKnownEnemies(state, playerId).includes(targetId)) {
            score += 20;
          }
        }
      }
      break;
  }
  return score;
}
function scoreEquipCard(state, action, playerId) {
  const player = findPlayer(state, playerId);
  if (!player) return 0;
  const card = player.hand.find((c2) => c2.instanceId === action.cardId);
  if (!card) return 0;
  switch (card.equipSlot) {
    case "weapon":
      return WEIGHTS.equipCard + (card.weaponRange || 1) * 3;
    case "armor":
      return WEIGHTS.equipCard + 8;
    case "plusHorse":
      return WEIGHTS.equipCard + 5;
    case "minusHorse":
      return WEIGHTS.equipCard + 7;
    default:
      return WEIGHTS.equipCard;
  }
}
function scoreUseSkill(state, action, playerId) {
  const skillValues = {
    "jianxiong": 25,
    "hujia": 30,
    "fankui": 25,
    "guicai": 20,
    "ganglie": 20,
    "tuxi": 35,
    "luoyi": 25,
    "tiandu": 15,
    "yiji": 25,
    "luoshen": 30,
    "qingguo": 20,
    "rende": 30,
    "jijiang": 25,
    "wusheng": 25,
    "paoxiao": 20,
    "guanxing": 25,
    "kongcheng": 20,
    "longdan": 20,
    "mashu": 10,
    "tieji": 25,
    "jizhi": 30,
    "qicai": 15,
    "zhiheng": 30,
    "jiuyuan": 20,
    "yingzi": 25,
    "fanjian": 30,
    "kurou": 25,
    "keji": 20,
    "qianxun": 15,
    "lianying": 25,
    "guose": 25,
    "liuli": 20,
    "jieyin": 30,
    "xiaoji": 25,
    "jijiu": 30,
    "qingnang": 30,
    "wushuang": 20,
    "lijian": 35,
    "biyue": 20,
    "leiji": 30
  };
  return skillValues[action.skillId] || 15;
}
function scoreTaoSelf(state, action, playerId) {
  const player = findPlayer(state, playerId);
  if (!player) return 0;
  if (player.aliveStatus === "dying") return WEIGHTS.dyingHeal;
  return WEIGHTS.healSelf;
}
function scoreTaoOther(state, action, playerId) {
  if (getKnownAllies(state, playerId).includes(action.targetId)) {
    return WEIGHTS.dyingHeal;
  }
  return WEIGHTS.dyingHeal * 0.7;
}
function scoreDiscardCard(state, action, playerId) {
  const player = findPlayer(state, playerId);
  if (!player) return 0;
  const card = player.hand.find((c2) => c2.instanceId === action.cardId);
  if (!card) return 0;
  const usefulness = {
    "sha": 5,
    "shan": 4,
    "tao": 10,
    "jiu": 6,
    "wuxie_keji": 7
  };
  const cardUsefulness = usefulness[card.subtype] || 4;
  if (card.category === "equipment") return -2;
  return 10 - cardUsefulness;
}

// ../src/engine/ai/AIPersonas.ts
var PERSONAS = {
  ruler: {
    identity: "ruler",
    aggressionMultiplier: 1,
    teamPlayMultiplier: 1.3,
    selfPreservationMultiplier: 1.5,
    cardControlMultiplier: 1.1,
    riskTolerance: 0.4
  },
  loyalist: {
    identity: "loyalist",
    aggressionMultiplier: 1.2,
    teamPlayMultiplier: 1.6,
    selfPreservationMultiplier: 1.1,
    cardControlMultiplier: 1.2,
    riskTolerance: 0.6
  },
  rebel: {
    identity: "rebel",
    aggressionMultiplier: 1.5,
    teamPlayMultiplier: 1,
    selfPreservationMultiplier: 0.9,
    cardControlMultiplier: 1.3,
    riskTolerance: 0.8
  },
  spy: {
    identity: "spy",
    aggressionMultiplier: 1,
    teamPlayMultiplier: 0.5,
    selfPreservationMultiplier: 1.8,
    cardControlMultiplier: 1,
    riskTolerance: 0.2
  }
};
function getPersona(identity) {
  return PERSONAS[identity];
}
function applyPersona(baseScore, persona, actionCategory) {
  switch (actionCategory) {
    case "damage":
      return baseScore * persona.aggressionMultiplier;
    case "team":
      return baseScore * persona.teamPlayMultiplier;
    case "self":
      return baseScore * persona.selfPreservationMultiplier;
    case "control":
      return baseScore * persona.cardControlMultiplier;
    default:
      return baseScore;
  }
}

// ../src/engine/ai/AIEvaluator.ts
function evaluateBestAction(state, playerId) {
  const player = findPlayer(state, playerId);
  if (!player) return { type: "END_TURN", playerId };
  const validActions = getValidActions(state, playerId);
  const persona = getPersona(player.identity);
  const enemies = getKnownEnemies(state, playerId);
  const allies = getKnownAllies(state, playerId);
  const scored = [];
  for (const action of validActions) {
    let score = scoreAction(state, action, playerId);
    if (action.type === "PLAY_CARD") {
      const card = player.hand.find((c2) => c2.instanceId === action.cardId);
      if (card) {
        if (card.subtype === "sha") {
          const alive = getAlivePlayers(state).filter((p) => p.id !== playerId);
          let bestTargetScore = -Infinity;
          let bestTargets = [];
          for (const target of alive) {
            const isEnemy = enemies.includes(target.id);
            const isAlly = allies.includes(target.id);
            let targetScore = score;
            if (isEnemy) {
              targetScore = applyPersona(targetScore, persona, "damage");
              if (target.hp <= 1) targetScore += 100;
            } else if (isAlly) {
              targetScore = applyPersona(targetScore, persona, "team");
              targetScore -= 80;
            } else {
              targetScore *= 0.7;
            }
            if (targetScore > bestTargetScore) {
              bestTargetScore = targetScore;
              bestTargets = [target.id];
            }
          }
          if (bestTargets.length > 0) {
            scored.push({
              action: { ...action, targets: bestTargets },
              score: bestTargetScore
            });
            continue;
          }
        } else if (card.category === "tool") {
          const alive = getAlivePlayers(state);
          let bestTargetScore = score;
          let bestTargets = [];
          const isHarmful = ["guohe_chaiqiao", "shunshou_qianyang", "juedou", "jiedao_sharen"].includes(card.subtype);
          const isAOE = ["nanman_ruqin", "wanjian_qifa"].includes(card.subtype);
          const isChain = card.subtype === "tiesuo_lianhuan";
          const isDelayed = ["lebu_sishu", "bingliang_cunduan", "shandian"].includes(card.subtype);
          if (isHarmful) {
            for (const target of alive) {
              if (target.id === playerId) continue;
              const isEnemy = enemies.includes(target.id);
              if (isEnemy) {
                bestTargetScore = applyPersona(score, persona, "damage");
                bestTargets = [target.id];
                break;
              }
            }
          } else if (isAOE) {
            const enemyCount = alive.filter((p) => enemies.includes(p.id)).length;
            const allyCount = alive.filter((p) => allies.includes(p.id)).length;
            const net = enemyCount - allyCount;
            score = applyPersona(score + net * 15, persona, "damage");
            bestTargets = [];
          } else if (isChain) {
            const enemyTargets = alive.filter((p) => enemies.includes(p.id) && !p.isChainLinked);
            if (enemyTargets.length > 0) {
              bestTargetScore = applyPersona(score + 10, persona, "damage");
              bestTargets = enemyTargets.slice(0, 2).map((p) => p.id);
            }
          } else if (isDelayed) {
            for (const target of alive) {
              if (target.id === playerId) continue;
              if (enemies.includes(target.id)) {
                bestTargetScore = applyPersona(score, persona, "damage");
                bestTargets = [target.id];
                break;
              }
            }
          }
          scored.push({
            action: { ...action, targets: bestTargets },
            score: bestTargetScore
          });
          continue;
        }
      }
    }
    if (action.type === "USE_TAO_SELF") {
      score = applyPersona(score, persona, "self");
    } else if (action.type === "USE_TAO_OTHER") {
      score = applyPersona(score, persona, "team");
    } else if (action.type === "EQUIP_CARD") {
      score = applyPersona(score, persona, "self");
    } else if (action.type === "USE_SKILL") {
      score = applyPersona(score, persona, "self");
    }
    scored.push({ action, score });
  }
  scored.sort((a, b) => b.score - a.score);
  if (scored.length > 1) {
    const topScore = scored[0].score;
    const candidates = scored.filter((s) => s.score >= topScore * 0.85);
    if (candidates.length > 1) {
      return candidates[Math.floor(Math.random() * candidates.length)].action;
    }
  }
  if (scored.length === 0) {
    const currentPlayer = getCurrentPlayer(state);
    if (currentPlayer.id === playerId) {
      if (state.currentTurnPhase === "play") {
        return { type: "END_PHASE", playerId };
      }
      return { type: "END_TURN", playerId };
    }
    if (state.pendingAction?.playerId === playerId) {
      return { type: "PASS_RESPONSE", playerId };
    }
    return { type: "END_TURN", playerId };
  }
  return scored[0].action;
}

// ../src/engine/ai/AIController.ts
function aiSelectCharacter(player) {
  if (player.selectableCharacters && player.selectableCharacters.length > 0) {
    const idx = Math.floor(Math.random() * player.selectableCharacters.length);
    return player.selectableCharacters[idx];
  }
  const allChars = [
    "caocao",
    "simayi",
    "xiahoudun",
    "zhangliao",
    "xuchu",
    "guojia",
    "zhenji",
    "liubei",
    "guanyu",
    "zhangfei",
    "zhugeliang",
    "zhaoyun",
    "machao",
    "huangyueying",
    "sunquan",
    "zhouyu",
    "huanggai",
    "lvmeng",
    "luxun",
    "daqiao",
    "sunshangxiang",
    "huatuo",
    "lvbu",
    "diaochan",
    "zhangjiao",
    "yuanshao"
  ];
  const info = getCharacterInfo(allChars[Math.floor(Math.random() * allChars.length)]);
  return info?.id || "caocao";
}
function aiDecide(state, playerId) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.aliveStatus !== "alive") {
    return { type: "END_TURN", playerId };
  }
  if (state.pendingAction) {
    return handlePendingAction(state, playerId);
  }
  return evaluateBestAction(state, playerId);
}
function handlePendingAction(state, playerId) {
  const pending = state.pendingAction;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { type: "PASS_RESPONSE", playerId };
  if (pending.playerId !== playerId) {
    if (pending.type === "use_tao_dying") {
      const dyingPlayer = state.players.find((p) => p.id === pending.playerId);
      if (dyingPlayer) {
        const allies = state.players.filter(
          (p) => p.id !== playerId && p.identity === player.identity
        );
        const isAlly = allies.some((a) => a.id === pending.playerId);
        if (isAlly || player.identity === "ruler") {
          const tao = player.hand.find((c2) => c2.subtype === "tao");
          if (tao) {
            return { type: "USE_TAO_OTHER", playerId, cardId: tao.instanceId, targetId: pending.playerId };
          }
        }
      }
    }
    return { type: "PASS_RESPONSE", playerId };
  }
  switch (pending.type) {
    case "respond_to_sha": {
      const shan = player.hand.find((c2) => c2.subtype === "shan");
      if (shan) return { type: "RESPOND", playerId, cardIds: [shan.instanceId] };
      if (player.equipment.armor?.subtype === "baguazhen") {
        return { type: "JUDGE_BAGUAZHEN", playerId };
      }
      return { type: "PASS_RESPONSE", playerId };
    }
    case "respond_to_nanman": {
      const sha = player.hand.find((c2) => c2.subtype === "sha");
      if (sha && player.hp <= 2) return { type: "RESPOND", playerId, cardIds: [sha.instanceId] };
      if (sha && player.hp <= 3 && Math.random() < 0.6) return { type: "RESPOND", playerId, cardIds: [sha.instanceId] };
      return { type: "PASS_RESPONSE", playerId };
    }
    case "respond_to_wanjian": {
      const shan = player.hand.find((c2) => c2.subtype === "shan");
      if (shan) return { type: "RESPOND", playerId, cardIds: [shan.instanceId] };
      return { type: "PASS_RESPONSE", playerId };
    }
    case "respond_to_juedou": {
      const sha = player.hand.find((c2) => c2.subtype === "sha");
      if (sha) return { type: "RESPOND", playerId, cardIds: [sha.instanceId] };
      return { type: "PASS_RESPONSE", playerId };
    }
    case "respond_to_wuxie_chain":
      return { type: "PASS_WUXIE", playerId };
    case "use_tao_dying":
      const tao = player.hand.find((c2) => c2.subtype === "tao");
      if (tao) return { type: "USE_TAO_SELF", playerId, cardId: tao.instanceId };
      return { type: "PASS_RESPONSE", playerId };
    case "pick_card_to_discard":
    case "pick_card_to_steal": {
      const available = pending.extra?.availableCards || [];
      const targetId = pending.extra?.targetId;
      if (available.length === 0) return { type: "PASS_RESPONSE", playerId };
      const equipCard = available.find((c2) => c2.zone === "equipment");
      const picked = equipCard || available[Math.floor(Math.random() * available.length)];
      return { type: "SELECT_TARGET_CARD", playerId, cardId: picked.cardId, targetPlayerId: targetId };
    }
    case "jiedao_sharen_choice": {
      const extra = pending.extra || {};
      const validTargets = extra.validTargetIds || [];
      const hasSha = extra.hasSha;
      if (hasSha && validTargets.length > 0 && Math.random() < 0.6) {
        const target = validTargets[Math.floor(Math.random() * validTargets.length)];
        return { type: "JIEDAO_ATTACK", playerId, targetId: target };
      }
      return { type: "JIEDAO_GIVE_WEAPON", playerId };
    }
    case "wugu_pick_card": {
      const wuguCards = pending.extra?.wuguCards || [];
      if (wuguCards.length === 0) return { type: "PASS_RESPONSE", playerId };
      const picked = wuguCards[Math.floor(Math.random() * wuguCards.length)];
      return { type: "PICK_WUGU_CARD", playerId, cardId: picked.instanceId };
    }
    default:
      return { type: "PASS_RESPONSE", playerId };
  }
}

// StateMasker.ts
function maskState(state, viewerId) {
  const masked = JSON.parse(JSON.stringify(state));
  const deckCount = masked.deck.length;
  const discardCount = masked.discardPile.length;
  masked.deck = [];
  masked.discardPile = [];
  for (const player of masked.players) {
    if (player.id === viewerId) continue;
    player.hand = player.hand.map((card) => createMaskedCard(card.instanceId));
    if (!player.identityRevealed) {
      player.identity = "rebel";
    }
  }
  return { state: masked, deckCount, discardCount };
}
function createMaskedCard(instanceId) {
  return {
    instanceId,
    definitionId: "",
    name: "?",
    category: "basic",
    subtype: "sha",
    suit: "spade",
    rankNumber: 1,
    rankDisplay: "?",
    toolTiming: null,
    equipSlot: null,
    weaponRange: null,
    isFireElement: false,
    isThunderElement: false
  };
}

// GameRunner.ts
function shuffleArray2(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function assignIdentities(count) {
  switch (count) {
    case 2:
      return ["ruler", "rebel"];
    case 3:
      return ["ruler", "loyalist", "rebel"];
    case 4:
      return ["ruler", "loyalist", "rebel", "spy"];
    case 5:
      return ["ruler", "loyalist", "rebel", "rebel", "spy"];
    case 6:
      return ["ruler", "loyalist", "rebel", "rebel", "rebel", "spy"];
    case 7:
      return ["ruler", "loyalist", "loyalist", "rebel", "rebel", "rebel", "spy"];
    case 8:
      return ["ruler", "loyalist", "loyalist", "rebel", "rebel", "rebel", "rebel", "spy"];
    default: {
      const rebels = Math.floor(count * 0.4);
      const loyalists = Math.max(1, Math.floor(count * 0.3));
      const result = ["ruler"];
      for (let i = 0; i < loyalists; i++) result.push("loyalist");
      for (let i = 0; i < rebels; i++) result.push("rebel");
      if (count > 3) result.push("spy");
      while (result.length < count) result.push("rebel");
      return result.slice(0, count);
    }
  }
}
function createOnlineGameState(room) {
  const humanSessions = Array.from(room.players.values()).sort((a, b) => a.playerIndex - b.playerIndex);
  const totalCount = room.playerCount;
  const names = humanSessions.map((p) => p.playerName);
  const aiIndices = [];
  for (let i = names.length; i < totalCount; i++) {
    names.push(`AI_${i + 1}`);
    aiIndices.push(i);
  }
  const identities = shuffleArray2(assignIdentities(totalCount));
  const rulerIdx = identities.indexOf("ruler");
  if (rulerIdx > 0) {
    [identities[0], identities[rulerIdx]] = [identities[rulerIdx], identities[0]];
  }
  const players = [];
  const turnOrder = [];
  for (let i = 0; i < totalCount; i++) {
    const isHuman = i < humanSessions.length;
    const id = isHuman ? humanSessions[i].playerId : `ai_${i}_${Date.now()}`;
    const player = createPlayerState(id, names[i], !isHuman);
    player.identity = identities[i];
    if (i === 0) {
      player.identityRevealed = true;
      player.maxHp = 5;
      player.hp = 5;
    }
    players.push(player);
    turnOrder.push(id);
  }
  return {
    gamePhase: "character_select",
    mode: "online",
    config: { mode: "online", playerNames: names, aiPlayerIndices: aiIndices },
    players,
    turnOrder,
    currentPlayerIndex: 0,
    currentTurnPhase: "judge",
    turnNumber: 0,
    roundNumber: 0,
    deck: [],
    discardPile: [],
    pendingAction: null,
    actionHistory: [],
    eventQueue: [],
    winner: null
  };
}
var ALL_CHARACTERS = [
  "caocao",
  "simayi",
  "xiahoudun",
  "zhangliao",
  "xuchu",
  "guojia",
  "zhenji",
  "liubei",
  "guanyu",
  "zhangfei",
  "zhugeliang",
  "zhaoyun",
  "machao",
  "huangyueying",
  "sunquan",
  "zhouyu",
  "huanggai",
  "lvmeng",
  "luxun",
  "daqiao",
  "sunshangxiang",
  "huatuo",
  "lvbu",
  "diaochan",
  "zhangjiao",
  "yuanshao"
];
var GameRunner = class {
  room;
  state;
  aiTimers = /* @__PURE__ */ new Map();
  destroyed = false;
  constructor(room) {
    this.room = room;
    this.state = createOnlineGameState(room);
  }
  start() {
    console.log("[GameRunner.start] Starting with", this.state.players.length, "players");
    for (const player of this.state.players) {
      if (player.characterId) continue;
      const charId = player.isAI ? aiSelectCharacter(player) : ALL_CHARACTERS[Math.floor(Math.random() * ALL_CHARACTERS.length)];
      console.log("[GameRunner.start] Assigning", charId, "to player", player.id, "(isAI:", player.isAI, ")");
      this.state = gameReducer(this.state, {
        type: "SELECT_CHARACTER",
        playerId: player.id,
        characterId: charId
      });
    }
    console.log("[GameRunner.start] Characters assigned, dispatching START_GAME");
    const { state: newState } = this.applyReducer(this.state, { type: "START_GAME" });
    this.state = newState;
    console.log("[GameRunner.start] START_GAME resolved, phase:", this.state.gamePhase);
    this.broadcastState();
    console.log("[GameRunner.start] broadcastState done");
    this.scheduleAI();
    console.log("[GameRunner.start] scheduleAI done");
  }
  handleAction(playerId, action) {
    if (this.destroyed) return;
    if (!validateAction(this.state, action)) {
      this.room.sendToPlayer(playerId, { type: "ERROR", code: "INVALID_ACTION", message: "\u975E\u6CD5\u64CD\u4F5C" });
      return;
    }
    const { state: newState, newActions } = this.applyReducer(this.state, action);
    this.state = newState;
    this.processFollowUps(newActions);
    this.broadcastState();
    if (this.state.gamePhase === "finished") {
      this.cleanup();
      return;
    }
    this.scheduleAI();
  }
  cleanup() {
    this.destroyed = true;
    for (const timer of this.aiTimers.values()) {
      clearTimeout(timer);
    }
    this.aiTimers.clear();
  }
  applyReducer(state, action) {
    const result = gameReducer(state, action);
    return { state: result, newActions: [] };
  }
  processFollowUps(_actions) {
  }
  broadcastState() {
    console.log("[GameRunner.broadcastState] Sending state to", this.room.players.size, "players");
    for (const [playerId] of this.room.players) {
      const { state: masked, deckCount, discardCount } = maskState(this.state, playerId);
      masked._viewerPlayerId = playerId;
      const validActions = getValidActions(this.state, playerId);
      console.log("[GameRunner.broadcastState] Sending to", playerId, "validActions:", validActions.length);
      this.room.sendToPlayer(playerId, {
        type: "GAME_STATE",
        state: masked,
        validActions,
        deckCount,
        discardCount
      });
    }
  }
  scheduleAI() {
    if (this.destroyed) return;
    if (this.state.pendingAction) {
      const pendingPlayer = this.state.players.find((p) => p.id === this.state.pendingAction.playerId);
      if (pendingPlayer?.isAI && pendingPlayer.aliveStatus === "alive") {
        const key = `pending_${pendingPlayer.id}`;
        if (!this.aiTimers.has(key)) {
          const delay = 500 + Math.random() * 800;
          const timer = setTimeout(() => {
            this.aiTimers.delete(key);
            this.runAI(pendingPlayer.id);
          }, delay);
          this.aiTimers.set(key, timer);
        }
        return;
      }
      if (this.state.pendingAction.type === "use_tao_dying") {
        for (const player of this.state.players) {
          if (player.isAI && player.aliveStatus === "alive" && player.id !== pendingPlayer?.id) {
            const key = `tao_${player.id}`;
            if (!this.aiTimers.has(key)) {
              const timer = setTimeout(() => {
                this.aiTimers.delete(key);
                this.runAI(player.id);
              }, 300 + Math.random() * 500);
              this.aiTimers.set(key, timer);
            }
          }
        }
        return;
      }
      return;
    }
    const currentId = this.state.turnOrder[this.state.currentPlayerIndex];
    const currentPlayer = this.state.players.find((p) => p.id === currentId);
    if (currentPlayer?.isAI && currentPlayer.aliveStatus === "alive") {
      const key = `turn_${currentId}`;
      if (!this.aiTimers.has(key)) {
        const delay = 800 + Math.random() * 1200;
        const timer = setTimeout(() => {
          this.aiTimers.delete(key);
          this.runAI(currentId);
        }, delay);
        this.aiTimers.set(key, timer);
      }
    }
  }
  runAI(playerId) {
    if (this.destroyed) return;
    const action = aiDecide(this.state, playerId);
    this.handleAction(playerId, action);
  }
};

// index.ts
var PORT = parseInt(process.env.PORT || "3001", 10);
var roomManager = new RoomManager();
var PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
var wsSessionMap = /* @__PURE__ */ new Map();
var MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};
function serveStatic(_req, res) {
  const url = _req.url === "/" ? "/index.html" : _req.url || "/index.html";
  const filePath = join(PUBLIC_DIR, url);
  if (existsSync(filePath)) {
    const ext = extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(readFileSync(filePath));
  } else {
    const indexPath = join(PUBLIC_DIR, "index.html");
    if (existsSync(indexPath)) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(readFileSync(indexPath));
    } else {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", rooms: roomManager["rooms"].size }));
    }
  }
}
var httpServer = createServer(serveStatic);
var wss = new WebSocketServer({ server: httpServer });
wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      sendTo(ws, { type: "ERROR", code: "PARSE_ERROR", message: "\u65E0\u6548\u6D88\u606F\u683C\u5F0F" });
      return;
    }
    switch (msg.type) {
      case "CREATE_ROOM": {
        const playerName = msg.playerName || "\u73A9\u5BB6";
        const playerCount = Math.min(8, Math.max(2, msg.playerCount || 4));
        const { roomCode, playerId, playerIndex } = roomManager.createRoom(playerName, playerCount, ws);
        wsSessionMap.set(ws, { roomCode, playerId });
        sendTo(ws, { type: "ROOM_CREATED", roomCode, playerId, playerIndex });
        break;
      }
      case "JOIN_ROOM": {
        const roomCode = msg.roomCode;
        const playerName = msg.playerName || "\u73A9\u5BB6";
        if (!roomCode) {
          sendTo(ws, { type: "ERROR", code: "INVALID_CODE", message: "\u8BF7\u8F93\u5165\u623F\u95F4\u53F7" });
          return;
        }
        const result = roomManager.joinRoom(roomCode, playerName, ws);
        if ("error" in result) {
          sendTo(ws, { type: "ERROR", code: result.error, message: getErrorMessage(result.error) });
          return;
        }
        wsSessionMap.set(ws, { roomCode, playerId: result.playerId });
        sendTo(ws, {
          type: "ROOM_JOINED",
          roomCode,
          playerId: result.playerId,
          playerIndex: result.playerIndex,
          players: result.room.getLobbyPlayers()
        });
        result.room.broadcast({
          type: "PLAYER_JOINED",
          player: {
            playerId: result.playerId,
            playerName,
            playerIndex: result.playerIndex,
            isHost: false
          }
        }, result.playerId);
        break;
      }
      case "START_GAME": {
        const session = wsSessionMap.get(ws);
        if (!session) return;
        const room = roomManager.getRoom(session.roomCode);
        if (!room) return;
        if (room.hostPlayerId !== session.playerId) {
          sendTo(ws, { type: "ERROR", code: "NOT_HOST", message: "\u53EA\u6709\u623F\u4E3B\u53EF\u4EE5\u5F00\u59CB\u6E38\u620F" });
          return;
        }
        if (room.players.size < 2) {
          sendTo(ws, { type: "ERROR", code: "NOT_ENOUGH_PLAYERS", message: "\u81F3\u5C11\u9700\u89812\u540D\u73A9\u5BB6" });
          return;
        }
        room.state = "playing";
        console.log("[START_GAME] Starting game for room", session.roomCode, "players:", room.players.size);
        let runner;
        try {
          runner = new GameRunner(room);
        } catch (e) {
          console.error("[START_GAME] GameRunner constructor error:", e);
          room.state = "lobby";
          sendTo(ws, { type: "ERROR", code: "START_FAILED", message: "\u521B\u5EFA\u6E38\u620F\u5931\u8D25: " + String(e) });
          return;
        }
        room.gameRunner = runner;
        room.broadcast({ type: "GAME_STARTED" });
        console.log("[START_GAME] GAME_STARTED broadcast sent");
        try {
          runner.start();
          console.log("[START_GAME] runner.start() completed");
        } catch (e) {
          console.error("[START_GAME] runner.start() error:", e);
          room.state = "lobby";
          room.broadcast({ type: "ERROR", code: "START_FAILED", message: "\u6E38\u620F\u542F\u52A8\u5931\u8D25: " + String(e) });
        }
        break;
      }
      case "PLAYER_ACTION": {
        const session = wsSessionMap.get(ws);
        if (!session) return;
        const room = roomManager.getRoom(session.roomCode);
        if (!room?.gameRunner) return;
        room.gameRunner.handleAction(session.playerId, msg.action);
        break;
      }
      case "LEAVE_ROOM": {
        const session = wsSessionMap.get(ws);
        if (!session) return;
        const room = roomManager.leaveRoom(session.roomCode, session.playerId);
        wsSessionMap.delete(ws);
        if (room) {
          room.broadcast({ type: "PLAYER_LEFT", playerId: session.playerId });
        }
        break;
      }
      case "PING": {
        sendTo(ws, { type: "PONG" });
        break;
      }
    }
  });
  ws.on("close", () => {
    const session = wsSessionMap.get(ws);
    if (session) {
      const room = roomManager.leaveRoom(session.roomCode, session.playerId);
      wsSessionMap.delete(ws);
      if (room) {
        room.broadcast({ type: "PLAYER_LEFT", playerId: session.playerId });
      }
    }
  });
});
function sendTo(ws, msg) {
  if (ws.readyState === WebSocket2.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}
function getErrorMessage(code) {
  switch (code) {
    case "ROOM_NOT_FOUND":
      return "\u623F\u95F4\u4E0D\u5B58\u5728";
    case "GAME_ALREADY_STARTED":
      return "\u6E38\u620F\u5DF2\u7ECF\u5F00\u59CB";
    case "ROOM_FULL":
      return "\u623F\u95F4\u5DF2\u6EE1";
    default:
      return "\u672A\u77E5\u9519\u8BEF";
  }
}
httpServer.listen(PORT, () => {
  console.log(`[Sanguosha Server] listening on port ${PORT}`);
});
