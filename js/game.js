// 멍냥이의 버스여행 - 게임 화면 배치, 입력(터치), 매 프레임 업데이트
// =====================================================================
//  게임 화면 배치
// =====================================================================
function layout() {
  const W = stage.clientWidth, H = stage.clientHeight;
  if (!W || !H) return;
  const dpr = DPR;
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
  // 주차장 버스가 너무 작아지지 않게: 화면이 낮으면 승객 구역·정류장·레일을 조금씩 줄여 주차장 높이를 확보해요
  let sH = clamp(H * 0.095, 48, 88), railH = S.rail ? clamp(H * 0.085, 50, 76) : 0;
  {
    const fixed = L.qTop + 8 + L.pr * 2.2 + L.pr * 2.8 + 12 + pad + (S.rail ? 8 : 0);
    const want = CS_MIN * (S.rows + 0.4) + 16;                       // 이만큼은 있어야 버스가 적당한 크기
    const fitW = (W - 2 * pad - 16) / (S.cols + 0.4);                 // 가로가 먼저 모자라면 줄여도 소용없어요
    let need = Math.min(want, fitW * (S.rows + 0.4) + 16) - (H - fixed - L.qH - sH - railH);
    const take = (cur, min) => { const d = Math.max(0, Math.min(need, cur - min)); need -= d; return cur - d; };
    if (need > 0) L.qH = take(L.qH, 96);
    if (need > 0) sH = take(sH, 40);
    if (need > 0 && S.rail) railH = take(railH, 40);
  }
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
  L.swH = 4;                                                  // (보도는 없앴어요: 칸 위쪽 여백만)
  L.walkY = L.sTop - 2;                                       // 멍냥이들은 정류장 판 위쪽 가장자리를 따라 걸어가요
  L.sH = sH;
  L.roadH = L.pr * 2.8;
  L.sw = Math.min((W - 2 * pad) / MAX_SLOTS, L.sH * 0.62);
  L.sx0 = (W - L.sw * MAX_SLOTS) / 2;
  L.roadY = L.sTop + L.swH + L.sH + L.roadH / 2;

  // 주차장
  const bTop = L.sTop + L.swH + L.sH + L.roadH + 12;
  let bH = H - bTop - pad;
  // 레일 버스 이벤트: 주차장 아래에 레일 자리를 만들어요
  if (S.rail) {
    L.railH = railH;
    bH -= L.railH + 8;
    L.railTop = bTop + bH + 8;
  }
  L.bTop = bTop; L.bH = bH;    // 주차장 바탕은 위 패널들과 같은 가로 폭 (8 ~ W-8)
  L.cs = Math.floor(Math.min((W - 2 * pad - 16) / (S.cols + 0.4), (bH - 16) / (S.rows + 0.4)));
  L.bx = (W - L.cs * S.cols) / 2;
  L.by = bTop + (bH - L.cs * S.rows) / 2;
  if (S.rail) { L.railW = L.cs; L.rx0 = L.bx + (S.rail.off || 0) * L.cs; }   // 레일 칸은 주차장 세로줄과 딱 맞아요 (돌린 판에서는 가운데 줄들)

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
  const d = ((sExit - s0) % T + T) % T;          // 하트 길이 도는 방향 그대로 출구까지 가는 거리 (뒤로 돌아가지 않아요)
  const pts = [[p.x, p.y]];
  for (let u = 8; u < d; u += 8) { const q = pathPoint(L.ring, (s0 + u) % T); pts.push([q.x, q.y]); }
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
    const i = Math.floor((px - L.rx0) / L.railW);
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

// 주차장 버스를 누르면: 원래 동작. 레일은 버스가 실제로 빠져나갔을 때만 한 칸 움직여요
//   (못 나가는 버스를 일부러 눌러 레일만 돌리는 꼼수 막기)
function tapVehicle(v) {
  if (S.vehicles.some(o => o.move) || (S.shuffle && S.shuffle.wait > 0)) return;   // 자리 바꾸는 중엔 잠깐 기다려요
  if (tapParked(v)) { railStep(); turnStep(); }   // U턴 차례도 버스가 실제로 빠져나갔을 때만 지나가요
  else unstickTurners();
}
// 꺼낼 수 있는 버스가 하나도 없는데 U턴 버스를 돌리면 길이 열린다면, 바로 U턴시켜 줘요 (판이 완전히 막히지 않게)
function unstickTurners() {
  const parked = S.vehicles.filter(v => v.state === 'parked');
  if (!parked.some(v => v.turner) || parked.some(v => !v.bump && parkedBlockers(v).length === 0)) return;
  if (S.rail && S.rail.items.some((v, i) => v && (railToBoard(v, i), parkedBlockers(v).length === 0))) return;
  S.turnLeft = S.turnEvery;
  for (const v of parked) if (v.turner) { if (v.bump) v.turnLater = true; else uTurn(v); }
}
function tapParked(v) {
  if (S.liftMode) {
    const si = freeSlot();
    if (si < 0) { toast('빈 자리가 없어요!'); return; }
    S.liftMode = false;
    S.boost.lift--;
    launch(v, si, true);
    updateUI();
    return true;
  }

  const blockers = parkedBlockers(v);
  if (blockers.length) {
    // 막힌 버스: 부딪히는 곳까지 갔다가 돌아오기
    const a = axes(v.ang), front = v.cx * a.ux + v.cy * a.uy + v.l / 2;
    let d = Infinity;
    for (const o of blockers) d = Math.min(d, proj(o.body, a.ux, a.uy)[0] - front);
    d = Math.max(0, d);
    v.bump = { d, t: 0, T: 0.22 + d * 0.05 };
    loseLife();
    sfx('block');
    return;
  }

  const si = freeSlot();
  if (si < 0) { v.shake = 0.35; toast('대기 칸이 꽉 찼어요!'); sfx('block'); return; }
  launch(v, si, false);
  return true;
}

function launch(v, si, lifted) {
  countShuffle();
  countBalloon();
  countRainbow();
  countWing(v);
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
// 출발 차례: 찻길 위에 떠나는 중인 다른 버스가 내 앞(오른쪽)으로 충분히 지나갔을 때만 출발해요
//   (같은 시간에 여러 대가 다 차도 한 대씩 차례차례 떠나요)
function roadClearFor(v) {
  const myX = slotPos(v.slot).x, gap = slotSize(v).l * 1.3;
  for (const o of S.vehicles) {
    if (o === v || o.state !== 'departing') continue;
    if (vehiclePose(o).x < myX + gap) return false;
  }
  // 찻길로 들어오는 중인 버스와도 부딪히지 않게
  for (const o of S.vehicles) if (o.state === 'toSlot' && !o.lifted && o.t > 0 && o.t < 0.66) return false;
  return true;
}

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
// ---- 색 섞기 ('매우 어려움' 단계에서만 1개) ----
//   지금 꺼낼 수 있는 버스들의 색을, 기다리는 멍냥이들에게 가장 필요한 색으로 바꿔 주고, 나머지 버스들은 무작위로 섞어요.
//   같은 크기 버스끼리만 색을 맞바꿔서 색마다 태울 자리 수는 그대로예요 (풀 수 있는지는 변하지 않아요)
function useMixBooster() {
  if (!S || S.over || S.boost.mix <= 0 || S.vehicles.some(v => v.move)) return;
  const parked = S.vehicles.filter(v => v.state === 'parked');
  const free = parked.filter(v => !v.hidden && !v.bump && parkedBlockers(v).length === 0);
  if (!free.length) { toast('지금 꺼낼 수 있는 버스가 없어요'); return; }
  // 곧 탈 멍냥이 순서: 하트 길 위에서 출구에 가까운 순 → 줄 선 순
  const T = L.ring.total, sExit = L.ring.cum[L.exitIdx];
  const onRing = S.ring.map((p, k) => p && { p, d: ((sExit - ringS(k)) % T + T) % T }).filter(Boolean).sort((a, b) => a.d - b.d).map(o => o.p);
  const people = onRing.concat(S.waiting).slice(0, 40);
  // 대기 칸 버스가 이미 받아 줄 수 있는 자리는 빼고, 급한 색부터 차례로
  const room = {};
  for (const v of S.slots) if (v && v.state === 'slot') room[v.color] = (room[v.color] || 0) + (v.cap - v.filled - v.incoming);
  const want = [];
  for (const p of people) {
    if (room[p.color] > 0) { room[p.color]--; continue; }
    if (!want.includes(p.color)) want.push(p.color);
  }
  // 꺼낼 수 있는 버스가 이미 급한 색이면 그대로 두고, 나머지 버스를 남은 급한 색으로 바꿔요
  const freeSet = new Set(free), done = new Set();
  const todo = want.slice(0, free.length);
  for (const v of free) { const i = todo.indexOf(v.color); if (i >= 0) { todo.splice(i, 1); done.add(v); } }
  let changed = 0;
  for (const v of free) {
    if (done.has(v)) continue;
    for (let i = 0; i < todo.length; i++) {
      const c = todo[i];
      // 같은 크기에, 그 색인 다른 버스(막힌 버스·레일 버스)와 색을 맞바꿔요
      const o = S.vehicles.find(x => x !== v && !freeSet.has(x) && !done.has(x) && x.color === c && x.cap === v.cap && (x.state === 'parked' || x.state === 'rail'));
      if (!o) continue;
      o.color = v.color; v.color = c;
      done.add(v); done.add(o); todo.splice(i, 1); changed++;
      break;
    }
  }
  // 나머지 버스들도 진짜로 섞어요: 같은 자리 수(8·16·24·32석)끼리라면 대각선이든 가로·세로든 레일이든 서로 색을 바꿔요
  //   (자리 수별 색 개수는 그대로라 풀 수 있는지는 변하지 않아요)
  const groups = {};
  for (const x of S.vehicles) if (!done.has(x) && (x.state === 'parked' || x.state === 'rail')) (groups[x.cap] = groups[x.cap] || []).push(x);
  for (const g of Object.values(groups)) {
    const cols = g.map(x => x.color);
    for (let i = cols.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cols[i], cols[j]] = [cols[j], cols[i]]; }
    g.forEach((x, i) => { if (x.color !== cols[i]) { x.color = cols[i]; changed++; } });
  }
  // 알림 없이: 보이는 버스들이 잠깐 이 색 저 색으로 빙글빙글 바뀌다가 하나씩 제 색에 멈춰요
  const pool = [...new Set(S.vehicles.map(x => x.color))];
  for (const x of S.vehicles) {
    if (x.state !== 'parked' || x.hidden) continue;
    x.mixT = 0.55 + Math.random() * 0.45; x.mixTick = 0; x.mixPool = pool;
  }
  if (changed) S.boost.mix--;                 // 아무것도 안 바뀌었으면(버스가 거의 없을 때) 아이템은 그대로 남아요
  sfx('go');
  updateUI();
}
$('mixBtn').onclick = () => useMixBooster();
// 게임 도중 홈 버튼: 나가면 하트가 1개 줄어든다고 먼저 물어봐요
// 지도 버튼 그림: 세 번 접힌 종이 지도 + 빨간 핀
$('homeBtn').innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><g stroke="#4a3b2c" stroke-width="1.4" stroke-linejoin="round">
  <path d="M3 6.5 L8.5 4.5 L15.5 6.5 L21 4.5 V17.5 L15.5 19.5 L8.5 17.5 L3 19.5Z" fill="#fbf3e2"/>
  <path d="M8.5 4.5 V17.5 M15.5 6.5 V19.5" fill="none"/>
  <path d="M4.6 15.6 Q7 12.2 10.2 13.4 T15 10.4 Q17 9.6 19.2 8.2" fill="none" stroke="#c9a45c" stroke-width="1.3" stroke-dasharray="1.8 1.6"/>
  <path d="M17.6 4.2 C15.9 4.2 15 5.4 15 6.6 C15 8.4 17.6 10.8 17.6 10.8 C17.6 10.8 20.2 8.4 20.2 6.6 C20.2 5.4 19.3 4.2 17.6 4.2Z" fill="#e8768e" stroke-width="1.1"/>
  <circle cx="17.6" cy="6.6" r=".9" fill="#fbf3e2" stroke="none"/></g></svg>`;
$('homeBtn').onclick = () => {
  if (!S || S.over) { showMenu(); return; }
  refreshHearts();
  const card = $('card');
  card.innerHTML = `<h2>지도로 나갈까요?</h2>
    <p>지금 나가면 이 단계는 실패예요.<br>시작할 때 낸 하트는 돌려받지 못해요.<br>
    <span class="heartNow">${HEART_SVG}지금 하트 ${hearts.n}개</span></p>
    <button class="btn" id="ovStay">계속 하기</button>
    <button class="btn alt" id="ovLeave">나가기</button>`;
  card.querySelector('#ovStay').onclick = () => hideOverlay();
  card.querySelector('#ovLeave').onclick = () => { if (S && !S.daily) store.set('busGame.combo', 0); showMenu(); };   // 중간에 나가도 콤보 끊김
  $('overlay').classList.add('show');
};
$('settingsBtn').onclick = $('settingsBtn2').onclick = () => showSettings();
// 빨리감기 버튼: 누르면 켜지고 다시 누르면 꺼져요 (화면을 꾹 누르는 것과 같은 4배 속도)
$('ffBtn').innerHTML = `<svg viewBox="0 0 26 16" width="24" height="15" aria-hidden="true"><g fill="#fbf3e2" stroke="#4a3b2c" stroke-width="1.3" stroke-linejoin="round">
  <path d="M2 3 L9 8 L2 13Z"/><path d="M9 3 L16 8 L9 13Z"/></g><text x="21.5" y="12" text-anchor="middle" font-size="9" font-weight="700" fill="#4a3b2c">4</text></svg>`;
$('ffBtn').onclick = () => { if (!S || S.over) return; S.ff = !S.ff; $('ffBtn').classList.toggle('on', S.ff); };

// ---- 일시정지: 버튼을 누르면 모든 움직임이 멈추고, 멍냥이들이 엎드려 잠깐 조는 화면 (누르면 다시 시작) ----
const PAUSE_SVG = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><g fill="#fbf3e2" stroke="#4a3b2c" stroke-width="1.4" stroke-linejoin="round">
  <rect x="6" y="5" width="4.2" height="14" rx="1.4"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.4"/></g></svg>`;
$('pauseBtn').innerHTML = PAUSE_SVG;
function setPaused(on) {
  if (!S) return;
  S.paused = on;
  if (on) {
    S.holding = false;
    // 엎드려 자는 고양이·강아지 (메인 화면 벤치 친구와 같은 그림)
    const pic = (id, a) => { const el = $(id); if (!el.src) { const sp = spriteCv.get(animalSpriteId(a, true)); if (sp) el.src = sp.cv.toDataURL(); } };
    pic('sleepCat', { kind: 'cat', c: 6, ribbon: '#7fb4d6', bag: false });
    pic('sleepDog', { kind: 'dog', c: 3, ribbon: null, bag: false });
  }
  $('pauseCover').classList.toggle('show', on);
}
$('pauseBtn').onclick = () => { if (S && !S.over) setPaused(true); };
$('pauseCover').onclick = () => setPaused(false);
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
let resizeTimer = 0;
function onResize() {
  if (S) layout(); else if (typeof renderMap === 'function') renderMap();   // 다 불러오기 전에 크기가 바뀌어도 괜찮게
  // 가로로 돌렸으면 게임을 잠깐 멈춰요 (세로로 돌려 달라는 안내가 화면을 덮어요)
  if (S && !S.over && !S.paused && innerWidth > innerHeight && innerHeight <= 540 && typeof setPaused === 'function') setPaused(true);
}
window.addEventListener('resize', () => { onResize(); clearTimeout(resizeTimer); resizeTimer = setTimeout(onResize, 350); });   // 돌린 뒤 화면이 자리 잡으면 한 번 더
window.addEventListener('orientationchange', () => setTimeout(onResize, 400));
// 앱으로 돌아오면 화면이 자리 잡을 때까지 몇 번 더 크기를 맞춰요
const settleSize = () => [150, 600, 1500].forEach(ms => setTimeout(onResize, ms));
document.addEventListener('visibilitychange', () => { if (!document.hidden) settleSize(); });
window.addEventListener('pageshow', settleSize);

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
  if (S.rainbow && S.rainbow.t >= 0 && !S.rainbow.end) {   // 무지개비: 약 3초 동안 내리고, 0.6초쯤 색이 바뀌기 시작해요
    S.rainbow.t += dt;
    if (!S.rainbow.done && S.rainbow.t >= 0.6) { S.rainbow.done = true; rainbowRecolor(); }
    if (S.rainbow.t > 3.2) S.rainbow.end = true;
  }
  if (S.wing) {                                   // 날개 버스: 미리 알림 → 잠깐 뒤 날아가요
    if (S.wing.warn > 0) S.wing.warn -= dt;
    if (S.wing.wait > 0 && (S.wing.wait -= dt) <= 0) { S.wing.wait = 0; flyWingBus(); }
    if (S.wing.pending && !S.over && freeSlot() >= 0 && !S.vehicles.some(v => v.move)) flyWingBus();   // 자리가 났어요: 이제 날아와요
  }
  for (const f of S.lifeFx) f.t += dt;          // 깨진 하트 조각
  if (S.lifeFx.length && S.lifeFx.every(f => f.t > 1.2)) S.lifeFx.length = 0;
  // 풍선 버스: 주차장이 다 비었는데 하늘에 남아 있으면 바로 내려와요
  if (S.balloon && S.vehicles.some(v => v.state === 'sky') && !S.vehicles.some(v => v.state === 'parked' || v.state === 'landing')) landBalloon();
  for (const v of S.vehicles) {
    if (v.state === 'landing') {                 // 풍선을 달고 둥실둥실 내려와요
      v.fall += dt / 1.4;
      if (v.fall >= 1) { v.state = 'parked'; v.fall = 1; v.pop = 0; v.away = 0; revealCheck(false); }
    }
    if (v.away !== undefined && v.away < 1) v.away = Math.min(1, v.away + dt / 1.6);   // 내려앉으면 풍선은 하늘로
    if (v.move) { v.move.t += dt * 1.6; if (v.move.t >= 1) { v.move = null; revealCheck(false); } }
    if (v.pop < 1) v.pop = Math.min(1, v.pop + dt * 4);
    if (v.mixT > 0) {                           // 색 섞기: 짧게 이 색 저 색 → 제 색에 멈추며 통!
      v.mixT -= dt; v.mixTick -= dt;
      if (v.mixTick <= 0) { v.mixTick = 0.075; v.mixCol = v.mixPool[Math.floor(Math.random() * v.mixPool.length)]; }
      if (v.mixT <= 0) { v.mixT = 0; v.pop = 0; }
    }
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
      const out = v.fromRail ? ty < L.bTop + 1 : (tx < 13 || tx > L.W - 13 || ty < L.bTop + 1 || ty > L.bTop + L.bH - 6);
      if (out || v.off > v.exitDist + 40) startArrive(v, a.ux);
    } else if (v.state === 'toSlot') {
      v.t += dt / (v.winged ? 1.15 : v.lifted ? 0.55 : v.arrT);   // 날개 버스는 천천히 팔랑팔랑
      if (v.t >= 1) { v.t = 1; v.state = 'slot'; }
    } else if (v.state === 'slot') {
      if (v.filled >= v.cap && v.incoming === 0 && roadClearFor(v)) {   // 먼저 떠난 버스가 앞으로 충분히 가야 출발 (겹치지 않게)
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
  if ((S.holding || S.ff) && !S.over) S.rush = Math.max(S.rush, 0.15);   // 꾹 누르는 동안·빨리감기 버튼이 켜져 있는 동안 계속 빨리
  // 주차장·레일·하늘에 버스가 하나도 안 남았으면(다 대기 칸에 올라왔으면) 더 고를 게 없으니 약 6배로 후다닥 태워요
  S.allOut = !S.over && !S.vehicles.some(v => v.state === 'parked' || v.state === 'rail' || v.state === 'sky' || v.state === 'landing' || v.state === 'exiting')
    && !(S.rail && S.rail.items.some(Boolean));
  if (S.allOut) S.rush = Math.max(S.rush, 0.15);
  const zoom = S.allOut ? 1.5 : 1;               // 빨리감기(약 4배)보다 1.5배 더 → 약 6배
  if (S.rush > 0) S.rush -= dt;
  if (S.treeShake > 0) S.treeShake -= dt;
  if (S.rail && S.rail.anim > 0) S.rail.anim = Math.max(0, S.rail.anim - dt / 0.25);
  // 빈자리가 있고 기다리는 친구가 있으면 하트 길이 조금 더 빨리 돌아서 금방 채워져요 (듬성듬성하지 않게)
  const gaps = S.waiting.length ? S.ring.reduce((a, p) => a + (p ? 0 : 1), 0) : 0;
  // 꾹 누르면 약 3배속 (하트 길 5배, 걷기·탑승도 더 빠르게)
  const fast = S.rush > 0 ? 5.2 * zoom : 1 + Math.min(2.2, gaps * 0.35);
  S.ringOff = (S.ringOff + dt * L.pr * 4.5 * fast) % L.ring.total;   // 기본 속도 조금 올림 (출구 차례대로 타니까)
  for (let k = 0; k < S.ring.length; k++) {
    if (!S.ring[k] && S.waiting.length && ringS(k) < L.ringSp * 0.7) S.ring[k] = S.waiting.shift();
  }

  // 승객 태우기: 원 위에 있는 승객은 누구든 같은 색 버스에 탈 수 있어요
  S.boardTimer -= dt;
  if (S.boardTimer <= 0) {
    let pick = null, best = Infinity;
    const T = L.ring.total, sExit = L.ring.cum[L.exitIdx];
    S.ring.forEach((p, k) => {
      if (!p || p.x === undefined) return;
      const v = bestVehicleFor(p.color);
      const d = ((sExit - ringS(k)) % T + T) % T;              // 출구까지 남은 거리 (도는 방향)
      // 새치기 금지: 자기 차례(출구에 도착)가 된 친구만 내려서 버스를 타러 가요
      if (v && d < L.ringSp * 0.6 && d < best) { best = d; pick = { k, p, v }; }
    });
    if (pick) {
      const { k, p, v } = pick;
      S.ring[k] = null;
      v.incoming++;
      // 버스까지 걸어가는 친구 (눈이 반짝반짝!)
      S.flying.push({ color: p.color, kind: p.kind, bag: p.bag, ribbon: p.ribbon, id: p.id, path: walkRoute(p, v, ringS(k)), s: 0, v });
      S.boardTimer = S.rush > 0 ? 0.02 / zoom : 0.06;   // 꾹 누르는 동안엔 더 빨리 차례차례 출발
      sfx('board', v.filled + v.incoming);
      updateUI();
    }
  }

  let landed = false;
  for (const f of S.flying) {
    f.s += dt * L.pr * 14 * (S.rush > 0 ? 3.8 * zoom : 1);   // 꾹 누르는 동안엔 버스까지 더 빨리 걸어가요
    if (f.s >= f.path.total) { f.v.filled++; f.v.incoming--; landed = true; f.done = true; }
  }
  S.flying = S.flying.filter(f => !f.done);
  if (landed) updateUI();

  // 승객들이 자기 자리로 걸어가기
  const k = Math.min(1, dt * 10 * (S.rush > 0 ? 4.5 * zoom : 1));
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

// 목숨 하트 (101단계부터): 막힌 버스에 부딪히면 하나씩 깨져요. 다 깨지면 실패
function loseLife() {
  if (!S || !S.lives || S.over) return;
  S.lives--;
  S.lifeFx.push({ i: S.lives, t: 0 });
  if (S.lives <= 0) {
    S.over = true; S.lostByLives = true; store.set('busGame.combo', 0);
    sfx('lose');
    setTimeout(() => showOverlay('lose'), 700);
  }
}
function checkWin() {
  if (S.over) return;
  if (remainingCount() === 0 && S.vehicles.every(v => v.state === 'gone')) {
    S.over = true;
    if (!S.daily && S.level + 1 > unlocked) { unlocked = Math.min(MAX_LEVEL, S.level + 1); store.set('busGame.unlocked', unlocked); }
    if (S.daily && acct && typeof api === 'function') api('/daily/clear', { day: S.daily, tries: S.tries || 1 }).catch(() => {});   // 오늘의 경쟁 기록
    refundHeart();                                    // 시작할 때 낸 하트를 돌려받아요
    if (!S.daily) saveBest(S.level, S.tries || 1);     // 별 모으기 기록
    if (!S.daily) {                                     // 점수 + 콤보
      const combo = store.get('busGame.combo', 0) + 1; store.set('busGame.combo', combo);
      S.combo = combo; S.gain = Math.round(baseScore(S.tries || 1) * (1 + comboBonus(combo)));
    }
    if (!S.daily && acct && typeof api === 'function') api('/clear', { level: S.level, tries: S.tries || 1, score: S.gain || 0 })
      .then(r => { if (r && r.total != null) { store.set('busGame.score', r.total); if (typeof updateHello === 'function') updateHello(); } }).catch(() => {});   // 랭킹·점수 기록
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
  if (!S.daily) store.set('busGame.combo', 0);       // 실패하면 콤보가 끊겨요
  sfx('lose');
  setTimeout(() => showOverlay('lose'), 400);
}

