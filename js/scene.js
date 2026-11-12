// 멍냥이의 버스여행 - 계절 풍경, 수채화 나무, 메인 화면의 움직이는 버스
// =====================================================================
//  계절 풍경 (봄 / 여름 / 가을 / 겨울)
// =====================================================================
const SEASONS = {
  spring: {
    sky: ['#a9cde2', '#dcebee', '#f7e9e2'], sun: '#fff4e4', mt: ['#aebdd0', '#d9e0e6'],
    forest: ['#f4cbd6', '#efbccb', '#e6a9bc', '#f8dbe3', '#fbe8ee'], meadow: ['#cfe4a8', '#acd08a', '#93be72'],   // 봄 숲: 벚꽃 핑크
    grass: ['#7fae5f', '#95c072', '#6f9e52', '#a7cd84'], flowers: ['#f6c9d6', '#fffaf4', '#f9e6a0'],
    leaves: ['#f4c4d1', '#f8d6df', '#eeb1c2', '#fbe6ec', '#f9dbe3'], leafBase: '#e3a7b8', trunk: '#7b5a46', cloudShade: '#dfe2ea',
  },
  summer: {
    sky: ['#86c0e6', '#cbe6f0', '#f1f0dc'], sun: '#fff7d6', mt: ['#9fb8cc', '#d3e0e2'],
    forest: ['#6f9f58', '#7fae63', '#5f8f4c', '#8ab86c', '#4f7f3f'], meadow: ['#b7da8e', '#95c56e', '#7cb35a'],
    grass: ['#5f9a45', '#78ae55', '#4f8a3a', '#8cc064'], flowers: ['#fffdf6', '#f9e6a0', '#c9d9f5'],
    leaves: ['#a6d17a', '#8cc463', '#c4e39b', '#72ab50', '#b4dc88', '#5f9a45'], leafBase: '#3f7232', trunk: '#6f5240', cloudShade: '#d8e2ec',
  },
  autumn: {
    sky: ['#a4c2d4', '#e8dcc8', '#f6dfb8'], sun: '#ffeccc', mt: ['#b1b9c4', '#dfd9cf'],
    forest: ['#c8783f', '#d99a4a', '#b5602f', '#c9a050', '#8c8f4a'], meadow: ['#d6cd8e', '#c3b674', '#ad9f5d'],
    grass: ['#b39a55', '#c8ae64', '#9c8a4a', '#d3b56a'], flowers: ['#e9a96a', '#f1d58a'],
    leaves: ['#d9653f', '#e8913f', '#f0b54a', '#c9472f', '#e07a3a'], leafBase: '#a8452a', trunk: '#6a4c3a', cloudShade: '#e3dbd0',
  },
  winter: {
    sky: ['#b6c6d5', '#dde5ec', '#eff1f3'], sun: '#ffffff', mt: ['#c3ccd6', '#eef1f4'],
    forest: ['#a9b4bc', '#b9c2c9', '#94a0a9', '#c9d1d7'], meadow: ['#f6f8fa', '#e8edf2', '#dde4ea'],
    grass: ['#c6d0d8', '#b5c1ca'], flowers: [],
    leaves: null, leafBase: null, trunk: '#6d5e55', cloudShade: '#cfd6de',
  },
};
const SEASON_KEYS = ['spring', 'summer', 'autumn', 'winter'];
// 계절: 기본은 '지금 계절'(오늘 날짜 기준, 3~5월 봄 / 6~8월 여름 / 9~11월 가을 / 12~2월 겨울). 설정에서 바꿀 수 있어요.
const seasonByDate = () => SEASON_KEYS[Math.floor(((new Date().getMonth() + 10) % 12) / 3)];
let seasonPref = store.get('busGame.seasonPref', 'auto');
let season = SEASONS[seasonPref] ? seasonPref : seasonByDate();
const f1 = n => n.toFixed(1);
const pick = (R, arr) => arr[Math.floor(R() * arr.length)];

