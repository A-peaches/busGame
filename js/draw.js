// 멍냥이의 버스여행 - 그리기: 버스, 멍냥이, 정류장, 주차장, 레일
// =====================================================================
//  그리기
// =====================================================================
function rr(x, y, w, h, r) {
  // 크기가 0 이하(가로 화면 등)여도 오류 없이 넘어가요
  w = Math.max(0, w); h = Math.max(0, h);
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
// 아스팔트의 자잘한 알갱이 (항상 같은 자리에 찍히도록 고정 난수)
function drawSpeckles(x, y, w, h, n) {
  const R = mulberry32(Math.round(w * 7 + h));
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = R() < 0.5 ? 'rgba(255,255,255,.1)' : 'rgba(40,35,30,.08)';
    ctx.fillRect(x + 6 + R() * (w - 12), y + 6 + R() * (h - 12), 1.6, 1.6);
  }
}

function drawVehicle(x, y, a, w, l, colorIdx, hidden, o = {}) {
  const C = hidden ? HIDDEN_COLOR : COLORS[colorIdx];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  if (o.scale) ctx.scale(o.scale, o.scale);
  ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;

  const lw = 1, R = w * 0.3;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  // 땅에 드리운 옅은 그림자
  ctx.fillStyle = 'rgba(70,50,30,.16)';
  rr(-w / 2 + 1.5, -l / 2 + 2.5, w, l, R); ctx.fill();

  // 차체: 무광, 양옆이 살짝 어두워 둥근 부피감 + 얇은 갈색 테두리
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, shadeOf(C)); g.addColorStop(0.18, C.c); g.addColorStop(0.82, C.c); g.addColorStop(1, shadeOf(C));   // 멍냥이 털색과 똑같은 색이 넓게
  ctx.fillStyle = g;
  rr(-w / 2, -l / 2, w, l, R); ctx.fill();
  ctx.strokeStyle = LINE; ctx.lineWidth = lw; ctx.stroke();

  // 옛날 시골버스 같은 투톤 지붕
  ctx.fillStyle = 'rgba(255,250,240,.12)';           // 지붕은 아주 옅게만 (색이 바래 보이지 않게)
  rr(-w * 0.31, -l / 2 + w * 0.46, w * 0.62, l - w * 0.9, w * 0.14); ctx.fill();
  ctx.strokeStyle = 'rgba(112,104,96,.4)'; ctx.lineWidth = lw * 0.7; ctx.stroke();

  // 옆 창문 (위에서 보면 가장자리에 줄지어 보여요)
  const span = l - w * 0.95, n = Math.max(1, Math.floor(span / (w * 0.34))), step = span / n;
  ctx.fillStyle = 'rgba(120,140,146,.85)';
  for (let i = 0; i < n; i++) {
    const yy = -l / 2 + w * 0.5 + step * (i + 0.15);
    for (const s of [-1, 1]) { rr(s * w * 0.43 - w * 0.04, yy, w * 0.08, step * 0.7, 1); ctx.fill(); }
  }
  // 앞유리 / 뒷유리
  ctx.fillStyle = '#7f9195';
  rr(-w * 0.36, -l / 2 + w * 0.1, w * 0.72, w * 0.24, w * 0.07); ctx.fill();
  ctx.strokeStyle = LINE; ctx.lineWidth = lw * 0.75; ctx.stroke();
  ctx.fillStyle = '#8d9ea1';
  rr(-w * 0.3, l / 2 - w * 0.27, w * 0.6, w * 0.13, w * 0.05); ctx.fill(); ctx.stroke();

  if (hidden) {
    // 색은 숨겨도 나가는 방향은 보여 줘요: 앞쪽 끝에 작은 화살촉 (무엇을 먼저 치워야 할지 알 수 있게)
    if (o.arrow) {
      const hy = -l / 2 + w * 0.78, hw = w * 0.28, hh = w * 0.26;
      ctx.beginPath();
      ctx.moveTo(0, hy - hh); ctx.lineTo(hw, hy + hh * 0.6); ctx.lineTo(0, hy + hh * 0.15); ctx.lineTo(-hw, hy + hh * 0.6); ctx.closePath();
      ctx.fillStyle = '#f6ecd8'; ctx.fill();
      ctx.strokeStyle = LINE; ctx.lineWidth = lw * 0.8; ctx.stroke();
    }
    ctx.rotate(-a);
    ctx.font = `700 ${w * 0.62}px MaruBuri, serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = LINE; ctx.lineWidth = lw * 1.4; ctx.strokeText('?', 0, 1);
    ctx.fillStyle = '#f6ecd8'; ctx.fillText('?', 0, 1);
  } else if (o.arrow) {
    // 크림색 화살표 + 얇은 테두리
    const s = Math.min(l * 0.22, w * 0.7), hw = w * 0.25, sw = w * 0.075, hb = -s + w * 0.2;
    ctx.beginPath();
    ctx.moveTo(0, -s - w * 0.12); ctx.lineTo(hw, hb); ctx.lineTo(sw, hb); ctx.lineTo(sw, s);
    ctx.lineTo(-sw, s); ctx.lineTo(-sw, hb); ctx.lineTo(-hw, hb); ctx.closePath();
    ctx.fillStyle = '#fbf3e2'; ctx.fill();
    ctx.strokeStyle = LINE; ctx.lineWidth = lw * 0.8; ctx.stroke();
  } else if (o.seats !== undefined && o.seats !== null) {
    // 남은 좌석 수를 지붕에 크게
    ctx.rotate(-a);
    const tw = w * 0.82, th = w * 0.62;
    rr(-tw / 2, -th / 2, tw, th, th * 0.35);
    ctx.fillStyle = 'rgba(251,246,234,.95)'; ctx.fill();
    ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#5a4a3a';
    ctx.font = `700 ${w * (o.seats >= 10 ? 0.4 : 0.48)}px MaruBuri, serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(o.seats), 0, 1);
  }
  if (o.turner && !hidden) {
    // U턴 버스: 앞쪽 모서리에 작은 노란 배지 + 다음 U턴까지 남은 턴 수 (화살표와 겹치지 않게)
    ctx.save();
    ctx.translate(w * 0.46, -l / 2 + w * 0.3);
    ctx.rotate(-a);
    const r = w * 0.3;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#f6dd92'; ctx.fill();
    ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.stroke();
    // 다음 U턴까지 남은 턴 수
    ctx.fillStyle = '#5a4a3a'; ctx.font = `700 ${r * 1.35}px MaruBuri, serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(o.turner), 0, r * 0.08);
    ctx.restore();
  }
  if (o.capLabel && !hidden) {
    // 주차된 버스: 꼬리 쪽에 작은 숫자로 정원 표시
    ctx.save();
    ctx.translate(0, l / 2 - w * 0.48);
    ctx.rotate(-a);
    ctx.font = `700 ${w * 0.3}px MaruBuri, serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(90,80,70,.7)'; ctx.lineWidth = 2; ctx.strokeText(String(o.capLabel), 0, 0.5);
    ctx.fillStyle = '#fbf3e2'; ctx.fillText(String(o.capLabel), 0, 0.5);
    ctx.restore();
  }
  ctx.restore();
}

function ell(x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fill(); }

// 색 섞기 (밝은 털색 / 그늘진 털색 만들기)
function mixHex(a, b, t) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
const lightOf = C => C.l || (C.l = mixHex(C.c, '#fff8ec', 0.4));
const shadeOf = C => C.s || (C.s = mixHex(C.c, C.d, 0.55));

