// 멍냥이의 버스여행 - 서버 연결 (Cloudflare): 단계 저장, 친구, 하트 선물, 폰 알림
// =====================================================================
//  계정은 가입 없이 기기마다 자동으로 만들어져요 (닉네임을 정하면).
//  친구 코드로 친구를 추가하고, 친구에게 6시간마다 하트 1개를 보낼 수 있어요.
// =====================================================================
const API = 'https://meow-bus-api.bbhtodo.workers.dev';
const VAPID_PUBLIC = 'BMBMyytakpUuVSzdzYb6B6A2MZs-Y1MiM-TyyUrbVza8ROCRuOSWtZRqmWKRnxk7CDxzEfevcfInudWMo35nGzI';
let acct = store.get('busGame.acct', null);      // { id, token, code }
let pendingGifts = 0;

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function api(path, data) {
  const opt = { method: data ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' } };
  if (acct) opt.headers.Authorization = 'Bearer ' + acct.token;
  if (data) opt.body = JSON.stringify(data);
  const r = await fetch(API + path, opt);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || String(r.status)), { status: r.status, data: j });
  return j;
}

async function ensureAccount() {
  if (acct) return acct;
  if (!nickname) return null;
  try {
    const r = await api('/register', { nickname, unlocked });
    acct = { id: r.id, token: r.token, code: r.code };
    store.set('busGame.acct', acct);
    saveAuthForSW();
    return acct;
  } catch (e) { return null; }
}

// ---- 단계·하트 저장 (조금 모아서 보내요) ----
let syncTimer = 0;
function syncSoon() { clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, 800); }
async function syncNow() {
  if (!(await ensureAccount())) return;
  try {
    refreshHearts();
    const r = await api('/sync', { nickname, unlocked, hearts: { n: hearts.n, t: hearts.t } });
    if (r.code && acct.code !== r.code) { acct.code = r.code; store.set('busGame.acct', acct); }
    if (r.unlocked > unlocked) {               // 다른 곳에서 더 많이 깼다면 이어서
      unlocked = r.unlocked; store.set('busGame.unlocked', unlocked);
      if (!S) renderMap();
    }
    setGiftBadge(r.gifts || 0);
    if (r.gifts > 0) checkGifts();
  } catch (e) {
    if (e.status === 401) { acct = null; store.set('busGame.acct', null); }
  }
}

function setGiftBadge(n) {
  pendingGifts = n;
  const b = $('friendsBtn');
  if (b) b.classList.toggle('hasDot', n > 0);
}

// ---- 하트 선물 받기 ----
let giftPopupOpen = false;
async function checkGifts() {
  if (giftPopupOpen) return;
  let list;
  try { list = (await api('/gifts')).gifts; } catch (e) { return; }
  if (!list.length) return;
  const names = [...new Set(list.map(g => g.nickname || '친구'))];
  if (S || $('overlay').classList.contains('show')) {      // 게임 중이면 살짝만 알려 주고, 지도에서 받아요
    toast(`💌 ${names[0]}님${names.length > 1 ? ' 외 ' + (names.length - 1) + '명' : ''}이 하트를 보냈어요!`, 2400);
    return;
  }
  giftPopupOpen = true;
  const card = $('card');
  card.innerHTML = `<h2>💌 하트 도착!</h2>
    <p><b>${names.map(esc).join(', ')}</b>님이 하트를 보냈어요!</p>
    <p><span class="heartNow">${HEART_SVG} × ${list.length}</span></p>
    <button class="btn" id="ovClaim">받기</button>`;
  card.querySelector('#ovClaim').onclick = async () => {
    try {
      const c = await api('/gifts/claim', {});
      refreshHearts();
      if (hearts.n >= HEART_MAX) hearts.t = Date.now();
      hearts.n += c.count;
      store.set('busGame.hearts', hearts);
      renderHearts();
      toast(`하트 ${c.count}개를 받았어요!`, 1800);
    } catch (e) { toast('다시 시도해 주세요'); }
    giftPopupOpen = false;
    setGiftBadge(0);
    hideOverlay();
    syncSoon();
  };
  $('overlay').classList.add('show');
}

// ---- 친구 창 ----
const fmtWait = ms => {
  const m = Math.max(0, Math.ceil(ms / 60000)), h = Math.floor(m / 60);
  return h ? `${h}시간 ${m % 60}분 뒤` : `${m}분 뒤`;
};
async function showFriends() {
  const card = $('card');
  const close = '<button class="btn alt" id="ovClose">닫기</button>';
  const bindClose = () => { const c = card.querySelector('#ovClose'); if (c) c.onclick = () => hideOverlay(); };
  card.innerHTML = '<h2>친구</h2><p>불러오는 중…</p>' + close; bindClose();
  $('overlay').classList.add('show');
  if (!nickname) { card.innerHTML = '<h2>친구</h2><p>먼저 닉네임을 정해 주세요.</p>' + close; bindClose(); return; }
  if (!(await ensureAccount())) { card.innerHTML = '<h2>친구</h2><p>인터넷 연결을 확인해 주세요.</p>' + close; bindClose(); return; }
  let list = [], diff = 0;
  try { const r = await api('/friends'); list = r.friends; diff = r.now - Date.now(); }
  catch (e) { card.innerHTML = '<h2>친구</h2><p>친구 목록을 불러오지 못했어요.</p>' + close; bindClose(); return; }
  const t = Date.now() + diff;
  card.innerHTML = `<h2>친구</h2>
    <p>내 친구 코드</p>
    <div class="codeRow"><b class="myCode">${esc(acct.code)}</b><button class="btn alt mini" id="copyCode">복사</button></div>
    <div class="codeRow"><input class="nickInput" id="friendCode" maxlength="9" placeholder="친구 코드 입력 (예: ABCD-EF23)"><button class="btn mini" id="addFriend">추가</button></div>
    <div class="friendList">${list.length ? list.map(f => {
      const wait = f.nextGiftAt && f.nextGiftAt > t;
      return `<div class="friendRow"><span>${esc(f.nickname || '친구')} <small>${f.unlocked}단계</small></span>
        <button class="btn mini ${wait ? 'alt' : ''}" data-id="${esc(f.id)}" ${wait ? 'disabled' : ''}>${wait ? fmtWait(f.nextGiftAt - t) : '💌 하트 보내기'}</button></div>`;
    }).join('') : '<p><small>아직 친구가 없어요. 친구 코드를 서로 알려 주세요!</small></p>'}</div>
    <p><small>친구에게 6시간마다 하트 1개를 보낼 수 있어요</small></p>
    ${close}`;
  bindClose();
  card.querySelector('#copyCode').onclick = async () => {
    try { await navigator.clipboard.writeText(acct.code); toast('친구 코드를 복사했어요'); }
    catch (e) { toast(acct.code); }
  };
  card.querySelector('#addFriend').onclick = async () => {
    const code = card.querySelector('#friendCode').value.trim();
    if (!code) { toast('친구 코드를 적어 주세요'); return; }
    try { const r = await api('/friends/add', { code }); toast(`${r.friend.nickname || '친구'}님과 친구가 되었어요! 🐾`, 2000); showFriends(); }
    catch (e) { toast(e.message && e.message.length < 40 ? e.message : '친구를 추가하지 못했어요', 2000); }
  };
  card.querySelectorAll('.friendRow button[data-id]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    try { await api('/gift', { to: b.dataset.id }); toast('하트를 보냈어요! 💌', 1800); showFriends(); }
    catch (e) { toast(e.status === 429 ? '아직 보낼 수 없어요' : '보내지 못했어요', 1800); showFriends(); }
  });
}

// ---- 폰 알림 (웹 푸시) ----
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const pushOn = () => pushSupported() && Notification.permission === 'granted' && store.get('busGame.push', false);
const b64uToU8 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
// 서비스 워커가 메시지함을 열 수 있도록 열쇠를 넘겨줘요
async function saveAuthForSW() {
  if (!acct || !('caches' in window)) return;
  try {
    const c = await caches.open('meow');
    await c.put(new URL('__meow_auth', location.href).href, new Response(JSON.stringify({ token: acct.token, api: API })));
  } catch (e) { /* 무시 */ }
}
async function enablePush() {
  if (!pushSupported()) { toast('이 브라우저는 폰 알림을 지원하지 않아요', 2400); return false; }
  if (!(await ensureAccount())) { toast('인터넷 연결을 확인해 주세요'); return false; }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { toast('알림이 허용되지 않았어요', 2000); return false; }
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToU8(VAPID_PUBLIC) });
    await saveAuthForSW();
    await api('/push', { subscription: sub.toJSON() });
    store.set('busGame.push', true);
    toast('폰 알림을 켰어요 🔔', 1800);
    return true;
  } catch (e) { toast('알림을 켜지 못했어요', 2000); return false; }
}
async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
    await api('/push', { subscription: null });
  } catch (e) { /* 무시 */ }
  store.set('busGame.push', false);
}

// ---- 시작할 때와 주기적으로 맞춰요 ----
const PEOPLE_SVG = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><g stroke="#4a3b2c" stroke-width="1.5" stroke-linejoin="round">
  <circle cx="9" cy="9" r="3.4" fill="#f3a9c1"/><path d="M3 19.5 C3 15.5 5.7 13.6 9 13.6 C12.3 13.6 15 15.5 15 19.5Z" fill="#f3a9c1"/>
  <circle cx="16.2" cy="8.2" r="2.8" fill="#8dbbe0"/><path d="M14.5 13 C17.8 12.6 21 14.4 21 18.5 H16" fill="#8dbbe0"/></g></svg>`;
$('friendsBtn').innerHTML = PEOPLE_SVG + '<span class="dot"></span>';
$('friendsBtn').onclick = () => showFriends();
if (acct) saveAuthForSW();
if (pushOn()) navigator.serviceWorker.register('sw.js').catch(() => {});
setTimeout(syncNow, 1500);
setInterval(syncNow, 2 * 60 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });
