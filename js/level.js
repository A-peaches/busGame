// 멍냥이의 버스여행 - 도형 계산, 단계 만들기(난이도·레일 버스), 게임 시작
// =====================================================================
//  도형 계산 (버스 = 회전된 직사각형)
//  ang = 버스가 바라보는 방향. 0 = 위, 90도 = 오른쪽, 45도 = 오른쪽 위 ...
// =====================================================================
function axes(ang) {
  return { ux: Math.sin(ang), uy: -Math.cos(ang), vx: Math.cos(ang), vy: Math.sin(ang) };
}
function makeBox(cx, cy, ang, hl, hw) { return { cx, cy, hl, hw, ...axes(ang) }; }
function bodyBox(v, inflate = 0) { return makeBox(v.cx, v.cy, v.ang, v.l / 2 + inflate, v.w / 2 + inflate); }
// 버스가 앞으로 쭉 나갈 때 쓸고 지나가는 영역
function sweepBox(v) {
  const F = 40, a = axes(v.ang);
  return makeBox(v.cx + a.ux * F / 2, v.cy + a.uy * F / 2, v.ang, v.l / 2 + F / 2, v.w / 2 - 0.02);
}
function proj(b, ax, ay) {
  const c = b.cx * ax + b.cy * ay;
  const r = b.hl * Math.abs(b.ux * ax + b.uy * ay) + b.hw * Math.abs(b.vx * ax + b.vy * ay);
  return [c - r, c + r];
}
// 두 직사각형이 겹치는지 (분리축 정리)
function overlap(A, B) {
  const dx = A.cx - B.cx, dy = A.cy - B.cy;
  const rs = Math.hypot(A.hl, A.hw) + Math.hypot(B.hl, B.hw);
  if (dx * dx + dy * dy > rs * rs) return false;
  for (const [ax, ay] of [[A.ux, A.uy], [A.vx, A.vy], [B.ux, B.uy], [B.vx, B.vy]]) {
    const pa = proj(A, ax, ay), pb = proj(B, ax, ay);
    if (pa[1] <= pb[0] + 1e-6 || pb[1] <= pa[0] + 1e-6) return false;
  }
  return true;
}
function insideBoard(v, cols, rows) {
  const b = bodyBox(v);
  for (const s of [1, -1]) for (const t of [1, -1]) {
    const x = b.cx + b.ux * b.hl * s + b.vx * b.hw * t;
    const y = b.cy + b.uy * b.hl * s + b.vy * b.hw * t;
    if (x < 0.04 || y < 0.04 || x > cols - 0.04 || y > rows - 0.04) return false;
  }
  return true;
}

// =====================================================================
//  단계(레벨) 만들기
//  1) 주차장을 버스로 빽빽하게 채웁니다 (가로/세로/대각선).
//  2) "지금 앞이 뚫린 버스"를 하나씩 골라 방향을 정하고 빼냅니다.
//     → 이 순서대로 빼면 반드시 풀리므로, 모든 단계는 풀 수 있습니다.
// =====================================================================
// 난이도 주기: 10단계마다 [쉬움 → 어려움 → 매우 어려움]이 반복되고, 10번째 단계는 "매우 어려움".
//   별 5개(최고 난이도)는 30단계마다 한 번만 (30, 60, 90단계).
// 10단계 묶음이 넘어갈 때마다 전체 난이도가 조금씩 올라가요. 단계는 150단계까지 (101단계부터는 목숨 하트).
const MAX_LEVEL = 150;
const LIVES_FROM = 101;        // 이 단계부터 '목숨 하트' 3개: 막힌 버스를 눌러 부딪히면 하나씩 깨지고, 다 깨지면 실패
const LIVES = 3;
// 이벤트: 5단계부터 한 단계에 하나씩, 풍선 버스 → U턴 버스 → 레일 버스 → 자리 바꾸기 순서로 번갈아 나와요 (난이도 별은 그대로)
const EVENT_FROM = 5;
const EVENTS = ['balloon', 'turn', 'rail', 'shuffle'];
const EVENT_NAMES = { balloon: '풍선 버스', turn: 'U턴 버스', rail: '레일 버스', shuffle: '자리 바꾸기', cloud: '구름', rainbow: '무지개비', wing: '날개 버스' };
const WING_EVERY = 8;          // 날개 버스: 버스가 8대 빠질 때마다 주차장의 버스 하나가 날개를 달고 대기 칸으로 날아가요
const RAINBOW_AFTER = 10;      // 무지개비: 버스가 10대 빠지면 딱 한 번 내려서 멍냥이들 색이 바뀌어요
const EVENT_DOUBLE_FROM = 61;
const CLOUD_FROM = 10;         // 구름 이벤트: 10단계부터 5단계마다, 대기 줄 뒤쪽을 뭉게구름이 가려요  // 이 단계부터는 이벤트가 두 개씩 겹쳐 나와요 (뒤 단계 난이도 유지)
// 이 단계의 이벤트들: 5~60단계는 하나, 61단계부터는 바로 다음 순서 이벤트까지 두 개 (풍선+U턴, U턴+레일, 레일+자리 바꾸기, 자리 바꾸기+풍선)
const levelEvents = n => {
  if (n < EVENT_FROM) return [];
  const i = (n - EVENT_FROM) % EVENTS.length;
  const list = n >= EVENT_DOUBLE_FROM ? [EVENTS[i], EVENTS[(i + 1) % EVENTS.length]] : [EVENTS[i]];
  // 덤 이벤트 (버스 배치는 그대로): 구름은 10·20·30…, 무지개비는 15·25·35… → 5단계마다 번갈아
  if (n >= CLOUD_FROM && n % 10 === 0) list.push('cloud');
  if (n >= CLOUD_FROM + 5 && n % 10 === 5) list.push('rainbow');
  if (n >= 12 && n % 10 === 2) list.push('wing');            // 날개 버스: 12·22·32…단계
  return list;
};
const hasEvent = (n, e) => levelEvents(n).includes(e);
const BALLOON_COUNT = 3;       // 풍선 버스: 한 단계에 3대가
const BALLOON_EVERY = 5;       //   버스가 5대 빠질 때마다 한 대씩 하늘에서 내려와요
const TIERS = {
  1: { stars: 1, name: '쉬움' },
  3: { stars: 3, name: '어려움' },
  4: { stars: 4, name: '매우 어려움' },
  5: { stars: 5, name: '최고 난이도' },
};
// 1~10단계는 적응 구간: 쉬움 위주에 어려움을 섞고, 10단계에서 처음 '매우 어려움'을 만나요 (너무 쉽지 않게)
const EARLY_TIERS = [1, 1, 3, 1, 3, 1, 3, 1, 3, 4];
function levelTier(n) {
  if (n <= 10) return EARLY_TIERS[n - 1];
  if (n % 30 === 0) return 5;
  const pos = (n - 1) % 10 + 1;
  if (pos === 10) return 4;
  return [1, 3, 4][(pos - 1) % 3];
}
// 실제로 버스 수, 색 수 등을 정할 때 쓰는 "체감 난이도" 값
//   전체를 +2.5 올리고, 단계마다 0.27씩 미세하게 계속 어려워져요 (같은 별이라도 뒤 단계가 조금 더 어려워요)
function effectiveLevel(n) {
  const tier = levelTier(n) === 5 ? 4.4 : levelTier(n);     // 별 5개는 너무 어렵지 않게 살짝 완화
  return (tier - 1) * 3 + 1 + 2.5 + (n - 1) * 0.27;   // 기본 +2.5 (조금 더 어렵게 한 칸 올림)
}

