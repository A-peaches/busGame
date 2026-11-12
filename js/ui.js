// 멍냥이의 버스여행 - 메인 화면 단계 지도, 화면 UI, 팝업, 축하·실패 연출
// =====================================================================
//  메인 화면 (단계 지도)
// =====================================================================
function showScreen(name) {
  $('menu').classList.toggle('hidden', name !== 'game' ? false : true);
  $('game').classList.toggle('hidden', name !== 'game');
}

function showMenu() {
  S = null;
  hideOverlay();
  showScreen('menu');
  renderMap();
  if (typeof updateSky === 'function' && document.getElementById('celestial')) updateSky();
}

// 지도 단계 모양: 고양이 → 강아지 → 고양이 … (눈코입 없이 실루엣만)
//   같은 모양을 두 번 그려요: 먼저 굵은 테두리로, 그 위에 색으로 덮어서 바깥 테두리만 남게 (귀와 머리 사이 선이 안 보여요)
const NODE_SHAPE = {
  // 고양이: 끝이 살짝 뭉뚝한 귀, 옆으로 조금 넓적한 얼굴
  cat: '<path d="M16.5 24 L15.6 13.2 Q15.3 9.2 18.8 11 L29.5 17.2Z M 57.5 24 L 58.4 13.2 Q 58.7 9.2 55.2 11 L 44.5 17.2 Z"/><ellipse cx="37" cy="36" rx="26" ry="21"/>',
  // 강아지: 머리 양옆에서 길게 축 처진 귀
  dog: '<path d="M21 15 C10 14 4.5 29 6.5 43 C7.5 51 15.5 53 18.5 46 C21 39 24.5 26 21 15Z M 53 15 C 64 14 69.5 29 67.5 43 C 66.5 51 58.5 53 55.5 46 C 53 39 49.5 26 53 15 Z"/><ellipse cx="37" cy="34" rx="25" ry="21"/>',
};
const nodeSvg = kind => `<svg class="nodeShape" viewBox="0 0 74 62" aria-hidden="true">
  <g class="ol">${NODE_SHAPE[kind]}</g><g class="fl">${NODE_SHAPE[kind]}</g></svg>`;

function renderMap() {
  const scroll = $('mapScroll'), inner = $('mapInner');
  const W = scroll.clientWidth;
  if (!W) return;
  const N = MAX_LEVEL, SP = 104;
  const H = N * SP + 90;
  inner.style.height = H + 'px';
  const amp = Math.min(W * 0.26, 120);
  const cx = (W - 56) / 2;                 // 오른쪽 세로 버튼 자리(56px)를 비워 두고 길을 그려요
  const pts = [];
  for (let i = 0; i < N; i++) pts.push({ x: cx + Math.sin(i * 1.05) * amp, y: H - 60 - i * SP });

  // 구불구불한 시골길 (부드러운 곡선)
  let d = `M ${pts[0].x} ${H + 20} L ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`;
  }
  // (지도와 함께 스크롤되는 나무는 위쪽 페이드 구간에서 반투명하게 보여서 없앴어요.
  //  나무는 움직이지 않는 배경 들판에만 심어요.)
  const deco = '';
  // 흙길: 얇은 회색 테두리 + 바퀴 자국 (겨울엔 눈길)
  // 길과 나무는 한 번만 그림(이미지)으로 만들어 두어, 스크롤해도 다시 그리지 않아요
  const road = season === 'winter' ? ['#eef1f4', '#dfe5ea'] : ['#ead6b0', '#d6bf96'];
  const img = $('mapRoad');
  img.style.width = W + 'px'; img.style.height = H + 'px';
  setSvgImage(img, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    <defs><filter id="wash" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2"/></filter></defs>
    <path d="${d}" fill="none" stroke="#a8a097" stroke-width="29.5" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="${road[0]}" stroke-width="27.5" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="${road[1]}" stroke-width="12" stroke-linecap="round" opacity=".55"/>
    <path d="${d}" fill="none" stroke="${road[0]}" stroke-width="7" stroke-linecap="round"/>
    ${deco}</svg>`);
  updateHello();

  inner.querySelectorAll('.node').forEach(n => n.remove());
  pts.forEach((p, i) => {
    const n = i + 1;
    const b = document.createElement('button');
    const kind = i % 2 ? 'dog' : 'cat';
    b.className = 'node ' + kind + ' ' + (n < unlocked ? 'done' : n === unlocked ? 'current' : 'locked');
    b.style.left = p.x + 'px';
    b.style.top = p.y + 'px';
    b.innerHTML = nodeSvg(kind) + `<span class="nodeIn">${n > unlocked ? LOCK_SVG : `${n}<small>${'★'.repeat(TIERS[levelTier(n)].stars)}</small>`}</span>`;
    if (n === unlocked) b.innerHTML += BUS_SVG;
    b.onclick = () => n <= unlocked ? showLevelPopup(n) : toast('앞 단계를 먼저 깨 주세요');
    inner.appendChild(b);
  });

  const cur = pts[Math.min(unlocked, N) - 1];
  scroll.scrollTop = cur.y - scroll.clientHeight * 0.6;
  mapPts = pts; mapW = W;
  if (typeof renderFriendMarks === 'function') renderFriendMarks();   // 친구들이 있는 단계에 이름표
}
let mapPts = null, mapW = 0;

// =====================================================================
//  화면 UI
// =====================================================================
function updateUI() {
  $('levelLabel').textContent = `${S.level}단계`;
  $('leftLabel').textContent = `${TIERS[levelTier(S.level)].name} · 남은 승객 ${remainingCount()}명` +
    (S.shuffle ? ` · 자리 바꾸기까지 ${S.shuffle.left}대` : '');
  $('slotCnt').textContent = S.boost.slot;
  $('liftCnt').textContent = S.boost.lift;
  $('slotBtn').disabled = S.boost.slot <= 0 || S.slotCount >= MAX_SLOTS;
  $('liftBtn').disabled = S.boost.lift <= 0;
  $('liftBtn').classList.toggle('active', S.liftMode);
}

let toastTimer = 0;
function toast(msg, ms = 1400) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

function showOverlay(kind) {
  const card = $('card');
  if (kind === 'win') {
    const tries = S.tries || 1;
    const all = store.get('busGame.tries', {}); all[S.level] = 0; store.set('busGame.tries', all);   // 다음 도전은 새로 세요
    card.innerHTML = `<canvas id="celebCv" class="perch" width="600" height="250"></canvas>
      <h2>축하드립니다!</h2><p><b>${tries}번</b>의 시도로 성공했습니다!<br><small>${HEART_SVG} 시작할 때 낸 하트를 돌려받았어요</small></p>
      ${S.level < MAX_LEVEL ? `<button class="btn" id="ovNext">${S.level + 1}단계로</button>` : '<p><b>100단계를 모두 깼어요! 최고의 버스 기사님!</b></p>'}
      <button class="btn alt" id="ovMap">메인 메뉴로</button>`;
    if (S.level < MAX_LEVEL) card.querySelector('#ovNext').onclick = () => { stopCelebration(); tryStart(S.level + 1); };
    card.querySelector('#ovMap').onclick = () => { stopCelebration(); showMenu(); };
    $('overlay').classList.add('show');
    celebrate();
    return;
  } else {
    const canSlot = S.boost.slot > 0 && S.slotCount < MAX_SLOTS;
    refreshHearts();
    card.innerHTML = `<canvas id="sadCv" class="perch" width="600" height="250"></canvas>
      <h2>꽉 막혔어요</h2><p>대기 칸이 가득 차서 더 태울 수 없어요.<br>
      <small>다시 하기는 하트 1개가 들어요</small><br>
      <span class="heartNow">${HEART_SVG}지금 하트 ${hearts.n}개</span></p>
      <button class="btn" id="ovSlot" ${canSlot ? '' : 'disabled'}>아이템 사용${canSlot ? ' (자리 +1)' : ' (없음)'}</button>
      <button class="btn alt" id="ovRetry">다시 하기</button>
      <button class="btn alt" id="ovMap">지도 보기</button>`;
    if (canSlot) card.querySelector('#ovSlot').onclick = () => { stopCelebration(); useSlotBooster(); S.over = false; hideOverlay(); };
    card.querySelector('#ovRetry').onclick = () => {
      if (!useHeart()) { toast(`하트가 없어요 · ${heartLeft()} 뒤에 1개 충전`, 2200); return; }
      stopCelebration(); startLevel(S.level);
    };
    card.querySelector('#ovMap').onclick = () => { stopCelebration(); showMenu(); };
    $('overlay').classList.add('show');
    sadLoop();
    return;
  }
  card.querySelector('#ovMap').onclick = () => showMenu();
  $('overlay').classList.add('show');
}
function hideOverlay() { $('overlay').classList.remove('show'); $('card').classList.remove('help'); stopCelebration(); }

// =====================================================================
//  클리어 축하: 핑크·파랑·노랑·연두 폭죽 + 나팔 부는 강아지와 고양이
// =====================================================================
let celebRAF = 0;
function stopCelebration() {
  cancelAnimationFrame(celebRAF); celebRAF = 0;
  const cf = $('confetti'); if (cf) cf.getContext('2d').clearRect(0, 0, cf.width, cf.height);
}
function celebrate() {
  stopCelebration();
  const cf = $('confetti'), app = $('app');
  const dpr = DPR, W = app.clientWidth, H = app.clientHeight;
  cf.width = W * dpr; cf.height = H * dpr;
  const fc = cf.getContext('2d'); fc.setTransform(dpr, 0, 0, dpr, 0, 0);
  const COLS = ['#f4a3bd', '#8dbbe0', '#f6d76b', '#b4dc88', '#fbe0ea'];
  const parts = [];
  const burst = (x, y) => {
    sfx('board', Math.floor(Math.random() * 8));
    for (let i = 0; i < 64; i++) {
      const a = Math.random() * Math.PI * 2, v = 140 + Math.random() * 240;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 1.8 + Math.random() * 0.9, age: 0,
        c: COLS[i % COLS.length], s: 5 + Math.random() * 5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, round: Math.random() < 0.4 });
    }
  };
  const plan = [0, 0.35, 0.8, 1.3, 1.9, 2.6, 3.4].map(t => ({ t, done: false }));
  const cc = $('celebCv') ? $('celebCv').getContext('2d') : null;
  const t0 = performance.now();
  let last = t0;
  const frame = () => {
    const now = performance.now();   // 한 가지 시계만 써요 (기기마다 rAF 시각 기준이 달라도 안전)
    const T = (now - t0) / 1000, dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    // 폭죽 터뜨리기
    for (const p of plan) if (!p.done && T >= p.t) { p.done = true; burst(W * (0.15 + Math.random() * 0.7), H * (0.12 + Math.random() * 0.35)); }
    fc.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.age += dt; p.vy += 260 * dt; p.vx *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      const a = Math.max(0, 1 - p.age / p.life);
      if (!a) continue;
      fc.save(); fc.globalAlpha = a; fc.translate(p.x, p.y); fc.rotate(p.rot); fc.fillStyle = p.c;
      if (p.round) { fc.beginPath(); fc.arc(0, 0, p.s * 0.6, 0, Math.PI * 2); fc.fill(); }
      else fc.fillRect(-p.s / 2, -p.s * 0.3, p.s, p.s * 0.6);
      fc.restore();
    }
    // 나팔 부는 고양이와 강아지
    if (cc) drawTrumpeters(cc, T);
    if ($('overlay').classList.contains('show')) celebRAF = requestAnimationFrame(frame);
  };
  celebRAF = requestAnimationFrame(frame);
}
// 나팔 (입에서 바깥 위쪽으로, 끝에 나팔꽃 모양 벨)
function drawTrumpet(c, mx, my, dir, k) {
  const ex = mx + dir * k * 1.5, ey = my - k * 0.7;
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = LINE; c.lineWidth = k * 0.2 + 2; c.beginPath(); c.moveTo(mx, my); c.lineTo(ex, ey); c.stroke();
  c.strokeStyle = '#f2c94c'; c.lineWidth = k * 0.2; c.stroke();
  const ang = Math.atan2(ey - my, ex - mx);
  c.save(); c.translate(ex, ey); c.rotate(ang);
  c.beginPath(); c.moveTo(0, -k * 0.12); c.lineTo(k * 0.6, -k * 0.42); c.lineTo(k * 0.6, k * 0.42); c.lineTo(0, k * 0.12); c.closePath();
  c.fillStyle = '#f6d76b'; c.fill(); c.strokeStyle = LINE; c.lineWidth = 2; c.stroke();
  c.beginPath(); c.ellipse(k * 0.6, 0, k * 0.12, k * 0.42, 0, 0, Math.PI * 2); c.fillStyle = '#e9b949'; c.fill(); c.stroke();
  c.restore();
  return { x: ex + Math.cos(ang) * k * 0.7, y: ey + Math.sin(ang) * k * 0.7 };
}
// 실패: 시무룩하게 눈물이 그렁그렁한 고양이와 강아지 (팝업 위에 걸터앉아 있어요)
function sadLoop() {
  stopCelebration();
  const c = $('sadCv') && $('sadCv').getContext('2d');
  if (!c) return;
  const t0 = performance.now();
  const frame = () => {
    const T = (performance.now() - t0) / 1000, W = c.canvas.width, H = c.canvas.height;
    c.clearRect(0, 0, W, H);
    const saved = ctx, savedLW = LW_SCALE;
    ctx = c; LW_SCALE = 2;
    try {
      for (const [x, kind, col, ph] of [[W * 0.36, 'cat', 6, 0], [W * 0.64, 'dog', 1, 1.1]]) {
        const sniff = Math.max(0, Math.sin(T * 2.2 + ph)) * 2;   // 훌쩍훌쩍 어깨가 들썩
        drawAnimal(x, H - 22, 46, col, kind, sniff, ph, { sad: true, ribbon: kind === 'cat' ? '#e8768e' : null });
      }
    } finally { ctx = saved; LW_SCALE = savedLW; }
    if ($('overlay').classList.contains('show')) celebRAF = requestAnimationFrame(frame);
  };
  celebRAF = requestAnimationFrame(frame);
}

function drawTrumpeters(c, T) {
  const W = c.canvas.width, H = c.canvas.height;
  c.clearRect(0, 0, W, H);
  const saved = ctx, savedLW = LW_SCALE;
  ctx = c; LW_SCALE = 2;
  try {
    const r = 40;
    for (const [x, kind, col, dir, ph] of [[W * 0.3, 'cat', 6, -1, 0], [W * 0.7, 'dog', 1, 1, 1.3]]) {
      const bob = Math.abs(Math.sin(T * 5 + ph)) * 6;
      drawAnimal(x, H - 22, r, col, kind, bob, ph, { excited: true, ribbon: kind === 'cat' ? '#e8768e' : null });
      // 입 위치 (drawAnimal의 머리 좌표에 맞춰)
      const my = H - 22 - bob - r * 1.2 * 0.9 + r * 0.3, mx = x + dir * r * 0.2;
      const bell = drawTrumpet(c, mx, my, dir, r * (1 + Math.sin(T * 10 + ph) * 0.04));
      // 나팔에서 나오는 음표
      for (let i = 0; i < 2; i++) {
        const k = (T * 0.8 + i * 0.5 + ph) % 1;
        c.globalAlpha = Math.sin(k * Math.PI);
        c.font = `700 ${24 + k * 14}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillStyle = i ? '#8dbbe0' : '#f4a3bd';
        c.fillText(i ? '♫' : '♪', bell.x + dir * k * 40, bell.y - k * 60);
      }
      c.globalAlpha = 1;
    }
  } finally { ctx = saved; LW_SCALE = savedLW; }
}


// =====================================================================
//  설명서 (메인 화면 오른쪽 아래 세로 버튼 맨 위 책 버튼)
// =====================================================================
const BOOK_SVG = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><g fill="none" stroke="#4a3b2c" stroke-width="1.6" stroke-linejoin="round">
  <path d="M12 6.5 C9.5 4.8 6.5 4.6 3.5 5.2 V18.6 C6.5 18 9.5 18.2 12 19.9 C14.5 18.2 17.5 18 20.5 18.6 V5.2 C17.5 4.6 14.5 4.8 12 6.5Z" fill="#f6dd92"/>
  <path d="M12 6.5 V19.9"/></g></svg>`;
// 책갈피 한 장 = 한 쪽. [제목, 짧은 이름, 내용]
const HELP_PAGES = [
  ['🚌 버스 꺼내기', '버스', `<ul>
      <li>주차장의 버스를 누르면 <b>화살표 방향</b>으로 나가요.</li>
      <li>앞이 막혀 있으면 부딪히고 제자리로 돌아와요. <b>앞이 뚫린 버스</b>부터 꺼내요.</li>
      <li>버스는 위·아래·양옆·대각선 <b>8방향</b>이 있어요. 숫자는 탈 수 있는 자리 수(8·16·24·32석)예요.</li>
      <li><b>❓ 버스</b>는 색이 숨겨져 있다가 앞길이 열리면 색이 보여요. 앞쪽 끝의 <b>작은 화살촉</b>으로 나가는 방향은 알 수 있어요.</li>
    </ul>`],
  ['🐱🐶 멍냥이 태우기', '태우기', `<ul>
      <li>꺼낸 버스는 가운데 <b>대기 칸</b>에 서요. 처음엔 4칸이에요.</li>
      <li><b>하트 길</b> 위의 멍냥이는 <b>같은 색 버스</b>가 오면 걸어가서 타요.</li>
      <li>버스가 다 차면 신나게 출발하고, 대기 칸이 비어요.</li>
      <li>멍냥이들은 하트 길을 돌다가 <b>출구에 도착한 차례대로</b> 같은 색 버스를 타러 내려가요. 새치기는 없어요!</li>
      <li>화면을 <b>꾹 누르고 있으면</b> 약 3배속 빨리감기! 손을 떼면 원래대로 돌아와요.</li>
      <li>멍냥이를 모두 태워 보내면 <b>클리어!</b></li>
    </ul>`],
  ['🧰 실패와 아이템', '아이템', `<ul>
      <li>대기 칸이 꽉 찼는데 하트 길의 누구도 탈 수 없으면 <b>꽉 막혀요</b>.</li>
      <li><b>자리 추가</b>: 대기 칸이 한 칸 늘어나요. 단계마다 1개 (별 5개 단계는 2개).</li>
      <li><b>크레인</b>: 막혀 있는 버스도 아무거나 하나 바로 꺼내요. 단계마다 1개.</li>
      <li>꽉 막혔을 때 [아이템 사용]으로 자리를 늘려 이어서 할 수도 있어요.</li>
    </ul>`],
  ['❤️ 하트', '하트', `<ul>
      <li>하트는 최대 5개, <b>10분마다 1개</b>씩 충전돼요.</li>
      <li>단계를 <b>시작할 때 하트 1개</b>를 내요. <b>깨면 그 하트를 돌려받아요.</b></li>
      <li>실패하거나 중간에 나가면 낸 하트는 돌아오지 않아요. 다시 하기도 새로 시작이라 하트 1개가 들어요.</li>
      <li>하트가 0개면 단계를 시작할 수 없어요.</li>
      <li>친구가 보낸 하트를 받으면 5개를 넘을 수도 있어요.</li>
      <li><b>출석 선물</b>: 하루에 처음 들어오면 하트 1개를 더 받아요.</li>
    </ul>`],
  ['⭐ 단계와 이벤트', '단계', `<ul>
      <li>모두 <b>100단계</b>예요. 한 단계를 깨면 다음 단계가 열려요.</li>
      <li>10단계마다 <b>쉬움 → 어려움 → 매우 어려움</b>이 반복되고, 갈수록 조금씩 어려워져요.</li>
      <li><b>별 5개(최고 난이도)</b>는 30단계마다 나와요.</li>
    </ul>
    <h3>🚃 레일 버스 (31단계부터)</h3>
    <ul>
      <li>주차장 아래 레일 위에도 버스가 있어요. 레일 칸은 위의 주차장 세로줄과 딱 맞아요.</li>
      <li>레일 버스는 <b>바로 위 같은 세로줄</b>의 버스들을 먼저 빼야 위로 쭉 나갈 수 있어요.</li>
      <li>그런데 버스를 <b>누를 때마다 레일이 한 칸씩</b> 움직여서, 다음엔 다른 줄 아래에 가 있어요!</li>
    </ul>
    <h3>🔄 U턴 버스 (61단계부터)</h3>
    <ul>
      <li>모서리에 <b>노란 숫자 배지</b>가 붙은 버스예요.</li>
      <li>버스를 <b>3번 누를 때마다</b>(한 번이 한 턴) U턴 버스들의 <b>앞뒤 방향이 휙</b> 바뀌어요.</li>
      <li>배지 숫자는 <b>다음 U턴까지 남은 턴</b>이에요. 나가는 길이 막히기 전에 서둘러요!</li>
    </ul>
    <h3>🔁 자리 바꾸기 (81단계부터)</h3>
    <ul>
      <li>주차장에서 버스를 <b>몇 대 뺄 때마다</b> 남은 버스들이 <b>새 자리로 다시 주차</b>해요.</li>
      <li>쉬움은 8대, 어려움은 7대, 매우 어려움 이상은 6대마다예요.</li>
      <li>위쪽 <b>"자리 바꾸기까지 N대"</b>에 남은 대수가 보여요.</li>
    </ul>`],
  ['💌 친구와 알림', '친구', `<ul>
      <li>오른쪽 아래 <b>친구 버튼</b>에서 <b>닉네임으로 친구를 찾아 [친구 요청]</b>을 보내요. 상대가 수락하면 친구가 돼요.</li>
      <li>받은 친구 요청이 있으면 친구 버튼에 빨간 점이 생겨요. 친구 창에서 <b>수락/거절</b>할 수 있어요.</li>
      <li>친구 이름 옆 <b>초록 동그라미</b>는 지금 접속 중이라는 뜻이에요. 아니면 마지막 접속 시간이 보여요.</li>
      <li>지도에는 친구가 지금 있는 단계 옆에 <b>🐾 이름표</b>가 붙어요. 위로 올려 보면 앞서 간 친구를 볼 수 있어요. 이름표를 누르면 그 단계의 친구들이 모두 보여요.</li>
      <li>친구가 나를 <b>따라잡거나 앞지르면</b> 폰 알림으로 알려 드려요.</li>
      <li>오른쪽 아래 말풍선 버튼은 <b>전체 채팅</b>이에요. 모두가 보는 곳이니 고운 말을 써 주세요. 사흘 지난 글은 사라져요.</li>
      <li>친구에게 <b>6시간마다 하트 1개</b>를 보낼 수 있어요. 친구 줄의 <b>하트</b> 버튼을 누르고, 기다리는 동안엔 남은 시간(예: 4h, 35m)이 보여요. <b>편지</b> 버튼은 쪽지예요.</li>
      <li>하트가 도착하면 <b>우편함 버튼에 N</b>이 붙어요. 우편함에서 원할 때 <b>[받기]</b>를 눌러 받아요.</li>
      <li>친구 창은 <b>많이 깬 순서</b>대로 보여요. 1·2·3등에게는 <b>트로피</b>가 붙어요.</li>
      <li>친구 옆 <b>휴지통</b> 버튼으로 <b>친구 삭제</b>나 <b>차단</b>을 할 수 있어요. 차단하면 서로 다시 친구 추가를 할 수 없어요.</li>
      <li><b>✉️ 쪽지</b>로 친구에게 짧은 글(80자)을 보낼 수 있어요. 대화가 아니라 우편함으로 가는 쪽지예요.</li>
      <li>오른쪽 아래 <b>우편함</b>에서 주고받은 하트 기록과 쪽지를 볼 수 있고, 받은 쪽지에 답장할 수 있어요.</li>
      <li><b>폰 알림</b>을 켜면 하트·쪽지가 도착했을 때와 하트가 가득 찼을 때 알려 드려요. (설정에서 켜고 끌 수 있어요)</li>
    </ul>`],
  ['🔑 백업 코드', '백업', `<ul>
      <li>이름·이메일 같은 개인정보는 받지 않아요. 대신 <b>백업 코드</b>로 다른 기기에서 이어 할 수 있어요.</li>
      <li><b>설정 → 백업 코드 · 만들기</b>를 누르면 12자리 코드가 나와요. 캡처하거나 메모해 두세요.</li>
      <li>새 기기에서는 처음 화면의 <b>[백업 코드로 불러오기]</b>, 또는 설정 → 백업 코드 · 불러오기에 입력해요.</li>
      <li>단계, 하트, 친구가 그대로 돌아와요.</li>
      <li>코드를 새로 만들면 <b>예전 코드는 쓸 수 없어요</b>. 서버에는 코드 자체가 아니라 알아볼 수 없게 바꾼 값만 저장해요.</li>
      <li>코드를 아는 사람은 누구나 불러올 수 있으니 다른 사람에게 알려 주지 마세요.</li>
    </ul>`],
  ['⚙ 설정', '설정', `<ul>
      <li>배경음악·효과음 켜기와 크기를 바꿀 수 있어요.</li>
      <li><b>계절 테마</b>: 지금 계절 / 봄 / 여름 / 가을 / 겨울.</li>
      <li><b>가벼운 모드</b>: 오래된 폰에서 버벅이면 그림을 조금 단순하게 해요. '자동'이면 느린 폰에서 저절로 켜져요.</li>
      <li>폰 알림, 백업 코드, 닉네임도 여기서 바꿔요.</li>
      <li>메인 화면의 하늘은 실제 시간과 날씨를 따라가요.</li>
    </ul>`],
];
let helpPage = 0;
function showHelp(page) {
  if (page !== undefined) helpPage = page;
  const card = $('card');
  card.classList.add('help');
  const [title, , body] = HELP_PAGES[helpPage];
  card.innerHTML = `<h2>설명서</h2>
    <div class="bookmarks">${HELP_PAGES.map((p, i) =>
      `<button class="bm${i === helpPage ? ' on' : ''}" data-p="${i}">${i + 1}. ${p[1]}</button>`).join('')}</div>
    <div class="helpPage"><h3>${helpPage + 1}. ${title}</h3>${body}</div>
    <div class="helpNav">
      <button class="btn alt mini" id="hPrev" ${helpPage ? '' : 'disabled'}>‹ 이전</button>
      <span>${helpPage + 1} / ${HELP_PAGES.length}</span>
      <button class="btn alt mini" id="hNext" ${helpPage < HELP_PAGES.length - 1 ? '' : 'disabled'}>다음 ›</button>
    </div>
    <button class="btn" id="ovClose">알겠어요</button>`;
  card.querySelectorAll('.bm').forEach(b => b.onclick = () => showHelp(+b.dataset.p));
  card.querySelector('#hPrev').onclick = () => showHelp(helpPage - 1);
  card.querySelector('#hNext').onclick = () => showHelp(helpPage + 1);
  card.querySelector('#ovClose').onclick = () => hideOverlay();
  $('overlay').classList.add('show');
}
$('helpBtn').innerHTML = BOOK_SVG;
$('helpBtn').onclick = () => showHelp();