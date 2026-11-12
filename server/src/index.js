// 멍냥이의 버스여행 서버 (Cloudflare Worker + D1)
//   - 단계·하트 저장, 친구 코드로 친구 추가, 6시간마다 하트 선물
//   - 하트를 받으면 / 하트가 가득 차면 폰 웹 푸시 알림
// 푸시는 내용(payload) 없이 "깨우기"만 보내고, 폰의 서비스 워커가 /inbox에서 메시지를 받아 보여 줘요.
// (그래서 복잡한 암호화 없이 VAPID 서명만 하면 돼요)

const HEART_MAX = 5;
const HEART_MS = 10 * 60 * 1000;      // 하트 1개 충전 시간
const GIFT_MS = 6 * 60 * 60 * 1000;   // 친구에게 하트를 보낼 수 있는 간격

// ---- 보안 ----
// 1) 모든 개인 데이터는 기기마다 받은 비밀 열쇠(토큰, 192비트 무작위)가 있어야만 읽고 쓸 수 있어요.
//    주소(URL)만 알아서는 아무것도 못 가져가고, 열쇠가 있어도 "자기 것"만 보여요.
// 2) 게임 화면이 있는 주소에서만 브라우저가 이 서버를 부를 수 있게 해요 (다른 웹사이트에서 몰래 부르기 차단).
// 3) 계정 만들기·백업 불러오기·친구 추가는 너무 많이 두드리면 잠깐 막아요 (무차별 대입·도배 방지).
const ALLOWED_ORIGINS = ['https://meowbus.bbhtodo.workers.dev', 'https://a-peaches.github.io', 'http://127.0.0.1:8080', 'http://localhost:8080'];
const corsFor = req => {
  const o = req.headers.get('Origin') || '';
  return {
    ...(ALLOWED_ORIGINS.includes(o) ? { 'Access-Control-Allow-Origin': o, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
};
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

// 같은 사람(또는 같은 인터넷 주소)이 짧은 시간에 너무 많이 시도하면 막아요
async function tooMany(env, key, max, windowMs) {
  const t = now();
  const row = await env.DB.prepare(
    `INSERT INTO throttle (key, n, reset) VALUES (?1, 1, ?2)
     ON CONFLICT(key) DO UPDATE SET n = CASE WHEN reset < ?3 THEN 1 ELSE n + 1 END, reset = CASE WHEN reset < ?3 THEN ?2 ELSE reset END
     RETURNING n`).bind(key, t + windowMs, t).first();
  return row && row.n > max;
}
const ipOf = req => req.headers.get('CF-Connecting-IP') || 'unknown';
const slowDown = () => json({ error: '잠시 후에 다시 시도해 주세요' }, 429);

const hex = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(b => b.toString(16).padStart(2, '0')).join(''); };
const CODE_CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // 헷갈리는 0/O, 1/I 는 빼요
const newCode = () => {
  const a = new Uint8Array(8); crypto.getRandomValues(a);
  const s = [...a].map(b => CODE_CH[b % CODE_CH.length]).join('');
  return s.slice(0, 4) + '-' + s.slice(4);
};
const cleanName = s => String(s || '').trim().slice(0, 10);
const now = () => Date.now();

export default {
  // 요청마다 그 요청의 주소에 맞는 CORS 머리글을 붙여요 (요청끼리 섞이지 않게)
  async fetch(req, env, ctx) {
    const cors = corsFor(req);
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    let res;
    try { res = await handle(req, env, ctx); }
    catch (e) {                                            // 어디서 생긴 오류든 여기서 잡아요 (내용은 숨기고)
      console.log('error', new URL(req.url).pathname, e && e.stack || e);
      res = json({ error: '서버에 문제가 생겼어요' }, 500);
    }
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
    return res;
  },

  // 5분마다: 하트가 가득 찬 사람에게 알림 + 여행 알림
  async scheduled(event, env, ctx) {
    ctx.waitUntil(notifyFullHearts(env).then(() => remindTravelers(env)).then(() => notifyReplies(env)).then(() => cleanUp(env)));
  },
};

async function handle(req, env, ctx) {
  {
    const url = new URL(req.url), path = url.pathname;
    try {
      const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
      if (path === '/' ) return json({ ok: true, name: 'meow-bus-api' });
      if (path === '/notices' && req.method === 'GET') {                                  // 공지사항 (누구나 볼 수 있어요)
        const { results } = await env.DB.prepare('SELECT id, at, title, body FROM notices ORDER BY id DESC LIMIT 30').all();
        return json({ notices: results });
      }
      if (path === '/nick/check' && req.method === 'GET') {                              // 닉네임 쓸 수 있는지 (중복 막기)
        if (await tooMany(env, 'nick:' + ipOf(req), 120, 3600000)) return slowDown();
        const me = await auth(req, env);
        const name = cleanName(url.searchParams.get('name'));
        return json({ ok: !!name && !(await nickTaken(env, name, me && me.id)) });
      }
      if (path === '/register' && req.method === 'POST') {
        if (await tooMany(env, 'reg:' + ipOf(req), 20, 3600000)) return slowDown();      // 한 시간에 20개까지
        return register(env, body);
      }
      if (path === '/log' && req.method === 'POST') {                                     // 게임 오류 기록 (개인정보 없이)
        if (await tooMany(env, 'log:' + ipOf(req), 30, 3600000)) return json({ ok: true });
        const cut = (v, n) => String(v == null ? '' : v).slice(0, n);
        await env.DB.prepare('INSERT INTO errors (at, ver, level, msg, stack, ua) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(now(), cut(body.ver, 10), body.level | 0, cut(body.msg, 300), cut(body.stack, 1200), cut(body.ua, 160)).run();
        return json({ ok: true });
      }
      if (path === '/restore' && req.method === 'POST') {
        if (await tooMany(env, 'rst:' + ipOf(req), 10, 3600000)) return slowDown();      // 한 시간에 10번까지
        return restore(env, body);
      }

      const user = await auth(req, env);
      if (!user) return json({ error: 'unauthorized' }, 401);
      // 접속 중 표시: 1분에 한 번만 마지막 접속 시각을 새로 적어요
      // (폰 알림을 받을 때 서비스 워커가 부르는 /inbox는 접속이 아니에요)
      if (path !== '/inbox' && now() - (user.last_seen || 0) > 60000) {
        user.last_seen = now();
        ctx.waitUntil(env.DB.prepare('UPDATE users SET last_seen = ? WHERE id = ?').bind(user.last_seen, user.id).run());
      }

      if (path === '/me') return json(publicMe(user));
      if (path === '/sync' && req.method === 'POST') return sync(env, user, body, ctx);
      if (path === '/friends' && req.method === 'GET') return listFriends(env, user);
      if (path === '/friends/add' && req.method === 'POST') {
        if (await tooMany(env, 'add:' + user.id, 20, 3600000)) return slowDown();         // 한 시간에 20번까지
        return addFriend(env, ctx, user, body);
      }
      if (path === '/friends/remove' && req.method === 'POST') return removeFriend(env, user, body);
      if (path === '/users/search' && req.method === 'GET') {
        if (await tooMany(env, 'srch:' + user.id, 60, 3600000)) return slowDown();        // 한 시간에 60번까지
        return searchUsers(env, user, url.searchParams.get('q'));
      }
      if (path === '/friends/request' && req.method === 'POST') {
        if (await tooMany(env, 'req:' + user.id, 30, 3600000)) return slowDown();         // 한 시간에 30번까지
        return requestFriend(env, ctx, user, body);
      }
      if (path === '/friends/respond' && req.method === 'POST') return respondFriend(env, ctx, user, body);
      if (path === '/inquiry' && req.method === 'POST') {
        if (await tooMany(env, 'inq:' + user.id, 5, 3600000)) return json({ error: '문의는 한 시간에 5번까지 보낼 수 있어요' }, 429);
        return sendInquiry(env, user, body);
      }
      if (path === '/inquiry' && req.method === 'GET') return myInquiries(env, user);
      if (path === '/chat' && req.method === 'GET') return listChat(env, user, +url.searchParams.get('after') || 0);
      if (path === '/chat' && req.method === 'POST') {
        if (await tooMany(env, 'chat1:' + user.id, 1, 2000)) return json({ error: '조금 천천히 보내 주세요' }, 429);   // 2초에 1번
        if (await tooMany(env, 'chat5:' + user.id, 20, 300000)) return json({ error: '잠시 쉬었다가 보내 주세요' }, 429); // 5분에 20번
        return sendChat(env, user, body);
      }
      if (path === '/gift' && req.method === 'POST') return gift(env, ctx, user, body);
      if (path === '/gifts' && req.method === 'GET') return listGifts(env, user);
      if (path === '/gifts/claim' && req.method === 'POST') return claimGifts(env, user, body);
      if (path === '/push' && req.method === 'POST') return savePush(env, user, body);
      if (path === '/inbox') return inbox(env, user);
      if (path === '/backup' && req.method === 'POST') return makeBackup(env, user);
      if (path === '/letter' && req.method === 'POST') return sendLetter(env, ctx, user, body);
      if (path === '/mail' && req.method === 'GET') return listMail(env, user);
      if (path === '/mail/read' && req.method === 'POST') return readMail(env, user);
      return json({ error: 'not found' }, 404);
    } catch (e) {
      console.log('error', path, e && e.stack || e);      // 자세한 내용은 서버 기록에만 남기고
      return json({ error: '서버에 문제가 생겼어요' }, 500);   // 밖으로는 알려 주지 않아요
    }
  }
}

async function auth(req, env) {
  const h = req.headers.get('Authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!/^[0-9a-f]{48}$/.test(token)) return null;      // 열쇠 모양이 아니면 DB를 찾아보지도 않아요
  return env.DB.prepare('SELECT * FROM users WHERE token = ?').bind(token).first();
}
const publicMe = u => ({ id: u.id, code: u.code, nickname: u.nickname, unlocked: u.unlocked });

// 같은 닉네임은 한 사람만 (대소문자 구분 없이). selfId 는 내 계정이라 빼고 봐요
async function nickTaken(env, name, selfId) {
  if (!name) return false;
  return !!(await env.DB.prepare("SELECT 1 FROM users WHERE lower(nickname) = lower(?) AND id != ? LIMIT 1").bind(name, selfId || '').first());
}
async function register(env, body) {
  const id = hex(8), token = hex(24), nickname = cleanName(body.nickname);
  if (await nickTaken(env, nickname)) return json({ error: '이미 있는 닉네임이에요', taken: true }, 409);
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    try {
      await env.DB.prepare('INSERT INTO users (id, token, code, nickname, unlocked, created) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(id, token, code, nickname, Math.max(1, body.unlocked | 0), now()).run();
      return json({ id, token, code, nickname });
    } catch (e) { /* 친구 코드가 겹치면 다시 만들어요 */ }
  }
  return json({ error: 'try again' }, 500);
}

// ---- 백업 코드: 개인정보 없이 다른 기기에서 이어하기 ----
// 서버에는 코드 자체가 아니라 SHA-256 해시만 저장해요 (서버를 봐도 코드를 알 수 없어요)
const sha256 = async s => b64u(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
const normBackup = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
async function makeBackup(env, user) {
  const a = new Uint8Array(12); crypto.getRandomValues(a);
  const raw = [...a].map(b => CODE_CH[b % CODE_CH.length]).join('');
  await env.DB.prepare('UPDATE users SET backup_hash = ? WHERE id = ?').bind(await sha256(raw), user.id).run();
  return json({ backup: raw.slice(0, 4) + '-' + raw.slice(4, 8) + '-' + raw.slice(8) });
}
async function restore(env, body) {
  const raw = normBackup(body.code);
  if (raw.length !== 12) return json({ error: '백업 코드를 확인해 주세요' }, 400);
  const u = await env.DB.prepare('SELECT * FROM users WHERE backup_hash = ?').bind(await sha256(raw)).first();
  if (!u) return json({ error: '그 백업 코드를 찾을 수 없어요' }, 404);
  return json({ id: u.id, token: u.token, code: u.code, nickname: u.nickname, unlocked: u.unlocked, hearts: { n: u.hearts, t: u.hearts_t } });
}

async function sync(env, user, body, ctx) {
  let nickname = body.nickname !== undefined ? cleanName(body.nickname) : user.nickname;
  let nickTakenNow = false;
  if (nickname !== user.nickname && await nickTaken(env, nickname, user.id)) { nickname = user.nickname; nickTakenNow = true; }   // 이미 있는 닉네임이면 바꾸지 않아요
  const unlocked = Math.min(100, user.unlocked + 5, Math.max(user.unlocked, body.unlocked | 0));   // 한 번에 5단계 넘게 뛰지 않게
  let { hearts, hearts_t, full_at, full_notified } = user;
  if (body.hearts && Number.isFinite(body.hearts.n) && Number.isFinite(body.hearts.t)) {
    hearts = Math.max(0, Math.min(99, body.hearts.n | 0));
    hearts_t = Math.floor(body.hearts.t);
    const newFull = hearts >= HEART_MAX ? 0 : hearts_t + (HEART_MAX - hearts) * HEART_MS;
    if (newFull !== full_at) { full_at = newFull; full_notified = newFull ? 0 : 1; }
  }
  await env.DB.prepare('UPDATE users SET nickname = ?, unlocked = ?, hearts = ?, hearts_t = ?, full_at = ?, full_notified = ?, last_seen = ? WHERE id = ?')
    .bind(nickname, unlocked, hearts, hearts_t, full_at, full_notified, now(), user.id).run();
  // 친구를 따라잡거나 앞질렀으면 그 친구에게 알려 줘요 (이번에 넘어선 친구만)
  if (unlocked > user.unlocked && ctx) ctx.waitUntil(tellCaughtUp(env, user, nickname, user.unlocked, unlocked));
  const g = await env.DB.prepare('SELECT COUNT(*) AS c FROM gifts WHERE to_id = ? AND claimed = 0').bind(user.id).first();
  const l = await env.DB.prepare('SELECT COUNT(*) AS c FROM letters WHERE to_id = ? AND read = 0').bind(user.id).first();
  const fr = await env.DB.prepare('SELECT COUNT(*) AS c FROM friend_requests WHERE to_id = ?').bind(user.id).first();
  return json({ unlocked, gifts: g ? g.c : 0, letters: l ? l.c : 0, requests: fr ? fr.c : 0, code: user.code, nickname, nickTaken: nickTakenNow });
}

// 내가 old → cur 단계가 되면서 넘어선 친구들에게 알림: 같은 단계가 되면 '따라잡았어요', 더 앞서면 '앞질렀어요'
//   (같은 단계에 있던 친구를 한 단계 앞서 나가도 '앞질렀어요')
async function tellCaughtUp(env, user, nickname, old, cur) {
  const { results } = await env.DB.prepare(
    `SELECT u.* FROM friends f JOIN users u ON u.id = f.b WHERE f.a = ? AND u.unlocked >= ? AND u.unlocked <= ? LIMIT 20`)
    .bind(user.id, old, cur).all();
  const who = nickname || '친구';
  for (const u of results) {
    if (cur > u.unlocked) await notify(env, u, '🏃 친구가 앞질렀어요!', `${who}님이 나를 앞질러 ${cur}단계에 도착했어요. 다시 따라잡아 볼까요?`);
    else await notify(env, u, '🐾 친구가 따라잡았어요!', `${who}님이 나와 같은 ${cur}단계에 왔어요. 질 수 없죠!`);
  }
}

// ---- 우편함: 하트를 주고받은 기록 + 친구 쪽지 ----
const LETTER_MAX = 80;            // 쪽지 글자 수
const LETTER_PER_DAY = 30;        // 하루에 보낼 수 있는 쪽지 수 (장난 방지)
async function sendLetter(env, ctx, user, body) {
  const to = String(body.to || '');
  const text = String(body.text || '').replace(/\s+/g, ' ').trim().slice(0, LETTER_MAX);
  if (!text) return json({ error: '쪽지 내용을 적어 주세요' }, 400);
  const f = await env.DB.prepare('SELECT 1 FROM friends WHERE a = ? AND b = ?').bind(user.id, to).first();
  if (!f) return json({ error: '친구가 아니에요' }, 400);
  const day = await env.DB.prepare('SELECT COUNT(*) AS c FROM letters WHERE from_id = ? AND at > ?').bind(user.id, now() - 86400000).first();
  if (day && day.c >= LETTER_PER_DAY) return json({ error: '오늘은 쪽지를 너무 많이 보냈어요' }, 429);
  await env.DB.prepare('INSERT INTO letters (from_id, to_id, body, at) VALUES (?, ?, ?, ?)').bind(user.id, to, text, now()).run();
  const other = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(to).first();
  if (other) ctx.waitUntil(notify(env, other, `✉️ ${user.nickname || '친구'}님의 쪽지`, text));
  return json({ ok: true });
}
async function listMail(env, user) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM (
       SELECT 'heart' AS kind, g.id, g.from_id, g.to_id, '' AS body, g.at, g.claimed AS read FROM gifts g WHERE g.to_id = ?1 OR g.from_id = ?1
       UNION ALL
       SELECT 'letter' AS kind, l.id, l.from_id, l.to_id, l.body, l.at, l.read FROM letters l WHERE l.to_id = ?1 OR l.from_id = ?1
     ) m ORDER BY m.at DESC LIMIT 80`).bind(user.id).all();
  const ids = [...new Set(results.flatMap(r => [r.from_id, r.to_id]))];
  const names = {};
  if (ids.length) {
    const q = await env.DB.prepare(`SELECT id, nickname FROM users WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
    for (const u of q.results) names[u.id] = u.nickname;
  }
  return json({ mail: results.map(r => {
    const mine = r.from_id === user.id, other = mine ? r.to_id : r.from_id;
    const m = { kind: r.kind, dir: mine ? 'out' : 'in', friendId: other, nickname: names[other] || '친구', body: r.body, at: r.at, unread: !mine && !r.read };
    if (r.kind === 'heart' && !mine && !r.read) m.giftId = r.id;     // 아직 안 받은 하트: 우편함에서 [받기]
    return m;
  }), now: now() });
}
async function readMail(env, user) {
  await env.DB.prepare('UPDATE letters SET read = 1 WHERE to_id = ? AND read = 0').bind(user.id).run();
  return json({ ok: true });
}

async function listFriends(env, user) {
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.nickname, u.unlocked, u.last_seen, f.last_gift FROM friends f JOIN users u ON u.id = f.b WHERE f.a = ? ORDER BY u.unlocked DESC, u.nickname`)
    .bind(user.id).all();
  const rq = await env.DB.prepare(
    `SELECT u.id, u.nickname, u.unlocked, r.at FROM friend_requests r JOIN users u ON u.id = r.from_id WHERE r.to_id = ? ORDER BY r.at DESC LIMIT 30`)
    .bind(user.id).all();
  return json({
    friends: results.map(r => ({ id: r.id, nickname: r.nickname, unlocked: r.unlocked, lastSeen: r.last_seen || 0, nextGiftAt: r.last_gift ? r.last_gift + GIFT_MS : 0 })),
    requests: rq.results.map(r => ({ id: r.id, nickname: r.nickname, unlocked: r.unlocked, at: r.at })),
    now: now(),
  });
}

async function addFriend(env, ctx, user, body) {
  const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 8) return json({ error: '친구 코드를 확인해 주세요' }, 400);
  const other = await env.DB.prepare('SELECT * FROM users WHERE code = ?').bind(code.slice(0, 4) + '-' + code.slice(4)).first();
  if (!other) return json({ error: '그 코드를 가진 친구를 찾을 수 없어요' }, 404);
  if (other.id === user.id) return json({ error: '내 코드예요' }, 400);
  // 둘 중 누구라도 차단했으면 친구가 될 수 없어요 (누가 차단했는지는 알려 주지 않아요)
  const blocked = await env.DB.prepare('SELECT 1 FROM blocks WHERE (a = ?1 AND b = ?2) OR (a = ?2 AND b = ?1)').bind(user.id, other.id).first();
  if (blocked) return json({ error: '친구를 추가할 수 없어요' }, 400);
  const t = now();
  await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO friends (a, b, created) VALUES (?, ?, ?)').bind(user.id, other.id, t),
    env.DB.prepare('INSERT OR IGNORE INTO friends (a, b, created) VALUES (?, ?, ?)').bind(other.id, user.id, t),
  ]);
  ctx.waitUntil(notify(env, other, '🐾 새 친구', `${user.nickname || '누군가'}님과 친구가 되었어요!`));
  return json({ ok: true, friend: { id: other.id, nickname: other.nickname, unlocked: other.unlocked } });
}

// ---- 닉네임으로 친구 찾기 → 친구 요청 → 상대가 수락하면 친구 ----
async function searchUsers(env, user, q) {
  q = cleanName(q);
  if (!q) return json({ users: [] });
  const like = '%' + q.replace(/[!%_]/g, c => '!' + c) + '%';     // %, _ 는 글자 그대로 찾아요 (! 로 표시)
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.nickname, u.unlocked,
       EXISTS(SELECT 1 FROM friends f WHERE f.a = ?1 AND f.b = u.id) AS friend,
       EXISTS(SELECT 1 FROM friend_requests r WHERE r.from_id = ?1 AND r.to_id = u.id) AS sent
     FROM users u
     WHERE u.nickname LIKE ?2 ESCAPE '!' AND u.id != ?1 AND u.nickname != ''
       AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.a = ?1 AND b.b = u.id) OR (b.a = u.id AND b.b = ?1))
     ORDER BY (u.nickname = ?3) DESC, u.last_seen DESC LIMIT 15`).bind(user.id, like, q).all();
  return json({ users: results.map(r => ({ id: r.id, nickname: r.nickname, unlocked: r.unlocked, friend: !!r.friend, sent: !!r.sent })) });
}
async function makeFriends(env, a, b) {
  const t = now();
  await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO friends (a, b, created) VALUES (?, ?, ?)').bind(a, b, t),
    env.DB.prepare('INSERT OR IGNORE INTO friends (a, b, created) VALUES (?, ?, ?)').bind(b, a, t),
    env.DB.prepare('DELETE FROM friend_requests WHERE (from_id = ?1 AND to_id = ?2) OR (from_id = ?2 AND to_id = ?1)').bind(a, b),
  ]);
}
async function requestFriend(env, ctx, user, body) {
  const id = String(body.id || '');
  if (!/^[0-9a-f]{16}$/.test(id) || id === user.id) return json({ error: '잘못된 요청이에요' }, 400);
  const other = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!other) return json({ error: '그 친구를 찾을 수 없어요' }, 404);
  const blocked = await env.DB.prepare('SELECT 1 FROM blocks WHERE (a = ?1 AND b = ?2) OR (a = ?2 AND b = ?1)').bind(user.id, id).first();
  if (blocked) return json({ error: '친구 요청을 보낼 수 없어요' }, 400);
  if (await env.DB.prepare('SELECT 1 FROM friends WHERE a = ? AND b = ?').bind(user.id, id).first()) return json({ ok: true, friend: true });
  // 상대가 이미 나에게 요청했다면 바로 친구가 돼요
  if (await env.DB.prepare('SELECT 1 FROM friend_requests WHERE from_id = ? AND to_id = ?').bind(id, user.id).first()) {
    await makeFriends(env, user.id, id);
    ctx.waitUntil(notify(env, other, '🐾 새 친구', `${user.nickname || '누군가'}님과 친구가 되었어요!`));
    return json({ ok: true, friend: true });
  }
  const r = await env.DB.prepare('INSERT OR IGNORE INTO friend_requests (from_id, to_id, at) VALUES (?, ?, ?)').bind(user.id, id, now()).run();
  if (r.meta && r.meta.changes) ctx.waitUntil(notify(env, other, '🐾 친구 요청', `${user.nickname || '누군가'}님이 친구가 되고 싶어 해요`));
  return json({ ok: true, sent: true });
}
async function respondFriend(env, ctx, user, body) {
  const id = String(body.id || '');
  const rq = await env.DB.prepare('SELECT 1 FROM friend_requests WHERE from_id = ? AND to_id = ?').bind(id, user.id).first();
  if (!rq) return json({ error: '요청을 찾을 수 없어요' }, 404);
  if (body.accept) {
    await makeFriends(env, user.id, id);
    const other = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
    if (other) ctx.waitUntil(notify(env, other, '🐾 새 친구', `${user.nickname || '누군가'}님이 친구 요청을 받아 주었어요!`));
  } else {
    await env.DB.prepare('DELETE FROM friend_requests WHERE from_id = ? AND to_id = ?').bind(id, user.id).run();
  }
  return json({ ok: true });
}

// ---- 개발자에게 문의하기 (개발자가 읽고 답을 달아요. 답이 달리면 폰 알림) ----
async function sendInquiry(env, user, body) {
  const text = String(body.text || '').trim().slice(0, 1000);
  if (text.length < 2) return json({ error: '문의 내용을 적어 주세요' }, 400);
  const cut = (v, n) => String(v == null ? '' : v).slice(0, n);
  await env.DB.prepare('INSERT INTO inquiries (at, user_id, nickname, body, ver, ua) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(now(), user.id, user.nickname || '', text, cut(body.ver, 10), cut(body.ua, 160)).run();
  return json({ ok: true });
}
async function myInquiries(env, user) {
  const { results } = await env.DB.prepare('SELECT id, at, body, reply, replied_at FROM inquiries WHERE user_id = ? ORDER BY id DESC LIMIT 20').bind(user.id).all();
  return json({ inquiries: results });
}

// 개발자가 답을 달면(status = 'replied') 문의한 사람에게 폰 알림을 보내요
async function notifyReplies(env) {
  const { results } = await env.DB.prepare(
    `SELECT q.id, u.* FROM inquiries q JOIN users u ON u.id = q.user_id WHERE q.status = 'replied' LIMIT 50`).all();
  for (const r of results) {
    await env.DB.prepare("UPDATE inquiries SET status = 'notified' WHERE id = ?").bind(r.id).run();
    await notify(env, r, '💬 문의에 답이 왔어요', '공지사항 → 내 문의에서 확인해 보세요');
  }
}

// ---- 전체 채팅 (모두가 보는 짧은 말, 사흘 뒤 지워져요) ----
const CHAT_MAX = 100;
async function listChat(env, user, after) {
  const q = after > 0
    ? env.DB.prepare(`SELECT id, user_id, nickname, body, at FROM chat WHERE id > ?1
        AND user_id NOT IN (SELECT b FROM blocks WHERE a = ?2) ORDER BY id ASC LIMIT 50`).bind(after, user.id)
    : env.DB.prepare(`SELECT * FROM (SELECT id, user_id, nickname, body, at FROM chat
        WHERE user_id NOT IN (SELECT b FROM blocks WHERE a = ?1) ORDER BY id DESC LIMIT 50) ORDER BY id ASC`).bind(user.id);
  const { results } = await q.all();
  // 닉네임 옆에 지금 단계, 전체 1·2·3위에게는 금·은·동 메달 (같은 단계면 먼저 시작한 사람이 앞)
  const ids = [...new Set(results.map(r => r.user_id))];
  const lv = {};
  if (ids.length) {
    const u = await env.DB.prepare(`SELECT id, unlocked FROM users WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
    for (const x of u.results) lv[x.id] = x.unlocked;
  }
  const top = (await env.DB.prepare("SELECT id FROM users WHERE nickname != '' ORDER BY unlocked DESC, created ASC LIMIT 3").all()).results.map(x => x.id);
  return json({ messages: results.map(r => ({ id: r.id, nickname: r.nickname, body: r.body, at: r.at, mine: r.user_id === user.id,
    level: lv[r.user_id] || 0, medal: top.indexOf(r.user_id) + 1 })), now: now() });
}
async function sendChat(env, user, body) {
  const text = String(body.text || '').replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX);
  if (!text) return json({ error: '내용을 적어 주세요' }, 400);
  if (!user.nickname) return json({ error: '닉네임을 먼저 정해 주세요' }, 400);
  const r = await env.DB.prepare('INSERT INTO chat (user_id, nickname, body, at) VALUES (?, ?, ?, ?) RETURNING id')
    .bind(user.id, user.nickname, text, now()).first();
  return json({ ok: true, id: r && r.id });
}

// 친구 삭제(양쪽 다 끊어요) / 차단(삭제 + 다시 친구가 될 수 없게)
async function removeFriend(env, user, body) {
  const id = String(body.id || '');
  if (!/^[0-9a-f]{16}$/.test(id)) return json({ error: '잘못된 요청이에요' }, 400);
  const q = [
    env.DB.prepare('DELETE FROM friends WHERE (a = ?1 AND b = ?2) OR (a = ?2 AND b = ?1)').bind(user.id, id),
  ];
  q.push(env.DB.prepare('DELETE FROM friend_requests WHERE (from_id = ?1 AND to_id = ?2) OR (from_id = ?2 AND to_id = ?1)').bind(user.id, id));
  if (body.block) q.push(env.DB.prepare('INSERT OR IGNORE INTO blocks (a, b, created) VALUES (?, ?, ?)').bind(user.id, id, now()));
  await env.DB.batch(q);
  return json({ ok: true });
}

async function gift(env, ctx, user, body) {
  const to = String(body.to || '');
  const f = await env.DB.prepare('SELECT * FROM friends WHERE a = ? AND b = ?').bind(user.id, to).first();
  if (!f) return json({ error: '친구가 아니에요' }, 400);
  const t = now();
  if (f.last_gift && t < f.last_gift + GIFT_MS) return json({ error: 'wait', nextGiftAt: f.last_gift + GIFT_MS }, 429);
  await env.DB.batch([
    env.DB.prepare('UPDATE friends SET last_gift = ? WHERE a = ? AND b = ?').bind(t, user.id, to),
    env.DB.prepare('INSERT INTO gifts (from_id, to_id, at) VALUES (?, ?, ?)').bind(user.id, to, t),
  ]);
  const other = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(to).first();
  if (other) ctx.waitUntil(notify(env, other, '💌 하트 도착!', `${user.nickname || '친구'}님이 하트를 보냈어요!`));
  return json({ ok: true, nextGiftAt: t + GIFT_MS });
}

async function listGifts(env, user) {
  const { results } = await env.DB.prepare(
    `SELECT g.id, g.at, u.nickname FROM gifts g LEFT JOIN users u ON u.id = g.from_id WHERE g.to_id = ? AND g.claimed = 0 ORDER BY g.at`)
    .bind(user.id).all();
  return json({ gifts: results });
}

// 하트 받기: id 를 주면 그 하트 하나만, 없으면 모두. (내 앞으로 온 것만, 한 번만 받을 수 있어요)
async function claimGifts(env, user, body) {
  const one = Number.isInteger(body && body.id) ? body.id : null;
  const r = one !== null
    ? await env.DB.prepare('UPDATE gifts SET claimed = 1 WHERE id = ? AND to_id = ? AND claimed = 0').bind(one, user.id).run()
    : await env.DB.prepare('UPDATE gifts SET claimed = 1 WHERE to_id = ? AND claimed = 0').bind(user.id).run();
  return json({ count: (r.meta && r.meta.changes) || 0 });
}

async function savePush(env, user, body) {
  // 진짜 브라우저 푸시 서버 주소(https)만 받아요 (다른 곳으로 요청을 보내게 하는 장난 방지)
  const s = body.subscription;
  let ok = false;
  try { ok = !!(s && s.endpoint && new URL(s.endpoint).protocol === 'https:' && String(s.endpoint).length < 1000); } catch (e) { ok = false; }
  const sub = ok ? JSON.stringify({ endpoint: s.endpoint, expirationTime: s.expirationTime || null, keys: s.keys || {} }) : null;
  await env.DB.prepare('UPDATE users SET push = ? WHERE id = ?').bind(sub, user.id).run();
  return json({ ok: true, enabled: !!sub });
}

// 서비스 워커가 푸시를 받으면 여기서 보여 줄 메시지를 가져가요
async function inbox(env, user) {
  const { results } = await env.DB.prepare('SELECT id, title, body, at FROM notes WHERE user_id = ? AND seen = 0 ORDER BY at DESC LIMIT 5')
    .bind(user.id).all();
  await env.DB.prepare('UPDATE notes SET seen = 1 WHERE user_id = ? AND seen = 0').bind(user.id).run();
  return json({ notes: results });
}

async function notifyFullHearts(env) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM users WHERE full_notified = 0 AND full_at > 0 AND full_at <= ? LIMIT 200').bind(now()).all();
  for (const u of results) {
    await env.DB.prepare('UPDATE users SET full_notified = 1 WHERE id = ?').bind(u.id).run();
    await notify(env, u, '❤️ 하트가 가득 찼어요', '멍냥이들이 정류장에서 기다리고 있어요. 버스를 출발시켜 볼까요?');
  }
}

// 남길 필요 없는 기록은 지워요: 이미 보여 준 알림(쪽지 내용 복사본 포함)은 7일 뒤, 지난 횟수 제한 기록은 바로
async function cleanUp(env) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM notes WHERE seen = 1 AND at < ?').bind(now() - 7 * DAY),
    env.DB.prepare('DELETE FROM throttle WHERE reset < ?').bind(now()),
    env.DB.prepare('DELETE FROM chat WHERE at < ?').bind(now() - 3 * DAY),
    env.DB.prepare('DELETE FROM errors WHERE at < ?').bind(now() - 14 * DAY),
  ]);
}

// ---- 여행 알림: 하루 넘게 안 온 사람에게, 낮 시간(한국 11~20시)에 하루 한 번만 ----
const REMIND = [
  ['🐱 멍냥이들이 기다려요!', '정류장에 멍냥이들이 줄을 섰어요. 버스를 출발시켜 주세요 🚌'],
  ['🐶 오늘도 여행 가요!', '멍멍! 냥냥! 멍냥이들의 여행을 도와주세요 🐾'],
  ['🚌 버스가 시동을 걸었어요', '부릉부릉~ 멍냥이들이 태워 주기를 기다리고 있어요 🐱🐶'],
  ['🐾 정류장이 북적북적해요', '꼬리를 살랑살랑 흔들며 기다리는 중이에요. 잠깐 들러 주실래요?'],
  ['🌼 멍냥이들의 여행 시간', '오늘은 몇 단계까지 갈 수 있을까요? 멍냥이들이 응원해요 🐶🐱'],
];
const DAY = 86400000;
async function remindTravelers(env) {
  const kstHour = new Date(now() + 9 * 3600000).getUTCHours();
  if (kstHour < 11 || kstHour >= 20) return;
  const t = now();
  const { results } = await env.DB.prepare(
    `SELECT * FROM users WHERE push IS NOT NULL AND last_seen < ? AND reminded_at < ? LIMIT 100`).bind(t - DAY * 0.8, t - DAY).all();
  for (const u of results) {
    await env.DB.prepare('UPDATE users SET reminded_at = ? WHERE id = ?').bind(t, u.id).run();
    const [title, body] = REMIND[Math.floor(Math.random() * REMIND.length)];
    await notify(env, u, title, body);
  }
}

// 메시지함에 넣고, 푸시로 폰을 깨워요
async function notify(env, user, title, body) {
  await env.DB.prepare('INSERT INTO notes (user_id, title, body, at) VALUES (?, ?, ?, ?)').bind(user.id, title, body, now()).run();
  if (!user.push) return;
  try {
    const sub = JSON.parse(user.push);
    const jwt = await vapidJWT(env, new URL(sub.endpoint).origin);
    const r = await fetch(sub.endpoint, {
      method: 'POST',
      headers: { TTL: '86400', Urgency: 'high', Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC}` },
    });
    if (r.status === 404 || r.status === 410) {      // 구독이 만료됐으면 지워요
      await env.DB.prepare('UPDATE users SET push = NULL WHERE id = ?').bind(user.id).run();
    }
  } catch (e) { /* 알림 실패는 게임에 영향 없게 */ }
}

// ---- VAPID 서명 (ES256 JWT) ----
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
let signKey = null;
async function vapidJWT(env, aud) {
  if (!signKey) {
    const pub = fromB64u(env.VAPID_PUBLIC);           // 0x04 | x(32) | y(32)
    signKey = await crypto.subtle.importKey('jwk', {
      kty: 'EC', crv: 'P-256', x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), d: env.VAPID_PRIVATE, ext: true,
    }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  }
  const enc = o => b64u(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = enc({ typ: 'JWT', alg: 'ES256' }) + '.' + enc({ aud, exp: Math.floor(now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT });
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signKey, new TextEncoder().encode(unsigned));
  return unsigned + '.' + b64u(sig);
}