function levelParams(n) {
  const e = effectiveLevel(n);
  // 단계 진행도 0(1단계) → 1(100단계): 같은 별이라도 뒤 단계일수록 최대치가 조금씩 열려서 계속 어려워져요
  const pr = Math.min(1, (n - 1) / 99);   // 100단계에서 최대치 (101단계부터는 주차장 크기 등은 그대로, 목숨 하트로 어려워져요)
  return {
    // 주차장 크기: 10×12 가 꽉 차면 더는 버스가 안 들어가서, 뒤 단계일수록 가로를 넓혀요 (34단계 11칸 → 67단계 12칸)
    //   화면은 세로가 더 빠듯해서 세로(12칸)는 그대로 → 칸이 너무 작아지지 않아요
    cols: Math.min(6 + Math.floor((e - 1) / 4), 10 + Math.floor(pr * 2.99)),
    rows: Math.min(8 + Math.floor((e - 1) / 3), 12),
    // 색 수: 별이 적은 단계는 상한을 낮게 (쉬움 6색, 어려움 8색, 매우 어려움 이상 10색) → 쉬운 단계가 억울하게 막히지 않게
    //   (쉬움은 6색에서 뒤로 갈수록 8색까지, 어려움은 8색에서 9색까지)
    colorCount: Math.min(3 + Math.floor((e - 1) / 3), COLORS.length, { 1: 6 + Math.floor(pr * 3), 3: 8 + Math.floor(pr * 2) }[levelTier(n)] || COLORS.length),
    diagChance: Math.min(0.1 + e * 0.025, 0.35 + pr * 0.1),           // 대각선 버스: 뒤로 갈수록 45%까지
    hiddenChance: e >= 4 ? Math.min(0.08 + e * 0.012, 0.36 + pr * 0.14) : 0,   // ❓ 버스: 뒤로 갈수록 50%까지
    mix: Math.min(24 + e * 6, 260),  // 승객 순서가 섞이는 정도 (좌석이 많아진 만큼 크게)
    target: e,
  };
}

// 버스 하나를 아무 데나 (가로 / 세로 / 가끔 대각선)
function randomPose(len, cols, rows, rng, diagChance) {
  let base, cx, cy;
  if (rng() < diagChance && len <= 3) {
    base = rng() < 0.5 ? Math.PI / 4 : Math.PI * 3 / 4;
    cx = Math.round(rng() * cols * 2) / 2;
    cy = Math.round(rng() * rows * 2) / 2;
  } else if (rng() < 0.5) {
    base = 0;
    cx = Math.floor(rng() * cols) + 0.5;
    cy = Math.floor(rng() * (rows - len + 1)) + len / 2;
  } else {
    base = Math.PI / 2;
    cx = Math.floor(rng() * (cols - len + 1)) + len / 2;
    cy = Math.floor(rng() * rows) + 0.5;
  }
  return { cx, cy, ang: base, len, l: len - 0.14, w: BODY_W };
}