// 수채화 나무: 줄기에서 가지가 여러 번 갈라지며 풍성하게 뻗고,
// 가지 끝마다 작은 잎이 여러 장 + 옅은 물감 번짐 (동그란 덩어리 없음)
//   봄: 벚꽃 / 여름: 싱그러운 초록 / 가을: 단풍나무와 은행나무 / 겨울: 앙상한 가지 + 눈
const GINKGO = ['#f2c94c', '#f6d769', '#e8b72f', '#f9e49a', '#dcae2a'];
function makeTree(seed, h, ss = season, detail = 1) {
  const R = mulberry32(seed), P = SEASONS[ss];
  const bare = !P.leaves;
  const ginkgo = ss === 'autumn' && seed % 2 === 0;
  const cols = ginkgo ? GINKGO : P.leaves;
  const maxD = (detail < 1 ? 3 : h < 100 ? 5 : 6) + (bare ? 1 : 0);
  const tw = h * 0.055;
  let branches = '';
  const tips = [], mids = [];

  function grow(x, y, ang, len, w, d) {
    const ex = x + Math.sin(ang) * len, ey = y - Math.cos(ang) * len;
    const bend = (R() - 0.5) * len * 0.3;
    const mx = (x + ex) / 2 + Math.cos(ang) * bend, my = (y + ey) / 2 + Math.sin(ang) * bend;
    branches += `<path d="M${f1(x)} ${f1(y)} Q${f1(mx)} ${f1(my)} ${f1(ex)} ${f1(ey)}" stroke-width="${f1(Math.max(w, 0.35))}"/>`;
    if (d >= 2) mids.push([mx, my, d]);
    if (d >= maxD) { tips.push([ex, ey]); return; }
    const n = R() < 0.35 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const spread = 0.36 + R() * 0.36;
      const off = n === 2 ? (i ? spread : -spread) : (i - 1) * spread * 1.15;
      const a = clamp((ang + off + (R() - 0.5) * 0.25) * 0.97, -1.5, 1.5);   // 위쪽으로 살짝 모이게
      grow(ex, ey, a, len * (0.7 + R() * 0.14), w * 0.64, d + 1);
    }
  }

  // 줄기 (아래가 넓은 원뿔꼴) + 큰 가지 2~3개
  const lean = (R() - 0.5) * 0.12, trunkLen = h * 0.21;
  const tx = Math.sin(lean) * trunkLen, ty = -trunkLen;
  const limbs = R() < 0.5 ? 2 : 3;
  for (let i = 0; i < limbs; i++) {
    const off = limbs === 2 ? (i ? 0.38 : -0.42) : (i - 1) * 0.5;
    grow(tx, ty, lean + off * 1.25 + (R() - 0.5) * 0.2, h * (0.16 + R() * 0.04), tw * 0.72, 1);
  }
  // 먼 숲(detail<1)은 줄기·가지 없이 잎만 빽빽하게 → 가지가 안 보이는 울창한 숲
  const foliageOnly = detail < 1 && !bare;
  let s = detail >= 1 ? `<ellipse cx="0" cy="0" rx="${f1(h * 0.3)}" ry="${f1(h * 0.045)}" fill="rgba(60,50,30,.14)"/>` : '';
  if (!foliageOnly) s += `<path d="M${f1(-tw * 0.65)} 0 Q${f1(-tw * 0.4)} ${f1(-trunkLen * 0.5)} ${f1(tx - tw * 0.36)} ${f1(ty)} L${f1(tx + tw * 0.36)} ${f1(ty)}
    Q${f1(tw * 0.4)} ${f1(-trunkLen * 0.5)} ${f1(tw * 0.65)} 0Z" fill="${P.trunk}" stroke="rgba(112,104,96,.45)" stroke-width=".6"/>`;

  let wash = '', leaves = '';
  if (!bare) {
    // 물감 번짐: 가지 끝 근처에 옅은 색이 스며든 듯
    for (let i = 0; i < tips.length; i++) {
      const [x, y] = tips[i];
      wash += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(h * (0.08 + R() * 0.05))}" ry="${f1(h * (0.06 + R() * 0.04))}" fill="${pick(R, cols)}" opacity="${foliageOnly ? '.7' : '.42'}"/>`;
    }
    // 잎사귀: 가지 끝마다 여러 장, 중간 가지에도 조금
    const perTip = detail >= 1 ? 8 : 7;
    const L0 = h * (detail >= 1 ? 0.04 : 0.075);
    const addLeaf = (x, y, spread) => {
      const lx = x + (R() - 0.5) * spread, ly = y + (R() - 0.5) * spread;
      const L = L0 * (0.75 + R() * 0.55), W = L * (ginkgo ? 0.7 : 0.45);
      const shape = ginkgo
        ? `M0 0 L${f1(L * 0.85)} ${f1(-W)} Q${f1(L * 1.1)} 0 ${f1(L * 0.85)} ${f1(W)}Z`
        : `M0 0 Q${f1(L / 2)} ${f1(-W)} ${f1(L)} 0 Q${f1(L / 2)} ${f1(W)} 0 0Z`;
      leaves += `<path d="${shape}" fill="${pick(R, cols)}" opacity="${f1(0.72 + R() * 0.25)}" transform="translate(${f1(lx)} ${f1(ly)}) rotate(${Math.round(R() * 360)})"/>`;
    };
    for (const [x, y] of tips) for (let k = 0; k < perTip; k++) addLeaf(x, y, h * 0.13);
    // 가지 중간·아래쪽까지 잎을 달아 아래도 풍성하게 (아래로 갈수록 살짝 늘어지듯)
    for (const [x, y, dd] of mids) {
      const k = dd <= 3 ? 4 : 3;
      for (let i = 0; i < k; i++) addLeaf(x, y + h * 0.02, h * 0.11);
      if (R() < 0.5) wash += `<ellipse cx="${f1(x)}" cy="${f1(y + h * 0.02)}" rx="${f1(h * 0.07)}" ry="${f1(h * 0.05)}" fill="${pick(R, cols)}" opacity=".35"/>`;
    }
    if (ss === 'spring') for (let k = 0; k < tips.length; k++) if (R() < 0.3) { const [x, y] = tips[k]; leaves += `<circle cx="${f1(x + (R() - 0.5) * h * 0.05)}" cy="${f1(y)}" r="${f1(h * 0.012)}" fill="#a9c98a" opacity=".8"/>`; }
  } else {
    // 겨울: 가지 위에 쌓인 눈
    for (const [x, y] of tips) if (R() < 0.45) leaves += `<ellipse cx="${f1(x)}" cy="${f1(y - 0.5)}" rx="${f1(h * 0.022)}" ry="${f1(h * 0.009)}" fill="#fbfcfd"/>`;
    for (const [x, y] of mids) if (R() < 0.3) leaves += `<ellipse cx="${f1(x)}" cy="${f1(y - 0.5)}" rx="${f1(h * 0.02)}" ry="${f1(h * 0.008)}" fill="#fbfcfd"/>`;
  }
  s += `<g filter="url(#wash)">${wash}</g>`;
  if (!foliageOnly) s += `<g stroke="${P.trunk}" fill="none" stroke-linecap="round">${branches}</g>`;
  s += leaves;
  return s;
}

// 몽글몽글한 뭉게구름 (가장자리를 노이즈로 일렁이게 해서 실제 구름처럼)
function makeCloud(id, seed, P) {
  const R = mulberry32(seed);
  const n = 7, puffs = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const r = 16 + Math.sin(t * Math.PI) * 24 + R() * 9;
    puffs.push([40 + t * 180 + (R() - 0.5) * 12, 82 - r * 0.6, r]);
  }
  const circles = (dy, fill, k = 1) => puffs.map(([x, y, r]) => `<circle cx="${f1(x)}" cy="${f1(y + dy)}" r="${f1(r * k)}"/>`).join('').replace(/^/, `<g fill="${fill}">`) + '</g>';
  return `<svg viewBox="0 0 260 120" width="100%" aria-hidden="true">
    <defs><filter id="${id}" x="-20%" y="-30%" width="140%" height="160%">
      <feTurbulence type="fractalNoise" baseFrequency=".028" numOctaves="4" seed="${seed}" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="20" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feGaussianBlur in="d" stdDeviation="1.3"/></filter></defs>
    <g filter="url(#${id})">
      ${circles(8, P.cloudShade)}
      <rect x="40" y="70" width="180" height="22" rx="11" fill="${P.cloudShade}"/>
      ${circles(0, '#fdfdfc')}
      <g opacity=".85">${circles(-5, '#ffffff', 0.72)}</g>
    </g></svg>`;
}

