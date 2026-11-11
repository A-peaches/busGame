// 멍냥이의 버스여행 - 소리: 피아노 합성, 효과음, 배경음악
// =====================================================================
//  소리: 피아노 음색을 브라우저에서 직접 합성합니다 (음악 파일 없음)
// =====================================================================
let AC = null, sfxBus = null, bgmBus = null;
function audio() {
  if (AC) return AC;
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
  // 잔향: 작은 나무 방에서 치는 피아노 느낌
  const len = Math.floor(AC.sampleRate * 2.4);
  const ir = AC.createBuffer(2, len, AC.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  const verb = AC.createConvolver(); verb.buffer = ir;
  const wet = AC.createGain(); wet.gain.value = 0.3;
  verb.connect(wet).connect(AC.destination);
  sfxBus = AC.createGain(); bgmBus = AC.createGain();
  sfxBus.gain.value = 0; bgmBus.gain.value = 0;
  for (const b of [sfxBus, bgmBus]) { b.connect(AC.destination); b.connect(verb); }
  applyVolumes();
  return AC;
}
function applyVolumes() {
  if (!AC) return;
  const t = AC.currentTime;
  sfxBus.gain.setTargetAtTime(settings.sfxOn ? settings.sfxVol * 0.9 : 0, t, 0.03);
  bgmBus.gain.setTargetAtTime(settings.bgmOn ? settings.bgmVol * 0.55 : 0, t, 0.15);
}
document.addEventListener('visibilitychange', () => {
  if (!AC) return;
  if (document.hidden) AC.suspend(); else AC.resume();
});

// 피아노 한 음: 배음 몇 개 + 빠른 타건 + 천천히 사라지는 울림
function piano(m, t, dur, vel, bus) {
  const f = 440 * Math.pow(2, (m - 69) / 12);
  const out = AC.createGain();
  const lp = AC.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(Math.min(9000, f * 8), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(500, f * 2.2), t + 0.9);
  out.connect(lp).connect(bus);
  const end = t + Math.max(0.45, Math.min(dur + 0.6, clamp(3.4 - (m - 48) * 0.045, 0.8, 3.6)));
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(vel, t + 0.008);
  out.gain.exponentialRampToValueAtTime(vel * 0.35, t + 0.35);
  out.gain.exponentialRampToValueAtTime(0.0001, end);
  for (const [h, amp, det] of [[1, 1, 0], [2, 0.45, 2], [3, 0.2, -3], [4, 0.08, 4]]) {
    const o = AC.createOscillator(), g = AC.createGain();
    o.frequency.value = f * h; o.detune.value = det; g.gain.value = amp;
    o.connect(g).connect(out);
    o.start(t); o.stop(end + 0.05);
  }
}

// 버튼 소리 "뿅": 날카로운 배음 없이 둥근 사인파가 살짝 올라가며 작게 사라져요
function blip(t, f0 = 520, f1v = 880, vol = 0.07, len = 0.13, cut = 2200) {
  const o = AC.createOscillator(), g = AC.createGain(), lp = AC.createBiquadFilter();
  o.type = 'sine';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1v, t + 0.07);
  lp.type = 'lowpass'; lp.frequency.value = cut;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(lp).connect(g).connect(sfxBus);
  o.start(t); o.stop(t + len + 0.02);
}

// 효과음: "뿅뿅" 느낌을 피아노로
const PENTA = [72, 74, 76, 79, 81, 84, 86, 88];   // 탈 때마다 한 음씩 올라가요
// 효과음은 버스가 다 차서 출발할 때만 (나머지는 조용히)
const SFX_ON = new Set(['depart']);
function sfx(kind, arg = 0) {
  if (!SFX_ON.has(kind) || !settings.sfxOn || !audio()) return;
  if (AC.state === 'suspended') AC.resume();
  const t = AC.currentTime + 0.01, B = sfxBus;
  switch (kind) {
    case 'click':  blip(t); break;                                                            // 뿅 (작고 동그랗게)
    case 'go':     blip(t, 440, 660, 0.05, 0.1, 1300); blip(t + 0.085, 600, 520, 0.045, 0.2, 1100); break;   // 뾰롱 (낮고 부드럽게)
    case 'vroom':  blip(t, 130, 175, 0.045, 0.14, 650); blip(t + 0.16, 140, 200, 0.04, 0.2, 650); break;   // 부릉부릉 (낮고 작게)
    case 'block':  piano(50, t, 0.2, 0.17, B); piano(49, t + 0.06, 0.25, 0.1, B); break;     // 쿵
    case 'board':  piano(PENTA[arg % PENTA.length], t, 0.12, 0.07, B); break;                 // 폴짝
    case 'depart': [72, 76, 79, 84].forEach((m, i) => piano(m, t + i * 0.07, 0.35, 0.1, B)); break;
    case 'win':    [65, 69, 72, 77, 81, 84].forEach((m, i) => piano(m, t + i * 0.11, 0.9, 0.11, B)); break;
    case 'lose':   [69, 65, 62, 57].forEach((m, i) => piano(m, t + i * 0.18, 0.9, 0.09, B)); break;
  }
}

// 배경음악: 시골의 푸근한 오후 같은 잔잔한 피아노 (F장조, 16마디 반복)
//   마디마다 [왼손 아르페지오 음 5개(낮은→높은), 오른손 멜로디 [시작 박, 길이(박), 음]]
const BPM = 66, BEAT = 60 / BPM;
const SONG = [
  [[41, 48, 53, 57, 60], [[0, 1.5, 69], [1.5, 0.5, 72], [2, 2, 77]]],              // F
  [[40, 48, 52, 55, 60], [[0, 1.5, 76], [1.5, 0.5, 74], [2, 2, 72]]],              // C/E
  [[38, 45, 50, 53, 57], [[0, 1, 74], [1, 1, 77], [2, 1.5, 81], [3.5, 0.5, 79]]],  // Dm
  [[45, 52, 57, 60, 64], [[0, 3, 76]]],                                            // Am
  [[46, 53, 58, 62, 65], [[0, 1.5, 74], [1.5, 0.5, 72], [2, 1, 70], [3, 1, 74]]],  // Bb
  [[45, 48, 53, 57, 60], [[0, 1.5, 72], [1.5, 0.5, 69], [2, 2, 65]]],              // F/A
  [[43, 50, 53, 58, 62], [[0, 1, 67], [1, 1, 70], [2, 1, 74], [3, 1, 77]]],        // Gm7
  [[36, 43, 48, 52, 55], [[0, 2, 76], [2, 2, 72]]],                                // C
  [[41, 48, 53, 57, 60], [[0, 1.5, 77], [1.5, 0.5, 76], [2, 1, 72], [3, 1, 69]]],  // F
  [[45, 52, 57, 60, 64], [[0, 1.5, 72], [1.5, 0.5, 76], [2, 2, 81]]],              // Am
  [[46, 53, 58, 62, 65], [[0, 1, 79], [1, 1, 77], [2, 2, 74]]],                    // Bb
  [[41, 48, 53, 57, 60], [[0, 1, 72], [1, 1, 69], [2, 2, 72]]],                    // F
  [[43, 50, 55, 58, 62], [[0, 1, 70], [1, 1, 74], [2, 1.5, 79], [3.5, 0.5, 77]]],  // Gm
  [[45, 52, 57, 60, 64], [[0, 1.5, 76], [1.5, 0.5, 72], [2, 2, 69]]],              // Am
  [[46, 53, 58, 62, 65], [[0, 1, 74], [1, 1, 72], [2, 1, 70], [3, 1, 67]]],        // Bb
  [[36, 43, 48, 53, 55], [[0, 2, 72], [2, 2, 67]]],                                // Csus4
];
let bgmTimer = null, bgmNext = 0, bgmBar = 0;
const hum = () => (Math.random() - 0.5) * 0.014;     // 사람이 치는 듯한 미세한 흔들림
const vary = () => 0.85 + Math.random() * 0.3;
function scheduleBgm() {
  if (bgmNext < AC.currentTime) bgmNext = AC.currentTime + 0.1;
  while (bgmNext < AC.currentTime + 1.2) {
    const [arp, mel] = SONG[bgmBar % SONG.length], t0 = bgmNext;
    const high = Math.floor(bgmBar / SONG.length) % 2 === 1;   // 두 번째 반복은 한 옥타브 위 오르골 느낌
    [0, 1, 2, 3, 4, 3, 2, 1].forEach((k, i) =>
      piano(arp[k], t0 + i * BEAT / 2 + hum(), BEAT * 0.9, (i === 0 ? 0.06 : 0.032) * vary(), bgmBus));
    mel.forEach(([s, d, m]) =>
      piano(m + (high ? 12 : 0), t0 + s * BEAT + hum(), d * BEAT, (high ? 0.05 : 0.075) * vary(), bgmBus));
    bgmNext += 4 * BEAT;
    bgmBar++;
  }
}
function startBgm() {
  if (!settings.bgmOn || bgmTimer || !audio()) return;
  if (AC.state === 'suspended') AC.resume();
  bgmNext = AC.currentTime + 0.3;
  applyVolumes();
  scheduleBgm();
  bgmTimer = setInterval(scheduleBgm, 300);
}
// 브라우저는 사람이 화면을 한 번 만져야 소리를 허락해요.
// 아이폰 사파리는 "손가락을 뗄 때(touchend/click)"만 인정해서, 여러 신호에 계속 걸어 두고 소리가 켜질 때까지 다시 시도해요.
function unlockAudio() {
  if (!audio()) return;
  if (AC.state !== 'running') {
    AC.resume();
    // 아이폰: 사용자 동작 안에서 아주 짧은 무음을 한 번 재생해야 소리 길이 열려요
    const s = AC.createBufferSource();
    s.buffer = AC.createBuffer(1, 1, 22050);
    s.connect(AC.destination); s.start(0);
  }
  startBgm();
}
['pointerdown', 'touchend', 'click', 'keydown'].forEach(ev => document.addEventListener(ev, unlockAudio, true));

function stopBgm() {
  clearInterval(bgmTimer);
  bgmTimer = null;
  applyVolumes();
}