// 하나씩 빼낼 수 있는 순서를 찾고, 나가는 쪽으로 방향을 정해요.
// drop=true 면 막혔을 때 버스를 없애고 계속, false 면 null (= 이 배치는 못 써요)
function extractOrder(list, rng, drop) {
  let remaining = list.slice();
  const order = [];
  while (remaining.length) {
    const cands = [];
    for (const v of remaining) {
      for (const flip of [0, Math.PI]) {
        const sw = sweepBox({ ...v, ang: v.ang + flip });
        if (!remaining.some(o => o !== v && overlap(sw, o.body))) cands.push([v, v.ang + flip]);
      }
    }
    if (!cands.length) {
      if (!drop) return null;
      remaining.splice(Math.floor(rng() * remaining.length), 1);
      continue;
    }
    const [v, ang] = cands[Math.floor(rng() * cands.length)];
    v.ang = normAng(ang);
    order.push(v);
    remaining = remaining.filter(o => o !== v);
  }
  return order;
}

// ---- 점수: 적은 시도로 깰수록 높게 + 연속으로 깨면 콤보 보너스 ----
//   1번 만에 1000 · 2번 800 · 3번 600 · 10번 안 400 · 그 밖 200
//   콤보: 실패 없이 연달아 깬 판 수. 2연속부터 10%씩 더 (최대 +100%)
const baseScore = tries => tries <= 1 ? 1000 : tries === 2 ? 800 : tries === 3 ? 600 : tries <= 10 ? 400 : 200;
const comboBonus = combo => Math.min(10, Math.max(0, combo - 1)) * 0.1;
const myScore = () => store.get('busGame.score', 0);

// ---- 별 모으기: 몇 번 만에 깼는지로 별 1~3개 ----
const bestTries = () => store.get('busGame.best', {});
const starsFor = tries => !tries ? 0 : tries <= 3 ? 3 : tries <= 10 ? 2 : 1;
const levelStars = n => starsFor(bestTries()[n]);
function saveBest(n, tries) {
  const b = bestTries();
  if (!b[n] || tries < b[n]) { b[n] = tries; store.set('busGame.best', b); }
}
// 별 기록이 생기기 전에 깬 단계는 별 3개(1번 만에)로 한 번 채워 줘요 (만점 선물)
(function giftOldStars() {
  if (store.get('busGame.starGift1', false)) return;
  const b = bestTries(), top = unlocked;
  for (let n = 1; n < top; n++) if (!b[n]) b[n] = 1;
  store.set('busGame.best', b); store.set('busGame.starGift1', true);
})();
// 팝업 위에 삐죽 올라온 별 세 개 (가운데가 커요). 받은 별만 노랗게
const STAR_PATH = 'M12 1.8 L14.9 8.3 L22 9 L16.6 13.7 L18.2 20.7 L12 17 L5.8 20.7 L7.4 13.7 L2 9 L9.1 8.3Z';
const starCrown = (k, cls = '') => `<div class="starCrown ${cls}">${[0, 1, 2].map(i =>
  `<svg class="sc${i}" viewBox="0 0 24 22" aria-hidden="true"><path d="${STAR_PATH}" fill="${i < k ? '#f6d76b' : '#efe6d4'}" stroke="${i < k ? '#c99a2e' : '#cbbfa8'}" stroke-width="1.4" stroke-linejoin="round"/></svg>`).join('')}</div>`;

