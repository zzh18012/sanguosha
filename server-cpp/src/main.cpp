// ============================================================
// main.cpp — San Guo Sha C++ Server Entry Point
// HTTP + WebSocket server using uWebSockets v20 + nlohmann/json
// ============================================================

#include <uWS/uWS.h>
#include <nlohmann/json.hpp>

#include "types.hpp"
#include "json_serializer.hpp"
#include "game_state.hpp"
#include "deck.hpp"
#include "rules_engine.hpp"
#include "action_resolver.hpp"
#include "ai.hpp"
#include "skills.hpp"
#include "characters.hpp"
#include "distance.hpp"
#include "identity.hpp"

#include <algorithm>
#include <chrono>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <map>
#include <mutex>
#include <random>
#include <sstream>
#include <string>
#include <string_view>
#include <unordered_map>

namespace fs = std::filesystem;
using json = nlohmann::json;

// ============================================================
// Per-socket user data attached to every WebSocket connection
// ============================================================
struct PerSocketData {
    std::string playerId;
    std::string roomCode;
};

// Shorthand for the typed WebSocket pointer we use everywhere
using WS = uWS::WebSocket<false, true, PerSocketData>;

// ============================================================
// PlayerSession — a player inside a Room
// ============================================================
struct PlayerSession {
    std::string playerId;
    std::string playerName;
    int playerIndex = 0;
    WS* ws = nullptr;
};

// ============================================================
// LobbyPlayer — public info visible in the lobby
// ============================================================
struct LobbyPlayer {
    std::string playerId;
    std::string playerName;
    int playerIndex = 0;
    bool isHost = false;
};

inline json toJson(const LobbyPlayer& p) {
    return {
        {"playerId",   p.playerId},
        {"playerName", p.playerName},
        {"playerIndex",p.playerIndex},
        {"isHost",     p.isHost}
    };
}

// ============================================================
// Room — holds one game room
// ============================================================
struct Room {
    std::string roomCode;
    std::string hostPlayerId;
    int playerCount = 4;                     // room size chosen by host
    std::map<std::string, PlayerSession> players;
    std::string state = "lobby";             // "lobby" | "playing" | "finished"
    GameState gameState;                     // active game state (valid when state=="playing")
    std::mt19937 rng;                        // per-room RNG for deck/damage

    Room() : rng(std::chrono::steady_clock::now().time_since_epoch().count()) {}

    // --- helpers ----------------------------------------------------

    std::vector<LobbyPlayer> getLobbyPlayers() const {
        std::vector<LobbyPlayer> out;
        for (const auto& [id, s] : players) {
            out.push_back({id, s.playerName, s.playerIndex, id == hostPlayerId});
        }
        return out;
    }

    void sendToPlayer(const std::string& playerId, const json& msg) {
        auto it = players.find(playerId);
        if (it == players.end() || !it->second.ws) return;
        std::string payload = msg.dump();
        it->second.ws->send(payload, uWS::OpCode::TEXT);
    }

    void broadcast(const json& msg, const std::string& excludePlayerId = "") {
        for (auto& [pid, s] : players) {
            if (pid == excludePlayerId || !s.ws) continue;
            std::string payload = msg.dump();
            s.ws->send(payload, uWS::OpCode::TEXT);
        }
    }
};

// ============================================================
// RoomManager — thread-safe registry of all active rooms
// ============================================================
class RoomManager {
public:
    RoomManager()
        : rng_(std::chrono::steady_clock::now().time_since_epoch().count()) {}

    // Create a new room. Returns {roomCode, playerId, playerIndex}.
    std::tuple<std::string, std::string, int>
    createRoom(const std::string& playerName, int playerCount, WS* ws) {
        std::lock_guard<std::mutex> lk(mtx_);
        std::string code   = generateRoomCode();
        std::string pid    = generateId();
        Room room;
        room.roomCode     = code;
        room.hostPlayerId = pid;
        room.playerCount  = playerCount;
        room.players.emplace(pid, PlayerSession{pid, playerName, 0, ws});
        rooms_.emplace(code, std::move(room));
        return {code, pid, 0};
    }

    // Join result discriminated by success flag.
    struct JoinResult {
        bool success = false;
        std::string errorCode;
        std::string playerId;
        int         playerIndex = 0;
        Room*       room = nullptr;
    };

    JoinResult joinRoom(const std::string& roomCode,
                        const std::string& playerName,
                        WS* ws) {
        std::lock_guard<std::mutex> lk(mtx_);
        auto it = rooms_.find(roomCode);
        if (it == rooms_.end())
            return {false, "ROOM_NOT_FOUND"};
        Room& r = it->second;
        if (r.state != "lobby")
            return {false, "GAME_ALREADY_STARTED"};
        if (static_cast<int>(r.players.size()) >= r.playerCount)
            return {false, "ROOM_FULL"};

        std::string pid = generateId();
        int idx = static_cast<int>(r.players.size());
        r.players.emplace(pid, PlayerSession{pid, playerName, idx, ws});
        return {true, "", pid, idx, &r};
    }

    // A player leaves (or disconnects from) a room.
    // Returns pointer to the room if it still exists, nullptr otherwise.
    Room* leaveRoom(const std::string& roomCode, const std::string& playerId) {
        std::lock_guard<std::mutex> lk(mtx_);
        auto it = rooms_.find(roomCode);
        if (it == rooms_.end()) return nullptr;
        Room& r = it->second;
        r.players.erase(playerId);

        if (r.players.empty()) {
            rooms_.erase(it);
            return nullptr;
        }

        // If the host left, hand host to the next player in line.
        if (playerId == r.hostPlayerId) {
            r.hostPlayerId = r.players.begin()->first;
        }
        return &r;
    }

    // Look up a room by code. Returns nullptr when not found.
    Room* getRoom(const std::string& roomCode) {
        std::lock_guard<std::mutex> lk(mtx_);
        auto it = rooms_.find(roomCode);
        return (it != rooms_.end()) ? &it->second : nullptr;
    }

private:
    // ---- id / code generators --------------------------------------

    std::string generateId() {
        auto now = std::chrono::steady_clock::now().time_since_epoch().count();
        std::uniform_int_distribution<int> d(100000, 999999);
        return "p_" + std::to_string(now) + "_" + std::to_string(d(rng_));
    }

    std::string generateRoomCode() {
        std::uniform_int_distribution<int> d(1000, 9999);
        // Try random codes first.
        for (int i = 0; i < 200; ++i) {
            int v = d(rng_);
            std::string s = std::to_string(v);
            if (rooms_.find(s) == rooms_.end()) return s;
        }
        // Fallback: linear scan of the entire 4-digit space.
        for (int v = 1000; v <= 9999; ++v) {
            std::string s = std::to_string(v);
            if (rooms_.find(s) == rooms_.end()) return s;
        }
        // Every code is taken — exceptionally unlikely; just hand out a
        // random code so the server doesn't crash.
        return std::to_string(d(rng_));
    }

    // ---- members ---------------------------------------------------

    std::map<std::string, Room> rooms_;
    std::mutex mtx_;
    std::mt19937 rng_;
};

// ============================================================
// Global room manager instance
// ============================================================
RoomManager g_roomMgr;

// ============================================================
// Error message mapping (Chinese, matches Node.js reference server)
// ============================================================
static std::string errorMessage(const std::string& code) {
    if (code == "ROOM_NOT_FOUND")       return "房间不存在";
    if (code == "GAME_ALREADY_STARTED") return "游戏已经开始";
    if (code == "ROOM_FULL")            return "房间已满";
    return "未知错误";
}

// ============================================================
// MIME type lookup by file extension
// ============================================================
static std::string mimeType(const std::string& path) {
    static const std::unordered_map<std::string, std::string> map = {
        {".html", "text/html"},
        {".js",   "application/javascript"},
        {".css",  "text/css"},
        {".json", "application/json"},
        {".png",  "image/png"},
        {".svg",  "image/svg+xml"},
    };
    auto dot = path.rfind('.');
    if (dot == std::string::npos) return "application/octet-stream";
    auto it = map.find(path.substr(dot));
    return (it != map.end()) ? it->second : "application/octet-stream";
}

// ============================================================
// Static file serving helper
// ============================================================
static bool serveStatic(uWS::HttpResponse<false>* res,
                        const std::string& url,
                        const std::string& publicDir) {
    // Map root to index.html. Strip query string if present.
    std::string path = (url == "/" || url.empty()) ? "/index.html" : url;
    auto q = path.find('?');
    if (q != std::string::npos) path.erase(q);

    // Basic directory-traversal guard.
    if (path.find("..") != std::string::npos) {
        res->writeStatus("403 Forbidden");
        res->end("403 Forbidden");
        return true;
    }

    std::string full = publicDir + path;
    std::ifstream f(full, std::ios::binary);
    if (!f.good()) return false;

    std::ostringstream buf;
    buf << f.rdbuf();
    std::string body = buf.str();
    res->writeHeader("Content-Type", mimeType(path));
    res->end(body);
    return true;
}

// ============================================================
// Entry point
// ============================================================
int main() {
    // ---- resolve public/ directory ---------------------------------

    // The built React frontend lives in server-cpp/../public/.
    // Try several common locations so the server works in different
    // deployment layouts (local dev, Docker, etc.).
    std::string publicDir = "../public/";
    if (!fs::exists(publicDir + "index.html")) publicDir = "./public/";
    if (!fs::exists(publicDir + "index.html")) publicDir = "../../public/";

    std::cout << "[sanguosha] public directory: "
              << fs::absolute(publicDir).string() << std::endl;
    if (!fs::exists(publicDir + "index.html")) {
        std::cerr << "[sanguosha] WARNING — index.html not found; "
                     "HTTP requests will return health-check JSON fallback.\n";
    }

    // ---- build uWS app ---------------------------------------------

    uWS::App app;

    // ================================================================
    // HTTP — serve the React SPA
    // ================================================================
    app.get("/*", [&publicDir](auto* res, auto* req) {
        std::string url(req->getUrl());

        // 1. Try exact file match.
        if (serveStatic(res, url, publicDir)) return;

        // 2. SPA fallback — serve index.html for client-side routing.
        {
            std::ifstream f(publicDir + "index.html", std::ios::binary);
            if (f.good()) {
                std::ostringstream buf;
                buf << f.rdbuf();
                res->writeHeader("Content-Type", "text/html");
                res->end(buf.str());
                return;
            }
        }

        // 3. Nothing to serve — return a health-check JSON blob.
        res->writeHeader("Content-Type", "application/json");
        res->end(R"({"status":"ok"})");
    });

    // ================================================================
    // WebSocket /ws — game protocol
    // ================================================================
    app.ws<PerSocketData>("/ws", {
        // Behaviour parameters.
        .compression      = uWS::SHARED_COMPRESSOR,
        .maxPayloadLength = 64 * 1024,
        .idleTimeout      = 600,
        .maxBackpressure  = 1 * 1024 * 1024,

        // ---- open ---------------------------------------------------
        .open = [](auto* /*ws*/) {
            // PerSocketData is already zero-initialised.
        },

        // ---- message ------------------------------------------------
        .message = [](auto* ws, std::string_view raw, uWS::OpCode /*op*/) {
            json msg;
            try {
                msg = json::parse(raw);
            } catch (...) {
                std::string err =
                    R"({"type":"ERROR","code":"PARSE_ERROR","message":"无效消息格式"})";
                ws->send(err, uWS::OpCode::TEXT);
                return;
            }

            std::string type = msg.value("type", "");
            auto& sd = *ws->getUserData();   // PerSocketData&

            // ----------------------------------------------------------
            // CREATE_ROOM
            // ----------------------------------------------------------
            if (type == "CREATE_ROOM") {
                std::string name = msg.value("playerName", "玩家");
                int count = msg.value("playerCount", 4);
                count = std::clamp(count, 2, 8);

                auto [code, pid, idx] = g_roomMgr.createRoom(name, count, ws);
                sd.playerId = pid;
                sd.roomCode = code;

                json resp;
                resp["type"]        = "ROOM_CREATED";
                resp["roomCode"]    = code;
                resp["playerId"]    = pid;
                resp["playerIndex"] = idx;
                ws->send(resp.dump(), uWS::OpCode::TEXT);
            }
            // ----------------------------------------------------------
            // JOIN_ROOM
            // ----------------------------------------------------------
            else if (type == "JOIN_ROOM") {
                std::string code = msg.value("roomCode", "");
                std::string name = msg.value("playerName", "玩家");
                if (code.empty()) {
                    json e;
                    e["type"]    = "ERROR";
                    e["code"]    = "INVALID_CODE";
                    e["message"] = "请输入房间号";
                    ws->send(e.dump(), uWS::OpCode::TEXT);
                    return;
                }

                auto jr = g_roomMgr.joinRoom(code, name, ws);
                if (!jr.success) {
                    json e;
                    e["type"]    = "ERROR";
                    e["code"]    = jr.errorCode;
                    e["message"] = errorMessage(jr.errorCode);
                    ws->send(e.dump(), uWS::OpCode::TEXT);
                    return;
                }

                sd.playerId = jr.playerId;
                sd.roomCode = code;

                // Send ROOM_JOINED to the new player.
                json joined;
                joined["type"]        = "ROOM_JOINED";
                joined["roomCode"]    = code;
                joined["playerId"]    = jr.playerId;
                joined["playerIndex"] = jr.playerIndex;
                joined["players"]     = json::array();
                for (const auto& lp : jr.room->getLobbyPlayers()) {
                    joined["players"].push_back(toJson(lp));
                }
                ws->send(joined.dump(), uWS::OpCode::TEXT);

                // Tell everyone else in the room about the new joiner.
                json pj;
                pj["type"] = "PLAYER_JOINED";
                pj["player"] = {
                    {"playerId",    jr.playerId},
                    {"playerName",  name},
                    {"playerIndex", jr.playerIndex},
                    {"isHost",      false}
                };
                jr.room->broadcast(pj, jr.playerId);
            }
            // ----------------------------------------------------------
            // START_GAME  (host only)
            // ----------------------------------------------------------
            else if (type == "START_GAME") {
                if (sd.roomCode.empty()) return;
                Room* room = g_roomMgr.getRoom(sd.roomCode);
                if (!room) return;

                // Only the host may start.
                if (room->hostPlayerId != sd.playerId) {
                    json e;
                    e["type"]    = "ERROR";
                    e["code"]    = "NOT_HOST";
                    e["message"] = "只有房主可以开始游戏";
                    ws->send(e.dump(), uWS::OpCode::TEXT);
                    return;
                }
                if (room->players.size() < 2) {
                    json e;
                    e["type"]    = "ERROR";
                    e["code"]    = "NOT_ENOUGH_PLAYERS";
                    e["message"] = "至少需要2名玩家";
                    ws->send(e.dump(), uWS::OpCode::TEXT);
                    return;
                }

                room->state = "playing";
                std::cout << "[sanguosha] START_GAME room=" << sd.roomCode
                          << " players=" << room->players.size() << "\n";

                // Build player names and AI indices
                std::vector<std::string> names;
                std::vector<int> aiIndices;
                int idx = 0;
                for (auto& [pid, ps] : room->players) {
                    names.push_back(ps.playerName);
                    idx++;
                }
                // Fill remaining slots with AI
                while ((int)names.size() < room->playerCount) {
                    names.push_back("AI_" + std::to_string(names.size() + 1));
                    aiIndices.push_back((int)names.size() - 1);
                }

                // Create game state
                room->gameState = sj::createGameState(names, aiIndices);

                // Assign characters to all players
                auto allChars = getAllCharacters();
                std::shuffle(allChars.begin(), allChars.end(), room->rng);
                for (auto& p : room->gameState.players) {
                    if (allChars.empty()) break;
                    const auto& ch = allChars[0];
                    p.characterId = ch.id;
                    p.characterName = ch.name;
                    p.kingdom = ch.kingdom;
                    p.maxHp = p.identity == Identity::Ruler ? ch.maxHp + 1 : ch.maxHp;
                    p.hp = p.maxHp;
                    // Add non-ruler skills
                    for (auto& sid : ch.skillIds) {
                        if (sid == "hujia" || sid == "jijiang" || sid == "jiuyuan") {
                            // Only add ruler skills for the ruler
                            if (p.identity == Identity::Ruler) p.skills.push_back(sid);
                        } else {
                            p.skills.push_back(sid);
                        }
                    }
                    allChars.erase(allChars.begin());
                }

                // Init deck and deal
                room->gameState.deck = deck::buildFullDeck();
                deck::shuffle(room->gameState.deck, room->rng);

                // Start game
                auto startAction = GameAction{ActionType::StartGame, "", {}};
                resolver::resolveAction(room->gameState, startAction, room->rng);

                // Broadcast GAME_STARTED
                room->broadcast({{"type", "GAME_STARTED"}});

                // Broadcast initial game state to each player
                for (auto& [pid, ps] : room->players) {
                    auto actions = rules::getValidActions(room->gameState, pid);
                    json gsJson = sj::gameStateToJson(room->gameState);
                    gsJson["_viewerPlayerId"] = pid;
                    json gsMsg;
                    gsMsg["type"] = "GAME_STATE";
                    gsMsg["state"] = gsJson;
                    gsMsg["validActions"] = json::array();
                    for (auto& a : actions) {
                        json aj;
                        aj["type"] = a.type == ActionType::PlayCard ? "PLAY_CARD" :
                                     a.type == ActionType::EquipCard ? "EQUIP_CARD" :
                                     a.type == ActionType::DiscardCard ? "DISCARD_CARD" :
                                     a.type == ActionType::EndTurn ? "END_TURN" :
                                     a.type == ActionType::UseSkill ? "USE_SKILL" :
                                     a.type == ActionType::UseTaoSelf ? "USE_TAO_SELF" :
                                     a.type == ActionType::UseTaoOther ? "USE_TAO_OTHER" :
                                     a.type == ActionType::PassResponse ? "PASS_RESPONSE" :
                                     a.type == ActionType::PassSaveDying ? "PASS_SAVE_DYING" :
                                     a.type == ActionType::PlayWuxie ? "PLAY_WUXIE" :
                                     a.type == ActionType::PassWuxie ? "PASS_WUXIE" :
                                     a.type == ActionType::Respond ? "RESPOND" :
                                     a.type == ActionType::SelectCharacter ? "SELECT_CHARACTER" :
                                     a.type == ActionType::StartGame ? "START_GAME" : "UNKNOWN";
                        if (auto* pd = std::get_if<PlayCardData>(&a.data)) {
                            aj["cardId"] = pd->cardId;
                            aj["targetIds"] = pd->targetIds;
                        } else if (auto* rd = std::get_if<RespondData>(&a.data)) {
                            aj["cardId"] = rd->cardId;
                        } else if (auto* td = std::get_if<UseTaoData>(&a.data)) {
                            aj["cardId"] = td->cardId;
                            aj["targetId"] = td->targetId;
                        } else if (auto* sd = std::get_if<UseSkillData>(&a.data)) {
                            aj["skillId"] = sd->skillId;
                        } else if (auto* dd = std::get_if<DiscardCardData>(&a.data)) {
                            aj["cardId"] = dd->cardId;
                        } else if (auto* ed = std::get_if<EquipCardData>(&a.data)) {
                            aj["cardId"] = ed->cardId;
                        } else if (auto* wd = std::get_if<PlayWuxieData>(&a.data)) {
                            aj["cardId"] = wd->cardId;
                        }
                        gsMsg["validActions"].push_back(aj);
                    }
                    gsMsg["deckCount"] = (int)room->gameState.deck.size();
                    gsMsg["discardCount"] = (int)room->gameState.discardPile.size();
                    room->sendToPlayer(pid, gsMsg);
                }
            }
            // ----------------------------------------------------------
            // PLAYER_ACTION
            // ----------------------------------------------------------
            else if (type == "PLAYER_ACTION") {
                if (sd.roomCode.empty()) return;
                Room* room = g_roomMgr.getRoom(sd.roomCode);
                if (!room || room->state != "playing") return;

                if (msg.contains("action")) {
                    GameAction action = sj::parseAction(msg["action"]);
                    action.playerId = sd.playerId; // trust server-side

                    // Validate
                    if (!rules::validateAction(room->gameState, action)) {
                        json e;
                        e["type"] = "ERROR";
                        e["code"] = "INVALID_ACTION";
                        e["message"] = "非法操作";
                        ws->send(e.dump(), uWS::OpCode::TEXT);
                        return;
                    }

                    // Resolve
                    auto followUps = resolver::resolveAction(room->gameState, action, room->rng);
                    for (auto& f : followUps)
                        room->gameState.eventQueue.push_back(std::move(f));
                    resolver::processFollowUps(room->gameState, room->rng);

                    // Broadcast updated state to each player
                    for (auto& [pid, ps] : room->players) {
                        auto actions = rules::getValidActions(room->gameState, pid);
                        json gsJson = sj::gameStateToJson(room->gameState);
                        gsJson["_viewerPlayerId"] = pid;
                        json gsMsg;
                        gsMsg["type"] = "GAME_STATE";
                        gsMsg["state"] = gsJson;
                        gsMsg["validActions"] = json::array();
                        for (auto& a : actions) {
                            json aj;
                            aj["type"] = a.type == ActionType::PlayCard ? "PLAY_CARD" :
                                         a.type == ActionType::EquipCard ? "EQUIP_CARD" :
                                         a.type == ActionType::DiscardCard ? "DISCARD_CARD" :
                                         a.type == ActionType::EndTurn ? "END_TURN" :
                                         a.type == ActionType::UseSkill ? "USE_SKILL" :
                                         a.type == ActionType::UseTaoSelf ? "USE_TAO_SELF" :
                                         a.type == ActionType::PassResponse ? "PASS_RESPONSE" :
                                         a.type == ActionType::Respond ? "RESPOND" : "UNKNOWN";
                            if (auto* pd = std::get_if<PlayCardData>(&a.data)) {
                                aj["cardId"] = pd->cardId;
                                aj["targetIds"] = pd->targetIds;
                            }
                            gsMsg["validActions"].push_back(aj);
                        }
                        gsMsg["deckCount"] = (int)room->gameState.deck.size();
                        gsMsg["discardCount"] = (int)room->gameState.discardPile.size();
                        room->sendToPlayer(pid, gsMsg);
                    }

                    // Check if game is finished
                    if (room->gameState.gamePhase == GamePhase::Finished) {
                        room->state = "finished";
                        json overMsg;
                        overMsg["type"] = "GAME_OVER";
                        overMsg["winner"] = room->gameState.winner.value_or("");
                        room->broadcast(overMsg);
                    }
                }
            }
            // ----------------------------------------------------------
            // LEAVE_ROOM
            // ----------------------------------------------------------
            else if (type == "LEAVE_ROOM") {
                if (sd.roomCode.empty()) return;
                std::string roomCode = sd.roomCode;
                std::string pid     = sd.playerId;

                Room* room = g_roomMgr.leaveRoom(roomCode, pid);
                sd.roomCode.clear();
                sd.playerId.clear();

                if (room) {
                    room->broadcast({{"type", "PLAYER_LEFT"},
                                     {"playerId", pid}});
                }
            }
            // ----------------------------------------------------------
            // PING  →  PONG
            // ----------------------------------------------------------
            else if (type == "PING") {
                ws->send(R"({"type":"PONG"})", uWS::OpCode::TEXT);
            }
        },

        // ---- close (disconnect) -------------------------------------
        .close = [](auto* ws, int /*code*/, std::string_view /*reason*/) {
            auto& sd = *ws->getUserData();
            if (sd.roomCode.empty()) return;

            std::string roomCode = sd.roomCode;
            std::string pid     = sd.playerId;

            std::cout << "[sanguosha] Player disconnected playerId="
                      << pid << " room=" << roomCode << "\n";

            Room* room = g_roomMgr.leaveRoom(roomCode, pid);
            sd.roomCode.clear();
            sd.playerId.clear();

            if (room) {
                room->broadcast({{"type", "PLAYER_LEFT"}, {"playerId", pid}});
            }
        }
    });

    // ================================================================
    // Bind & run
    // ================================================================
    app.listen(3001, [](auto* token) {
        if (token) {
            std::cout << "[sanguosha] listening on 0.0.0.0:3001\n";
        } else {
            std::cerr << "[sanguosha] FATAL — failed to listen on port 3001\n";
            std::exit(1);
        }
    });

    app.run();
    return 0;
}
