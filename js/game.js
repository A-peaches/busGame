// 멍냥이의 버스여행 - 게임 화면 배치, 입력(터치), 매 프레임 업데이트
// =====================================================================
//  게임 화면 배치
// =====================================================================
function layout() {
  const W = stage.clientWidth, H = stage.clientHeight;
  if (!W || !H) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  L.W = W; L.H = H;
  const pad = 10;

  // 승객 구역: 빙글빙글 도는 원형 길 + 원에 들어가려고 기다리는 줄
  L.pr = clamp(W / 46, 6, 10);
  L.laneW = L.pr * 2.9;
  L.sp = L.pr * 2.15;
  L.qTop = 2; L.qH = clamp(H * 0.27, 130, 250);
  L.headRoom = L.pr * 2.3;
  L.ry = Math.max(20, (L.qH - L.laneW - L.headRoom - 12) / 2);
  L.rx = Math.min((W - 28) * 0.34, L.ry * 1.2);      // 하트가 옆으로 늘어나지 않게
  L.rcx = 16 + L.laneW / 2 + L.rx + 4;
  L.rcy = L.qTop + L.headRoom + 6 + L.laneW / 2 + L.ry;
  buildRing();
  buildWaitPath();
  L.tufts = [];
  const tr = mulberry32(7);
  for (let i = 0; i < 26; i++) L.tufts.push([14 + tr() * (W - 28), L.qTop + 8 + tr() * (L.qH - 16), tr()]);

  // 하트 왼쪽 아래(출구)에서 정류장으로 내려가는 길은 buildRing()에서 정해요

  // 정류장: 위쪽 보도(걸어가는 길) + 대기 칸 + 아래쪽 찻길(버스가 떠나는 길)
  L.sTop = L.qTop + L.qH + 8;
  L.swH = L.pr * 2.2;                                         // 보도 높이
  L.walkY = L.sTop + L.swH * 0.55;
  L.sH = clamp(H * 0.11, 56, 100);
  L.roadH = L.pr * 2.8;
  L.sw = Math.min((W - 2 * pad) / MAX_SLOTS, L.sH * 0.62);
  L.sx0 = (W - L.sw * MAX_SLOTS) / 2;
  L.roadY = L.sTop + L.swH + L.sH + L.roadH / 2;

  // 주차장
  const bTop = L.sTop + L.swH + L.sH + L.roadH + 12;
  let bH = H - bTop - pad;
  // 레일 버스 이벤트: 주차장 아래에 레일 자리를 만들어요
  if (S.rail) {
    L.railH = clamp(H * 0.085, 50, 76);
    bH -= L.railH + 8;
    L.railTop = bTop + bH + 8;
    L.railW = (W - 32) / S.rail.K;
  }
  L.bTop = bTop; L.bH = bH;    // 주차장 바탕은 위 패널들과 같은 가로 폭 (8 ~ W-8)
  L.cs = Math.floor(Math.min((W - 2 * pad - 16) / (S.cols + 0.4), (bH - 16) / (S.rows + 0.4)));
  L.bx = (W - L.cs * S.cols) / 2;
  L.by = bTop + (bH - L.cs * S.rows) / 2;

  syncRing();
}

// 점들을 이어 만든 길 (길이를 따라 위치를 구할 수 있게)
function makePath(pts, closed) {
  if (closed) pts = pts.concat([pts[0]]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, total: cum[cum.length - 1] };
}
function pathPoint(path, s) {
  const { cum, pts, total } = path;
  if (s <= 0) return { x: pts[0][0], y: pts[0][1] };
  if (s >= total) { const p = pts[pts.length - 1]; return { x: p[0], y: p[1] }; }
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
  const t = (s - cum[lo]) / (cum[hi] - cum[lo] || 1);
  return { x: lerp(pts[lo][0], pts[hi][0], t), y: lerp(pts[lo][1], pts[hi][1], t) };
}

// 하트 모양 길 (가장 오른쪽 점 = 입구에서 시작해 시계 방향으로 돕니다)
function buildRing() {
  const raw = [];
  for (let i = 0; i < 200; i++) {
    const t = i / 200 * Math.PI * 2;
    raw.push([16 * Math.sin(t) ** 3, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]);
  }
  const ys = raw.map(p => p[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
  let pts = raw.map(([x, y]) => [L.rcx + x / 16 * L.rx, L.rcy + ((y - y0) / (y1 - y0) * 2 - 1) * L.ry]);
  let k = 0;
  pts.forEach((p, i) => { if (p[0] > pts[k][0]) k = i; });
  pts = pts.slice(k).concat(pts.slice(0, k));            // 입구(가장 오른쪽)부터 시작
  L.ring = makePath(pts, true);
  L.ringPts = pts;
  L.ringN = Math.max(8, Math.floor(L.ring.total / (L.sp * 1.05)));
  L.ringSp = L.ring.total / L.ringN;
  // 출구: 하트의 왼쪽 아래 비탈
  let best = -Infinity;
  pts.forEach(([x, y], i) => {
    const sc = -(x - L.rcx) / L.rx + (y - L.rcy) / L.ry;
    if (sc > best) { best = sc; L.exitIdx = i; }
  });
  [L.exitX, L.exitY] = pts[L.exitIdx];
  // 가운데 잔디 섬 (하트를 안쪽으로 줄인 모양)
  const kk = 1 - (L.laneW / 2 + 4) / L.ry, cy = L.rcy + L.ry * 0.05;
  L.islandPts = pts.map(([x, y]) => [L.rcx + (x - L.rcx) * kk, cy + (y - cy) * kk]);
}

// 원 입구(오른쪽)에서 시작해 위아래로 구불구불한 대기 줄
function buildWaitPath() {
  const g = L.laneW + 7, [ex, ey] = L.ring.pts[0];
  const xa = ex + L.laneW / 2 + 6, xb = L.W - 16;
  const C = Math.max(1, Math.floor((xb - xa) / g));
  const yT = L.qTop + L.headRoom + 6 + L.laneW / 2 + g / 2;
  const yB = L.qTop + L.qH - 6 - L.laneW / 2 - g / 2;
  const pts = [[ex, ey]];
  for (let c = 0; c < C; c++) {
    // 마지막 줄이 위로 올라가서, 줄의 시작(집)이 오른쪽 위에 오도록
    const x = xa + g / 2 + c * g, down = (C - 1 - c) % 2 === 1;
    const ys = c === 0 ? ey : (down ? yT : yB), ye = down ? yB : yT;
    const steps = Math.max(2, Math.ceil(Math.abs(ye - ys) / 6));
    for (let i = 0; i <= steps; i++) pts.push([x, lerp(ys, ye, i / steps)]);
    if (c < C - 1) {
      for (let i = 1; i < 14; i++) {
        const a = down ? Math.PI - (i / 14) * Math.PI : Math.PI + (i / 14) * Math.PI;
        pts.push([x + g / 2 + Math.cos(a) * g / 2, ye + Math.sin(a) * g / 2]);
      }
    }
  }
  // 마지막 줄은 패널 위쪽 경계선까지 쭉 이어서, 줄이 밖에서부터 계속 이어지는 것처럼
  const [lx, ly] = pts[pts.length - 1];
  if (ly < L.qTop + L.qH / 2) {
    for (let y = ly - 6; y > L.qTop - 4; y -= 6) pts.push([lx, y]);
    pts.push([lx, L.qTop - 4]);
  }
  L.wait = makePath(pts, false);
  L.waitMax = Math.max(0, Math.floor(L.wait.total / L.sp) - 1);
}

// 화면 크기가 바뀌어 원 위 자리 수가 달라지면 승객을 다시 배치
function syncRing() {
  if (S.ring.length === L.ringN) return;
  const ppl = S.ring.filter(Boolean);
  S.ring = new Array(L.ringN).fill(null);
  ppl.forEach((p, i) => { if (i < L.ringN) S.ring[i] = p; else S.waiting.unshift(p); });
}
const ringS = k => (k * L.ringSp + S.ringOff) % L.ring.total;
const remainingCount = () => S.waiting.length + S.ring.filter(Boolean).length + S.flying.length;

function bestVehicleFor(color) {
  let best = null;
  for (let i = 0; i < S.slotCount; i++) {
    const v = S.slots[i];
    // 같은 색 버스가 여럿이면 왼쪽 칸부터 채워요
    if (v && v.state === 'slot' && v.color === color && v.filled + v.incoming < v.cap) return v;
  }
  return best;
}

const slotPos = i => ({ x: L.sx0 + L.sw * (i + 0.5), y: L.sTop + L.swH + L.sH / 2 });

// 원 위의 자리 → 원 출구 → 정류장 보도 → 내 버스 문 앞까지 걸어가는 길
//   (잔디 섬을 가로지르지 않고 원형 길을 따라 출구까지 가요)
function walkRoute(p, v, s0) {
  const sp = slotPos(v.slot), top = sp.y - slotSize(v).l / 2;
  const qb = L.qTop + L.qH, T = L.ring.total;
  const sExit = L.ring.cum[L.exitIdx];
  let d = ((sExit - s0) % T + T) % T;            // 앞으로 돌아가는 거리
  const dir = d <= T / 2 ? 1 : -1;               // 더 가까운 쪽으로
  if (dir < 0) d = T - d;
  const pts = [[p.x, p.y]];
  for (let u = 8; u < d; u += 8) { const q = pathPoint(L.ring, ((s0 + dir * u) % T + T) % T); pts.push([q.x, q.y]); }
  pts.push([L.exitX, L.exitY], [L.exitX, qb - 4], [L.exitX, L.walkY], [sp.x, L.walkY], [sp.x, top + 2]);
  return makePath(pts, false);
}
const slotSize = v => { const w = L.sw * 0.72; return { w, l: Math.min(L.sH * 0.9, w * (1.3 + v.len * 0.32)) }; };

// =====================================================================
//  입력
// =====================================================================
// 화면을 꾹 누르고 있으면 빨리감기! (손을 떼면 원래 속도로)
let holdTimer = 0, holdXY = null;
function holdEnd() { clearTimeout(holdTimer); holdXY = null; if (S) S.holding = false; }
canvas.addEventListener('pointerdown', e => {
  holdXY = [e.clientX, e.clientY];
  clearTimeout(holdTimer);
  holdTimer = setTimeout(() => { if (S && !S.over && holdXY) { S.holding = true; S.treeShake = 0.6; } }, 350);
});
canvas.addEventListener('pointermove', e => {
  if (holdXY && Math.hypot(e.clientX - holdXY[0], e.clientY - holdXY[1]) > 14) holdEnd();
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => canvas.addEventListener(ev, holdEnd));
canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('pointerdown', e => {
  if (!S || S.over) return;
  const r = canvas.getBoundingClientRect();
  const px = e.clientX - r.left, py = e.clientY - r.top;

  if (py > L.sTop + L.swH && py < L.sTop + L.swH + L.sH) {
    const i = Math.floor((px - L.sx0) / L.sw);
    if (i >= S.slotCount && i < MAX_SLOTS) { useSlotBooster(); return; }
  }

  // 레일 버스
  if (S.rail && py >= L.railTop && py <= L.railTop + L.railH) {
    const i = Math.floor((px - 16) / L.railW);
    if (i >= 0 && i < S.rail.K) tapRail(i);
    return;
  }

  const gx = (px - L.bx) / L.cs, gy = (py - L.by) / L.cs;
  let hit = null;
  for (const v of S.vehicles) {
    if (v.state !== 'parked') continue;
    const a = axes(v.ang), dx = gx - v.cx, dy = gy - v.cy;
    if (Math.abs(dx * a.ux + dy * a.uy) <= v.l / 2 + 0.08 && Math.abs(dx * a.vx + dy * a.vy) <= v.w / 2 + 0.14) hit = v;
  }
  if (hit) tapVehicle(hit);
});

// 주차장 버스를 누르면: 원래 동작 + 레일이 한 칸 움직여요
function tapVehicle(v) {
  if (S.vehicles.some(o => o.move) || (S.shuffle && S.shuffle.wait > 0)) return;   // 자리 바꾸는 중엔 잠깐 기다려요
  tapParked(v);
  railStep();
  turnStep();
}
function tapParked(v) {
  if (S.liftMode) {
    const si = freeSlot();
    if (si < 0) { toast('빈 자리가 없어요!'); return; }
    S.liftMode = false;
    S.boost.lift--;
    launch(v, si, true);
    updateUI();
    return;
  }

  const blockers = parkedBlockers(v);
  if (blockers.length) {
    // 막힌 버스: 부딪히는 곳까지 갔다가 돌아오기
    const a = axes(v.ang), front = v.cx * a.ux + v.cy * a.uy + v.l / 2;
    let d = Infinity;
    for (const o of blockers) d = Math.min(d, proj(o.body, a.ux, a.uy)[0] - front);
    d = Math.max(0, d);
    v.bump = { d, t: 0, T: 0.22 + d * 0.05 };
    sfx('block');
    return;
  }

  const si = freeSlot();
  if (si < 0) { v.shake = 0.35; toast('대기 칸이 꽉 찼어요!'); sfx('block'); return; }
  launch(v, si, false);
}

function launch(v, si, lifted) {
  countShuffle();
  S.slots[si] = v;
  v.slot = si;
  v.bump = null;
  if (lifted) {
    v.hidden = false;
    v.lifted = true;
    v.state = 'toSlot';
    v.t = 0;
    v.from = { x: L.bx + v.cx * L.cs, y: L.by + v.cy * L.cs, a: v.ang, w: v.w * L.cs, l: v.l * L.cs };
  } else {
    v.state = 'exiting';
    v.off = 0;
    // 버스 꼬리가 주차장 밖으로 나갈 때까지의 거리
    const a = axes(v.ang);
    const rx = v.cx - a.ux * v.l / 2, ry = v.cy - a.uy * v.l / 2;
    let t = Infinity;
    if (a.ux > 1e-6) t = Math.min(t, (S.cols - rx) / a.ux);
    if (a.ux < -1e-6) t = Math.min(t, -rx / a.ux);
    if (a.uy > 1e-6) t = Math.min(t, (S.rows - ry) / a.uy);
    if (a.uy < -1e-6) t = Math.min(t, -ry / a.uy);
    v.exitDist = t + v.w * 0.5 + 0.1;
  }
  revealCheck(false);
  sfx('go');
}

// 주차장을 빠져나온 버스가 찻길 옆에서 들어와 부릉부릉 달려와서 칸으로 쏙 들어가요
//   dirx: 빠져나간 방향(오른쪽 +). 오른쪽으로 나갔으면 오른쪽 끝에서 들어와요.
function startArrive(v, dirx) {
  const p = slotPos(v.slot);
  v.side = dirx > 0.3 ? 1 : dirx < -0.3 ? -1 : (p.x < L.W / 2 ? -1 : 1);
  const x0 = v.side > 0 ? L.W - 8 : 8;
  v.arrT = 0.5 + Math.abs(x0 - p.x) / (L.W * 1.25);
  v.state = 'toSlot'; v.lifted = false;
  v.t = -0.1;              // 아주 잠깐 안 보였다가 (주차장을 돌아 나오는 동안)
  sfx('vroom');
}

function useSlotBooster() {
  if (S.boost.slot <= 0 || S.slotCount >= MAX_SLOTS) {
    toast(S.slotCount >= MAX_SLOTS ? '더 이상 늘릴 수 없어요' : '자리 추가를 이미 썼어요');
    return false;
  }
  S.boost.slot--;
  S.slotCount++;
  sfx('depart');
  updateUI();
  return true;
}

$('slotBtn').onclick = () => { if (S && !S.over) useSlotBooster(); };
$('liftBtn').onclick = () => {
  if (!S || S.over || S.boost.lift <= 0) return;
  S.liftMode = !S.liftMode;
  if (S.liftMode) toast('꺼낼 버스를 아무거나 눌러 주세요', 2000);
  updateUI();
};
// 게임 도중 홈 버튼: 나가면 하트가 1개 줄어든다고 먼저 물어봐요
$('homeBtn').onclick = () => {
  if (!S || S.over) { showMenu(); return; }
  refreshHearts();
  const card = $('card');
  card.innerHTML = `<h2>지도로 나갈까요?</h2>
    <p>지금 나가면 이 단계는 실패로 쳐서 하트가 1개 줄어요.<br>
    <span class="heartNow">${HEART_SVG}지금 하트 ${hearts.n}개</span></p>
    <button class="btn" id="ovStay">계속 하기</button>
    <button class="btn alt" id="ovLeave">나가기 (하트 1개)</button>`;
  card.querySelector('#ovStay').onclick = () => hideOverlay();
  card.querySelector('#ovLeave').onclick = () => { useHeart(); showMenu(); };
  $('overlay').classList.add('show');
};
$('settingsBtn').onclick = $('settingsBtn2').onclick = () => showSettings();
document.querySelectorAll('.settingsBtn').forEach(b => b.innerHTML = GEAR_SVG);
// 꾹 누르기(길게 터치) 메뉴, 페이지 전체가 선택되는 현상, 두 번 탭 확대 막기
document.addEventListener('contextmenu', e => { if (!e.target.closest('input')) e.preventDefault(); });
document.addEventListener('selectstart', e => { if (!e.target.closest || !e.target.closest('input')) e.preventDefault(); });
let lastTouchEnd = 0;
document.addEventListener('touchend', e => {
  const now = Date.now();
  if (now - lastTouchEnd < 300 && !e.target.closest('input')) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
// 화면의 모든 버튼에 "톡" 피아노 소리
document.addEventListener('click', e => { if (e.target.closest('button')) sfx('click'); }, true);
window.addEventListener('resize', () => { if (S) layout(); else renderMap(); });

// =====================================================================
//  매 프레임 업데이트
// =====================================================================
function update(dt) {
  if (!S) return;
  S.time += dt;

  if (S.shuffle && S.shuffle.wait > 0) {
    S.shuffle.wait -= dt;
    if (S.shuffle.wait <= 0) { S.shuffle.wait = 0; doShuffle(); updateUI(); }
  }
  for (const v of S.vehicles) {
    if (v.move) { v.move.t += dt * 1.6; if (v.move.t >= 1) { v.move = null; revealCheck(false); } }
    if (v.pop < 1) v.pop = Math.min(1, v.pop + dt * 4);
    if (v.shake > 0) v.shake -= dt;
    if (v.spin > 0) v.spin = Math.max(0, v.spin - dt * 3.5);

    if (v.state === 'parked' && v.bump) {
      const b = v.bump;
      b.t += dt;
      if (b.t >= b.T) { v.bump = null; v.off = 0; if (v.turnLater) uTurn(v); }
      else {
        const u = b.t / b.T, peak = b.d + 0.15;
        v.off = u < 0.45 ? peak * easeOut(u / 0.45) : peak * (1 - easeIn((u - 0.45) / 0.55));
      }
    } else if (v.state === 'exiting') {
      // 화살표 방향으로 쭉 빠져서 주차장 테두리 밖으로 완전히 나갈 때까지 달려요
      v.off += dt * 16;
      const a = axes(v.ang);
      const tx = L.bx + (v.cx + a.ux * (v.off - v.l / 2)) * L.cs, ty = L.by + (v.cy + a.uy * (v.off - v.l / 2)) * L.cs;
      const out = tx < 13 || tx > L.W - 13 || ty < L.bTop + 1 || ty > L.bTop + L.bH - 6;
      if (out || v.off > v.exitDist + 40) startArrive(v, a.ux);
    } else if (v.state === 'toSlot') {
      v.t += dt / (v.lifted ? 0.55 : v.arrT);
      if (v.t >= 1) { v.t = 1; v.state = 'slot'; }
    } else if (v.state === 'slot') {
      if (v.filled >= v.cap && v.incoming === 0) {
        v.state = 'departing'; v.t = 0; v.left = false;
        const p = slotPos(v.slot); v.depX = p.x; v.depY = p.y;
        sfx('depart');
      }
    } else if (v.state === 'departing') {
      // 칸에서 아래 찻길로 빠져나와 오른쪽으로 신나게 떠나요
      v.t += dt / 1.9;
      if (!v.left && v.t >= 0.22) { v.left = true; S.slots[v.slot] = null; }   // 칸은 먼저 비워 줘요
      if (v.t >= 1) { v.state = 'gone'; checkWin(); }
    }
  }

  // 원이 빙글빙글 돌고, 빈자리가 입구를 지나가면 기다리던 승객이 들어갑니다
  // 화면을 꾹 누르면 빨리감기 (줄이 빠르게 하트 길로 들어와요)
  if (S.holding && !S.over) S.rush = Math.max(S.rush, 0.15);   // 꾹 누르는 동안 계속 빨리
  if (S.rush > 0) S.rush -= dt;
  if (S.treeShake > 0) S.treeShake -= dt;
  if (S.rail && S.rail.anim > 0) S.rail.anim = Math.max(0, S.rail.anim - dt / 0.25);
  const fast = S.rush > 0 ? 3.5 : 1;
  S.ringOff = (S.ringOff + dt * L.pr * 3.2 * fast) % L.ring.total;
  for (let k = 0; k < S.ring.length; k++) {
    if (!S.ring[k] && S.waiting.length && ringS(k) < L.ringSp * 0.7) S.ring[k] = S.waiting.shift();
  }

  // 승객 태우기: 원 위에 있는 승객은 누구든 같은 색 버스에 탈 수 있어요
  S.boardTimer -= dt;
  if (S.boardTimer <= 0) {
    let pick = null, best = Infinity;
    S.ring.forEach((p, k) => {
      if (!p || p.x === undefined) return;
      const v = bestVehicleFor(p.color);
      const d = (p.x - L.exitX) ** 2 + (p.y - L.exitY) ** 2;   // 출구에 가까운 친구부터
      if (v && d < best) { best = d; pick = { k, p, v }; }
    });
    if (pick) {
      const { k, p, v } = pick;
      S.ring[k] = null;
      v.incoming++;
      // 버스까지 걸어가는 친구 (눈이 반짝반짝!)
      S.flying.push({ color: p.color, kind: p.kind, bag: p.bag, ribbon: p.ribbon, id: p.id, path: walkRoute(p, v, ringS(k)), s: 0, v });
      S.boardTimer = S.rush > 0 ? 0.02 : 0.06;   // 꾹 누르는 동안엔 더 빨리 차례차례 출발
      sfx('board', v.filled + v.incoming);
      updateUI();
    }
  }

  let landed = false;
  for (const f of S.flying) {
    f.s += dt * L.pr * 14 * (S.rush > 0 ? 2.5 : 1);   // 꾹 누르는 동안엔 버스까지 더 빨리 걸어가요
    if (f.s >= f.path.total) { f.v.filled++; f.v.incoming--; landed = true; f.done = true; }
  }
  S.flying = S.flying.filter(f => !f.done);
  if (landed) updateUI();

  // 승객들이 자기 자리로 걸어가기
  const k = Math.min(1, dt * 10 * (S.rush > 0 ? 3 : 1));
  const walkTo = (p, t) => {
    if (p.x === undefined) { p.x = t.x; p.y = t.y; }
    const dx = t.x - p.x, dy = t.y - p.y;
    p.x += dx * k; p.y += dy * k;
    p.walking = Math.abs(dx) + Math.abs(dy) > 1.5;
  };
  S.ring.forEach((p, i) => { if (p) walkTo(p, pathPoint(L.ring, ringS(i))); });
  S.waiting.forEach((p, i) => {
    if (i < L.waitMax) walkTo(p, pathPoint(L.wait, (i + 1) * L.sp));
    else p.x = undefined;
  });

  checkLose();
}

function checkWin() {
  if (S.over) return;
  if (remainingCount() === 0 && S.vehicles.every(v => v.state === 'gone')) {
    S.over = true;
    if (S.level + 1 > unlocked) { unlocked = Math.min(MAX_LEVEL, S.level + 1); store.set('busGame.unlocked', unlocked); }
    if (typeof syncSoon === 'function') syncSoon();   // 깬 단계를 서버에도 저장
    sfx('win');
    setTimeout(() => showOverlay('win'), 350);
  }
}

function checkLose() {
  if (S.over || S.flying.length || !remainingCount()) return;
  if (S.vehicles.some(v => ['exiting', 'toSlot', 'departing'].includes(v.state))) return;
  if (S.vehicles.some(v => v.state === 'slot' && v.filled >= v.cap)) return;
  for (let i = 0; i < S.slotCount; i++) if (!S.slots[i]) return;
  // 원에 빈자리가 있고 기다리는 승객이 있으면 아직 채워지는 중
  if (S.waiting.length && S.ring.some(p => !p)) return;
  // 원 위의 누군가가 탈 수 있으면 아직 진행 중
  if (S.ring.some(p => p && bestVehicleFor(p.color))) return;
  S.over = true;
  sfx('lose');
  setTimeout(() => showOverlay('lose'), 400);
}