// 무작위는 쓰임새마다 따로 써요: 주차장 배치·색은 rng, U턴·레일·풍선·승객 줄은 각자 다른 흐름.
//   → 이벤트 규칙을 바꿔도 버스 배치는 그대로예요 (랭킹 기록이 같은 판끼리 비교돼요)
function genLevel(n, seed = n * 7919 + 13) {
  const rng = mulberry32(seed);
  const rngT = mulberry32(seed * 3 + 101), rngR = mulberry32(seed * 5 + 203), rngB = mulberry32(seed * 7 + 307), rngQ = mulberry32(seed * 11 + 409);
  const P = levelParams(n);
  const { cols, rows } = P;
  const target = Math.min(20 + 3 * (P.target - 1), Math.floor(cols * rows / 1.9));   // 버스 수 (주차장이 꽉 찰 때까지)

  // 1) 빽빽하게 배치
  const placed = [];
  for (let tries = 0; tries < 25000 && placed.length < target; tries++) {
    // 버스 4종류: 2칸(8석) / 3칸(16석) / 4칸(24석) / 5칸(32석)
    const rl = rng();
    let len = rl < 0.4 ? 2 : rl < 0.74 ? 3 : rl < 0.92 ? 4 : 5;
    if (len > Math.min(cols, rows) - 1) len = 3;
    const v = randomPose(len, cols, rows, rng, P.diagChance);
    if (!insideBoard(v, cols, rows)) continue;
    v.pack = bodyBox(v, GAP);
    if (placed.some(o => overlap(v.pack, o.pack))) continue;
    v.body = bodyBox(v);
    placed.push(v);
  }
  // 2) 빼낼 수 있는 순서와 방향 정하기 (꽉 막혀 아무도 못 나가면 버스 하나를 없애요)
  const order = extractOrder(placed, rng, true);

  // 색 / 정원 / 미스터리
  const idx = COLORS.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const palette = idx.slice(0, P.colorCount);
  order.forEach((v, i) => {
    v.color = palette[i < P.colorCount ? i : Math.floor(rng() * P.colorCount)];
    v.cap = (v.len - 1) * 8;          // 8 / 16 / 24 / 32석
    v.hidden = rng() < P.hiddenChance;
    // U턴 버스 (61단계부터): 버스를 누를 때마다 앞뒤 방향이 휙 바뀌어요.
    //   빼낼 순서를 정할 때 앞·뒤 어느 쪽으로든 나갈 수 있게 골랐으니, 한 번 더 누르면 언제든 풀 수 있어요.
    v.turner = hasEvent(n, 'turn') && rngT() < Math.min(0.16 + n * 0.0015, 0.3);
    if (v.turner) v.hidden = false;
  });

  // 새 이벤트 "레일 버스" (31단계부터): 주차장 아래 레일 위에 버스들이 있어요.
  //   버스를 누를 때마다 레일이 한 칸씩 움직이고, 노란 출구 칸에 온 버스만 출발할 수 있어요.
  let rail = null;
  if (hasEvent(n, 'rail')) {
    // 레일 칸 = 주차장 세로줄. 레일 버스는 바로 위 같은 줄의 버스들을 먼저 빼야 위로 나갈 수 있어요
    const K = cols, cnt = Math.min(8, 3 + Math.floor(n / 15), K - 2);   // 초반 3대 → 뒤로 갈수록 8대까지
    const items = new Array(K).fill(null), free = [...Array(K).keys()];
    for (let i = 0; i < cnt; i++) {
      const len = rngR() < 0.6 ? 2 : 3;
      const v = { cx: -100, cy: -100, ang: 0, len, l: len - 0.14, w: BODY_W, onRail: true,
        color: palette[Math.floor(rngR() * P.colorCount)], cap: (len - 1) * 8, hidden: false };
      items[free.splice(Math.floor(rngR() * free.length), 1)[0]] = v;
      order.splice(Math.floor(rngR() * (order.length + 1)), 0, v);   // 승객 순서에도 섞어 넣어요
    }
    rail = { K, items };
  }

  // 새 이벤트 "풍선 버스": 버스 3대가 하늘에 있다가, 버스를 5대 뺄 때마다 한 대씩 풍선을 달고 주차장 빈자리에 내려와요.
  //   (내려앉을 자리는 그때 고르는데, 그 뒤에도 반드시 다 뺄 수 있는 자리만 골라요)
  if (hasEvent(n, 'balloon')) {
    for (let i = 0; i < BALLOON_COUNT; i++) {
      const len = rngB() < 0.6 ? 2 : 3;
      const v = { cx: -100, cy: -100, ang: 0, len, l: len - 0.14, w: BODY_W, sky: true,
        color: palette[Math.floor(rngB() * P.colorCount)], cap: (len - 1) * 8, hidden: false };
      const lo = Math.floor(order.length * 0.3);       // 승객은 조금 뒤쪽에 섞어 넣어요 (내려온 뒤에 탈 수 있게)
      order.splice(lo + Math.floor(rngB() * (order.length - lo + 1)), 0, v);
    }
  }

  // 승객 줄: 빼낼 순서대로 만든 뒤 단계가 오를수록 더 섞기
  const q = [];
  let k = 0;
  for (const v of order) for (let j = 0; j < v.cap; j++) q.push({ color: v.color, key: k++ });
  q.forEach(p => p.key += rngQ() * P.mix);
  q.sort((a, b) => a.key - b.key);
  // 억울한 시작 막기: 줄 맨 앞 몇 명은 "처음부터 뺄 수 있는 버스" 색으로 맞춰요.
  //   (색별 인원 수는 그대로라서 풀 수 있는지는 변하지 않고, 중반 이후 어려움도 그대로예요)
  const parked = order.filter(v => !v.onRail && !v.sky);
  const freeColors = new Set(parked.filter(v => !v.hidden && !parked.some(o => o !== v && overlap(sweepBox(v), o.body))).map(v => v.color));
  const FRONT = Math.min(q.length, 10);
  if (freeColors.size) {
    for (let i = 0; i < FRONT; i++) {
      if (freeColors.has(q[i].color)) continue;
      const j = q.findIndex((p, x) => x > i && freeColors.has(p.color));
      if (j < 0) break;
      [q[i], q[j]] = [q[j], q[i]];
    }
  }

  return {
    cols, rows, vehicles: order, rail,
    queue: q.map((p, i) => ({
      id: i, color: p.color, kind: rngQ() < 0.5 ? 'cat' : 'dog', bag: rngQ() < 0.16,
      ribbon: rngQ() < 0.15 ? ['#e8768e', '#7fb4d6', '#f2c35a', '#b9a2d8'][Math.floor(rngQ() * 4)] : null,
    })),
  };
}

