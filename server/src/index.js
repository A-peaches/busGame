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
    const res = await handle(req, env, ctx);
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
    return res;
  },

  // 5분마다: 하트가 가득 찬 사람에게 알림 + 여행 알림
  async scheduled(event, env, ctx) {
    ctx.waitUntil(notifyFullHearts(env).then(() => remindTravelers(env)).then(() => cleanUp(env)));
  },
};

async function handle(req, env, ctx) {
  {
    const url = new URL(req.url), path = url.pathname;
    try {
      const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
      if (path === '/' ) return json({ ok: true, name: 'meow-bus-api' });
      if (path === '/register' && req.method === 'POST') {
        if (await tooMany(env, 'reg:' + ipOf(req), 20, 3600000)) return slowDown();      // 한 시간에 20개까지
        return register(env, body);
      }
      if (path === '/restore' && req.method === 'POST') {
        if (await tooMany(env, 'rst:' + ipOf(req), 10, 3600000)) return slowDown();      // 한 시간에 10번까지
        return restore(env, body);
      }

      const user = await auth(req, env);
      if (!user) return json({ error: 'unauthorized' }, 401);

      if (path === '/me') return json(publicMe(user));
      if (path === '/sync' && req.method === 'POST') return sync(env, user, body);
      if (path === '/friends' && req.method === 'GET') return listFriends(env, user);
      if (path === '/friends/add' && req.method === 'POST') {
        if (await tooMany(env, 'add:' + user.id, 20, 3600000)) return slowDown();         // 한 시간에 20번까지
        return addFriend(env, ctx, user, body);
      }
      if (path === '/gift' && req.method === 'POST') return gift(env, ctx, user, body);
      if (path === '/gifts' && req.method === 'GET') return listGifts(env, user);
      if (path === '/gifts/claim' && req.method === 'POST') return claimGifts(env, user);
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

async function register(env, body) {
  const id = hex(8), token = hex(24), nickname = cleanName(body.nickname);
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

async function sync(env, user, body) {
  const nickname = body.nickname !== undefined ? cleanName(body.nickname) : user.nickname;
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
  const g = await env.DB.prepare('SELECT COUNT(*) AS c FROM gifts WHERE to_id = ? AND claimed = 0').bind(user.id).first();
  const l = await env.DB.prepare('SELECT COUNT(*) AS c FROM letters WHERE to_id = ? AND read = 0').bind(user.id).first();
  return json({ unlocked, gifts: g ? g.c : 0, letters: l ? l.c : 0, code: user.code });
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
       SELECT 'heart' AS kind, g.from_id, g.to_id, '' AS body, g.at, 1 AS read FROM gifts g WHERE g.to_id = ?1 OR g.from_id = ?1
       UNION ALL
       SELECT 'letter' AS kind, l.from_id, l.to_id, l.body, l.at, l.read FROM letters l WHERE l.to_id = ?1 OR l.from_id = ?1
     ) m ORDER BY m.at DESC LIMIT 80`).bind(user.id).all();
  const ids = [...new Set(results.flatMap(r => [r.from_id, r.to_id]))];
  const names = {};
  if (ids.length) {
    const q = await env.DB.prepare(`SELECT id, nickname FROM users WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
    for (const u of q.results) names[u.id] = u.nickname;
  }
  return json({ mail: results.map(r => {
    const mine = r.from_id === user.id, other = mine ? r.to_id : r.from_id;
    return { kind: r.kind, dir: mine ? 'out' : 'in', friendId: other, nickname: names[other] || '친구', body: r.body, at: r.at, unread: !mine && !r.read };
  }), now: now() });
}
async function readMail(env, user) {
  await env.DB.prepare('UPDATE letters SET read = 1 WHERE to_id = ? AND read = 0').bind(user.id).run();
  return json({ ok: true });
}

async function listFriends(env, user) {
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.nickname, u.unlocked, f.last_gift FROM friends f JOIN users u ON u.id = f.b WHERE f.a = ? ORDER BY u.unlocked DESC, u.nickname`)
    .bind(user.id).all();
  return json({ friends: results.map(r => ({ id: r.id, nickname: r.nickname, unlocked: r.unlocked, nextGiftAt: r.last_gift ? r.last_gift + GIFT_MS : 0 })), now: now() });
}

async function addFriend(env, ctx, user, body) {
  const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 8) return json({ error: '친구 코드를 확인해 주세요' }, 400);
  const other = await env.DB.prepare('SELECT * FROM users WHERE code = ?').bind(code.slice(0, 4) + '-' + code.slice(4)).first();
  if (!other) return json({ error: '그 코드를 가진 친구를 찾을 수 없어요' }, 404);
  if (other.id === user.id) return json({ error: '내 코드예요' }, 400);
  const t = now();
  await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO friends (a, b, created) VALUES (?, ?, ?)').bind(user.id, other.id, t),
    env.DB.prepare('INSERT OR IGNORE INTO friends (a, b, created) VALUES (?, ?, ?)').bind(other.id, user.id, t),
  ]);
  ctx.waitUntil(notify(env, other, '🐾 새 친구', `${user.nickname || '누군가'}님과 친구가 되었어요!`));
  return json({ ok: true, friend: { id: other.id, nickname: other.nickname, unlocked: other.unlocked } });
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

async function claimGifts(env, user) {
  const { results } = await env.DB.prepare(
    `SELECT g.id, u.nickname FROM gifts g LEFT JOIN users u ON u.id = g.from_id WHERE g.to_id = ? AND g.claimed = 0`).bind(user.id).all();
  if (!results.length) return json({ count: 0, from: [] });
  await env.DB.prepare('UPDATE gifts SET claimed = 1 WHERE to_id = ? AND claimed = 0').bind(user.id).run();
  return json({ count: results.length, from: results.map(r => r.nickname || '친구') });
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
