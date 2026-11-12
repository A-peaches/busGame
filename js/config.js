// 멍냥이의 버스여행 - 기본 설정: 색, 상수, 저장소, 아이콘, 공용 도구
// =====================================================================
//  기본 설정
// =====================================================================
// 따뜻한 파스텔 팔레트 (c = 밝은 색, d = 그림자 색)
const COLORS = [
  { c: '#ec8c7e', d: '#c2675b' }, // 토마토 (빨강)
  { c: '#8dbbe0', d: '#6290b8' }, // 여름 하늘 (파랑)
  { c: '#a3cf8c', d: '#73a25f' }, // 새싹 (초록)
  { c: '#f4d27c', d: '#cba54e' }, // 버터 (노랑)
  { c: '#bda6dc', d: '#8f78b2' }, // 라벤더 (보라)
  { c: '#f5ae74', d: '#cc844c' }, // 살구 (주황)
  { c: '#f3a9c1', d: '#c97e98' }, // 복숭아 (분홍)
  { c: '#92d3c6', d: '#5fa699' }, // 박하 (민트)
  { c: '#c19674', d: '#8f6a4d' }, // 코코아 (갈색)
];
const HIDDEN_COLOR = { c: '#776b7d', d: '#524857' };
const LINE = 'rgba(96,90,84,.85)';     // 인게임 그림 테두리: 1px, 조금 진한 회색
const MAX_SLOTS = 7;    // 대기 칸 최대
const BASE_SLOTS = 4;   // 처음 열린 대기 칸
const BODY_W = 0.74;    // 버스 폭 (칸 단위)
const GAP = 0.03;       // 버스 사이 최소 간격의 절반

const canvas = document.getElementById('cv');
let ctx = canvas.getContext('2d');      // (작은 그림 이미지를 만들 때 잠깐 다른 그림판으로 바꿔 써요)
let LW_SCALE = 1;                         // 테두리 굵기 배율 (크게 그린 뒤 줄여 쓸 때 보정)
const stage = document.getElementById('stage');
const $ = id => document.getElementById(id);

// 얇은 갈색 선으로 그린 아이콘들
const GEAR_SVG = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><g fill="none" stroke="#4a3b2c" stroke-width="1.6" stroke-linecap="round">
  <circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="6.8"/>
  <path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.4 5.4l1.8 1.8M16.8 16.8l1.8 1.8M5.4 18.6l1.8-1.8M16.8 7.2l1.8-1.8"/></g></svg>`;
const LOCK_SVG = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><g stroke="#4a3b2c" stroke-width="1.5" stroke-linejoin="round">
  <path d="M8 11V8.2a4 4 0 0 1 8 0V11" fill="none"/><rect x="5.5" y="11" width="13" height="9" rx="2" fill="#f1e5cf"/>
  <circle cx="12" cy="15.3" r="1.2" fill="#4a3b2c" stroke="none"/></g></svg>`;
// 현재 단계 위에 떠 있는 버스: 메인 화면 길가의 시내버스와 같은 그림체 (회색 1px 선)
const BUS_SVG = `<svg class="busIcon" viewBox="0 0 42 28" aria-hidden="true"><g stroke="#a8a097" stroke-width="1" stroke-linejoin="round">
  <path d="M3 8 Q3 3 9 3 H34 Q39 3 39 8 V21 H3 Z" fill="#f6f5f1"/>
  <path d="M3.5 7 Q4 3.5 9 3.5 H22 L17 8 H3.5Z" fill="#8cbfdd" stroke="none" opacity=".85"/>
  <path d="M12 18 L39 16.5 L39 19 L11 20Z" fill="#8cbfdd" stroke="none" opacity=".7"/>
  <path d="M3.5 9 H8 V17 L3.5 17.5Z" fill="#6f7c86"/>
  <rect x="11" y="8.5" width="6" height="6" rx=".8" fill="#5f6b74"/><rect x="18.5" y="8.5" width="6" height="6" rx=".8" fill="#5f6b74"/>
  <rect x="26" y="8.5" width="6" height="6" rx=".8" fill="#5f6b74"/><rect x="33.5" y="8.5" width="4.5" height="6" rx=".8" fill="#5f6b74"/>
  <circle cx="11" cy="22" r="3.4" fill="#4b4642"/><circle cx="32" cy="22" r="3.4" fill="#4b4642"/>
  <circle cx="11" cy="22" r="1.4" fill="#cfcbc4" stroke="none"/><circle cx="32" cy="22" r="1.4" fill="#cfcbc4" stroke="none"/></g></svg>`;

// 저장 (브라우저에 진행 상황 기억)
// 지금 쓰는 파일 버전 (index.html 의 ?v= 와 같게). 설정 창 맨 아래에 보여서 폰이 새 파일을 받았는지 알 수 있어요
const APP_VER = 42;
// 화면 해상도 상한: 폰 화면이 아주 촘촘해도(3배) 2배까지만 그려요 → 그릴 점이 절반 이하, 발열·배터리 절약
// 가벼운 모드: 오래된 폰에서 버벅이지 않게 그림을 조금 단순하게 해요.
//   설정값 'auto'(느리면 자동으로 켜짐) / 'on' / 'off'. 자동으로 켜진 적이 있으면 기억해 둬요.
let litePref = store_get('busGame.lite', 'auto');
let LITE = litePref === 'on' || (litePref === 'auto' && store_get('busGame.liteAuto', false));
function store_get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
let DPR = LITE ? 1 : Math.min(2, window.devicePixelRatio || 1);
function setLite(on) {
  if (LITE === on) return;
  LITE = on;
  DPR = on ? 1 : Math.min(2, window.devicePixelRatio || 1);
  if (typeof animalSprites !== 'undefined') animalSprites.clear();
  if (typeof boardCache !== 'undefined') boardCache = null;
  if (typeof S !== 'undefined' && S && typeof layout === 'function') layout();
  if (typeof makeParticles === 'function') makeParticles();
}
// 게임 오류를 서버에 남겨요 (멈춤 원인 찾기용). 닉네임·계정 같은 개인정보는 보내지 않고, 같은 오류는 한 번만.
const reportedErrors = new Set();
function reportError(e) {
  try {
    const msg = String((e && e.message) || e).slice(0, 300);
    if (/Failed to fetch|NetworkError|Load failed|network|aborted/i.test(msg)) return;   // 인터넷 끊김은 오류가 아니에요
    if (reportedErrors.has(msg) || reportedErrors.size > 5) return;
    reportedErrors.add(msg);
    console.error(e);
    fetch('https://meow-bus-api.bbhtodo.workers.dev/log', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ver: APP_VER, level: (typeof S !== 'undefined' && S && S.level) || 0, msg, stack: String((e && e.stack) || '').slice(0, 1200), ua: navigator.userAgent.slice(0, 160) }),
    }).catch(() => {});
  } catch (x) { /* 보고가 실패해도 게임은 계속 */ }
}
window.addEventListener('error', ev => reportError(ev.error || ev.message));
window.addEventListener('unhandledrejection', ev => reportError(ev.reason));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};
let unlocked = Math.max(store.get('busGame.unlocked', 1), store.get('busGameLevel', 1));
// 소리 설정 (설정 창에서 바꿈)
const settings = Object.assign({ bgmOn: true, bgmVol: 0.6, sfxOn: true, sfxVol: 0.8 }, store.get('busGame.settings', {}));
const saveSettings = () => store.set('busGame.settings', settings);

let S = null;  // 게임 상태 (메인 화면에서는 null)
const L = {};  // 게임 화면 배치 정보

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOut = t => 1 - (1 - t) * (1 - t);
const easeIn = t => t * t;
const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const normAng = a => { while (a > Math.PI) a -= Math.PI * 2; while (a <= -Math.PI) a += Math.PI * 2; return a; };