// =====================================================================
//  게임 시작
// =====================================================================
// 주차장이 화면에 비해 세로로 길면 통째로 90도 돌려서 버스를 더 크게 보여 줘요.
//   (모든 버스를 같이 돌리니 어떤 버스가 막히는지는 그대로예요. 레일은 그대로 아래에 있어요)
function fitBoardTurn() {
  layout();
  if (!(L.W > 0 && L.bH > 0)) return;
  const aw = L.W - 36, ah = L.bH - 16;
  const now = Math.min(aw / (S.cols + 0.4), ah / (S.rows + 0.4));
  const turned = Math.min(aw / (S.rows + 0.4), ah / (S.cols + 0.4));
  if (turned < now * 1.08) return;
  const R = S.rows;
  for (const v of S.vehicles) {
    if (v.state !== 'parked') continue;
    [v.cx, v.cy] = [R - v.cy, v.cx];
    v.ang = normAng(v.ang + Math.PI / 2);
    v.body = bodyBox(v);
  }
  [S.cols, S.rows] = [S.rows, S.cols];
  if (S.rail) S.rail.off = Math.floor((S.cols - S.rail.K) / 2);   // 레일은 넓어진 주차장 가운데 줄들 아래에
  S.turned = true;
}
// 오늘의 경쟁: 한국 시간 날짜 번호, 그날의 판(91~100단계 수준의 어려운 판 + 그날만의 배치)
const kstDayNum = () => Math.floor((Date.now() + 9 * 3600000) / 86400000);
const DAILY_LEVELS = [93, 96, 90, 99, 100];   // 매우 어려움(93·96·99·100)과 최고 난이도(90) 설정만
const dailyLevelOf = day => DAILY_LEVELS[day % DAILY_LEVELS.length];
function startDaily() {
  const day = kstDayNum();
  startLevel(dailyLevelOf(day), { daily: day, seed: day * 104729 + 7 });
}
function startLevel(n, opts = {}) {
  const g = genLevel(n, opts.seed);
  // 이 단계 도전 횟수 세기 (클리어하면 "N번의 시도로 성공!"). 오늘의 경쟁은 그날 따로 세요
  const tk = opts.daily ? 'd' + opts.daily : n;
  const allTries = store.get('busGame.tries', {});
  allTries[tk] = (allTries[tk] || 0) + 1;
  store.set('busGame.tries', allTries);
  S = {
    level: n, cols: g.cols, rows: g.rows, vehicles: [],
    waiting: g.queue,   // 원 밖에서 줄 서서 기다리는 승객
    ring: [],           // 원 위의 자리들 (승객 또는 빈자리 null)
    ringOff: 0,         // 원이 돌아간 거리
    slots: new Array(MAX_SLOTS).fill(null), slotCount: BASE_SLOTS,
    flying: [], boardTimer: 0.6, liftMode: false, over: false, time: 0,
    // 자리 추가: 모든 단계 기본 1개, 10번 실패하면 멍냥이의 응원으로 +1, 30번이면 +2 · 색 섞기: '매우 어려움'·'최고 난이도'에서만 1개
    boost: { slot: 1 + (opts.daily ? 0 : cheerLevel(allTries[tk] - 1)), lift: 1, mix: levelTier(n) >= 4 ? 1 : 0 },
    tries: allTries[tk], daily: opts.daily || 0, rush: 0, treeShake: 0,
    balloon: hasEvent(n, 'balloon') ? { left: BALLOON_EVERY } : null,
    lives: n >= LIVES_FROM ? LIVES : 0, lifeFx: [],
    cloud: hasEvent(n, 'cloud'),
    rainbow: hasEvent(n, 'rainbow') ? { left: RAINBOW_AFTER, t: -1, done: false } : null,
    wing: hasEvent(n, 'wing') ? { left: WING_EVERY, warn: 0, wait: 0 } : null,
    shuffle: hasEvent(n, 'shuffle') ? { every: SHUFFLE_EVERY(n), left: SHUFFLE_EVERY(n), wait: 0, count: 0 } : null,
  };
  g.vehicles.forEach((v, i) => {
    const o = {
      id: i, cx: v.cx, cy: v.cy, ang: v.ang, len: v.len, l: v.l, w: v.w, body: bodyBox(v),
      color: v.color, cap: v.cap, hidden: v.hidden, turner: !!v.turner, spin: 0,
      state: v.onRail ? 'rail' : v.sky ? 'sky' : 'parked', off: 0, bump: null, shake: 0, filled: 0, incoming: 0, pop: 1, t: 0,
    };
    v._rt = o;
    S.vehicles.push(o);
  });
  // 레일 버스 이벤트
  S.rail = g.rail ? { K: g.rail.K, items: g.rail.items.map(v => v ? v._rt : null), anim: 0 } : null;
  // U턴 버스는 정해진 턴(버스를 누른 횟수)마다 한꺼번에 방향을 바꿔요
  S.turnEvery = 3; S.turnLeft = S.turnEvery;
  showScreen('game');
  fitBoardTurn();
  revealCheck(true);
  layout();
  for (let k = 0; k < S.ring.length; k++) if (S.waiting.length) S.ring[k] = S.waiting.shift();
  hideOverlay();
  updateUI();
  // 멍냥이의 응원: 10번·30번 넘게 실패했으면 들어올 때 한 번씩만 알려 줘요 (이미 본 응원은 다시 안 띄워요)
  {
    const step = opts.daily ? 0 : cheerLevel(allTries[n] - 1), seen = store.get('busGame.cheerSeen', {});
    if (step > (seen[n] || 0)) { seen[n] = step; store.set('busGame.cheerSeen', seen); showCheer(step); return; }
  }
  // 목숨 하트를 처음 만나면 안내 (처음 한 번만)
  if (S.lives && !store.get('busGame.livesSeen', false)) {
    store.set('busGame.livesSeen', true);
    const card = $('card');
    card.innerHTML = `<h2>새 규칙! 목숨 하트 ❤️</h2>
      <p>101단계부터는 왼쪽 아래에 <b>하트 ${LIVES}개</b>가 있어요.<br>
      막힌 버스를 눌러 <b>부딪히면 하트가 하나씩 깨져요</b>.<br>
      다 깨지면 실패예요. 잘 보고 눌러 주세요!</p>
      <button class="btn" id="ovOk">알겠어요</button>`;
    card.querySelector('#ovOk').onclick = () => hideOverlay();
    $('overlay').classList.add('show');
    return;
  }
  // 구름 이벤트를 처음 만나면 안내 (처음 한 번만)
  if (S.cloud && !store.get('busGame.cloudSeen', false)) {
    store.set('busGame.cloudSeen', true);
    const card = $('card');
    card.innerHTML = `<h2>새 이벤트! 구름 ☁️</h2>
      <p>뭉게구름이 둥실 떠서<br><b>줄 서 있는 멍냥이들 뒤쪽</b>을 가려요.<br>
      다음에 올 친구들이 잘 안 보이니 조심조심!</p>
      <button class="btn" id="ovOk">알겠어요</button>`;
    card.querySelector('#ovOk').onclick = () => hideOverlay();
    $('overlay').classList.add('show');
    return;
  }
  // 풍선 버스 이벤트를 처음 만나면 안내 (처음 한 번만)
  if (S.balloon && !store.get('busGame.balloonSeen', false)) {
    store.set('busGame.balloonSeen', true);
    const card = $('card');
    card.innerHTML = `<h2>새 이벤트! 풍선 버스 🎈</h2>
      <p>버스를 <b>${BALLOON_EVERY}대 뺄 때마다</b> 풍선을 단 버스가<br>하늘에서 <b>주차장 빈자리에 내려와요</b>.<br>
      빼려던 버스 앞을 막을 수도 있으니 잘 보세요!<br><small>한 단계에 ${BALLOON_COUNT}대가 내려와요</small></p>
      <button class="btn" id="ovOk">알겠어요</button>`;
    card.querySelector('#ovOk').onclick = () => hideOverlay();
    $('overlay').classList.add('show');
  }
  // 자리 바꾸기 이벤트를 처음 만나면 안내
  else if (S.shuffle && !store.get('busGame.shuffleSeen', false)) {
    store.set('busGame.shuffleSeen', true);
    const card = $('card');
    card.innerHTML = `<h2>새 이벤트! 자리 바꾸기</h2>
      <p>주차장에서 버스를 <b>${S.shuffle.every}대</b> 뺄 때마다<br>
      남은 버스들이 <b>새 자리로 다시 주차</b>해요.<br>
      위쪽에 남은 대수가 보여요. 잘 보고 골라 주세요!</p>
      <button class="btn" id="ovOk">알겠어요</button>`;
    card.querySelector('#ovOk').onclick = () => hideOverlay();
    $('overlay').classList.add('show');
  }
  // U턴 이벤트를 처음 만나면 안내
  else if (S.vehicles.some(v => v.turner) && !store.get('busGame.turnSeen', false)) {
    store.set('busGame.turnSeen', true);
    const card = $('card');
    card.innerHTML = `<h2>새 이벤트! U턴 버스</h2>
      <p>모서리에 <b>노란 숫자 배지</b>가 붙은 버스는<br>
      버스가 <b>3대 빠져나갈 때마다 앞뒤 방향이 바뀌어요</b>.<br>
      배지 숫자는 다음 U턴까지 남은 턴이에요!</p>
      <button class="btn" id="ovOk">알겠어요</button>`;
    card.querySelector('#ovOk').onclick = () => hideOverlay();
    $('overlay').classList.add('show');
  }
  // 레일 이벤트를 처음 만나면 안내
  else if (S.rail && !store.get('busGame.railSeen', false)) {
    store.set('busGame.railSeen', true);
    const card = $('card');
    card.innerHTML = `<h2>새 이벤트! 레일 버스</h2>
      <p>주차장 아래 레일 위에도 버스가 있어요.<br>
      레일 버스는 <b>바로 위 같은 줄</b>의 버스들을<br>먼저 빼야 위로 나갈 수 있어요.<br>
      그런데 버스가 <b>빠져나갈 때마다 레일이 한 칸씩</b> 움직여요!</p>
      <button class="btn" id="ovOk">알겠어요</button>`;
    card.querySelector('#ovOk').onclick = () => hideOverlay();
    $('overlay').classList.add('show');
  }
}

