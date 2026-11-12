// 멍냥이의 버스여행 - 서버 연결 (Cloudflare): 단계 저장, 친구, 하트 선물, 폰 알림
// =====================================================================
//  계정은 가입 없이 기기마다 자동으로 만들어져요 (닉네임을 정하면).
//  닉네임으로 친구를 찾아 요청하고, 친구에게 6시간마다 하트 1개를 보낼 수 있어요. 전체 채팅도 있어요.
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

// 닉네임을 쓸 수 있는지 서버에 물어봐요 (인터넷이 안 되면 일단 통과, 서버가 다시 막아요)
async function nickAvailable(name) {
  try { return (await api('/nick/check?name=' + encodeURIComponent(name))).ok; } catch (e) { return e.status === 429 ? false : true; }
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
  } catch (e) {
    if (e.status === 409) {                       // 그사이 다른 사람이 같은 닉네임을 썼어요 → 다시 정해 달라고
      nickname = ''; store.set('busGame.nickname', '');
      if (typeof updateHello === 'function') updateHello();
      toast('이미 있는 닉네임이에요. 다른 닉네임을 정해 주세요', 2400);
      if (typeof showNickname === 'function') showNickname(true);
    }
    return null;
  }
}

// ---- 단계·하트 저장 (조금 모아서 보내요) ----
let syncTimer = 0;
function syncSoon() { clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, 800); }
// 동시에 여러 번 불려도(앱으로 돌아오기 + 주기 확인 등) 한 번만 실행해요 → 하트 알림이 두 번 뜨지 않게
let syncing = null;
function syncNow() {
  if (!syncing) syncing = syncOnce().finally(() => { syncing = null; });
  return syncing;
}
async function syncOnce() {
  if (!(await ensureAccount())) return;
  try {
    refreshHearts();
    const r = await api('/sync', { nickname, unlocked, hearts: { n: hearts.n, t: hearts.t } });
    if (r.code && acct.code !== r.code) { acct.code = r.code; store.set('busGame.acct', acct); }
    if (r.nickTaken && r.nickname) {               // 바꾸려던 닉네임이 이미 있어서 서버가 원래 닉네임을 지켰어요
      nickname = r.nickname; store.set('busGame.nickname', nickname); updateHello();
      toast('이미 있는 닉네임이라 바꾸지 못했어요', 2400);
    }
    if (r.unlocked > unlocked) {               // 다른 곳에서 더 많이 깼다면 이어서
      unlocked = r.unlocked; store.set('busGame.unlocked', unlocked);
      if (!S) renderMap();
    }
    setMailBadge((r.gifts || 0) + (r.letters || 0));   // 안 받은 하트 + 안 읽은 쪽지 → 우편함에 N
    setFriendBadge(r.requests || 0);                   // 받은 친구 요청 → 친구 버튼에 빨간 점
    if (!S) refreshFriendMarks();                      // 지도 위 친구 이름표 (2분에 한 번)
  } catch (e) {
    if (e.status === 401) { acct = null; store.set('busGame.acct', null); }
  }
}

// 우편함 버튼의 N 표시: 안 받은 하트나 안 읽은 쪽지가 있을 때
function setMailBadge(n) {
  pendingGifts = n;
  const b = $('mailBtn');
  if (b) b.classList.toggle('hasDot', n > 0);
}