// 고양이 / 강아지 승객 (발 위치 기준)
// 생각 말풍선: 고양이는 생선, 강아지는 뼈다귀
function drawThought(x, headTop, r, kind) {
  const bx = x + r * 1.05, by = headTop - r * 1.5;
  const puffs = [[0, 0, 1], [-0.85, 0.15, 0.7], [0.85, 0.15, 0.7], [-0.4, -0.45, 0.72], [0.4, -0.45, 0.72], [0, 0.45, 0.7]];
  const drawPuffs = () => puffs.forEach(([dx, dy, k]) => { ctx.beginPath(); ctx.arc(bx + dx * r, by + dy * r, r * 0.62 * k, 0, Math.PI * 2); ctx[mode](); });
  let mode = 'stroke';
  ctx.strokeStyle = LINE; ctx.lineWidth = 2;
  drawPuffs();
  for (const [dx, dy, k] of [[0.3, 1.25, 0.16], [0.6, 0.95, 0.24]]) { ctx.beginPath(); ctx.arc(x + dx * r, headTop + (dy - 1.5) * r + r * 0.05, r * k, 0, Math.PI * 2); ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = '#fffdf8'; ctx.fill(); }
  ctx.lineWidth = 2;
  mode = 'fill'; ctx.fillStyle = '#fffdf8';
  drawPuffs();
  ctx.lineWidth = 0.9;
  if (kind === 'cat') {
    // 생선
    ctx.beginPath(); ctx.ellipse(bx - r * 0.12, by, r * 0.62, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#9dbbd3'; ctx.fill(); ctx.strokeStyle = LINE; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx + r * 0.42, by); ctx.lineTo(bx + r * 0.82, by - r * 0.28); ctx.lineTo(bx + r * 0.82, by + r * 0.28); ctx.closePath();
    ctx.fillStyle = '#9dbbd3'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2e231a'; circle(bx - r * 0.5, by - r * 0.06, r * 0.07);
  } else {
    // 뼈다귀
    ctx.fillStyle = '#f6eedc'; ctx.strokeStyle = LINE;
    ctx.beginPath();
    for (const s of [-1, 1]) for (const t of [-1, 1]) { ctx.moveTo(bx + s * r * 0.55 + r * 0.17, by + t * r * 0.15); ctx.arc(bx + s * r * 0.55, by + t * r * 0.15, r * 0.17, 0, Math.PI * 2); }
    ctx.rect(bx - r * 0.55, by - r * 0.12, r * 1.1, r * 0.24);
    ctx.stroke(); ctx.fill();
  }
}

// 줄이 시작되는 작은 집: 네모 지붕을 얹은 하얀 도자기 집 (불 켜진 아치형 창문 + 하트 무늬)
//   지붕은 벽보다 살짝 넓은 납작한 판으로, 벽 위에 그대로 얹혀 자연스럽게 이어져요
function drawHouse(x, y, s) {
  const w = s * 0.8, wallH = s * 0.6, dx = s * 0.26, dy = s * 0.15;
  const rt = s * 0.1, o = s * 0.06;                       // 지붕 두께, 처마가 벽 밖으로 나온 길이
  const L = x - w / 2, Rr = x + w / 2, top = y - wallH;
  const glow = (fn) => { ctx.save(); ctx.shadowColor = 'rgba(255,196,110,.95)'; ctx.shadowBlur = s * 0.2; fn(); ctx.restore(); };
  const poly = (pts, fill) => { ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.stroke(); };
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = LINE; ctx.lineWidth = 1;

  // 바닥 그림자 + 바닥에 번지는 불빛
  ctx.fillStyle = 'rgba(70,55,40,.18)'; ell(x + dx * 0.4, y + s * 0.02, w * 0.72, s * 0.07);
  ctx.fillStyle = 'rgba(255,205,120,.18)'; ell(x, y + s * 0.03, w * 0.5, s * 0.05);

  // 옆벽 (그늘) → 앞벽
  poly([[Rr, y], [Rr + dx, y - dy], [Rr + dx, top - dy], [Rr, top]], '#ddd7cc');
  const g = ctx.createLinearGradient(L, top, Rr, y);
  g.addColorStop(0, '#fbf9f4'); g.addColorStop(1, '#ebe6dc');
  poly([[L, y], [L, top], [Rr, top], [Rr, y]], g);

  // 네모 지붕: 윗면 → 옆면 → 앞면 (앞면이 벽 꼭대기를 덮어 이음새가 자연스러워요)
  const rl = L - o, rr2 = Rr + o, rb = top + rt * 0.25, rtp = rb - rt;
  poly([[rl, rtp], [rr2, rtp], [rr2 + dx, rtp - dy], [rl + dx, rtp - dy]], '#f3dccb');
  poly([[rr2, rtp], [rr2 + dx, rtp - dy], [rr2 + dx, rb - dy], [rr2, rb]], '#d8b9a2');
  poly([[rl, rtp], [rr2, rtp], [rr2, rb], [rl, rb]], '#e8c9b3');
  const R = mulberry32(31);                                // 유약이 반짝이는 작은 점
  for (let i = 0; i < 10; i++) {
    const t = R(), u = R();
    ctx.fillStyle = `rgba(255,255,255,${f1(0.5 + R() * 0.5)})`;
    circle(lerp(rl, rr2, t) + dx * u, rtp - dy * u, s * 0.01 + R() * s * 0.01);
  }

  // 불 켜진 아치형 창문 두 개 (십자 창살)
  for (const cx of [x - w * 0.23, x + w * 0.23]) {
    const ww = w * 0.22, wh = wallH * 0.42, wy = y - wallH * 0.14 - wh;
    glow(() => {
      ctx.beginPath(); ctx.moveTo(cx - ww / 2, wy + wh); ctx.lineTo(cx - ww / 2, wy + ww / 2);
      ctx.arc(cx, wy + ww / 2, ww / 2, Math.PI, 0); ctx.lineTo(cx + ww / 2, wy + wh); ctx.closePath();
      ctx.fillStyle = '#ffd98c'; ctx.fill();
    });
    ctx.strokeStyle = '#f3efe7'; ctx.lineWidth = Math.max(1, ww * 0.14);
    ctx.beginPath(); ctx.moveTo(cx, wy); ctx.lineTo(cx, wy + wh); ctx.moveTo(cx - ww / 2, wy + wh * 0.5); ctx.lineTo(cx + ww / 2, wy + wh * 0.5); ctx.stroke();
    ctx.strokeStyle = LINE; ctx.lineWidth = 1;
  }

  // 벽 위쪽 가운데의 빛나는 하트 + 둘레의 작은 점들
  const hx = x, hy = top + wallH * 0.24, hs = s * 0.065;
  glow(() => {
    ctx.beginPath();
    ctx.moveTo(hx, hy + hs * 0.9);
    ctx.bezierCurveTo(hx - hs * 1.3, hy + hs * 0.1, hx - hs * 0.9, hy - hs * 1.0, hx, hy - hs * 0.35);
    ctx.bezierCurveTo(hx + hs * 0.9, hy - hs * 1.0, hx + hs * 1.3, hy + hs * 0.1, hx, hy + hs * 0.9);
    ctx.fillStyle = '#ffd98c'; ctx.fill();
    ctx.fillStyle = '#ffe3a6';
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      circle(hx + Math.cos(a) * hs * 1.9, hy + Math.sin(a) * hs * 1.8, s * 0.012);
    }
  });
}