// ---- 레일 버스 ----
// 버스를 누를 때마다 레일이 오른쪽으로 한 칸 (끝에 있던 버스는 왼쪽 처음으로)
function railStep() {
  if (!S || !S.rail) return;
  const it = S.rail.items;
  it.unshift(it.pop());
  S.rail.anim = 1;
}
const railCenter = i => ({ x: L.rx0 + L.railW * (i + 0.5), y: L.railTop + L.railH / 2 });   // 레일 칸 = 주차장 세로줄
const railSize = v => ({ w: v.w * L.cs, l: Math.min(L.railH * 0.88, v.l * L.cs) });
// 레일 버스를 누르면: 바로 위 같은 세로줄이 비어 있을 때만 위로 쭉 빠져나가요. 빠져나갔을 때만 레일이 한 칸 움직여요.
function railToBoard(v, i) {
  v.cx = i + 0.5 + (S.rail.off || 0);
  v.cy = (L.railTop + L.railH / 2 - L.by) / L.cs;
  v.ang = 0; v.off = 0; v.fromRail = true;
  v.body = bodyBox(v);
}
function tapRail(i) {
  const R = S.rail, v = R.items[i];
  let left = false;                                     // 레일은 버스가 실제로 빠져나갔을 때만 움직여요
  if (v && !(S.vehicles.some(o => o.move) || (S.shuffle && S.shuffle.wait > 0))) {
    railToBoard(v, i);
    const si = freeSlot();
    if (S.liftMode) {                                   // 크레인으로는 막혀 있어도 바로 들어 올려요
      if (si < 0) { toast('빈 자리가 없어요!'); return; }
      R.items[i] = null; S.liftMode = false; S.boost.lift--;
      launch(v, si, true); updateUI(); left = true;
    } else if (parkedBlockers(v).length) {
      v.shake = 0.35; v.state = 'rail';                 // 위가 막혀 있어요: 부르르
      loseLife();
    } else if (si < 0) {
      v.shake = 0.35; toast('대기 칸이 꽉 찼어요!');
    } else {
      R.items[i] = null;
      launch(v, si, false);                             // 위로 쭉 빠져나가 찻길로
      left = true;
    }
  }
  if (left) { railStep(); turnStep(); }       // 레일·U턴 모두 버스가 실제로 빠져나갔을 때만
  else if (v) unstickTurners();
}

// ---- 풍선 버스 ----
// 방향 그대로 하나씩 빼서 모두 뺄 수 있는지 (나갈 수 있는 버스부터 계속 빼 봐요)
function canClearAll(list) {
  let rem = list.slice();
  while (rem.length) {
    const clear = (v, ang) => !rem.some(o => o !== v && overlap(sweepBox({ ...v, ang }), o.body));
    const i = rem.findIndex(v => clear(v, v.ang) || (v.turner && clear(v, v.ang + Math.PI)));   // U턴 버스는 앞뒤 어느 쪽이든
    if (i < 0) return false;
    rem.splice(i, 1);
  }
  return true;
}
// 버스가 빠져나갈 때마다 불러요: 5대마다 풍선 버스 한 대가 내려와요
function countBalloon() {
  const B = S.balloon;
  if (!B || !S.vehicles.some(v => v.state === 'sky')) return;
  if (--B.left <= 0) B.left = landBalloon() ? BALLOON_EVERY : 1;   // 자리가 없으면 다음 버스 뒤에 다시
}
// 하늘의 풍선 버스 한 대를 내려앉힐 자리를 골라요. 빼려던 버스 앞을 막는 자리를 조금 더 좋아해요.
function landBalloon(instant, rng = Math.random) {
  const v = S.vehicles.find(x => x.state === 'sky');
  if (!v) return false;
  const board = S.vehicles.filter(x => x.state === 'parked' || x.state === 'landing');
  const free = board.filter(x => x.state === 'parked' && !x.hidden && parkedBlockers(x).length === 0);
  const good = [], blocking = [];
  for (let k = 0; k < 500 && good.length < 30; k++) {
    const c = randomPose(v.len, S.cols, S.rows, rng, 0.15);
    if (rng() < 0.5) c.ang = normAng(c.ang + Math.PI);
    if (!insideBoard(c, S.cols, S.rows)) continue;
    c.pack = bodyBox(c, GAP); c.body = bodyBox(c);
    if (board.some(o => overlap(c.pack, bodyBox(o, GAP)))) continue;
    if (!canClearAll(board.concat([c]))) continue;
    good.push(c);
    if (free.some(o => overlap(sweepBox(o), c.body))) blocking.push(c);
  }
  if (!good.length) return false;
  const p = blocking.length && rng() < 0.65 ? blocking[Math.floor(rng() * blocking.length)] : good[Math.floor(rng() * good.length)];
  v.cx = p.cx; v.cy = p.cy; v.ang = p.ang; v.body = bodyBox(v);
  v.off = 0; v.bump = null; v.pop = 1;
  if (instant) { v.state = 'parked'; return true; }
  v.state = 'landing'; v.fall = 0;
  return true;
}

// ---- 날개 버스 ----
// 버스가 빠질 때마다 세요 (날개 버스가 날아간 건 빼고). 1대 남으면 미리 알려 주고, 0이 되면 잠깐 뒤 날아가요
function countWing(v) {
  const W = S.wing;
  if (!W || v.winged) return;
  W.left--;
  if (W.left === 1) W.warn = 1.8;                       // "곧 날개 버스가 날아와요!"
  if (W.left <= 0) { W.left = WING_EVERY; W.wait = 0.45; }
}
// 주차장 버스 하나가 무작위로 날개를 달고 대기 칸으로 (운이 좋으면 막힌 버스가, 나쁘면 필요 없는 색이)
function flyWingBus() {
  const cand = S.vehicles.filter(v => v.state === 'parked' && !v.bump && !v.move);
  if (!cand.length || S.over) return;
  const v = cand[Math.floor(Math.random() * cand.length)];
  const si = freeSlot();
  if (si < 0) { S.wing.pending = true; return; }       // 대기 칸이 꽉 찼으면 기다렸다가, 자리가 나면 날아와요 (실패 없음)
  S.wing.pending = false;
  v.winged = true;
  launch(v, si, true);
  revealCheck(false);
  updateUI();
}