// ---- 하트 선물: 팝업 없이 우편함에서 원할 때 [받기] ----
async function claimHeart(id) {
  const c = await api('/gifts/claim', id === undefined ? {} : { id });
  if (c.count > 0) {
    refreshHearts();
    if (hearts.n >= HEART_MAX) hearts.t = Date.now();
    hearts.n += c.count;
    store.set('busGame.hearts', hearts);
    renderHearts();
    toast(`하트 ${c.count}개를 받았어요!`, 1600);
  }
  return c.count;
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
  const close = X_BTN;
  const bindClose = () => { const c = card.querySelector('#ovClose'); if (c) c.onclick = () => hideOverlay(); };
  card.innerHTML = '<h2>' + MAIL_TITLE + '</h2><p>불러오는 중…</p>' + close; bindClose();
  $('overlay').classList.add('show');
  if (!nickname || !(await ensureAccount())) { card.innerHTML = '<h2>' + MAIL_TITLE + '</h2><p>먼저 닉네임을 정하고 인터넷에 연결해 주세요.</p>' + close; bindClose(); return; }
  let r;
  try { r = await api('/mail'); } catch (e) { card.innerHTML = '<h2>' + MAIL_TITLE + '</h2><p>우편함을 불러오지 못했어요.</p>' + close; bindClose(); return; }
  const t = r.now;
  const toClaim = r.mail.filter(m => m.giftId).length;
  card.innerHTML = `<h2>${MAIL_TITLE}</h2>
    ${toClaim > 1 ? `<button class="btn mini claimAll" id="claimAll">하트 모두 받기 (${toClaim})</button>` : ''}
    <div class="mailList">${r.mail.length ? r.mail.map(m => {
      const who = `<b>${esc(m.nickname)}</b>님`;
      const what = m.kind === 'heart'
        ? (m.dir === 'in' ? `${who}이 하트를 보냈어요` : `${who}에게 하트를 보냈어요`)
        : (m.dir === 'in' ? `${who}의 쪽지` : `${who}에게 보낸 쪽지`);
      const reply = m.giftId
        ? `<button class="btn mini" data-claim="${m.giftId}">받기</button>`
        : m.kind === 'letter' && m.dir === 'in'
        ? `<button class="btn alt mini" data-reply="${esc(m.friendId)}" data-name="${esc(m.nickname)}">답장</button>` : '';
      return `<div class="mailRow${m.unread ? ' unread' : ''}"><span class="mi">${m.kind === 'heart' ? HEART_SVG : '✉️'}</span>
        <span class="mb">${what} <small>· ${fmtAgo(t - m.at)}</small>${m.kind === 'letter' ? `<span class="letter">${esc(m.body)}</span>` : ''}</span>${reply}</div>`;
    }).join('') : '<p><small>아직 주고받은 하트나 쪽지가 없어요.</small></p>'}</div>
    <p><small>친구 창에서 하트와 쪽지를 보낼 수 있어요</small></p>
    ${close}`;
  bindClose();
  card.querySelectorAll('button[data-reply]').forEach(b => b.onclick = () => writeLetter(b.dataset.reply, b.dataset.name, showMail));
  const afterClaim = () => { showMail(); syncSoon(); };
  card.querySelectorAll('button[data-claim]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    try { await claimHeart(+b.dataset.claim); } catch (e) { toast('다시 시도해 주세요'); }
    afterClaim();
  });
  const all = card.querySelector('#claimAll');
  if (all) all.onclick = async () => { all.disabled = true; try { await claimHeart(); } catch (e) { toast('다시 시도해 주세요'); } afterClaim(); };
  // 쪽지는 열어 보면 읽음. 안 받은 하트가 남아 있으면 N 표시는 그대로예요
  if (r.mail.some(m => m.unread && m.kind === 'letter')) api('/mail/read', {}).catch(() => {});
  setMailBadge(toClaim);
}