// 고양이 / 강아지 승객 (발 위치 기준)
//   opts: bag(분홍 보따리) ribbon(리본 색) sleep(쿨쿨) excited(버스 타러 가는 중: 눈이 초롱초롱)
function drawAnimal(x, y, r, colorIdx, kind, bob = 0, phase = 0, opts = {}) {
  const C = COLORS[colorIdx], LT = lightOf(C), SH = shadeOf(C);
  const lw = 0.9 * LW_SCALE;
  const line = (w = lw) => { ctx.strokeStyle = LINE; ctx.lineWidth = w; ctx.stroke(); };
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.fillStyle = 'rgba(70,50,30,.2)';
  ell(x, y + r * 0.45, r * 0.92, r * 0.3);
  y -= bob;
  // 위에서 살짝 누른 듯 좌우로 통통하게
  ctx.save();
  ctx.translate(x, y); ctx.scale(1.15, 0.9); ctx.translate(-x, -y);

  // 꼬리 (몸 뒤에 그려요)
  const tt = opts.tailT !== undefined ? opts.tailT : performance.now() / 1000 + phase;
  if (kind === 'cat') {
    const sw = Math.sin(tt * (opts.sleep ? 0.8 : 2.6));
    const tx = x + r * (1.25 + sw * 0.15), ty = y - r * (0.85 + sw * 0.1);
    ctx.beginPath();
    ctx.moveTo(x + r * 0.35, y - r * 0.05);
    ctx.bezierCurveTo(x + r * 1.15, y + r * 0.1, x + r * (1.35 + sw * 0.25), y - r * 0.35, tx, ty);
    ctx.strokeStyle = LINE; ctx.lineWidth = r * 0.3 + lw * 2; ctx.stroke();
    ctx.strokeStyle = C.c; ctx.lineWidth = r * 0.3; ctx.stroke();
  } else {
    const wag = Math.sin(tt * (opts.sleep ? 2 : opts.excited ? 22 : 14)) * 0.35;
    ctx.save();
    ctx.translate(x + r * 0.42, y - r * 0.15);
    ctx.rotate(-0.55 + wag);
    ctx.beginPath(); ctx.ellipse(r * 0.38, 0, r * 0.4, r * 0.21, 0, 0, Math.PI * 2);
    ctx.fillStyle = C.c; ctx.fill(); line();
    ctx.restore();
  }
  // 발 (몸 아래)
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(x + s * r * 0.25, y + r * 0.42, r * 0.17, r * 0.11, 0, 0, Math.PI * 2);
    ctx.fillStyle = C.c; ctx.fill(); line(lw * 0.8);
  }

  const hx = x, hy = y - r * 1.2, hr = r * 1.02;
  const bodyPath = () => rr(x - r * 0.52, y - r * 0.55, r * 1.04, r * 1.0, r * 0.48);
  const headPath = () => { ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); };
  const catEar = s => {
    ctx.beginPath();
    ctx.moveTo(hx + s * hr * 0.95, hy - hr * 0.1); ctx.lineTo(hx + s * hr * 0.75, hy - hr * 1.22); ctx.lineTo(hx + s * hr * 0.12, hy - hr * 0.75);
    ctx.closePath();
  };
  const dogEar = s => { ctx.beginPath(); ctx.ellipse(hx + s * hr * 0.86, hy + hr * 0.08, hr * 0.3, hr * 0.6, -s * 0.35, 0, Math.PI * 2); };
  const ear = kind === 'cat' ? catEar : dogEar;

  // 한 덩어리 실루엣: 몸·귀·머리의 바깥 테두리를 먼저 굵게 긋고, 그 위를 색으로 채워요.
  // → 겉 테두리만 남고, 몸과 얼굴 / 귀와 얼굴이 이어지는 안쪽에는 선이 없어요.
  ctx.strokeStyle = LINE; ctx.lineWidth = lw * 2;
  bodyPath(); ctx.stroke(); ear(-1); ctx.stroke(); ear(1); ctx.stroke(); headPath(); ctx.stroke();

  // 몸 (위는 밝고 아래는 살짝 어둡게) + 크림색 배
  const bg = ctx.createLinearGradient(0, y - r * 0.55, 0, y + r * 0.45);
  bg.addColorStop(0, LT); bg.addColorStop(0.5, C.c); bg.addColorStop(1, SH);
  bodyPath(); ctx.fillStyle = bg; ctx.fill();
  ctx.fillStyle = 'rgba(253,245,230,.75)'; ell(x, y - r * 0.02, r * 0.22, r * 0.25);

  // 귀
  for (const s of [-1, 1]) {
    ear(s); ctx.fillStyle = kind === 'cat' ? C.c : SH; ctx.fill();
    if (kind === 'cat') {
      ctx.fillStyle = '#efb5bf';
      ctx.beginPath();
      ctx.moveTo(hx + s * hr * 0.78, hy - hr * 0.38); ctx.lineTo(hx + s * hr * 0.7, hy - hr * 0.95); ctx.lineTo(hx + s * hr * 0.38, hy - hr * 0.72);
      ctx.closePath(); ctx.fill();
    }
  }

  // 머리: 왼쪽 위에서 햇빛이 드는 듯 부드러운 음영
  const hg = ctx.createRadialGradient(hx - hr * 0.35, hy - hr * 0.42, hr * 0.1, hx, hy, hr * 1.05);
  hg.addColorStop(0, LT); hg.addColorStop(0.65, C.c); hg.addColorStop(1, SH);
  headPath(); ctx.fillStyle = hg; ctx.fill();
  // 강아지 귀는 얼굴 위로 늘어지게: 귀를 한 번 더 칠하면 바깥 테두리는 남고 얼굴 쪽 이음새엔 선이 없어요
  if (kind === 'dog') for (const s of [-1, 1]) { dogEar(s); ctx.fillStyle = SH; ctx.fill(); }

  // 분홍 보따리 (몇몇 친구만): 막대에 매달아 어깨에 메고 있어요
  if (opts.bag) {
    ctx.beginPath(); ctx.moveTo(x + r * 0.05, y - r * 0.25); ctx.lineTo(x - r * 0.78, y - r * 1.05);
    ctx.strokeStyle = '#8f6a4d'; ctx.lineWidth = r * 0.13; ctx.stroke();
    const bx = x - r * 0.98, by = y - r * 0.78;
    ctx.beginPath(); ctx.arc(bx, by, r * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = '#f2abbe'; ctx.fill(); line();
    ctx.fillStyle = 'rgba(255,250,245,.85)';
    circle(bx - r * 0.15, by + r * 0.05, r * 0.06); circle(bx + r * 0.14, by + r * 0.16, r * 0.06); circle(bx + r * 0.05, by - r * 0.17, r * 0.05);
    ctx.beginPath(); ctx.ellipse(bx + r * 0.1, by - r * 0.42, r * 0.13, r * 0.08, -0.6, 0, Math.PI * 2);
    ctx.fillStyle = '#e897ad'; ctx.fill(); line(lw * 0.8);
  }

  // 정수리 털 한 가닥
  ctx.beginPath();
  ctx.moveTo(hx - hr * 0.08, hy - hr * 0.97);
  ctx.quadraticCurveTo(hx + hr * 0.02, hy - hr * 1.2, hx + hr * 0.2, hy - hr * 1.06);
  line(lw * 0.85);

  if (kind === 'dog') {
    ctx.beginPath(); ctx.ellipse(hx, hy + hr * 0.36, hr * 0.42, hr * 0.28, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fbf1de'; ctx.fill(); line(lw * 0.6);
    ctx.fillStyle = '#3a2c20'; ell(hx, hy + hr * 0.22, hr * 0.16, hr * 0.11);
  } else {
    ctx.fillStyle = 'rgba(253,245,230,.85)'; ell(hx, hy + hr * 0.32, hr * 0.36, hr * 0.22);
    ctx.fillStyle = '#d98490'; ell(hx, hy + hr * 0.2, hr * 0.12, hr * 0.08);
    if (r >= 7) {
      ctx.strokeStyle = 'rgba(60,40,30,.55)'; ctx.lineWidth = 0.8 * LW_SCALE;
      ctx.beginPath();
      for (const s of [-1, 1]) {
        ctx.moveTo(hx + s * hr * 0.32, hy + hr * 0.3); ctx.lineTo(hx + s * hr * 1.0, hy + hr * 0.2);
        ctx.moveTo(hx + s * hr * 0.32, hy + hr * 0.36); ctx.lineTo(hx + s * hr * 1.0, hy + hr * 0.46);
      }
      ctx.stroke();
    }
  }
  // 발그레한 볼
  for (const s of [-1, 1]) {
    const bx = hx + s * hr * 0.56, by = hy + hr * 0.2;
    ctx.fillStyle = `rgba(255,130,160,${opts.excited ? 0.5 : 0.35})`; ell(bx, by, hr * 0.24, hr * 0.16);
    ctx.fillStyle = 'rgba(255,95,135,.6)'; ell(bx, by, hr * 0.15, hr * 0.1);
    if (r >= 7) {
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 0.7 * LW_SCALE;
      ctx.beginPath();
      ctx.moveTo(bx - hr * 0.08, by + hr * 0.04); ctx.lineTo(bx - hr * 0.02, by - hr * 0.04);
      ctx.moveTo(bx + hr * 0.02, by + hr * 0.04); ctx.lineTo(bx + hr * 0.08, by - hr * 0.04);
      ctx.stroke();
    }
  }
  // 눈
  if (opts.sad) {
    // 시무룩: 눈물이 그렁그렁 맺힌 커다란 눈 + 축 처진 눈썹 + 살짝 내려간 입 + 또르르 눈물
    const tt2 = performance.now() / 1000 + phase;
    ctx.strokeStyle = '#2e231a'; ctx.lineWidth = Math.max(1, hr * 0.06); ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      const ex = hx + s * hr * 0.34, ey = hy - hr * 0.04;
      ctx.fillStyle = '#2e231a'; ell(ex, ey, hr * 0.17, hr * 0.2);
      ctx.fillStyle = 'rgba(160,210,240,.55)'; ell(ex, ey + hr * 0.1, hr * 0.17, hr * 0.09);   // 아래에 고인 눈물
      ctx.fillStyle = '#fffaf0';
      circle(ex - hr * 0.06, ey - hr * 0.08, hr * 0.07); circle(ex + hr * 0.06, ey + hr * 0.04, hr * 0.035);
      // 시무룩한 눈썹: 가운데(안쪽)는 올라가고 바깥쪽은 축 처진 八 모양
      ctx.beginPath(); ctx.moveTo(ex - s * hr * 0.14, ey - hr * 0.44); ctx.quadraticCurveTo(ex + s * hr * 0.04, ey - hr * 0.4, ex + s * hr * 0.2, ey - hr * 0.28); ctx.stroke();
      // 또르르 흐르는 눈물방울
      const k = (tt2 * 0.6 + (s > 0 ? 0.5 : 0)) % 1, dy = hr * (0.2 + k * 0.45);
      ctx.globalAlpha = 1 - k * 0.5;
      ctx.beginPath(); ctx.moveTo(ex + s * hr * 0.1, ey + dy - hr * 0.14);
      ctx.quadraticCurveTo(ex + s * hr * 0.21, ey + dy + hr * 0.04, ex + s * hr * 0.1, ey + dy + hr * 0.09);
      ctx.quadraticCurveTo(ex + s * hr * -0.01, ey + dy + hr * 0.04, ex + s * hr * 0.1, ey + dy - hr * 0.14);
      ctx.fillStyle = '#a9d6f2'; ctx.fill(); ctx.strokeStyle = 'rgba(96,140,170,.7)'; ctx.lineWidth = Math.max(0.6, hr * 0.03); ctx.stroke();
      ctx.globalAlpha = 1; ctx.strokeStyle = '#2e231a'; ctx.lineWidth = Math.max(1, hr * 0.06);
    }
    ctx.beginPath(); ctx.arc(hx, hy + hr * 0.62, hr * 0.13, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();   // 시무룩한 입
  } else if (opts.sleep) {
    // 쿨쿨: 감은 눈 (아래로 둥근 선)
    ctx.strokeStyle = '#2e231a'; ctx.lineWidth = Math.max(1, hr * 0.08);
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(hx + s * hr * 0.34, hy - hr * 0.1, hr * 0.13, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
  } else if (opts.excited) {
    // 초롱초롱: 크고 반짝이는 눈 + 별빛
    ctx.fillStyle = '#2e231a';
    ell(hx - hr * 0.34, hy - hr * 0.06, hr * 0.18, hr * 0.21); ell(hx + hr * 0.34, hy - hr * 0.06, hr * 0.18, hr * 0.21);
    ctx.fillStyle = '#fffaf0';
    for (const s of [-1, 1]) {
      circle(hx + s * hr * 0.34 - hr * 0.06, hy - hr * 0.14, hr * 0.075);
      circle(hx + s * hr * 0.34 + hr * 0.06, hy - hr * 0.0, hr * 0.035);
    }
    const tw = 0.6 + Math.sin(tt * 10) * 0.4;
    ctx.fillStyle = `rgba(255,214,110,${f1(tw)})`;
    star(hx + hr * 1.05, hy - hr * 0.85, hr * 0.22);
  } else {
    ctx.fillStyle = '#2e231a';
    ell(hx - hr * 0.34, hy - hr * 0.05, hr * 0.14, hr * 0.17); ell(hx + hr * 0.34, hy - hr * 0.05, hr * 0.14, hr * 0.17);
    // 초롱초롱: 큰 하얀 점 + 아래쪽에 작은 하얀 점 하나 더
    ctx.fillStyle = 'rgba(255,252,245,.95)';
    for (const s of [-1, 1]) {
      circle(hx + s * hr * 0.34 - hr * 0.045, hy - hr * 0.11, hr * 0.055);
      circle(hx + s * hr * 0.34 + hr * 0.05, hy + hr * 0.02, hr * 0.03);
    }
  }
  // 리본 (몇몇 친구만): 머리 위 오른쪽에 나비 모양
  if (opts.ribbon) {
    const rx = hx + hr * 0.42, ry = hy - hr * 0.92, k = hr * 0.32;
    ctx.fillStyle = opts.ribbon; ctx.strokeStyle = LINE; ctx.lineWidth = lw;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + s * k * 1.25, ry - k * 0.7); ctx.lineTo(rx + s * k * 1.25, ry + k * 0.7); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(rx, ry, k * 0.32, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}
// ---- 인게임 멍냥이를 미리 그린 그림(스프라이트)으로 빠르게 ----
//   소품(보따리·리본)과 표정(평소/쿨쿨/초롱초롱)별로 한 번씩만 그려 두고,
//   꼬리는 8단계 그림을 돌려 써서 지금처럼 살랑살랑 움직여요. (폰 배터리·발열이 훨씬 줄어요)
const TAIL_FRAMES = 6;   // 꼬리 흔들림 그림 수 (적을수록 새로 그릴 그림이 줄어 가벼워요)
const animalSprites = new Map();
function drawAnimalFast(x, y, r, colorIdx, kind, bob = 0, phase = 0, opts = {}) {
  const dpr = DPR;
  const speed = kind === 'cat' ? (opts.sleep ? 0.8 : 2.6) : (opts.sleep ? 2 : opts.excited ? 22 : 14);
  const cyc = ((performance.now() / 1000 + phase) * speed / (Math.PI * 2)) % 1;
  const frame = LITE ? 0 : Math.floor(cyc * TAIL_FRAMES);   // 가벼운 모드: 꼬리 흔들림 멈춤 (그림을 덜 만들어요)
  const key = `${kind}|${colorIdx}|${opts.ribbon || ''}|${opts.bag ? 1 : 0}|${opts.sleep ? 's' : opts.excited ? 'e' : 'n'}|${frame}|${r.toFixed(2)}|${dpr}`;
  let spr = animalSprites.get(key);
  if (spr) { animalSprites.delete(key); animalSprites.set(key, spr); }   // 방금 쓴 그림은 맨 뒤로 (오래 안 쓴 그림부터 정리하려고)
  else {
    // 한꺼번에 다 지우면 그 순간 수십 마리를 새로 그리느라 덜컥거려요 → 가장 오래 안 쓴 그림부터 조금씩 정리
    if (animalSprites.size > 900) {
      let n = 120;
      for (const k of animalSprites.keys()) { animalSprites.delete(k); if (--n <= 0) break; }
    }
    const ax = r * 1.95, ay = r * 2.5, w = r * 3.9, h = r * 3.4;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(w * dpr); cv.height = Math.ceil(h * dpr);
    const c = cv.getContext('2d'); c.scale(dpr, dpr);
    const saved = ctx; ctx = c;
    try { drawAnimal(ax, ay, r, colorIdx, kind, 0, 0, { ...opts, tailT: (frame / TAIL_FRAMES) * Math.PI * 2 / speed }); }
    finally { ctx = saved; }
    spr = { cv, ax, ay, w, h };
    animalSprites.set(key, spr);
  }
  ctx.drawImage(spr.cv, x - spr.ax, y - bob - spr.ay, spr.w, spr.h);
}

// 작은 반짝이 별
function star(x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, k = i % 2 ? r * 0.35 : r;
    ctx.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k);
  }
  ctx.closePath(); ctx.fill();
}

function vehiclePose(v) {
  if (v.state === 'parked' && v.move) {      // 자리 바꾸기: 살짝 떠서 새 자리로
    const m = v.move, e = easeInOut(Math.min(1, m.t)), up = 1 + Math.sin(Math.min(1, m.t) * Math.PI) * 0.15;
    return {
      x: L.bx + lerp(m.x, v.cx, e) * L.cs, y: L.by + lerp(m.y, v.cy, e) * L.cs,
      a: m.a + normAng(v.ang - m.a) * e, w: v.w * L.cs, l: v.l * L.cs, scale: up,
    };
  }
  if (v.state === 'parked' || v.state === 'exiting') {
    const a = axes(v.ang);
    const shake = v.shake > 0 ? Math.sin(v.shake * 60) * 3 : 0;
    const pop = v.pop < 1 ? 1 + Math.sin(v.pop * Math.PI) * 0.15 : 1;
    return {
      x: L.bx + (v.cx + a.ux * v.off) * L.cs + shake, y: L.by + (v.cy + a.uy * v.off) * L.cs,
      a: v.ang + (v.spin > 0 ? -Math.PI * easeInOut(v.spin) : 0),     // U턴: 반 바퀴 빙글
      w: v.w * L.cs, l: v.l * L.cs, scale: pop * (v.spin > 0 ? 1 + Math.sin(v.spin * Math.PI) * 0.1 : 1),
    };
  }
  const p = slotPos(v.slot), s = slotSize(v);
  if (v.state === 'toSlot' && !v.lifted) {
    // 찻길을 달려와서(살짝 덜컹덜컹) 칸 앞에서 위로 꺾어 들어가요
    if (v.t < 0) return { x: -999, y: -999, a: 0, w: s.w, l: s.l, alpha: 0 };
    const dir = -v.side, x0 = v.side > 0 ? L.W - 8 + s.l * 0.6 : 8 - s.l * 0.6;
    const xa = p.x - dir * s.w * 0.45, k = 0.66;
    if (v.t < k) {
      const u = easeOut(v.t / k);
      return { x: lerp(x0, xa, u), y: L.roadY + Math.sin(S.time * 38) * 0.7, a: dir * Math.PI / 2, w: s.w, l: s.l };
    }
    const u = easeInOut((v.t - k) / (1 - k));
    return { x: lerp(xa, p.x, u), y: lerp(L.roadY, p.y, u), a: dir * Math.PI / 2 * (1 - u), w: s.w, l: s.l };
  }
  if (v.state === 'toSlot') {
    const e = easeInOut(v.t), f = v.from;
    const lift = v.lifted ? 1 + Math.sin(v.t * Math.PI) * 0.3 : 1;
    return {
      x: lerp(f.x, p.x, e), y: lerp(f.y, p.y, e), a: f.a + normAng(-f.a) * e,
      w: lerp(f.w, s.w, e), l: lerp(f.l, s.l, e), scale: lift,
    };
  }
  if (v.state === 'departing') {
    if (v.t < 0.22) {   // 칸에서 아래 찻길로 빠져나오며 오른쪽으로 방향을 틀어요
      const u = easeInOut(v.t / 0.22);
      return { x: v.depX + u * s.w * 0.3, y: lerp(v.depY, L.roadY, u), a: u * Math.PI / 2, w: s.w, l: s.l };
    }
    const u = easeIn((v.t - 0.22) / 0.78);
    return { x: lerp(v.depX + s.w * 0.3, L.W + s.l, u), y: L.roadY, a: Math.PI / 2, w: s.w, l: s.l };
  }
  return { x: p.x, y: p.y, a: 0, w: s.w, l: s.l };
}

function drawQueueArea() {
  const SP = SEASONS[season];
  // 풀밭·길·꽃·화살표는 단계 중에 안 변해서 한 장의 그림으로 구워 두고 붙여요 (가볍게)
  cachedLayer('queue', `${L.W}|${L.H}|${DPR}|${season}|${S.level}|${L.laneW}`, L.qTop - 2, L.qH + 4, () => {
  // 풀밭
  // 풀밭 색도 메인 화면의 계절을 따라가요
  const g = ctx.createLinearGradient(0, L.qTop, 0, L.qTop + L.qH);
  g.addColorStop(0, SP.meadow[0]); g.addColorStop(1, SP.meadow[1]);
  ctx.fillStyle = g;
  rr(8, L.qTop, L.W - 16, L.qH, 18); ctx.fill();
  ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.stroke();
  for (const [x, y, k] of L.tufts) {
    if (k < 0.75 || !SP.flowers.length) {
      ctx.strokeStyle = SP.grass[Math.floor(k * 7) % SP.grass.length]; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(x - 3, y + 3); ctx.lineTo(x - 1, y - 3); ctx.moveTo(x, y + 3); ctx.lineTo(x + 2, y - 4); ctx.moveTo(x + 3, y + 3); ctx.lineTo(x + 5, y - 2); ctx.stroke();
    } else {
      ctx.fillStyle = SP.flowers[Math.floor(k * 13) % SP.flowers.length]; circle(x, y, 2.2);
    }
  }

  // 대기 줄 길 + 원형 길: 테두리를 먼저 둘 다 그리고 흙길을 위에 덮어서
  // 두 길이 만나는 곳에는 경계선 없이 하나로 이어져 보여요
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const waitPath = () => { ctx.beginPath(); L.wait.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); };
  const polyPath = pts => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); };
  // 하트 가운데 잔디 섬을 길보다 "먼저" 칠해요 → 하트 위쪽 움푹한 곳에서도 길 테두리가 가려지지 않아요
  polyPath(L.islandPts);
  ctx.fillStyle = SP.meadow[0]; ctx.fill();
  const ringPath = () => polyPath(L.ringPts);   // 하트 모양 길
  const exitPath = () => { ctx.beginPath(); ctx.moveTo(L.exitX, L.exitY); ctx.lineTo(L.exitX, L.qTop + L.qH); };
  const dirt = season === 'winter' ? '#eef1f4' : '#ebd8b2';
  // 길 끝(패널 경계에 닿는 곳)은 평평하게 잘라서 양쪽 테두리가 경계선까지 쭉 이어지게
  ctx.save(); rr(8, L.qTop, L.W - 16, L.qH, 18); ctx.clip();
  ctx.strokeStyle = LINE; ctx.lineWidth = L.laneW + 2;   // 길 양쪽 테두리 1px씩
  ctx.lineCap = 'butt'; waitPath(); ctx.stroke(); exitPath(); ctx.stroke(); ctx.lineCap = 'round'; ringPath(); ctx.stroke();
  ctx.strokeStyle = dirt; ctx.lineWidth = L.laneW;
  ctx.lineCap = 'butt'; waitPath(); ctx.stroke(); exitPath(); ctx.stroke(); ctx.lineCap = 'round'; ringPath(); ctx.stroke();
  ctx.restore();

  // (집은 없애고, 대기 줄 길이 풀밭 패널 위쪽 경계선까지 쭉 이어져요)

  // 하트 가운데 잔디 섬 + 큰 나무 + 꽃
  const iry = L.ry - L.laneW / 2 - 4;
  const cyI = L.rcy + L.ry * 0.05;
  for (let i = 0; i < 12 && SP.flowers.length; i++) {
    const [x, y] = L.islandPts[Math.floor(i / 12 * L.islandPts.length)];
    ctx.fillStyle = SP.flowers[i % SP.flowers.length];
    circle(L.rcx + (x - L.rcx) * 0.8, cyI + (y - cyI) * 0.8, 2.2);
  }
  // 도는 방향 화살표 (하트 길을 따라)
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  const n = L.ringPts.length;
  for (const f of [0.12, 0.38, 0.62, 0.88]) {
    const i = Math.floor(f * n), [px, py] = L.ringPts[i], [qx, qy] = L.ringPts[(i + 2) % n];
    const ang = Math.atan2(qy - py, qx - px);
    ctx.save(); ctx.translate(px, py); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-3, -3.5); ctx.lineTo(-3, 3.5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  });
  // 가운데 큰 나무 (메인 화면과 같은 계절의 잎사귀 나무) — 누르면 흔들려서 매번 그려요
  const iry = L.ry - L.laneW / 2 - 4;
  if (islandTree.complete && islandTree.naturalWidth) {
    const imgH = iry * 1.55, baseY = L.rcy + iry * 0.42;   // 하트 섬 안에 들어가는 크기
    const sh = S.treeShake > 0 ? Math.sin(S.treeShake * 40) * 0.06 * S.treeShake : 0;   // 누르면 살랑 흔들려요
    ctx.save(); ctx.translate(L.rcx, baseY); ctx.rotate(sh); ctx.translate(-L.rcx, -baseY);
    ctx.drawImage(treeBitmap(imgH), L.rcx - imgH / 2, baseY - imgH * (110 / 120), imgH, imgH);
    ctx.restore();
  }

  // 고양이 / 강아지들 (위쪽부터 그려서 아래쪽 친구가 앞에 보이도록)
  const vis = [];
  const add = (p, i, waitIdx = -1) => {
    if (!p || p.x === undefined) return;
    // 줄 뒤쪽에서 오래 기다리는 몇몇 친구: 간식 생각 중이거나, 지쳐서 쿨쿨 자는 중
    const back = waitIdx >= 8 && !p.walking;
    const sleep = back && waitIdx >= 10 && p.id % 6 === 2;
    const think = !sleep && back && p.id % 5 === 0 && (S.time + p.id * 1.7) % 9 < 4.5;
    vis.push({ x: p.x, y: p.y, c: p.color, kind: p.kind, think, sleep, ph: i * 0.73,
      opts: { bag: p.bag, ribbon: p.ribbon, sleep },
      bob: p.walking ? Math.abs(Math.sin(S.time * 14 + i)) * 2 : 0 });
  };
  S.ring.forEach((p, i) => add(p, i));
  S.waiting.forEach((p, i) => add(p, i + 100, i));
  vis.sort((a, b) => a.y - b.y);
  for (const p of vis) drawAnimalFast(p.x, p.y + L.pr * 0.3, L.pr, p.c, p.kind, p.bob, p.ph, p.opts);
  let bubbles = 0;
  for (const p of vis) {
    if (p.sleep) { drawZzz(p.x, p.y + L.pr * 0.3 - L.pr * 2.0, L.pr, p.ph); continue; }
    if (!p.think || bubbles >= 6) continue;
    bubbles++;
    drawThought(p.x, p.y + L.pr * 0.3 - L.pr * 2.05 - p.bob, L.pr, p.kind);
  }

  const hiddenN = S.waiting.length - Math.min(S.waiting.length, L.waitMax);
  if (hiddenN > 0) {
    const t = `+${hiddenN}`;
    ctx.font = '700 14px MaruBuri, serif';
    const tw = ctx.measureText(t).width + 14;
    ctx.fillStyle = 'rgba(59,50,38,.85)';
    rr(L.W - 16 - tw, L.qTop + 6, tw, 22, 11); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t, L.W - 16 - tw / 2, L.qTop + 17);
  }
}