// ---- 무지개비 ----
// 버스가 빠질 때마다 세다가, 10대째에 무지개비가 내려요
function countRainbow() {
  const R = S.rainbow;
  if (!R || R.t >= 0) return;
  if (--R.left <= 0) R.t = 0;
}
// 비가 내리는 동안: 기다리는 멍냥이들(하트 길·대기 줄)의 색을 서로 맞바꿔요.
//   색마다 멍냥이 수는 그대로라 버스 자리 수와 딱 맞아요 (풀 수 있는지는 변하지 않아요). 순서만 바뀌어요.
function rainbowRecolor() {
  const ppl = S.ring.filter(Boolean).concat(S.waiting);
  const cols = ppl.map(p => p.color);
  for (let i = cols.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cols[i], cols[j]] = [cols[j], cols[i]]; }
  ppl.forEach((p, i) => { p.color = cols[i]; p.flashUntil = S.time + 0.5 + Math.random() * 0.9; });
}

// ---- 자리 바꾸기 ----
// 별이 많은 단계일수록 더 자주 (어려움 7대, 매우 어려움 이상 6대, 쉬움 8대마다)
const SHUFFLE_EVERY = n => levelTier(n) >= 4 ? 6 : levelTier(n) === 3 ? 7 : 8;
// 주차장에서 버스를 뺄 때 불러요
function countShuffle() {
  const sh = S.shuffle;
  if (!sh) return;
  if (--sh.left <= 0) { sh.left = sh.every; sh.wait = 0.55; }   // 나가는 버스가 조금 빠진 뒤에
  updateUI();
}
// 남은 버스를 같은 크기 그대로, 하나씩 다 빼낼 수 있는 새 자리에 놓아요
function rearrange(vs, cols, rows, rng) {
  const idx = vs.map((_, i) => i).sort((a, b) => vs[b].len - vs[a].len);   // 긴 버스부터
  for (let attempt = 0; attempt < 80; attempt++) {
    const placed = [], pos = [];
    let ok = true;
    for (const i of idx) {
      let p = null;
      for (let tries = 0; tries < 500 && !p; tries++) {
        const c = randomPose(vs[i].len, cols, rows, rng, 0.2);
        if (!insideBoard(c, cols, rows)) continue;
        c.pack = bodyBox(c, GAP);
        if (placed.some(o => overlap(c.pack, o.pack))) continue;
        c.body = bodyBox(c);
        p = c;
      }
      if (!p) { ok = false; break; }
      placed.push(p); pos[i] = p;
    }
    if (ok && extractOrder(placed, rng, false)) return pos;
  }
  return null;
}
function doShuffle() {
  for (const v of S.vehicles) if (v.state === 'landing') { v.state = 'parked'; v.fall = 1; v.away = 0; }   // 내려오던 풍선 버스는 먼저 내려앉혀요
  const vs = S.vehicles.filter(v => v.state === 'parked');
  if (vs.length < 2) return;
  const rng = mulberry32((S.level * 7919 + S.shuffle.count * 104729 + (Date.now() & 0xffff)) >>> 0);
  const pos = rearrange(vs, S.cols, S.rows, rng);
  if (!pos) return;
  vs.forEach((v, i) => {
    const p = pos[i];
    v.move = { x: v.cx, y: v.cy, a: v.ang, t: 0 };
    v.cx = p.cx; v.cy = p.cy; v.ang = p.ang;
    v.body = bodyBox(v);
    v.bump = null; v.off = 0; v.spin = 0; v.turnLater = false;
  });
  S.shuffle.count++;
  sfx('go');
  toast('버스들이 자리를 바꿨어요!', 1400);
}

// ---- U턴 버스 ----
// 버스를 누를 때마다 U턴 버스들이 앞뒤를 바꿔요 (부딪혀 돌아오는 중이면 돌아온 다음에)
function turnStep() {
  if (!S || !S.vehicles.some(v => v.turner && v.state === 'parked')) return;
  if (--S.turnLeft > 0) return;                 // 아직 차례가 아니에요
  S.turnLeft = S.turnEvery;
  for (const v of S.vehicles) {
    if (!v.turner || v.state !== 'parked') continue;
    if (v.bump) v.turnLater = true; else uTurn(v);
  }
}
function uTurn(v) {
  v.turnLater = false;
  v.ang = normAng(v.ang + Math.PI);
  v.body = bodyBox(v);
  v.spin = 1;            // 빙글 도는 애니메이션
}

const parkedBlockers = v => {
  const sw = sweepBox(v);
  return S.vehicles.filter(o => o !== v && o.state === 'parked' && overlap(sw, o.body));
};

function revealCheck(instant) {
  for (const v of S.vehicles) {
    if (v.state === 'parked' && v.hidden && parkedBlockers(v).length === 0) {
      v.hidden = false;
      v.pop = instant ? 1 : 0;
    }
  }
}

function freeSlot() {
  for (let i = 0; i < S.slotCount; i++) if (!S.slots[i]) return i;
  return -1;
}