// ---- 공지사항 (개발자가 고칠 때마다 무엇이 바뀌었는지) + 개발자에게 문의하기 ----
const NOTICE_SVG = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><g stroke="#4a3b2c" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">
  <path d="M4 10 V14 H7 L14 18 V6 L7 10Z" fill="#f6dd92"/><path d="M7 14 L8.5 19.5 H10.5 L9.5 14.6" fill="#fbf3e2"/>
  <path d="M17 9.5 Q18.6 12 17 14.5 M19.3 7.5 Q22.2 12 19.3 16.5" fill="none"/></g></svg>`;
let noticeCache = [];
const fmtDate = ms => { const d = new Date(ms); return `${d.getMonth() + 1}월 ${d.getDate()}일`; };
async function checkNotices() {
  try {
    noticeCache = (await (await fetch(API + '/notices')).json()).notices || [];
    const top = noticeCache[0] ? noticeCache[0].id : 0;
    $('noticeBtn').classList.toggle('hasDot', top > store.get('busGame.noticeSeen', 0));
  } catch (e) { /* 인터넷이 안 되면 다음에 */ }
}
async function showNotices() {
  const card = $('card');
  card.innerHTML = `<h2>공지사항</h2><div class="noticeList"><p><small>불러오는 중…</small></p></div>
    <button class="btn" id="askDev">개발자에게 문의하기</button>
    ${X_BTN}`;
  card.querySelector('#ovClose').onclick = () => hideOverlay();
  card.querySelector('#askDev').onclick = () => showInquiry(showNotices);
  $('overlay').classList.add('show');
  await checkNotices();
  const box = card.querySelector('.noticeList'); if (!box) return;
  box.innerHTML = noticeCache.length ? noticeCache.map(n => `<div class="notice"><b>${esc(n.title)}</b><small>${fmtDate(n.at)}</small>
    <div class="nBody">${esc(n.body).replace(/\n/g, '<br>')}</div></div>`).join('') : '<p><small>아직 공지가 없어요</small></p>';
  if (noticeCache[0]) { store.set('busGame.noticeSeen', noticeCache[0].id); $('noticeBtn').classList.remove('hasDot'); }
}
// 문의하기: 글을 보내면 개발자가 읽고 답을 달아요. 답이 달리면 폰 알림이 가고, 여기서 볼 수 있어요
async function showInquiry(back) {
  const card = $('card');
  card.innerHTML = `<h2>개발자에게 문의하기</h2>
    <textarea class="letterBox" id="inqText" maxlength="1000" placeholder="불편한 점, 버그, 바라는 점을 자유롭게 적어 주세요"></textarea>
    <div class="letterCount"><span id="inqN">0</span> / 1000</div>
    <button class="btn" id="inqSend">보내기</button>
    <p class="secTitle">내 문의</p><div class="noticeList" id="myInq"><p><small>불러오는 중…</small></p></div>
    <button class="btn alt" id="ovBack">돌아가기</button>`;
  const ta = card.querySelector('#inqText');
  ta.oninput = () => card.querySelector('#inqN').textContent = ta.value.length;
  card.querySelector('#ovBack').onclick = () => back ? back() : hideOverlay();
  $('overlay').classList.add('show');
  const loadMine = async () => {
    const box = card.querySelector('#myInq'); if (!box) return;
    if (!nickname || !(await ensureAccount())) { box.innerHTML = '<p><small>닉네임을 정하고 인터넷에 연결하면 보낼 수 있어요.</small></p>'; return; }
    try {
      const list = (await api('/inquiry')).inquiries;
      box.innerHTML = list.length ? list.map(q => `<div class="notice"><small>${fmtDate(q.at)}</small><div class="nBody">${esc(q.body).replace(/\n/g, '<br>')}</div>
        ${q.reply ? `<div class="reply"><b>개발자 답변</b><br>${esc(q.reply).replace(/\n/g, '<br>')}</div>` : '<small class="wait">답변을 기다리는 중이에요</small>'}</div>`).join('')
        : '<p><small>아직 보낸 문의가 없어요</small></p>';
    } catch (e) { box.innerHTML = '<p><small>불러오지 못했어요</small></p>'; }
  };
  card.querySelector('#inqSend').onclick = async e => {
    const text = ta.value.trim();
    if (text.length < 2) { toast('문의 내용을 적어 주세요'); return; }
    if (!nickname || !(await ensureAccount())) { toast('닉네임을 정하고 인터넷에 연결해 주세요', 2200); return; }
    e.target.disabled = true;
    try { await api('/inquiry', { text, ver: APP_VER, ua: navigator.userAgent }); ta.value = ''; card.querySelector('#inqN').textContent = '0'; toast('문의를 보냈어요! 답이 오면 알려 드릴게요 💌', 2200); loadMine(); }
    catch (err) { toast(err.message && err.message.length < 40 ? err.message : '보내지 못했어요', 2200); }
    e.target.disabled = false;
  };
  loadMine();
}

// ---- 친구 삭제 / 차단 ----
function manageFriend(id, name) {
  const card = $('card');
  card.innerHTML = `<h2>${esc(name)}님</h2>
    <p><b>친구 삭제</b>: 서로의 친구 목록에서 사라져요. 다시 친구 요청을 보낼 수 있어요.<br>
    <b>차단</b>: 친구에서 지우고, 앞으로 서로 친구 추가를 할 수 없어요.</p>
    <button class="btn alt" id="fDel">친구 삭제</button>
    <button class="btn alt" id="fBlock">차단하기</button>
    <button class="btn" id="ovBack">돌아가기</button>`;
  const go = async block => {
    try { await api('/friends/remove', { id, block }); toast(block ? `${name}님을 차단했어요` : `${name}님을 친구에서 지웠어요`, 1800); }
    catch (e) { toast('다시 시도해 주세요'); }
    showFriends();
  };
  card.querySelector('#fDel').onclick = () => go(false);
  card.querySelector('#fBlock').onclick = () => go(true);
  card.querySelector('#ovBack').onclick = () => showFriends();
}

// ---- 친구 창 ----
const fmtWait = ms => {
  const m = Math.max(0, Math.ceil(ms / 60000)), h = Math.floor(m / 60);
  return h ? `${h}h` : `${m}m`;     // 아주 짧게: 4h, 35m
};
// 친구 줄의 작은 아이콘 버튼들 (하트 보내기 · 쪽지 · 삭제/차단)
const IC_HEART = '<svg viewBox="0 0 20 18" width="17" height="15" aria-hidden="true"><path d="M10 16.5 C4.5 12.3 1.5 9.4 1.5 5.9 C1.5 3.3 3.5 1.5 5.8 1.5 C7.5 1.5 9 2.4 10 3.9 C11 2.4 12.5 1.5 14.2 1.5 C16.5 1.5 18.5 3.3 18.5 5.9 C18.5 9.4 15.5 12.3 10 16.5Z" fill="#e9899b" stroke="#8a6a5c" stroke-width="1.1"/></svg>';
const IC_LETTER = '<svg viewBox="0 0 22 16" width="18" height="14" aria-hidden="true"><g stroke="#6b5a48" stroke-width="1.3" stroke-linejoin="round"><rect x="1.5" y="1.5" width="19" height="13" rx="2" fill="#fbf3e2"/><path d="M2.3 2.6 L11 9 L19.7 2.6" fill="none"/></g></svg>';
const IC_TRASH = '<svg viewBox="0 0 18 20" width="14" height="16" aria-hidden="true"><g stroke="#6b5a48" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M2 5 H16 M7 5 V2.8 H11 V5"/><path d="M3.8 5 L4.8 17.5 H13.2 L14.2 5" fill="#efe6d6"/><path d="M7.4 8.5 V14.5 M10.6 8.5 V14.5"/></g></svg>';

// 마지막 접속: 5분 안이면 "접속 중"(초록 동그라미), 아니면 "N분/시간/일 전"
const ONLINE_MS = 5 * 60 * 1000;
const seenText = (ls, t) => {
  if (!ls) return '접속 기록 없음';
  const d = t - ls;
  if (d < ONLINE_MS) return '접속 중';
  const m = Math.floor(d / 60000), h = Math.floor(m / 60), day = Math.floor(h / 24);
  return day ? `${day}일 전 접속` : h ? `${h}시간 전 접속` : `${m}분 전 접속`;
};
async function showFriends() {
  const card = $('card');
  const close = X_BTN;
  const bindClose = () => { const c = card.querySelector('#ovClose'); if (c) c.onclick = () => hideOverlay(); };
  card.innerHTML = '<h2>친구</h2><p>불러오는 중…</p>' + close; bindClose();
  $('overlay').classList.add('show');
  if (!nickname) { card.innerHTML = '<h2>친구</h2><p>먼저 닉네임을 정해 주세요.</p>' + close; bindClose(); return; }
  if (!(await ensureAccount())) { card.innerHTML = '<h2>친구</h2><p>인터넷 연결을 확인해 주세요.</p>' + close; bindClose(); return; }
  let list = [], reqs = [], diff = 0;
  try { const r = await api('/friends'); list = r.friends; reqs = r.requests || []; diff = r.now - Date.now(); }
  catch (e) { card.innerHTML = '<h2>친구</h2><p>친구 목록을 불러오지 못했어요.</p>' + close; bindClose(); return; }
  setFriendBadge(reqs.length);
  friendMarks = list.map(f => ({ nickname: f.nickname || '친구', unlocked: f.unlocked })); friendMarksAt = Date.now(); renderFriendMarks();
  const t = Date.now() + diff;
  // 많이 깬 순서대로 (나도 함께), 1·2·3등은 트로피
  const ranked = [...list, { me: true, unlocked }].sort((a, b) => b.unlocked - a.unlocked);
  card.innerHTML = `<h2 class="tightTop">친구</h2>
    <div class="codeRow"><input class="nickInput" id="findNick" maxlength="10" placeholder="닉네임으로 친구 찾기"><button class="btn mini" id="findBtn">찾기</button></div>
    <div class="findList" id="findList"></div>
    ${reqs.length ? `<p class="secTitle">받은 친구 요청</p><div class="friendList reqList">${reqs.map(q =>
      `<div class="friendRow"><span>${esc(q.nickname || '친구')}<small>${q.unlocked}단계</small></span>
        <span class="friendBtns"><button class="btn mini" data-accept="${esc(q.id)}">수락</button><button class="btn alt mini" data-reject="${esc(q.id)}">거절</button></span></div>`).join('')}</div>` : ''}
    <p class="secTitle">친구 ${list.length}명</p>
    <div class="friendList">${list.length ? ranked.map((f, i) => {
      const rank = `<span class="rank">${i < 3 ? trophy(i) : i + 1}</span>`;
      if (f.me) return `<div class="friendRow me"><span class="fName">${rank}<span class="fTxt">${esc(nickname)}<small>나 · ${unlocked}단계</small></span></span></div>`;
      const wait = f.nextGiftAt && f.nextGiftAt > t;
      const on = f.lastSeen && t - f.lastSeen < ONLINE_MS;
      return `<div class="friendRow"><span class="fName">${rank}<span class="fTxt">${esc(f.nickname || '친구')}<i class="onDot${on ? ' on' : ''}" title="${on ? '접속 중' : ''}"></i><small>${f.unlocked}단계 · ${seenText(f.lastSeen, t)}</small></span></span>
        <span class="friendBtns"><button class="btn mini ic ${wait ? 'alt' : ''}" data-id="${esc(f.id)}" ${wait ? 'disabled' : ''} aria-label="하트 보내기">${wait ? fmtWait(f.nextGiftAt - t) : IC_HEART}</button>
        <button class="btn alt mini ic" data-letter="${esc(f.id)}" data-name="${esc(f.nickname || '친구')}" aria-label="쪽지">${IC_LETTER}</button>
        <button class="btn alt mini ic" data-more="${esc(f.id)}" data-name="${esc(f.nickname || '친구')}" aria-label="삭제·차단">${IC_TRASH}</button></span></div>`;
    }).join('') : '<p><small>아직 친구가 없어요. 위에서 닉네임으로 찾아 친구 요청을 보내 보세요!</small></p>'}</div>
    <p><small>친구에게 6시간마다 하트 1개를 보낼 수 있어요</small></p>
    ${close}`;
  bindClose();
  // 닉네임으로 찾기 → [친구 요청]
  const inp = card.querySelector('#findNick'), out = card.querySelector('#findList');
  const find = async () => {
    const q = inp.value.trim();
    if (!q) { toast('닉네임을 적어 주세요'); return; }
    out.innerHTML = '<p><small>찾는 중…</small></p>';
    let users = [];
    try { users = (await api('/users/search?q=' + encodeURIComponent(q))).users; }
    catch (e) { out.innerHTML = `<p><small>${e.status === 429 ? '잠시 후에 다시 찾아 주세요' : '찾지 못했어요'}</small></p>`; return; }
    out.innerHTML = users.length ? users.map(u => `<div class="friendRow"><span>${esc(u.nickname)}<small>${u.unlocked}단계</small></span>
      ${u.friend ? '<small class="tag">친구</small>' : u.sent ? '<small class="tag">요청함</small>'
        : `<button class="btn mini" data-req="${esc(u.id)}" data-name="${esc(u.nickname)}">친구 요청</button>`}</div>`).join('')
      : '<p><small>그 닉네임을 가진 사람이 없어요</small></p>';
    out.querySelectorAll('button[data-req]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      try {
        const r = await api('/friends/request', { id: b.dataset.req });
        if (r.friend) { toast(`${b.dataset.name}님과 친구가 되었어요! 🐾`, 2000); showFriends(); return; }
        b.outerHTML = '<small class="tag">요청함</small>';
        toast('친구 요청을 보냈어요', 1600);
      } catch (e) { b.disabled = false; toast(e.message && e.message.length < 40 ? e.message : '보내지 못했어요', 1800); }
    });
  };
  card.querySelector('#findBtn').onclick = find;
  inp.onkeydown = e => { if (e.key === 'Enter') find(); };
  // 받은 요청: 수락 / 거절
  const answer = async (id, accept) => {
    try { await api('/friends/respond', { id, accept }); toast(accept ? '친구가 되었어요! 🐾' : '요청을 거절했어요', 1600); } catch (e) { toast('다시 시도해 주세요'); }
    showFriends();
  };
  card.querySelectorAll('button[data-accept]').forEach(b => b.onclick = () => answer(b.dataset.accept, true));
  card.querySelectorAll('button[data-reject]').forEach(b => b.onclick = () => answer(b.dataset.reject, false));
  card.querySelectorAll('.friendRow button[data-letter]').forEach(b => b.onclick = () => writeLetter(b.dataset.letter, b.dataset.name, showFriends));
  card.querySelectorAll('.friendRow button[data-more]').forEach(b => b.onclick = () => manageFriend(b.dataset.more, b.dataset.name));
  card.querySelectorAll('.friendRow button[data-id]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    try { await api('/gift', { to: b.dataset.id }); toast('하트를 보냈어요! 💌', 1800); showFriends(); }
    catch (e) { toast(e.status === 429 ? '아직 보낼 수 없어요' : '보내지 못했어요', 1800); showFriends(); }
  });
}
// ---- 지도에 친구 이름표: 친구가 지금 있는 단계 옆에 "🐾 이름" (여러 명이면 "이름 외 N명") ----
let friendMarks = [], friendMarksAt = 0;
async function refreshFriendMarks(force) {
  if (!acct || (!force && Date.now() - friendMarksAt < 2 * 60 * 1000)) return;
  friendMarksAt = Date.now();
  try { friendMarks = (await api('/friends')).friends.map(f => ({ nickname: f.nickname || '친구', unlocked: f.unlocked })); }
  catch (e) { return; }
  renderFriendMarks();
}
function renderFriendMarks() {
  const inner = $('mapInner');
  if (!inner || !mapPts) return;
  inner.querySelectorAll('.fMark').forEach(n => n.remove());
  const at = {};
  for (const f of friendMarks) { const n = Math.min(MAX_LEVEL, Math.max(1, f.unlocked)); (at[n] = at[n] || []).push(f.nickname); }
  for (const n in at) {
    const p = mapPts[n - 1], names = at[n];
    if (!p) continue;
    const el = document.createElement('div');
    const left = p.x > mapW / 2;                               // 길이 오른쪽이면 이름표는 왼쪽에
    el.className = 'fMark' + (left ? ' left' : '');
    el.style.top = p.y + 'px';
    el.style[left ? 'right' : 'left'] = (left ? mapW - p.x : p.x) + 44 + 'px';
    const short = s => s.length > 6 ? s.slice(0, 6) + '…' : s;
    el.textContent = `🐾 ${short(names[0])}${names.length > 1 ? ` 외 ${names.length - 1}명` : ''}`;
    el.onclick = () => toast(`${n}단계: ${names.join(', ')}`, 2600);
    inner.appendChild(el);
  }
}

// 친구 버튼의 빨간 점: 받은 친구 요청이 있을 때
function setFriendBadge(n) {
  const b = $('friendsBtn');
  if (b) b.classList.toggle('hasDot', n > 0);
}

// ---- 전체 채팅 (모두가 보는 짧은 말) ----
let chatLast = 0, chatTimer = 0, chatOpen = false;
const medalSvg = n => {
  const [c, d] = [['#f2c35a', '#c99a2e'], ['#d9dde2', '#9aa3ad'], ['#e2a77a', '#b07447']][n - 1];
  return `<svg class="medal" viewBox="0 0 16 18" width="13" height="15" aria-label="${n}위"><path d="M4 0 H7 L8 5 L9 0 H12 L10 7 H6Z" fill="#8dbbe0" stroke="#5a4e44" stroke-width=".8"/>
    <circle cx="8" cy="11.5" r="5.2" fill="${c}" stroke="${d}" stroke-width="1.2"/><text x="8" y="14" text-anchor="middle" font-size="6.5" font-weight="700" fill="#5a4e44">${n}</text></svg>`;
};
const fmtClock = ms => { const d = new Date(ms); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
async function showChat() {
  const card = $('card');
  card.innerHTML = `<h2>전체 채팅</h2>
    <div class="chatList" id="chatList"><p><small>불러오는 중…</small></p></div>
    <div class="codeRow chatInput"><input class="nickInput" id="chatText" maxlength="100" placeholder="모두에게 한마디 (100자)" autocomplete="off"><button class="btn mini" id="chatSend">보내기</button></div>
    <p><small>모두가 보는 곳이에요. 고운 말을 써 주세요 · 사흘 지난 글은 사라져요</small></p>
    ${X_BTN}`;
  $('overlay').classList.add('show');
  const box = card.querySelector('#chatList'), inp = card.querySelector('#chatText');
  const stop = () => { chatOpen = false; clearTimeout(chatTimer); };
  card.querySelector('#ovClose').onclick = () => { stop(); hideOverlay(); };
  if (!nickname || !(await ensureAccount())) { box.innerHTML = '<p><small>먼저 닉네임을 정하고 인터넷에 연결해 주세요.</small></p>'; return; }
  chatOpen = true; chatLast = 0; box.innerHTML = '';
  const add = list => {
    if (!list.length) { if (!box.children.length) box.innerHTML = '<p class="chatEmpty"><small>아직 아무도 말하지 않았어요. 첫 인사를 남겨 보세요!</small></p>'; return; }
    const empty = box.querySelector('.chatEmpty'); if (empty) empty.remove();
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    for (const m of list) {
      chatLast = Math.max(chatLast, m.id);
      const el = document.createElement('div');
      el.className = 'chatMsg' + (m.mine ? ' mine' : '');
      // 닉네임 옆에 단계, 전체 1·2·3위면 작은 금·은·동 메달
      const tag = m.level ? `<span class="lvTag">${m.level}단계${m.medal ? medalSvg(m.medal) : ''}</span>` : '';
      el.innerHTML = `${m.mine ? (tag ? `<b class="meTag">${tag}</b>` : '') : `<b>${esc(m.nickname)}${tag}</b>`}<span class="bubble">${esc(m.body)}</span><small>${fmtClock(m.at)}</small>`;
      box.appendChild(el);
    }
    if (nearBottom || list.some(m => m.mine)) box.scrollTop = box.scrollHeight;
  };
  const poll = async () => {
    if (!chatOpen || !$('overlay').classList.contains('show') || !card.contains(box)) { stop(); return; }
    try { add((await api('/chat?after=' + chatLast)).messages); } catch (e) { /* 잠깐 끊겨도 다음에 다시 */ }
    if (chatOpen) chatTimer = setTimeout(poll, document.hidden ? 15000 : 4000);   // 4초마다 새 글 확인
  };
  await poll();
  box.scrollTop = box.scrollHeight;
  const send = async () => {
    const text = inp.value.trim();
    if (!text) return;
    const btn = card.querySelector('#chatSend'); btn.disabled = true;
    try { await api('/chat', { text }); inp.value = ''; clearTimeout(chatTimer); await poll(); }
    catch (e) { toast(e.message && e.message.length < 40 ? e.message : '보내지 못했어요', 1800); }
    btn.disabled = false; inp.focus();
  };
  card.querySelector('#chatSend').onclick = send;
  inp.onkeydown = e => { if (e.key === 'Enter') send(); };
}

// ---- 폰 알림 (웹 푸시) ----
// 설치한 앱(멍냥버스 APK) 안에서 열렸는지: 앱은 알림 권한을 크롬과 따로, 폰 설정에서 관리해요
const IN_APP = (() => {
  try {
    if (document.referrer.startsWith('android-app://')) {
      sessionStorage.setItem('meowApp', '1');
      sessionStorage.setItem('meowFrom', document.referrer.slice(14).split('/')[0]);   // 어떤 앱이 열었는지
    }
    return sessionStorage.getItem('meowApp') === '1' || matchMedia('(display-mode: standalone)').matches;
  } catch (e) { return false; }
})();
// 지금 어디서 열렸는지: 인증된 앱이면 주소창이 없고(standalone), 알림 허용 창도 앱 것으로 떠요
function appMode() {
  let standalone = false;
  try { standalone = matchMedia('(display-mode: standalone)').matches; } catch (e) { /* 무시 */ }
  let from = '', moved = false;
  try { from = sessionStorage.getItem('meowFrom') || ''; moved = sessionStorage.getItem('meowMoved') === '1'; } catch (e) { /* 무시 */ }
  const kind = from.startsWith('org.chromium.webapk') ? '크롬 앱' : from.startsWith('io.github.apeaches') ? 'APK 앱' : from ? '앱(' + from + ')' : '';
  const tail = (moved ? ' · 예전 주소에서 옴' : '') + (from ? ' · ' + from.slice(-6) : '');
  if (IN_APP && standalone) return (kind || '앱') + ' (전체 화면)' + tail;
  if (IN_APP) return (kind || '앱') + ' (주소 표시)' + tail;
  return (standalone ? '홈 화면 앱' : '브라우저') + tail;
}
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
$('mailBtn').innerHTML = MAIL_SVG + '<span class="dot">N</span>';   // 새 소식이 있으면 N
$('mailBtn').onclick = () => showMail();
$('noticeBtn').innerHTML = NOTICE_SVG + '<span class="dot"></span>';
$('noticeBtn').onclick = () => showNotices();
setTimeout(checkNotices, 2500);                       // 새 공지가 있으면 확성기 버튼에 빨간 점
setInterval(checkNotices, 30 * 60 * 1000);
const CHAT_SVG = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><g stroke="#4a3b2c" stroke-width="1.5" stroke-linejoin="round">
  <path d="M4 5.5 H20 A1.5 1.5 0 0 1 21.5 7 V15 A1.5 1.5 0 0 1 20 16.5 H11 L6.5 20 V16.5 H4 A1.5 1.5 0 0 1 2.5 15 V7 A1.5 1.5 0 0 1 4 5.5Z" fill="#cfe6d6"/>
  <circle cx="8" cy="11" r="1.1" fill="#4a3b2c" stroke="none"/><circle cx="12" cy="11" r="1.1" fill="#4a3b2c" stroke="none"/><circle cx="16" cy="11" r="1.1" fill="#4a3b2c" stroke="none"/></g></svg>`;
$('chatBtn').innerHTML = CHAT_SVG;
$('chatBtn').onclick = () => showChat();
if (acct) saveAuthForSW();
// 서비스 워커는 늘 등록해요 (폰 알림 + 앱처럼 설치하기)
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
setTimeout(syncNow, 1500);
setInterval(syncNow, 2 * 60 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });
