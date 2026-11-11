// 멍냥이의 버스여행 서버 (Cloudflare Worker + D1)
//   - 단계·하트 저장, 친구 코드로 친구 추가, 6시간마다 하트 선물
//   - 하트를 받으면 / 하트가 가득 차면 폰 웹 푸시 알림
// 푸시는 내용(payload) 없이 "깨우기"만 보내고, 폰의 서비스 워커가 /inbox에서 메시지를 받아 보여 줘요.
// (그래서 복잡한 암호화 없이 VAPID 서명만 하면 돼요)

const HEART_MAX = 5;
const HEART_MS = 10 * 60 * 1000;      // 하트 1개 충전 시간
const GIFT_MS = 6 * 60 * 60 * 1000;   // 친구에게 하트를 보낼 수 있는 간격

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS } });

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
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url), path = url.pathname;
    try {
      const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
      if (path === '/' ) return json({ ok: true, name: 'meow-bus-api' });
      if (path === '/register' && req.method === 'POST') return register(env, body);

      const user = await auth(req, env);
      if (!user) return json({ error: 'unauthorized' }, 401);

      if (path === '/me') return json(publicMe(user));
      if (path === '/sync' && req.method === 'POST') return sync(env, user, body);
      if (path === '/friends' && req.method === 'GET') return listFriends(env, user);
      if (path === '/friends/add' && req.method === 'POST') return addFriend(env, ctx, user, body);
      if (path === '/gift' && req.method === 'POST') return gift(env, ctx, user, body);
      if (path === '/gifts' && req.method === 'GET') return listGifts(env, user);
      if (path === '/gifts/claim' && req.method === 'POST') return claimGifts(env, user);
      if (path === '/push' && req.method === 'POST') return savePush(env, user, body);
      if (path === '/inbox') return inbox(env, user);
      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: String((e && e.message) || e) }, 500);
    }
  },

  // 5분마다: 하트가 가득 찬 사람에게 알림
  async scheduled(event, env, ctx) {
    ctx.waitUntil(notifyFullHearts(env));
  },
};

async function auth(req, env) {
  const h = req.headers.get('Authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
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

async function sync(env, user, body) {
  const nickname = body.nickname !== undefined ? cleanName(body.nickname) : user.nickname;
  const unlocked = Math.min(100, Math.max(user.unlocked, body.unlocked | 0));
  let { hearts, hearts_t, full_at, full_notified } = user;
  if (body.hearts && Number.isFinite(body.hearts.n) && Number.isFinite(body.hearts.t)) {
    hearts = Math.max(0, Math.min(99, body.hearts.n | 0));
    hearts_t = Math.floor(body.hearts.t);
    const newFull = hearts >= HEART_MAX ? 0 : hearts_t + (HEART_MAX - hearts) * HEART_MS;
    if (newFull !== full_at) { full_at = newFull; full_notified = newFull ? 0 : 1; }
  }
  await env.DB.prepare('UPDATE users SET nickname = ?, unlocked = ?, hearts = ?, hearts_t = ?, full_at = ?, full_notified = ? WHERE id = ?')
    .bind(nickname, unlocked, hearts, hearts_t, full_at, full_notified, user.id).run();
  const g = await env.DB.prepare('SELECT COUNT(*) AS c FROM gifts WHERE to_id = ? AND claimed = 0').bind(user.id).first();
  return json({ unlocked, gifts: g ? g.c : 0, code: user.code });
}

async function listFriends(env, user) {
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.nickname, u.unlocked, f.last_gift FROM friends f JOIN users u ON u.id = f.b WHERE f.a = ? ORDER BY u.nickname`)
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
  const sub = body.subscription && body.subscription.endpoint ? JSON.stringify(body.subscription) : null;
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