// 들판 앞쪽 길가: 왼쪽엔 버스 정류장, 오른쪽엔 서 있는 시내버스 (가는 펜 선 + 수채화 채색)
function makeBusStopScene() {
  const INK = 'rgba(80,74,68,.85)', P = SEASONS[season], R = mulberry32(808);
  const y0 = 372;   // 길 바닥 높이
  let s = `<g stroke="${INK}" stroke-width=".8" stroke-linejoin="round" stroke-linecap="round">`;
  // 길: 옅은 회색 물감이 번진 아스팔트 + 연석
  s += `<path d="M-5 ${y0 - 4} C 120 ${y0 - 7} 260 ${y0 - 3} 405 ${y0 - 6} L405 ${y0 + 12} C 260 ${y0 + 14} 120 ${y0 + 10} -5 ${y0 + 13}Z" fill="#c9c6c0" opacity=".85" stroke="none" filter="url(#wash)"/>`;
  s += `<path d="M-5 ${y0 - 4} C 120 ${y0 - 7} 260 ${y0 - 3} 405 ${y0 - 6}" fill="none" stroke-width=".7"/>`;
  s += `<path d="M-5 ${y0 + 1} C 120 ${y0 - 2} 260 ${y0 + 2} 405 ${y0 - 1}" fill="none" stroke="rgba(80,74,68,.35)"/>`;
  if (season === 'autumn') for (let i = 0; i < 26; i++) s += `<ellipse cx="${f1(R() * 400)}" cy="${f1(y0 - 2 + R() * 13)}" rx="1.4" ry=".8" fill="${pick(R, ['#d9653f', '#e8913f', '#f0b54a'])}" stroke="none"/>`;
  if (season === 'winter') s += `<path d="M-5 ${y0 - 5} C 120 ${y0 - 8} 260 ${y0 - 4} 405 ${y0 - 7} L405 ${y0 - 2} C 260 ${y0} 120 ${y0 - 3} -5 ${y0}Z" fill="#fbfcfd" stroke="none"/>`;

  // ---- 왼쪽: 버스 정류장 (표지판 기둥 + 작은 대기소) ----
  s += `<rect x="16" y="${y0 - 64}" width="2.6" height="62" fill="#b9b6b0"/>`;                       // 기둥
  s += `<path d="M17 ${y0 - 60} L48 ${y0 - 60}" stroke-width="1.4" stroke="#8f8b85"/>`;              // 팔
  s += `<rect x="30" y="${y0 - 59}" width="20" height="7" rx="1" fill="#a87c5c"/>`;                  // 정류장 이름판
  s += `<circle cx="17.3" cy="${y0 - 68}" r="6" fill="#f6f3ec"/><rect x="13.5" y="${y0 - 70.5}" width="7.6" height="5" rx="1" fill="#7fb4d6"/>`;
  // 대기소: 지붕 + 투명 벽 + 의자
  s += `<path d="M30 ${y0 - 36} L78 ${y0 - 36} L74 ${y0 - 42} L34 ${y0 - 42}Z" fill="#9fb9b0"/>`;
  s += `<rect x="34" y="${y0 - 36}" width="2" height="34" fill="#b9b6b0"/><rect x="72" y="${y0 - 36}" width="2" height="34" fill="#b9b6b0"/>`;
  s += `<rect x="36" y="${y0 - 35}" width="36" height="22" fill="#d7e6ea" opacity=".55"/>`;
  s += `<rect x="40" y="${y0 - 14}" width="28" height="3" rx="1" fill="#a87c5c"/><path d="M43 ${y0 - 11} L43 ${y0 - 3} M65 ${y0 - 11} L65 ${y0 - 3}"/>`;
  s += `<rect x="38" y="${y0 - 33}" width="10" height="14" fill="#f2e6c9" opacity=".9"/>`;            // 노선도

  // 가로등 (버스는 움직이는 별도 층에서 그려요 → busLive)
  s += `<path d="M206 ${y0 - 2} L206 ${y0 - 84} Q206 ${y0 - 92} 216 ${y0 - 92} L224 ${y0 - 92}" fill="none" stroke="#9c9891" stroke-width="2"/>`;
  s += `<path d="M220 ${y0 - 94} L230 ${y0 - 94} L228 ${y0 - 90} L222 ${y0 - 90}Z" fill="#cfcbc4"/>`;
  // 길가 장면 전체를 약 1.15배 크게 (양옆이 잘리지 않게 기준점을 왼쪽에 둬요)
  return `<g transform="${SCENE_T}">${s}</g></g>`;
}
const SCENE_T = 'translate(42.7 372) scale(1.15) translate(-42.7 -372)';

// =====================================================================
//  메인 화면의 움직이는 버스: 멍냥이 5마리가 줄 서 있다가 5초마다 한 마리씩 타고,
//  탄 친구는 창밖을 바라보는 얼굴로 창문에 나타나요. 창문이 다 차면 출발 → 새 버스 도착.
// =====================================================================
const BUS = { x: 222, y0: 372, w: 120, h: 44, windows: 6, doorX: 244, gap: 13, every: 5 };
const busLive = { dx: 0, phase: 'arrive', t: 0, faces: [], queue: [], walker: null, timer: 2.5, last: 0 };
const OUTL = 'rgba(112,104,96,.75)';
const RIBBONS = ['#e8768e', '#7fb4d6', '#f2c35a', '#b9a2d8'];
const newFriend = () => ({
  kind: Math.random() < 0.5 ? 'cat' : 'dog', c: Math.floor(Math.random() * COLORS.length),
  ribbon: Math.random() < 0.18 ? RIBBONS[Math.floor(Math.random() * 4)] : null, bag: Math.random() < 0.16,
});
// 정류장 멍냥이는 미리 정한 12마리 중에서 골라요. 그림은 한가할 때 하나씩 미리 그려 둬요
//   (새 친구가 줄에 처음 나타나는 순간 그림을 그리면 오래된 폰에서 덜컥거려요)
const FRIEND_POOL = Array.from({ length: 12 }, newFriend);
const randFriend = () => ({ ...FRIEND_POOL[Math.floor(Math.random() * FRIEND_POOL.length)] });
(function warmFriends(i = 0) {
  if (i >= FRIEND_POOL.length) return;
  const idle = window.requestIdleCallback || (f => setTimeout(f, 120));
  idle(() => {
    try { animalSpriteId(FRIEND_POOL[i]); if (typeof faceImg === 'function') faceImg(FRIEND_POOL[i]); } catch (e) { /* 나중에 그려도 돼요 */ }
    warmFriends(i + 1);
  });
})();

// 줄 서 있는 작은 멍냥이 (발 위치 = 0,0)
function miniAnimalSVG(a, sleep = false) {
  const C = COLORS[a.c], o = `stroke="${OUTL}" stroke-width=".55"`;
  const ears = a.kind === 'cat'
    ? `<path d="M-4.2 -12 L-3.3 -17.2 L-0.8 -14.6Z M4.2 -12 L3.3 -17.2 L0.8 -14.6Z" fill="${C.c}" ${o}/>`
    : '';
  const dogEars = a.kind === 'dog'
    ? `<ellipse cx="-4.1" cy="-11.4" rx="1.5" ry="2.9" transform="rotate(18 -4.1 -11.4)" fill="${C.d}"/><ellipse cx="4.1" cy="-11.4" rx="1.5" ry="2.9" transform="rotate(-18 4.1 -11.4)" fill="${C.d}"/>`
    : '';
  return `<ellipse cx="0" cy=".4" rx="4.6" ry="1.2" fill="rgba(70,50,30,.2)"/>
    <ellipse cx="0" cy="-3.4" rx="3.9" ry="3.6" fill="${C.c}" ${o}/>${ears}
    <circle cx="0" cy="-11" r="4.6" fill="${C.c}" ${o}/>${dogEars}
    <ellipse cx="0" cy="-9.4" rx="1.9" ry="1.2" fill="#fbf1de"/>
    ${sleep
      ? `<path d="M-2.5 -11.6 Q-1.6 -10.6 -0.7 -11.6 M0.7 -11.6 Q1.6 -10.6 2.5 -11.6" fill="none" stroke="#2e231a" stroke-width=".55" stroke-linecap="round"/>`
      : `<circle cx="-1.6" cy="-11.4" r=".75" fill="#2e231a"/><circle cx="1.6" cy="-11.4" r=".75" fill="#2e231a"/>
    <circle cx="-1.8" cy="-11.7" r=".28" fill="#fff"/><circle cx="1.4" cy="-11.7" r=".28" fill="#fff"/>`}
    <ellipse cx="-2.9" cy="-9.9" rx=".9" ry=".55" fill="rgba(255,110,140,.55)"/><ellipse cx="2.9" cy="-9.9" rx=".9" ry=".55" fill="rgba(255,110,140,.55)"/>
    ${a.ribbon ? `<path d="M2 -15.2 L4.6 -16.6 L4.6 -13.8Z M2 -15.2 L-0.6 -16.6 L-0.6 -13.8Z" fill="#e8768e" ${o}/>` : ''}`;
}
// 창밖을 바라보는 얼굴 (창문 안쪽)
function windowFaceSVG(a, wx, wy) {
  const C = COLORS[a.c], o = `stroke="${OUTL}" stroke-width=".5"`, cx = wx + 6.75, cy = wy + 10.5;
  const ears = a.kind === 'cat'
    ? `<path d="M${cx - 4.2} ${cy - 2} L${cx - 3.3} ${cy - 7} L${cx - 0.8} ${cy - 4.4}Z M${cx + 4.2} ${cy - 2} L${cx + 3.3} ${cy - 7} L${cx + 0.8} ${cy - 4.4}Z" fill="${C.c}" ${o}/>`
    : `<ellipse cx="${cx - 4}" cy="${cy - 0.6}" rx="1.5" ry="2.8" fill="${C.d}"/><ellipse cx="${cx + 4}" cy="${cy - 0.6}" rx="1.5" ry="2.8" fill="${C.d}"/>`;
  return `<g>${a.kind === 'cat' ? ears : ''}<circle cx="${cx}" cy="${cy}" r="4.6" fill="${C.c}" ${o}/>${a.kind === 'dog' ? ears : ''}
    <ellipse cx="${cx}" cy="${cy + 1.6}" rx="1.9" ry="1.2" fill="#fbf1de"/>
    <circle cx="${cx - 1.6}" cy="${cy - 0.4}" r=".75" fill="#2e231a"/><circle cx="${cx + 1.6}" cy="${cy - 0.4}" r=".75" fill="#2e231a"/>
    <circle cx="${cx - 1.8}" cy="${cy - 0.7}" r=".28" fill="#fff"/><circle cx="${cx + 1.4}" cy="${cy - 0.7}" r=".28" fill="#fff"/>
    <ellipse cx="${cx - 2.9}" cy="${cy + 1.1}" rx=".9" ry=".55" fill="rgba(255,110,140,.55)"/><ellipse cx="${cx + 2.9}" cy="${cy + 1.1}" rx=".9" ry=".55" fill="rgba(255,110,140,.55)"/></g>`;
}
// 버스 그림 (왼쪽 위 = 0,0)
function busBodySVG(faces) {
  const bw = BUS.w, bh = BUS.h, I = `stroke="rgba(80,74,68,.85)" stroke-width=".8" stroke-linejoin="round"`;
  let s = `<ellipse cx="${bw / 2}" cy="${bh + 3}" rx="${bw * 0.52}" ry="4" fill="rgba(70,65,60,.22)"/>`;
  s += `<path d="M6 0 L${bw - 4} 0 Q${bw} 0 ${bw} 5 L${bw} ${bh - 4} L0 ${bh - 4} L0 9 Q0 0 6 0Z" fill="#f6f5f1" ${I}/>`;
  s += `<path d="M1 6 Q2 1 8 1 L54 1 L40 9 L1 9Z" fill="#8cbfdd" opacity=".85"/>`;
  s += `<path d="M30 ${bh - 12} L${bw} ${bh - 16} L${bw} ${bh - 10} L26 ${bh - 6}Z" fill="#8cbfdd" opacity=".7"/>`;
  s += `<path d="M2 11 L14 11 L14 30 L2 32Z" fill="#6f7c86" ${I}/>`;
  s += `<rect x="3" y="3" width="18" height="4" rx=".8" fill="#e8c56a" ${I}/>`;
  for (let i = 0; i < BUS.windows; i++) {
    const wx = 30 + i * 15;
    s += `<rect x="${wx}" y="11" width="13.5" height="15" rx="1" fill="#6d7a83" ${I}/>`;
    if (faces[i]) s += windowFaceSVG(faces[i], wx, 11);
    s += `<rect x="${wx}" y="11" width="13.5" height="15" rx="1" fill="rgba(200,225,235,.18)" stroke="none"/>`;   // 유리 반사
  }
  s += `<rect x="17" y="11" width="10" height="${bh - 16}" fill="#7d8992" ${I}/><path d="M22 11 L22 ${bh - 5}" ${I}/>`;
  s += `<rect x="-1" y="${bh - 7}" width="${bw + 2}" height="4" rx="1.5" fill="#d9d6cf" ${I}/>`;
  s += `<circle cx="4" cy="${bh - 11}" r="1.8" fill="#fff3c4" ${I}/>`;
  for (const wx of [30, bw - 24]) s += `<circle cx="${wx}" cy="${bh}" r="8" fill="#4b4642" ${I}/><circle cx="${wx}" cy="${bh}" r="3.6" fill="#cfcbc4"/>`;
  return s;
}
// ---- 인게임과 똑같은 멍냥이를 작은 그림(스프라이트)으로 한 번 그려 두고 메인 화면에서 재사용 ----
const SPR_PX = 26 / 5.3;      // 스프라이트 픽셀 ÷ 메인 화면 단위 (인게임 r=26으로 그려서 r=5.3 크기로 보여요)
const spriteIds = new Map();
function animalSpriteId(a, lying = false) {
  const key = `${a.kind}-${a.c}-${a.ribbon ? a.ribbon.slice(1) : 'n'}-${a.bag ? 1 : 0}-${lying ? 1 : 0}`;
  if (spriteIds.has(key)) return spriteIds.get(key);
  const W = lying ? 200 : 128, H = lying ? 120 : 128;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const saved = ctx, savedLW = LW_SCALE;
  ctx = cv.getContext('2d'); LW_SCALE = 2.6;
  try {
    if (lying) drawLyingAnimal(W / 2, H - 14, 26, a.c, a.kind, a.ribbon);
    else drawAnimal(64, 108, 26, a.c, a.kind, 0, 0, { ribbon: a.ribbon, bag: a.bag });
  } finally { ctx = saved; LW_SCALE = savedLW; }
  const id = 'spr-' + key;
  // 발 위치가 (0,0)에 오도록 그릴 자리와 크기를 같이 기억해요
  spriteIds.set(key, id);
  spriteCv.set(id, { cv, x: -W / 2 / SPR_PX, y: -(lying ? H - 14 : 108) / SPR_PX, w: W / SPR_PX, h: H / SPR_PX });
  return id;
}
const spriteCv = new Map();

// 엎드려서 자는 멍냥이 (앞발 위에 턱을 괴고). x=가운데, y=바닥
function drawLyingAnimal(x, y, r, colorIdx, kind, ribbon) {
  const C = COLORS[colorIdx], LT = lightOf(C), SH = shadeOf(C), lw = 0.9 * LW_SCALE;
  const line = (w = lw) => { ctx.strokeStyle = LINE; ctx.lineWidth = w; ctx.stroke(); };
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.fillStyle = 'rgba(70,50,30,.18)'; ell(x + r * 0.2, y + r * 0.05, r * 1.9, r * 0.22);
  const bx = x + r * 0.35, by = y - r * 0.5;                    // 몸 가운데
  const hx = x - r * 0.95, hy = y - r * 0.8, hr = r * 0.85;     // 머리
  const body = () => rr(bx - r * 1.25, by - r * 0.5, r * 2.5, r * 1.0, r * 0.5);
  const head = () => { ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); };
  const catEar = s => {
    ctx.beginPath();
    ctx.moveTo(hx + s * hr * 0.95, hy - hr * 0.1); ctx.lineTo(hx + s * hr * 0.75, hy - hr * 1.22); ctx.lineTo(hx + s * hr * 0.12, hy - hr * 0.75);
    ctx.closePath();
  };
  const dogEar = s => { ctx.beginPath(); ctx.ellipse(hx + s * hr * 0.86, hy + hr * 0.12, hr * 0.3, hr * 0.6, -s * 0.35, 0, Math.PI * 2); };
  const ear = kind === 'cat' ? catEar : dogEar;

  // 꼬리: 몸 뒤쪽에서 동그랗게 말려 있어요
  ctx.beginPath();
  ctx.moveTo(bx + r * 1.1, by + r * 0.1);
  ctx.bezierCurveTo(bx + r * 1.9, by + r * 0.2, bx + r * 1.9, by - r * 0.8, bx + r * 1.35, by - r * 0.75);
  ctx.strokeStyle = LINE; ctx.lineWidth = r * 0.3 + lw * 2; ctx.stroke();
  ctx.strokeStyle = C.c; ctx.lineWidth = r * 0.3; ctx.stroke();

  // 몸·귀·머리를 하나의 실루엣으로 (바깥만 테두리)
  ctx.strokeStyle = LINE; ctx.lineWidth = lw * 2;
  body(); ctx.stroke(); ear(-1); ctx.stroke(); ear(1); ctx.stroke(); head(); ctx.stroke();
  const bg = ctx.createLinearGradient(0, by - r * 0.5, 0, by + r * 0.5);
  bg.addColorStop(0, LT); bg.addColorStop(0.55, C.c); bg.addColorStop(1, SH);
  body(); ctx.fillStyle = bg; ctx.fill();
  for (const s of [-1, 1]) {
    ear(s); ctx.fillStyle = kind === 'cat' ? C.c : SH; ctx.fill();
    if (kind === 'cat') {
      ctx.fillStyle = '#efb5bf'; ctx.beginPath();
      ctx.moveTo(hx + s * hr * 0.78, hy - hr * 0.38); ctx.lineTo(hx + s * hr * 0.7, hy - hr * 0.95); ctx.lineTo(hx + s * hr * 0.38, hy - hr * 0.72);
      ctx.closePath(); ctx.fill();
    }
  }
  const hg = ctx.createRadialGradient(hx - hr * 0.35, hy - hr * 0.42, hr * 0.1, hx, hy, hr * 1.05);
  hg.addColorStop(0, LT); hg.addColorStop(0.65, C.c); hg.addColorStop(1, SH);
  head(); ctx.fillStyle = hg; ctx.fill();
  if (kind === 'dog') for (const s of [-1, 1]) { dogEar(s); ctx.fillStyle = SH; ctx.fill(); }

  // 턱 아래 앞발 두 개
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(hx + s * hr * 0.42, y - r * 0.12, r * 0.28, r * 0.15, 0, 0, Math.PI * 2);
    ctx.fillStyle = C.c; ctx.fill(); line(lw * 0.9);
  }
  // 주둥이·코
  ctx.fillStyle = kind === 'dog' ? '#fbf1de' : 'rgba(253,245,230,.85)'; ell(hx, hy + hr * 0.34, hr * 0.38, hr * 0.24);
  ctx.fillStyle = kind === 'dog' ? '#3a2c20' : '#d98490'; ell(hx, hy + hr * 0.22, hr * 0.13, hr * 0.09);
  // 감은 눈 + 발그레한 볼
  ctx.strokeStyle = '#2e231a'; ctx.lineWidth = Math.max(1, hr * 0.08);
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(hx + s * hr * 0.34, hy - hr * 0.06, hr * 0.13, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
  for (const s of [-1, 1]) { ctx.fillStyle = 'rgba(255,120,150,.45)'; ell(hx + s * hr * 0.58, hy + hr * 0.2, hr * 0.2, hr * 0.13); }
  if (ribbon) {
    const rx = hx + hr * 0.42, ry = hy - hr * 0.92, k = hr * 0.32;
    ctx.fillStyle = ribbon; ctx.strokeStyle = LINE; ctx.lineWidth = lw;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + s * k * 1.25, ry - k * 0.7); ctx.lineTo(rx + s * k * 1.25, ry + k * 0.7); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(rx, ry, k * 0.32, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
}

// 메인 화면 정류장 장면은 캔버스에 그려요: 버스 몸체는 한 번 구운 그림, 멍냥이·창문 얼굴은 구워 둔 그림을 붙이기만
//   (예전엔 1초에 14번 장면 전체를 SVG 글자로 새로 만들어서 오래된 폰에서 가끔 크게 멈칫했어요)
const svgBitmap = (() => {
  const cache = new Map();
  return (key, svg, w, h) => {
    let e = cache.get(key);
    if (!e) {
      if (cache.size > 60) cache.clear();
      const img = new Image();
      img.src = URL.createObjectURL(new Blob([`<svg xmlns="http://www.w3.org/2000/svg" ${svg.slice(4)}`], { type: 'image/svg+xml' }));
      e = { img, w, h };
      cache.set(key, e);
    }
    return e.img.complete && e.img.naturalWidth ? e.img : null;
  };
})();
const BUS_VB = [-3, -2, BUS.w + 6, BUS.h + 14];
const busBodyImg = () => svgBitmap('body', `<svg viewBox="${BUS_VB.join(' ')}" width="${BUS_VB[2] * 4}" height="${BUS_VB[3] * 4}">${busBodySVG([])}</svg>`);
const faceKey = a => `${a.kind}${a.c}`;
const faceImg = a => svgBitmap('face' + faceKey(a), `<svg viewBox="0 0 13.5 15" width="54" height="60">${windowFaceSVG(a, 0, 0)}</svg>`);
function renderBusLive() {
  const el = $('busLive');
  if (!el || !el.getContext) return;
  const W = el.clientWidth, H = el.clientHeight;
  if (!W || !H) return;
  const pw = Math.round(W * DPR), ph = Math.round(H * DPR);
  if (el.width !== pw || el.height !== ph) { el.width = pw; el.height = ph; }
  const c = el.getContext('2d');
  // viewBox 0 0 400 800 · xMidYMid slice + SCENE_T(42.7,372 기준 1.15배) 와 똑같이 맞춰요
  const sc = Math.max(W / 400, H / 800), ox = (W - 400 * sc) / 2, oy = (H - 800 * sc) / 2, k = 1.15;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, pw, ph);
  c.setTransform(DPR * sc * k, 0, 0, DPR * sc * k, DPR * (ox + sc * 42.7 * (1 - k)), DPR * (oy + sc * 372 * (1 - k)));
  const B = busLive, by = BUS.y0 - 6 - BUS.h, bx = BUS.x + B.dx;
  const put = (a, x, y, s = 1, op = 1, lying = false) => {
    const sp = spriteCv.get(animalSpriteId(a, lying)); if (!sp) return;
    c.globalAlpha = op;
    c.drawImage(sp.cv, x + sp.x * s, y + sp.y * s, sp.w * s, sp.h * s);
    c.globalAlpha = 1;
  };
  // 정류장 벤치에 엎드려 쿨쿨 자는 친구 + z (버스보다 먼저 그려서, 떠나는 버스가 앞을 지나가요)
  const tz = performance.now() / 1000;
  put(benchSleeper, 54, BUS.y0 - 14 + Math.sin(tz * 1.6) * 0.25, 0.72, 1, true);
  c.fillStyle = '#8f9bb3'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  for (let i = 0; i < 3; i++) {
    const q = (tz / 2.4 + i / 3) % 1;
    c.globalAlpha = Math.sin(q * Math.PI) * 0.9;
    c.font = `700 ${3 + q * 3}px MaruBuri, serif`;
    c.fillText('z', 48 + q * 8, BUS.y0 - 24 - q * 12);
  }
  c.globalAlpha = 1;
  // 버스 몸체 + 창문 얼굴 + 유리 반사
  const body = busBodyImg();
  if (body) c.drawImage(body, bx + BUS_VB[0], by + BUS_VB[1], BUS_VB[2], BUS_VB[3]);
  for (let i = 0; i < BUS.windows; i++) {
    const a = B.faces[i]; if (!a) continue;
    const wx = bx + 30 + i * 15, wy = by + 11, f = faceImg(a);
    if (f) c.drawImage(f, wx, wy, 13.5, 15);
    c.fillStyle = 'rgba(200,225,235,.18)'; c.fillRect(wx, wy, 13.5, 15);
  }
  // 줄 선 친구들 (인게임과 똑같은 그림, 크기만 작게)
  B.queue.forEach(a => put(a, a.x, BUS.y0 + 7, 1, a.op));
  if (B.walker) put(B.walker, B.walker.x, B.walker.y, B.walker.k, B.walker.op);
}
const benchSleeper = { kind: 'cat', c: 3, ribbon: '#e8768e', bag: false };
function tickBusLive() {
  const now = performance.now(), dt = Math.min(0.1, (now - (busLive.last || now)) / 1000);
  busLive.last = now;
  if (S || document.hidden) return;                       // 게임 중이거나 화면이 꺼져 있으면 쉬어요
  const B = busLive;
  while (B.queue.length < 5) B.queue.push({ ...randFriend(), x: 150, op: 0 });
  // 줄 선 친구들은 자기 자리로 조금씩 걸어가요
  B.queue.forEach((a, i) => {
    const tx = BUS.doorX - 12 - i * BUS.gap;
    a.x += (tx - a.x) * Math.min(1, dt * 4);
    a.op = Math.min(1, a.op + dt * 2);
  });
  B.t += dt;
  if (B.phase === 'arrive') {                             // 새 버스가 오른쪽에서 들어와요
    B.dx = 230 * Math.pow(1 - Math.min(1, B.t / 2.6), 3);
    if (B.t >= 2.6) { B.phase = 'board'; B.t = 0; B.timer = 1.2; B.dx = 0; }
  } else if (B.phase === 'board') {
    B.timer -= dt;
    if (B.timer <= 0 && !B.walker && B.faces.length < BUS.windows) {
      const a = B.queue.shift();                          // 맨 앞 친구가 문으로 쏙
      B.walker = { ...a, y: BUS.y0 + 7, k: 1, op: 1, t: 0 };
      B.timer = BUS.every;
    }
    if (B.walker) {
      const w = B.walker;
      w.t += dt / 0.9;
      w.x = lerp(w.x, BUS.x + 22, Math.min(1, dt * 6));
      w.y = BUS.y0 + 7 - w.t * 8;
      w.k = 1 - w.t * 0.3; w.op = 1 - w.t;
      if (w.t >= 1) { B.faces.push(w); B.walker = null; }   // 창문에 얼굴이 나타나요
    }
    if (B.faces.length >= BUS.windows && !B.walker) { B.phase = 'full'; B.t = 0; }
  } else if (B.phase === 'full') {                        // 모두 창밖을 바라보는 모습을 잠깐 보여 주고
    if (B.t >= 1.6) { B.phase = 'leave'; B.t = 0; }
  } else if (B.phase === 'leave') {                       // 왼쪽으로 출발!
    B.dx = -360 * Math.pow(Math.min(1, B.t / 3.4), 2);
    if (B.t >= 3.4) { B.phase = 'arrive'; B.t = 0; B.faces = []; B.dx = 230; }
  }
  renderBusLive();
}
setInterval(() => { if (!LITE || (busLive.liteTick = !busLive.liteTick)) tickBusLive(); }, 70);   // 초당 14번 (가벼운 모드는 7번)

function makeSnowman() {
  return `<g transform="translate(318 470)" stroke="rgba(112,104,96,.6)" stroke-width="1">
    <ellipse cx="0" cy="2" rx="28" ry="5" fill="rgba(120,130,145,.25)" stroke="none"/>
    <path d="M-17 -22 L-36 -36 M-31 -32 L-35 -40 M17 -22 L35 -34 M30 -31 L36 -38" stroke="#6d5e55" stroke-width="2" stroke-linecap="round" fill="none"/>
    <circle cx="0" cy="-17" r="19" fill="#fbfcfd"/><circle cx="0" cy="-46" r="13.5" fill="#fbfcfd"/>
    <circle cx="0" cy="-22" r="1.6" fill="#5a5048" stroke="none"/><circle cx="0" cy="-13" r="1.6" fill="#5a5048" stroke="none"/>
    <path d="M-12 -38 Q0 -32 12 -38 L12 -34 Q0 -28 -12 -34Z" fill="#c9604a"/><path d="M5 -35 L9 -24 L4 -24Z" fill="#c9604a"/>
    <rect x="-9" y="-66" width="18" height="11" rx="1" fill="#7c8a96"/><rect x="-12" y="-57" width="24" height="3" rx="1" fill="#7c8a96"/>
    <circle cx="-4.5" cy="-49" r="1.5" fill="#3a332c" stroke="none"/><circle cx="4.5" cy="-49" r="1.5" fill="#3a332c" stroke="none"/>
    <path d="M0 -45 L11 -43 L0 -41.5Z" fill="#e8893a" stroke="none"/>
  </g>`;
}

