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
    setMailBadge(r.letters || 0);
    if (r.gifts > 0) checkGifts();
  } catch (e) {
    if (e.status === 401) { acct = null; store.set('busGame.acct', null); }
  }
}

function setMailBadge(n) {
  const b = $('mailBtn');
  if (b) b.classList.toggle('hasDot', n > 0);
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

// ---- 트로피 (1등 금, 2등 은, 3등 동) ----
const trophy = i => {
  const [c, d] = [['#f2c35a', '#c99a2e'], ['#d9dde2', '#9aa3ad'], ['#e2a77a', '#b07447']][i];
  return `<svg viewBox="0 0 20 20" width="18" height="18" aria-label="${i + 1}등"><g stroke="#5a4e44" stroke-width="1" stroke-linejoin="round">
    <path d="M5.5 3.5 H14.5 V7.5 C14.5 10.5 12.5 12 10 12 C7.5 12 5.5 10.5 5.5 7.5Z" fill="${c}"/>
    <path d="M5.5 5 H3 C3 8 4.5 9 6 9 M14.5 5 H17 C17 8 15.5 9 14 9" fill="none"/>
    <path d="M8.6 12 H11.4 V14.5 H8.6Z" fill="${d}"/><path d="M6.5 14.5 H13.5 V17 H6.5Z" fill="${c}"/></g></svg>`;
};

// ---- 쪽지 쓰기 (대화가 아니라 우편함으로 가는 짧은 쪽지) ----
function writeLetter(id, name, back) {
  const card = $('card');
  card.innerHTML = `<h2>✉️ ${esc(name)}님에게 쪽지</h2>
    <textarea class="letterBox" id="letterText" maxlength="80" placeholder="짧은 쪽지를 적어 주세요"></textarea>
    <div class="letterCount"><span id="letterN">0</span> / 80</div>
    <button class="btn" id="letterSend">보내기</button>
    <button class="btn alt" id="ovBack">돌아가기</button>`;
  const ta = card.querySelector('#letterText');
  ta.oninput = () => card.querySelector('#letterN').textContent = ta.value.length;
  card.querySelector('#ovBack').onclick = () => back();
  card.querySelector('#letterSend').onclick = async e => {
    const text = ta.value.trim();
    if (!text) { toast('쪽지 내용을 적어 주세요'); return; }
    e.target.disabled = true;
    try { await api('/letter', { to: id, text }); toast('쪽지를 보냈어요! ✉️', 1800); back(); }
    catch (err) { e.target.disabled = false; toast(err.message && err.message.length < 40 ? err.message : '보내지 못했어요', 2000); }
  };
  $('overlay').classList.add('show');
  setTimeout(() => ta.focus(), 50);
}

// ---- 우편함: 하트를 주고받은 기록 + 쪽지 ----
const MAIL_TITLE = '<span style="display:inline-flex;align-items:center;gap:6px"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><g stroke="#4a3b2c" stroke-width="1.5" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2.5" fill="#fbf3e2"/><path d="M3.8 7 L12 13.2 L20.2 7" fill="none"/></g></svg>우편함</span>';
const fmtAgo = ms => {
  const m = Math.floor(ms / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
};
async function showMail() {
  const card = $('card');
  const close = '<button class="btn alt" id="ovClose">닫기</button>';
  const bindClose = () => { const c = card.querySelector('#ovClose'); if (c) c.onclick = () => hideOverlay(); };
  card.innerHTML = '<h2>' + MAIL_TITLE + '</h2><p>불러오는 중…</p>' + close; bindClose();
  $('overlay').classList.add('show');
  if (!nickname || !(await ensureAccount())) { card.innerHTML = '<h2>' + MAIL_TITLE + '</h2><p>먼저 닉네임을 정하고 인터넷에 연결해 주세요.</p>' + close; bindClose(); return; }
  let r;
  try { r = await api('/mail'); } catch (e) { card.innerHTML = '<h2>' + MAIL_TITLE + '</h2><p>우편함을 불러오지 못했어요.</p>' + close; bindClose(); return; }
  const t = r.now;
  card.innerHTML = `<h2>${MAIL_TITLE}</h2>
    <div class="mailList">${r.mail.length ? r.mail.map(m => {
      const who = `<b>${esc(m.nickname)}</b>님`;
      const what = m.kind === 'heart'
        ? (m.dir === 'in' ? `${who}이 하트를 보냈어요` : `${who}에게 하트를 보냈어요`)
        : (m.dir === 'in' ? `${who}의 쪽지` : `${who}에게 보낸 쪽지`);
      const reply = m.kind === 'letter' && m.dir === 'in'
        ? `<button class="btn alt mini" data-reply="${esc(m.friendId)}" data-name="${esc(m.nickname)}">답장</button>` : '';
      return `<div class="mailRow${m.unread ? ' unread' : ''}"><span class="mi">${m.kind === 'heart' ? HEART_SVG : '✉️'}</span>
        <span class="mb">${what} <small>· ${fmtAgo(t - m.at)}</small>${m.kind === 'letter' ? `<span class="letter">${esc(m.body)}</span>` : ''}</span>${reply}</div>`;
    }).join('') : '<p><small>아직 주고받은 하트나 쪽지가 없어요.</small></p>'}</div>
    <p><small>친구 창에서 하트와 쪽지를 보낼 수 있어요</small></p>
    ${close}`;
  bindClose();
  card.querySelectorAll('button[data-reply]').forEach(b => b.onclick = () => writeLetter(b.dataset.reply, b.dataset.name, showMail));
  if (r.mail.some(m => m.unread)) { api('/mail/read', {}).catch(() => {}); setMailBadge(0); }
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
  // 많이 깬 순서대로 (나도 함께), 1·2·3등은 트로피
  const ranked = [...list, { me: true, unlocked }].sort((a, b) => b.unlocked - a.unlocked);
  card.innerHTML = `<h2>친구</h2>
    <p>내 친구 코드</p>
    <div class="codeRow"><b class="myCode">${esc(acct.code)}</b><button class="btn alt mini" id="copyCode">복사</button></div>
    <div class="codeRow"><input class="nickInput" id="friendCode" maxlength="9" placeholder="친구 코드 입력 (예: ABCD-EF23)"><button class="btn mini" id="addFriend">추가</button></div>
    <div class="friendList">${list.length ? ranked.map((f, i) => {
      const rank = `<span class="rank">${i < 3 ? trophy(i) : i + 1}</span>`;
      if (f.me) return `<div class="friendRow me"><span>${rank}${esc(nickname)} <small>나 · ${unlocked}단계</small></span></div>`;
      const wait = f.nextGiftAt && f.nextGiftAt > t;
      return `<div class="friendRow"><span>${rank}${esc(f.nickname || '친구')} <small>${f.unlocked}단계</small></span>
        <span class="friendBtns"><button class="btn mini ${wait ? 'alt' : ''}" data-id="${esc(f.id)}" ${wait ? 'disabled' : ''}>${wait ? fmtWait(f.nextGiftAt - t) : '💌 하트'}</button>
        <button class="btn alt mini" data-letter="${esc(f.id)}" data-name="${esc(f.nickname || '친구')}">✉️ 쪽지</button></span></div>`;
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
  card.querySelectorAll('.friendRow button[data-letter]').forEach(b => b.onclick = () => writeLetter(b.dataset.letter, b.dataset.name, showFriends));
  card.querySelectorAll('.friendRow button[data-id]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    try { await api('/gift', { to: b.dataset.id }); toast('하트를 보냈어요! 💌', 1800); showFriends(); }
    catch (e) { toast(e.status === 429 ? '아직 보낼 수 없어요' : '보내지 못했어요', 1800); showFriends(); }
  });
}

// ---- 폰 알림 (웹 푸시) ----
// 설치한 앱(멍냥버스 APK) 안에서 열렸는지: 앱은 알림 권한을 크롬과 따로, 폰 설정에서 관리해요
const IN_APP = (() => {
  try {
    if (document.referrer.startsWith('android-app://')) sessionStorage.setItem('meowApp', '1');
    return sessionStorage.getItem('meowApp') === '1' || matchMedia('(display-mode: standalone)').matches;
  } catch (e) { return false; }
})();
// 알림이 막혀 있을 때: 어디서 켜는지 알려 드려요 (웹은 폰 설정을 직접 바꿀 수 없어요)
function showPushBlocked() {
  const card = $('card');
  card.innerHTML = `<h2>🔔 알림이 꺼져 있어요</h2>
    <p>${IN_APP
      ? '폰의 <b>설정 → 애플리케이션 → 멍냥버스 → 알림</b>을<br>켜 주세요. 켠 뒤 앱을 다시 열면 연결돼요.'
      : '크롬 주소창 왼쪽 <b>자물쇠(또는 설정) 아이콘 → 권한 → 알림</b>을<br>허용으로 바꿔 주세요.'}</p>
    <p><small>하트 도착 · 쪽지 · 하트 가득 · 여행 알림을 받을 수 있어요</small></p>
    <button class="btn" id="ovClose">알겠어요</button>`;
  card.querySelector('#ovClose').onclick = () => hideOverlay();
  $('overlay').classList.add('show');
}
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
// 실제로 알림이 연결돼 있는지 확인해요 (권한 + 구독). 권한만 있고 구독이 없으면 조용히 다시 연결해요.
// 알림이 안 켜질 때 이유를 남겨 설정 화면에 보여 줘요 (어디서 막히는지 알 수 있게)
let pushWhy = '';
const setWhy = s => { pushWhy = s; try { store.set('busGame.pushWhy', s); } catch (e) { /* 무시 */ } };
const errText = e => (e && (e.name || '') + (e.message ? ': ' + e.message : '')) || String(e);
// 서비스 워커가 켜질 때까지 기다려요 (영원히 멈추지 않게 10초 제한)
async function swReady() {
  const reg = await navigator.serviceWorker.register('sw.js');
  if (reg.active) return reg;
  await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, no) => setTimeout(() => no(new Error('서비스 워커 준비 시간 초과')), 10000)),
  ]);
  return reg;
}
async function pushState() {
  if (!pushSupported()) { setWhy('이 브라우저는 웹 알림을 지원하지 않아요'); return false; }
  if (Notification.permission !== 'granted') { setWhy('알림 권한: ' + ({ default: '아직 안 정함', denied: '차단됨' }[Notification.permission] || Notification.permission)); return false; }
  try {
    const reg = await swReady();
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      store.set('busGame.push', true);
      if (await ensureAccount()) { await saveAuthForSW(); api('/push', { subscription: sub.toJSON() }).catch(e => setWhy('서버 저장 실패 · ' + errText(e))); }
      setWhy('');
      return true;
    }
  } catch (e) { setWhy('확인 실패 · ' + errText(e)); }
  return enablePush(undefined, true);
}
async function enablePush(permP, silent) {
  if (!pushSupported()) { toast('이 브라우저는 폰 알림을 지원하지 않아요', 2400); return false; }
  if (Notification.permission === 'denied') { setWhy('알림 권한: 차단됨'); if (!silent) showPushBlocked(); return false; }
  // 권한은 먼저(버튼을 누른 순간) 물어보고, 계정은 그다음에 만들어요
  permP = permP || Notification.requestPermission();
  if (!(await ensureAccount())) { setWhy('계정 연결 실패 (인터넷 확인)'); toast('인터넷 연결을 확인해 주세요'); return false; }
  const perm = await permP;
  if (perm !== 'granted') { setWhy('알림 권한: ' + perm); if (perm === 'denied') showPushBlocked(); else toast('알림이 허용되지 않았어요', 2000); return false; }
  let step = '서비스 워커';
  try {
    const reg = await swReady();
    step = '구독';
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToU8(VAPID_PUBLIC) });
    step = '서버 저장';
    await saveAuthForSW();
    await api('/push', { subscription: sub.toJSON() });
    store.set('busGame.push', true);
    setWhy('');
    if (!silent) toast('폰 알림을 켰어요 🔔', 1800);
    return true;
  } catch (e) {
    setWhy(step + ' 실패 · ' + errText(e));
    if (!silent) toast('알림을 켜지 못했어요', 2000);
    return false;
  }
}
// 알림 동의를 꼭 받아요: 아직 정하지 않았으면 시작할 때마다 물어보고, 허용돼 있으면 조용히 연결해요
function askPushIfNeeded() {
  if (!nickname || !pushSupported()) return;
  const p = Notification.permission;
  if (p === 'granted') { pushState(); return; }     // 허용돼 있으면 구독을 확인하고 서버와 다시 맞춰요
  if ($('overlay').classList.contains('show')) return;
  if (p === 'denied') {                          // 막혀 있으면 사흘에 한 번 켜는 방법을 알려 드려요
    if (Date.now() - store.get('busGame.blockedTip', 0) > 3 * 86400000) { store.set('busGame.blockedTip', Date.now()); showPushBlocked(); }
    return;
  }
  if (p !== 'default') return;
  const card = $('card');
  card.innerHTML = `<h2>🔔 알림을 켜 주세요</h2>
    <p>친구가 <b>하트</b>나 <b>쪽지</b>를 보냈을 때,<br>하트가 <b>가득 찼을 때</b> 알려 드려요.</p>
    <button class="btn" id="pushYes">알림 허용하기</button>
    <button class="btn alt" id="pushLater">나중에</button>`;
  card.querySelector('#pushYes').onclick = () => { const pp = Notification.requestPermission(); hideOverlay(); enablePush(pp); };
  card.querySelector('#pushLater').onclick = () => hideOverlay();
  $('overlay').classList.add('show');
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

// ---- 백업 코드: 개인정보 없이 다른 기기에서 이어 하기 ----
async function showBackup() {
  const card = $('card');
  const back = '<button class="btn alt" id="ovBack">설정으로</button>';
  const bindBack = () => card.querySelector('#ovBack').onclick = () => showSettings();
  if (!nickname) { card.innerHTML = '<h2>백업 코드</h2><p>먼저 닉네임을 정해 주세요.</p>' + back; bindBack(); return; }
  card.innerHTML = `<h2>백업 코드 만들기</h2>
    <p>새 기기에서 이 코드를 넣으면 단계·하트·친구를 그대로 불러올 수 있어요.</p>
    <p><small>새로 만들면 <b>예전 백업 코드는 더 이상 쓸 수 없어요.</b></small></p>
    <button class="btn" id="mkBackup">코드 만들기</button>${back}`;
  bindBack();
  card.querySelector('#mkBackup').onclick = async () => {
    if (!(await ensureAccount())) { toast('인터넷 연결을 확인해 주세요'); return; }
    let r;
    try { await syncNow(); r = await api('/backup', {}); } catch (e) { toast('코드를 만들지 못했어요', 2000); return; }
    card.innerHTML = `<h2>내 백업 코드</h2>
      <div class="backupCode">${esc(r.backup)}</div>
      <p><small>캡처하거나 메모해 두세요. 이 코드는 다시 보여 드릴 수 없어요.<br>코드를 아는 사람은 누구나 불러올 수 있으니 다른 사람에게 알려 주지 마세요.</small></p>
      <button class="btn" id="cpBackup">복사하기</button>${back}`;
    bindBack();
    card.querySelector('#cpBackup').onclick = async () => {
      try { await navigator.clipboard.writeText(r.backup); toast('백업 코드를 복사했어요'); } catch (e) { toast(r.backup, 3000); }
    };
  };
}
function showRestore(first) {
  const card = $('card');
  card.innerHTML = `<h2>백업 코드로 불러오기</h2>
    <p>다른 기기에서 만든 백업 코드를 넣어 주세요.${first ? '' : '<br><small>지금 이 기기의 기록은 불러온 기록으로 바뀌어요.</small>'}</p>
    <input class="nickInput" id="bkInput" maxlength="14" placeholder="XXXX-XXXX-XXXX" autocapitalize="characters" autocomplete="off">
    ${first ? `<div class="consent">
      <div class="setRow"><span>📍 내 위치 날씨 보기<br><small>날씨를 불러올 때만 쓰고 저장하지 않아요</small></span><label class="switch"><input type="checkbox" id="geoOk" checked><span></span></label></div>
      ${pushSupported() ? `<p class="pushNote"><small>🔔 하트 도착·하트 가득·쪽지 알림을 받으려면<br>다음 화면에서 <b>알림 허용</b>을 눌러 주세요</small></p>` : ''}
    </div>` : ''}
    <button class="btn" id="bkOk">불러오기</button>
    <button class="btn alt" id="ovBack">${first ? '돌아가기' : '설정으로'}</button>`;
  const inp = card.querySelector('#bkInput');
  card.querySelector('#ovBack').onclick = () => first ? showNickname(true) : showSettings();
  const go = async () => {
    const code = inp.value.trim();
    if (!code) { toast('백업 코드를 적어 주세요'); return; }
    // 알림 권한은 버튼을 누른 순간에만 물어볼 수 있어서 처음 기기라면 지금 같이 물어봐요
    const geoC = card.querySelector('#geoOk');
    const permP = pushSupported() && Notification.permission === 'default' ? Notification.requestPermission() : null;
    let r;
    try { r = await api('/restore', { code }); }
    catch (e) { toast(e.message && e.message.length < 40 ? e.message : '불러오지 못했어요', 2200); return; }
    acct = { id: r.id, token: r.token, code: r.code };
    store.set('busGame.acct', acct);
    nickname = r.nickname || nickname || '멍냥';
    store.set('busGame.nickname', nickname);
    unlocked = Math.max(1, r.unlocked | 0);
    store.set('busGame.unlocked', unlocked);
    if (r.hearts) { hearts.n = r.hearts.n; hearts.t = r.hearts.t || Date.now(); refreshHearts(); store.set('busGame.hearts', hearts); }
    await saveAuthForSW();
    updateHello(); renderHearts(); renderMap();
    hideOverlay();
    toast(`${nickname}님, 다시 만나서 반가워요! 🐾`, 2200);
    if (first) { store.set('busGame.geo', geoC && geoC.checked ? 'yes' : 'no'); startWeather(); }
    // 알림을 쓰던 기기라면 새 계정으로 다시 연결해요
    if (permP || (pushSupported() && Notification.permission === 'granted')) enablePush(permP || undefined);
    syncSoon();
  };
  card.querySelector('#bkOk').onclick = go;
  inp.onkeydown = e => { if (e.key === 'Enter') go(); };
  $('overlay').classList.add('show');
  setTimeout(() => inp.focus(), 50);
}

// ---- 시작할 때와 주기적으로 맞춰요 ----
const PEOPLE_SVG = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><g stroke="#4a3b2c" stroke-width="1.5" stroke-linejoin="round">
  <circle cx="9" cy="9" r="3.4" fill="#f3a9c1"/><path d="M3 19.5 C3 15.5 5.7 13.6 9 13.6 C12.3 13.6 15 15.5 15 19.5Z" fill="#f3a9c1"/>
  <circle cx="16.2" cy="8.2" r="2.8" fill="#8dbbe0"/><path d="M14.5 13 C17.8 12.6 21 14.4 21 18.5 H16" fill="#8dbbe0"/></g></svg>`;
$('friendsBtn').innerHTML = PEOPLE_SVG + '<span class="dot"></span>';
$('friendsBtn').onclick = () => showFriends();
const MAIL_SVG = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><g stroke="#4a3b2c" stroke-width="1.5" stroke-linejoin="round">
  <rect x="3" y="6" width="18" height="13" rx="2.5" fill="#fbf3e2"/><path d="M3.8 7 L12 13.2 L20.2 7" fill="none"/>
  <path d="M12 13.2 C10.6 11.6 9.4 12.2 9.6 13.3 C9.8 14.4 12 15.8 12 15.8 C12 15.8 14.2 14.4 14.4 13.3 C14.6 12.2 13.4 11.6 12 13.2Z" fill="#e8768e" stroke-width="1"/></g></svg>`;
$('mailBtn').innerHTML = MAIL_SVG + '<span class="dot"></span>';
$('mailBtn').onclick = () => showMail();
if (acct) saveAuthForSW();
// 서비스 워커는 늘 등록해요 (폰 알림 + 앱처럼 설치하기)
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
setTimeout(syncNow, 1500);
setInterval(syncNow, 2 * 60 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });
