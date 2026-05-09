// Test game flow through tunnel
const WS_URL = 'wss://fruity-humans-invite.loca.lt';

function connect(label) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.onopen = () => { console.log(`[${label}] connected`); resolve(ws); };
    ws.onerror = (e) => { console.log(`[${label}] ERROR:`, e.message || e); reject(e); };
    ws.onclose = (e) => { console.log(`[${label}] CLOSED:`, e.code, e.reason); };
  });
}

function send(ws, msg) {
  ws.send(JSON.stringify(msg));
}

async function main() {
  console.log('=== Tunnel test ===\n');

  // Create room
  const ws1 = await connect('HOST');
  send(ws1, { type: 'CREATE_ROOM', playerName: 'Alice', playerCount: 2 });
  let roomCode = '';
  ws1.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    console.log('[HOST] RECV:', m.type);
    if (m.type === 'ROOM_CREATED') roomCode = m.roomCode;
  };
  await new Promise(r => setTimeout(r, 500));
  console.log('Room:', roomCode);
  if (!roomCode) { console.log('FAIL - no room created'); process.exit(1); }

  // Join room
  const ws2 = await connect('JOIN');
  send(ws2, { type: 'JOIN_ROOM', roomCode, playerName: 'Bob' });
  ws2.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    console.log('[JOIN] RECV:', m.type);
    if (m.type === 'GAME_STATE') console.log('  phase:', m.state.gamePhase, 'deck:', m.deckCount);
  };
  await new Promise(r => setTimeout(r, 500));

  // Start game
  console.log('--- Starting ---');
  send(ws1, { type: 'START_GAME' });
  let gotState = false;
  ws2.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.type === 'GAME_STATE') gotState = true;
  };
  await new Promise(r => setTimeout(r, 2000));

  console.log(gotState ? '\nTunnel: PASS' : '\nTunnel: FAIL (WS upgrade may not be supported)');
  ws1.close(); ws2.close();
  process.exit(gotState ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