// 배경 그림 전체 (하늘 → 먼 산 → 숲 → 들판과 풀)
// SVG 글자를 이미지로 바꿔 <img>에 넣어요 (브라우저가 한 번만 그리고 재사용)
function setSvgImage(img, svg) {
  if (img._url) URL.revokeObjectURL(img._url);
  img._url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  img.src = img._url;
}

function renderScene() {
  const P = SEASONS[season], R = mulberry32(2024);
  // 하늘(시간에 따라 바뀌는 부분)은 살아 있는 SVG로, 땅 풍경은 한 번만 그린 이미지로
  $('skyLayer').innerHTML = `<defs>
    <linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1"><stop id="sk0" offset="0" stop-color="${P.sky[0]}"/><stop id="sk1" offset=".25" stop-color="${P.sky[1]}"/><stop id="sk2" offset=".4" stop-color="${P.sky[2]}"/></linearGradient>
    <radialGradient id="glowG"><stop offset="0" stop-color="#fff6dc" stop-opacity=".9"/><stop offset=".35" stop-color="#fff0c8" stop-opacity=".35"/><stop offset="1" stop-color="#fff0c8" stop-opacity="0"/></radialGradient>
  </defs><rect width="400" height="800" fill="url(#skyG)"/><g id="celestial"></g>`;
  let s = `<defs>
    <linearGradient id="mtG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.mt[0]}"/><stop offset="1" stop-color="${P.mt[1]}"/></linearGradient>
    <linearGradient id="mdG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.meadow[0]}"/><stop offset=".45" stop-color="${P.meadow[1]}"/><stop offset="1" stop-color="${P.meadow[2]}"/></linearGradient>
    <filter id="paper"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" seed="4"/>
      <feColorMatrix type="matrix" values="0 0 0 0 .45  0 0 0 0 .38  0 0 0 0 .3  0 0 0 .07 0"/></filter>
    <filter id="haze"><feGaussianBlur stdDeviation=".6"/></filter>
    <filter id="wash" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2"/></filter>
  </defs>`;
  // (먼 산은 없애고, 들판 숲 위로 바로 하늘이 보여요)
  const ridge = x => 202 + Math.sin(x / 37) * 6 + Math.sin(x / 13) * 3;   // 지평선 (땅을 위로 넓힘)
  // 숲 아래와 들판 사이 빈틈을 덤불로 꽉 채우기: 물감 번짐 띠 + 자잘한 잎
  let bushTop = `M-6 ${f1(ridge(-6) + 4)}`;
  for (let x = 4; x <= 410; x += 10) bushTop += ` L${x} ${f1(ridge(x) + 4 + Math.sin(x / 7) * 2)}`;
  s += `<path d="${bushTop} L410 244 L-6 244Z" fill="${P.forest[2]}" opacity=".95" filter="url(#wash)"/>`;
  s += `<path d="${bushTop} L410 244 L-6 244Z" fill="${P.forest[0]}" opacity=".55"/>`;
  for (let i = 0; i < 420; i++) {
    const x = R() * 412 - 6, y = ridge(x) + 2 + R() * 30, L = 2.2 + R() * 2.2;
    s += `<path d="M0 0 Q${f1(L / 2)} ${f1(-L * 0.45)} ${f1(L)} 0 Q${f1(L / 2)} ${f1(L * 0.45)} 0 0Z" fill="${pick(R, P.forest)}" opacity=".85" transform="translate(${f1(x)} ${f1(y)}) rotate(${Math.round(R() * 360)})"/>`;
    if (season === 'winter' && R() < 0.3) s += `<ellipse cx="${f1(x)}" cy="${f1(y - 1)}" rx="1.6" ry=".7" fill="#fbfcfd"/>`;
  }
  // 지평선 숲: 앞쪽 나무와 똑같은 수채화 나무를 작게 촘촘히 (먼 줄은 흐릿하게)
  for (const [row, hmin, hmax, step, dy, op] of [[0, 22, 30, 7, 16, 0.65], [1, 28, 40, 9, 28, 0.95]]) {
    let g = `<g opacity="${op}">`;
    for (let x = -12; x < 414; x += step * (0.7 + R() * 0.6)) {
      const th = hmin + R() * (hmax - hmin), y = ridge(x) + dy + R() * 4;
      g += `<g transform="translate(${f1(x)} ${f1(y)})">${makeTree(500 + row * 100 + Math.round(x), th, season, 0.5)}</g>`;
    }
    s += g + '</g>';
  }
  // 들판
  s += `<path d="M0 222 C 80 210 160 230 240 218 C 300 210 360 222 400 216 L400 800 L0 800Z" fill="url(#mdG)"/>`;
  // 숲과 들판의 경계: 들판 위로 잎사귀·덤불을 한 겹 더 덮어 경계선이 안 보이게 자연스럽게 이어요
  const bz = (a, b, c, d, t) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d;
  const edge = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40; edge.push([bz(0, 80, 160, 240, t), bz(222, 210, 230, 218, t)]); }
  for (let i = 1; i <= 30; i++) { const t = i / 30; edge.push([bz(240, 300, 360, 400, t), bz(218, 210, 222, 216, t)]); }
  const edgeY = x => { for (let i = 1; i < edge.length; i++) if (edge[i][0] >= x) { const [x0, y0] = edge[i - 1], [x1, y1] = edge[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0 || 1); } return 216; };
  let fringe = `M-6 ${f1(edgeY(0) - 7)}`;
  for (let x = 4; x <= 410; x += 8) fringe += ` L${x} ${f1(edgeY(Math.min(x, 400)) - 7 + Math.sin(x / 5) * 2.5)}`;
  for (let x = 410; x >= -6; x -= 8) fringe += ` L${x} ${f1(edgeY(clamp(x, 0, 400)) + 7 + Math.sin(x / 6) * 3)}`;
  s += `<path d="${fringe}Z" fill="${P.forest[2]}" opacity=".85" filter="url(#wash)"/>`;
  for (let i = 0; i < 520; i++) {
    const x = R() * 412 - 6, ey = edgeY(clamp(x, 0, 400)), dy = (R() - 0.45) * 18;
    const below = dy > 3;   // 경계 아래쪽은 들판 풀색 잎으로 섞어서 땅으로 스며들게
    const L = 2.2 + R() * 2.4;
    s += `<path d="M0 0 Q${f1(L / 2)} ${f1(-L * 0.45)} ${f1(L)} 0 Q${f1(L / 2)} ${f1(L * 0.45)} 0 0Z" fill="${below ? pick(R, P.grass) : pick(R, P.forest)}" opacity="${below ? '.7' : '.9'}" transform="translate(${f1(x)} ${f1(ey + dy)}) rotate(${Math.round(R() * 360)})"/>`;
    if (season === 'winter' && R() < 0.25) s += `<ellipse cx="${f1(x)}" cy="${f1(ey + dy - 1)}" rx="1.6" ry=".7" fill="#fbfcfd"/>`;
  }
  // 들판 끝자락의 작은 나무들과 양옆의 큰 나무 (모두 땅 위에)
  for (const [x, y, h, sd] of [[34, 244, 46, 1], [372, 240, 52, 2], [120, 234, 30, 3], [262, 232, 28, 4], [200, 300, 40, 5], [330, 320, 36, 6], [372, 560, 62, 7], [70, 700, 58, 8]])
    s += `<g transform="translate(${x} ${y})">${makeTree(sd, h)}</g>`;
  // 풀잎: 멀수록 작고 옅게, 가까울수록 크고 진하게
  let grass = '';
  for (let i = 0; i < 600; i++) {
    const y = 230 + Math.pow(R(), 0.8) * 570, x = R() * 400, k = (y - 220) / 580;
    const hgt = 3 + k * 13 + R() * 4, bend = (R() - 0.5) * hgt * 0.8;
    grass += `<path d="M${f1(x)} ${f1(y)} q${f1(bend * 0.3)} ${f1(-hgt * 0.6)} ${f1(bend)} ${f1(-hgt)}" stroke="${pick(R, P.grass)}" stroke-width="${f1(0.6 + k * 1.1)}" opacity="${f1(0.45 + k * 0.5)}" fill="none" stroke-linecap="round"/>`;
  }
  s += grass;
  for (let i = 0; i < 46 && P.flowers.length; i++) {
    const y = 240 + R() * 550, k = (y - 220) / 580;
    s += `<circle cx="${f1(R() * 400)}" cy="${f1(y)}" r="${f1(0.8 + k * 2)}" fill="${pick(R, P.flowers)}"/>`;
  }
  s += makeBusStopScene();
  if (season === 'winter') s += makeSnowman();
  s += `<rect width="400" height="800" filter="url(#paper)"/>`;
  setSvgImage($('land'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 800" width="400" height="800">${s}</svg>`);

  // 구름 (흐리거나 비/눈이 오면 더 많고 잿빛)
  const sky = $('sky');
  sky.innerHTML = '';
  const gloomy = ['cloudy', 'rain', 'snow'].includes(weather.kind);
  const CP = gloomy ? { cloudShade: '#bfc5cd' } : P;
  const cl = [[2, 230, 80, -20], [9, 160, 110, -70], [14, 220, 140, -15], [5, 130, 95, -40]];
  if (gloomy) cl.push([0, 300, 90, -55], [11, 260, 120, -95], [6, 240, 100, -5]);
  cl.forEach(([top, w, dur, delay], i) => {
    const c = document.createElement('div');
    c.className = 'cloud';
    c.style.cssText = `top:${top}%;width:${w}px;animation-duration:${dur}s;animation-delay:${delay}s;opacity:${i === 3 ? 0.75 : 0.95}`;
    const img = document.createElement('img');
    img.alt = ''; img.draggable = false; img.style.width = '100%'; img.style.display = 'block';
    setSvgImage(img, makeCloud('cf' + i, 11 + i * 7, CP)
      .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ').replace('width="100%"', 'width="260" height="120"'));
    c.appendChild(img);
    sky.appendChild(c);
  });

  makeParticles();
  updateSky();
  islandTree.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 -110 120 120" width="240" height="240">
      <defs><filter id="wash" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2"/></filter></defs>
      ${makeTree(77, 100).replace(/<g filter="url\(#wash\)">[\s\S]*?<\/g>/, '')}</svg>`);   // 뿌연 물감 번짐은 빼서 잎·가지만 길을 가려요
}
const islandTree = new Image();