function draw() {
  ctx.clearRect(0, 0, L.W || 0, L.H || 0);
  if (!S || !L.ring) return;

  drawQueueArea();
  // 꾹 누르는 동안: 빨리감기 표시
  if (S.holding) {
    const tx = '▶▶ 빨리감기', fs = 13;
    ctx.font = `700 ${fs}px MaruBuri, serif`;
    const tw = ctx.measureText(tx).width + 22, bx = L.W / 2 - tw / 2, by = L.qTop + 10;
    ctx.globalAlpha = 0.6 + Math.sin(S.time * 8) * 0.25;
    ctx.fillStyle = '#f6dd92'; rr(bx, by, tw, fs + 12, (fs + 12) / 2); ctx.fill();
    ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#5a4a3a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(tx, L.W / 2, by + (fs + 12) / 2 + 1);
  }

  const panelH = L.swH + L.sH + L.roadH + 8;
  // 정류장(보도·칸·찻길)도 칸 수가 바뀔 때만 다시 그려요
  cachedLayer('stop', `${L.W}|${L.H}|${DPR}|${S.slotCount}|${S.boost.slot > 0 ? 1 : 0}`, L.qTop + L.qH - 6, L.sTop + panelH - (L.qTop + L.qH) + 10, () => {
  // 정류장: 위쪽 보도 + 하얗게 칠한 주차 칸 + 아래쪽 찻길
  ctx.fillStyle = '#8f8a83';
  rr(8, L.sTop - 4, L.W - 16, panelH, 14); ctx.fill();
  ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.stroke();
  drawSpeckles(8, L.sTop - 4, L.W - 16, panelH, 50);
  // 보도 (멍냥이들이 걸어가는 길)
  ctx.fillStyle = '#e4dccb';
  rr(8.5, L.sTop - 3.5, L.W - 17, L.swH + 3.5, 13); ctx.fill();
  ctx.fillRect(8.5, L.sTop + 6, L.W - 17, L.swH - 6);
  ctx.strokeStyle = 'rgba(112,104,96,.25)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 22; x < L.W - 14; x += Math.max(8, L.swH * 1.1)) { ctx.moveTo(x, L.sTop - 2); ctx.lineTo(x, L.sTop + L.swH); }
  ctx.stroke();
  ctx.strokeStyle = LINE; ctx.beginPath(); ctx.moveTo(8, L.sTop + L.swH); ctx.lineTo(L.W - 8, L.sTop + L.swH); ctx.stroke();
  // 찻길 (다 탄 버스가 떠나는 길) + 가운데 점선
  const ry0 = L.sTop + L.swH + L.sH;
  ctx.fillStyle = '#7c7771';
  ctx.fillRect(8.5, ry0, L.W - 17, L.roadH - 8);
  rr(8.5, ry0, L.W - 17, L.roadH + 3.5, 13); ctx.fill();
  ctx.strokeStyle = 'rgba(246,232,190,.75)'; ctx.lineWidth = 1.4; ctx.setLineDash([8, 7]);
  ctx.beginPath(); ctx.moveTo(18, L.roadY); ctx.lineTo(L.W - 18, L.roadY); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(8, ry0); ctx.lineTo(L.W - 8, ry0); ctx.stroke();
  // 원에서 내려오는 길을 보도까지 이어 주기
  const bw2 = L.laneW;
  ctx.fillStyle = '#ebd8b2';
  ctx.fillRect(L.exitX - bw2 / 2, L.qTop + L.qH - 3, bw2, L.sTop - (L.qTop + L.qH) + 4);
  ctx.strokeStyle = LINE; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(L.exitX - bw2 / 2, L.qTop + L.qH); ctx.lineTo(L.exitX - bw2 / 2, L.sTop - 4);
  ctx.moveTo(L.exitX + bw2 / 2, L.qTop + L.qH); ctx.lineTo(L.exitX + bw2 / 2, L.sTop - 4);
  ctx.stroke();
  for (let i = 0; i < MAX_SLOTS; i++) {
    const p = slotPos(i), w = L.sw * 0.9, h = L.sH * 0.92;
    const x0 = p.x - w / 2, x1 = p.x + w / 2, y0 = p.y - h / 2, y1 = p.y + h / 2;
    if (i < S.slotCount) {
      ctx.strokeStyle = 'rgba(246,240,226,.85)'; ctx.lineWidth = 1.6; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x0, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.fillStyle = '#d8cfbf';
      rr(p.x - w * 0.28, y0 + h * 0.06, w * 0.56, h * 0.05, 2); ctx.fill();
      ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(246,240,226,.4)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x0, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = S.boost.slot > 0 ? '#e3efcf' : 'rgba(255,255,255,.3)';
      ctx.font = `700 ${L.sw * 0.5}px MaruBuri, serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('+', p.x, p.y + 1);
    }
  }

  });

  // 주차장(바탕 + 가만히 서 있는 버스들)은 한 장의 그림으로 만들어 두고, 바뀔 때만 다시 그려요 (발열 줄이기)
  drawBoardCached();

  if (S.rail) drawRail();

  // 버스를 타러 걸어가는 친구들 (눈이 초롱초롱, 신나서 통통 뛰며)
  const walkers = S.flying.map(f => ({ f, p: pathPoint(f.path, f.s) })).sort((a, b) => a.p.y - b.p.y);
  for (const { f, p } of walkers) {
    const bob = Math.abs(Math.sin(S.time * 16 + f.id)) * 2.5;
    drawAnimalFast(p.x, p.y + L.pr * 0.3, L.pr * 0.92, f.color, f.kind, bob, f.id * 0.7,
      { bag: f.bag, ribbon: f.ribbon, excited: true });
  }

  const order = { parked: 0, slot: 1, departing: 1, exiting: 2, toSlot: 2 };
  const list = S.vehicles.filter(v => v.state in order).sort((a, b) => order[a.state] - order[b.state]);
  for (const v of list) {
    if (v.state === 'parked' && parkedStill(v)) continue;     // 주차장 그림에 이미 있어요
    const P = vehiclePose(v);
    if (P.alpha === 0) continue;
    const inSlot = v.state === 'slot' || v.state === 'departing';
    // 빠져나가는 버스는 주차장 안에서만, 찻길 버스는 정류장 네모 안에서만 보여요 (테두리를 넘지 않게)
    const clip = v.state === 'exiting' ? (v.fromRail ? [13, L.bTop + 1, L.W - 26, L.railTop + L.railH - L.bTop - 1, 12] : [13, L.bTop + 1, L.W - 26, L.bH - 6, 12])
      : (v.state === 'departing' || (v.state === 'toSlot' && !v.lifted)) ? [8.5, L.sTop - 3.5, L.W - 17, panelH - 1, 13] : null;
    if (clip) { ctx.save(); rr(...clip); ctx.clip(); }
    drawVehicle(P.x, P.y, P.a, P.w, P.l, v.mixT > 0 ? v.mixCol : v.color, v.hidden, {
      arrow: !inSlot && v.state !== 'toSlot', turner: v.turner && v.state === 'parked' ? S.turnLeft : 0, seats: inSlot ? v.cap - v.filled : null, capLabel: v.state === 'parked' ? v.cap : null,
      alpha: P.alpha, scale: P.scale,
    });
    if (clip) ctx.restore();
  }
  // 떠나는 버스: 신나는 음표 말풍선
  for (const v of S.vehicles) {
    if (v.state !== 'departing' || v.t < 0.12) continue;
    const P = vehiclePose(v);
    drawNoteBubble(P.x, P.y - P.w * 0.55, L.pr, v.t);
  }
}

// 레일 버스 이벤트: 침목이 깔린 레일 + 노란 출구 칸 + 레일 위 버스들
function drawRail() {
  const R = S.rail, y0 = L.railTop, h = L.railH, off = R.anim * L.railW;
  // 레일 바탕(침목·칸 나눔선)은 레일이 움직이는 순간 말고는 같아서 구워 둬요
  const drawBase = () => {
  ctx.fillStyle = '#8f8a83';
  rr(8, y0, L.W - 16, h, 14); ctx.fill();
  ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.stroke();
  ctx.save();
  rr(8, y0, L.W - 16, h, 14); ctx.clip();
  // 움직이는 침목 (레일이 움직이면 같이 밀려요)
  ctx.strokeStyle = 'rgba(70,58,46,.45)'; ctx.lineWidth = 4;
  ctx.beginPath();
  for (let x = 12 - off % 14; x < L.W - 8; x += 14) { ctx.moveTo(x, y0 + h * 0.14); ctx.lineTo(x, y0 + h * 0.86); }
  ctx.stroke();
  ctx.strokeStyle = '#d3cec6'; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(8, y0 + h * 0.22); ctx.lineTo(L.W - 8, y0 + h * 0.22); ctx.moveTo(8, y0 + h * 0.78); ctx.lineTo(L.W - 8, y0 + h * 0.78); ctx.stroke();
  // 레일 칸 나눔선 (위의 주차장 세로줄과 딱 맞아요)
  ctx.strokeStyle = 'rgba(246,232,190,.35)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
  ctx.beginPath();
  for (let k = 0; k <= R.K; k++) { const x = L.rx0 + L.railW * k; ctx.moveTo(x, y0 + 4); ctx.lineTo(x, y0 + h - 4); }
  ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  };
  if (R.anim > 0) drawBase();
  else cachedLayer('rail', `${L.W}|${L.H}|${DPR}|${R.K}|${L.railW}|${L.rx0}`, y0 - 1, h + 2, drawBase);
  ctx.save();
  rr(8, y0, L.W - 16, h, 14); ctx.clip();
  // 레일 위 버스들 (위를 보고 서 있어요. 위가 비면 위로 쭉 나가요)
  ctx.beginPath(); ctx.rect(L.rx0, y0, L.railW * R.K, h); ctx.clip();
  R.items.forEach((v, i) => {
    if (!v) return;
    const c = railCenter(i), s = railSize(v);
    let x = c.x - off;
    if (x < L.rx0 - L.railW * 0.5) x += L.railW * R.K;
    const sh = v.shake > 0 ? Math.sin(v.shake * 60) * 2.5 : 0;
    drawVehicle(x + sh, c.y, 0, s.w, s.l, v.color, false, { arrow: true, capLabel: v.cap });
  });
  ctx.restore();
}

// 음표 말풍선 (♪ 신난다!)
function drawNoteBubble(x, y, r, t) {
  const bx = x + r * 0.6, by = y - r * 1.9 - Math.sin(t * 20) * 1.2;
  const w = r * 3.2, h = r * 2;
  ctx.beginPath();
  rr(bx - w / 2, by - h / 2, w, h, h * 0.45);
  ctx.moveTo(bx - r * 0.5, by + h / 2 - 0.5); ctx.lineTo(bx - r * 0.9, by + h / 2 + r * 0.7); ctx.lineTo(bx - r * 0.05, by + h / 2 - 0.5);
  ctx.fillStyle = '#fffdf8'; ctx.fill();
  ctx.strokeStyle = LINE; ctx.lineWidth = 1;
  rr(bx - w / 2, by - h / 2, w, h, h * 0.45); ctx.stroke();
  ctx.font = `700 ${r * 1.35}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#d9906a'; ctx.fillText('♪', bx - r * 0.65, by + 1 + Math.sin(t * 25) * 1.5);
  ctx.fillStyle = '#7fb4d6'; ctx.fillText('♫', bx + r * 0.65, by + 1 - Math.sin(t * 25) * 1.5);
}

// 쿨쿨 자는 친구 머리 위의 Z
// 자는 친구 위로 둥실 떠오르는 z: 'z' 글자를 한 번만 그려 두고 크기만 바꿔 붙여요 (글자를 매번 쓰면 무거워요)
let zSprite = null;
function zImage() {
  if (zSprite) return zSprite;
  const S0 = 32, cv = document.createElement('canvas');
  cv.width = cv.height = S0;
  const c = cv.getContext('2d');
  c.font = `700 ${S0 * 0.85}px MaruBuri, serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#8f9bb3'; c.fillText('z', S0 / 2, S0 / 2);
  return (zSprite = cv);
}
document.fonts && document.fonts.ready.then(() => { zSprite = null; });
function drawZzz(x, headTop, r, ph) {
  const t = (performance.now() / 1000 + ph) % 2.4 / 2.4, img = zImage();
  for (let i = 0; i < 3; i++) {
    const k = (t + i / 3) % 1, sz = r * (0.6 + k * 0.6) * 1.18;
    ctx.globalAlpha = Math.sin(k * Math.PI) * 0.9;
    ctx.drawImage(img, x + r * (0.7 + k * 0.9) - sz / 2, headTop - r * k * 1.4 - sz / 2, sz, sz);
  }
  ctx.globalAlpha = 1;
}

// ---- 주차장 그림 캐시 ----
//   주차장 바탕과 움직이지 않는 버스들을 따로 그려 두고 매 프레임엔 그 그림 한 장만 붙여요.
//   버스를 꺼내거나, 부딪히거나, U턴·자리 바꾸기 등으로 모습이 바뀌면 그때만 새로 그려요.
const parkedStill = v => !(v.bump || v.shake > 0 || v.spin > 0 || v.move || v.pop < 1 || v.off || v.mixT > 0);
let boardCache = null;
function boardCacheKey() {
  let k = `${L.W}|${L.H}|${L.cs}|${DPR}|${S.level}|${S.liftMode ? 1 : 0}|${S.turnLeft}`;
  for (const v of S.vehicles) if (v.state === 'parked' && parkedStill(v)) k += `|${v.id},${v.cx},${v.cy},${v.ang},${v.hidden ? 1 : 0},${v.color}`;
  return k;
}
function drawBoardCached() {
  if (!(L.cs > 0 && L.bH > 0 && L.W > 0)) return;           // 화면이 너무 낮으면(가로 등) 그리지 않아요
  const key = boardCacheKey();
  const y0 = Math.floor(L.bTop - 8), h = Math.ceil(L.bH + 16);
  if (!boardCache || boardCache.key !== key) {
    const cv = (boardCache && boardCache.cv) || document.createElement('canvas');
    cv.width = Math.ceil(L.W * DPR); cv.height = Math.ceil(h * DPR);
    const c = cv.getContext('2d');
    c.setTransform(DPR, 0, 0, DPR, 0, -y0 * DPR);
    c.clearRect(0, y0, L.W, h);
    const saved = ctx; ctx = c;
    try {
    // 주차장: 연석 + 따뜻한 회색 아스팔트 + 바랜 주차선 + P 표시
      //   위쪽 대기 구역·정류장과 똑같은 가로 폭으로 깔고, 버스들은 그 가운데에 놓여요
      const bx0 = 13, by0 = L.bTop - 4 + 5, bw = L.W - 26, bh = L.bH + 4 - 10;
      ctx.fillStyle = '#e2dacb';
      rr(8, L.bTop - 4, L.W - 16, L.bH + 4, 16); ctx.fill();
      ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = S.liftMode ? '#cdbb86' : '#a7a199';
      rr(bx0, by0, bw, bh, 12); ctx.fill(); ctx.stroke();
      drawSpeckles(bx0, by0, bw, bh, 160);
      ctx.strokeStyle = 'rgba(246,240,226,.32)'; ctx.lineWidth = 1.4;
      ctx.setLineDash([L.cs * 0.55, L.cs * 0.45]);
      for (let i = 1; i < S.cols; i++) {
        ctx.beginPath(); ctx.moveTo(L.bx + i * L.cs, L.by + L.cs * 0.1); ctx.lineTo(L.bx + i * L.cs, L.by + S.rows * L.cs); ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(246,240,226,.16)';
      ctx.font = `700 ${L.cs * 1.4}px MaruBuri, serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('P', L.bx + S.cols * L.cs / 2, L.by + S.rows * L.cs / 2);
      // 가만히 서 있는 버스들
      for (const v of S.vehicles) {
        if (v.state !== 'parked' || !parkedStill(v)) continue;
        const P = vehiclePose(v);
        drawVehicle(P.x, P.y, P.a, P.w, P.l, v.color, v.hidden, { arrow: true, turner: v.turner ? S.turnLeft : 0, capLabel: v.cap, scale: P.scale });
      }
    } finally { ctx = saved; }
    boardCache = { cv, key, y0, h };
  }
  ctx.drawImage(boardCache.cv, 0, boardCache.y0, L.W, boardCache.h);
}
document.fonts && document.fonts.ready.then(() => { boardCache = null; });   // 글꼴이 늦게 와도 숫자가 바른 글꼴로

// ---- 구워 두는 그림층 (안 변하는 부분을 한 장으로 만들어 두고, key 가 바뀔 때만 다시 그려요) ----
const layerCache = {};
function cachedLayer(name, key, y0, h, fn) {
  if (!(h > 0 && L.W > 0)) return;
  let c = layerCache[name];
  if (!c || c.key !== key) {
    const cv = (c && c.cv) || document.createElement('canvas');
    cv.width = Math.ceil(L.W * DPR); cv.height = Math.ceil(h * DPR);
    const g = cv.getContext('2d');
    g.setTransform(DPR, 0, 0, DPR, 0, -y0 * DPR);
    g.clearRect(0, y0, L.W, h);
    const saved = ctx; ctx = g;
    try { fn(); } finally { ctx = saved; }
    c = layerCache[name] = { cv, key, y0, h };
  }
  ctx.drawImage(c.cv, 0, c.y0, L.W, c.h);
}
document.fonts && document.fonts.ready.then(() => { for (const k in layerCache) delete layerCache[k]; });

// 가운데 큰 나무: 잎사귀 수백 개짜리 그림(SVG)을 매번 붙이면 폰이 그때마다 다시 그려서 무거워요 (가을 나무 한 번에 약 3ms).
// 처음에 한 번만 보통 그림(비트맵)으로 구워 두고 그걸 붙여요. 계절·크기가 바뀌면 다시 구워요.
let treeBmp = null;
function treeBitmap(size) {
  const px = Math.ceil(size * DPR), key = islandTree.src.length + '|' + islandTree.src.slice(-40) + '|' + px;
  if (!treeBmp || treeBmp.key !== key) {
    const cv = (treeBmp && treeBmp.cv) || document.createElement('canvas');
    cv.width = cv.height = px;
    const c = cv.getContext('2d');
    c.clearRect(0, 0, px, px);
    c.drawImage(islandTree, 0, 0, px, px);
    treeBmp = { cv, key };
  }
  return treeBmp.cv;
}
