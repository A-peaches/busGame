// 멍냥이의 버스여행 - 실시간 하늘, 날씨, 하트, 닉네임, 설정 창
// =====================================================================
//  실시간 하늘: 일출 / 낮 / 일몰 / 밤 (해와 달이 실제 시각에 맞춰 움직여요)
// =====================================================================
const hhmm = d => d.getHours() + d.getMinutes() / 60;
function nowHours() {
  const h = parseFloat(params.get('hour'));       // 테스트용: ?hour=19.5
  return isNaN(h) ? hhmm(new Date()) : h;
}
// 날씨 API에서 일출/일몰 시각을 못 받았을 때 쓰는 서울 기준 근사값
function fallbackSun() {
  const d = new Date(), doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
  const c = Math.cos(2 * Math.PI * (doy + 10) / 365);
  return { rise: 6.45 + 1.27 * c, set: 18.62 - 1.33 * c };
}
// 달의 위상 (0 = 그믐/삭, 0.5 = 보름)
function moonPhase() {
  const days = (Date.now() - Date.UTC(2000, 0, 6, 18, 14)) / 864e5;
  return ((days % 29.530588) + 29.530588) % 29.530588 / 29.530588;
}
function updateSky() {
  const sun = weather.sun || fallbackSun();
  const t = nowHours(), P = SEASONS[season];
  const dawn = Math.abs(t - sun.rise) < 0.6, dusk = Math.abs(t - sun.set) < 0.6;
  const day = t > sun.rise && t < sun.set;
  let skyCols, tint = 'transparent', cel = '';
  // 해/달이 지나가는 큰 호: 왼쪽 지평선에서 떠서 오른쪽 지평선으로 져요
  const arc = f => ({ x: 30 + f * 340, y: 192 - Math.sin(Math.PI * f) * 160 });
  if (day || dawn || dusk) {
    const f = clamp((t - sun.rise) / (sun.set - sun.rise), -0.03, 1.03), p = arc(f);
    skyCols = dawn ? ['#8a97bf', '#f0b9a0', '#fbe2c2'] : dusk ? ['#7684b2', '#ee9f86', '#f8cfa2'] : P.sky;
    if (dawn || dusk) tint = 'rgba(240,140,90,.13)';
    const sc = dawn || dusk ? '#ffcf9a' : '#fff4d6';
    cel = `<circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="70" fill="url(#glowG)"/>
      <circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="15" fill="${sc}" stroke="rgba(112,104,96,.35)" stroke-width="1"/>`;
  } else {
    // 밤: 별 + 위상에 맞는 달
    const nightLen = 24 - (sun.set - sun.rise);
    const f = ((t - sun.set + 24) % 24) / nightLen, p = arc(clamp(f, 0, 1));
    skyCols = ['#1f2b4a', '#36446d', '#58648e'];
    tint = 'rgba(25,35,80,.42)';
    const R = mulberry32(99);
    for (let i = 0; i < 70; i++) cel += `<circle cx="${f1(R() * 400)}" cy="${f1(R() * 185)}" r="${f1(0.4 + R() * 1.1)}" fill="#fffbe8" opacity="${f1(0.4 + R() * 0.6)}"/>`;
    const ph = moonPhase(), r = 13;
    const dx = ph <= 0.5 ? 4 * r * ph : -4 * r * (1 - ph);
    cel += `<circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="50" fill="url(#glowG)" opacity=".5"/>
      <circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="${r}" fill="#f6f1dc"/>
      <circle cx="${f1(p.x + dx)}" cy="${f1(p.y)}" r="${r + 0.5}" fill="#2a3758" opacity=".92"/>`;
  }
  ['sk0', 'sk1', 'sk2'].forEach((id, i) => { const el = document.getElementById(id); if (el) el.setAttribute('stop-color', skyCols[i]); });
  const ce = document.getElementById('celestial'); if (ce) ce.innerHTML = cel;
  if (weather.kind === 'rain' || weather.kind === 'cloudy') tint = tint === 'transparent' ? 'rgba(90,100,115,.16)' : tint;
  $('tint').style.background = tint;
}
setInterval(() => { if (!S) updateSky(); }, 60000);

// =====================================================================
//  실제 날씨 (Open-Meteo, API 키 없음). 위치 동의를 안 하면 서울 기준.
// =====================================================================
const SEOUL = { lat: 37.57, lon: 126.98, name: '서울' };
const weather = { kind: 'clear', label: '', temp: null, sun: null, place: '서울' };
const WMO = c => c >= 71 && c <= 77 || c === 85 || c === 86 ? ['snow', '눈']
  : c >= 51 && c <= 67 || c >= 80 && c <= 82 || c >= 95 ? ['rain', '비']
  : c === 45 || c === 48 ? ['cloudy', '안개'] : c === 3 ? ['cloudy', '흐림'] : c === 2 ? ['clear', '구름 조금'] : ['clear', '맑음'];
// ---- 날씨 줄의 작은 그림들 (얇은 갈색 선, 파스텔) ----
const PIN_SVG = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><g fill="none" stroke="#6b5a48" stroke-width="1.3" stroke-linecap="round">
  <circle cx="8" cy="8" r="4.6"/><circle cx="8" cy="8" r="1.4" fill="#e8768e" stroke="none"/>
  <path d="M8 1 V3.2 M8 12.8 V15 M1 8 H3.2 M12.8 8 H15"/></g></svg>`;
const W_SUN = '<circle cx="8" cy="8" r="3.2" fill="#f6c95a"/><path d="M8 1.6 V3 M8 13 V14.4 M1.6 8 H3 M13 8 H14.4 M3.5 3.5 L4.4 4.4 M11.6 11.6 L12.5 12.5 M3.5 12.5 L4.4 11.6 M11.6 4.4 L12.5 3.5" fill="none"/>';
const W_MOON = '<path d="M10.8 2.6 A5.6 5.6 0 1 0 13.4 10.6 A4.4 4.4 0 0 1 10.8 2.6Z" fill="#f3e3a8"/>';
const W_CLOUD = (y = 0, c = '#f4f1ec') => `<path d="M4.4 ${12.6 + y} H12 A2.6 2.6 0 0 0 12.2 ${7.4 + y} A3.4 3.4 0 0 0 5.6 ${7.2 + y} A2.7 2.7 0 0 0 4.4 ${12.6 + y}Z" fill="${c}"/>`;
function weatherIcon(label) {
  let night = false;
  if (weather.sun) { const n = hhmm(new Date()); night = n < weather.sun.rise || n >= weather.sun.set; }
  const body = {
    '맑음': night ? W_MOON : W_SUN,
    '구름 조금': `<g transform="translate(-1.2 -1) scale(.8)">${night ? W_MOON : W_SUN}</g>` + W_CLOUD(1.4),
    '흐림': W_CLOUD(0, '#e6e2dc'),
    '안개': W_CLOUD(-2.4, '#ece8e2') + '<path d="M3 13 H13 M4.5 15 H11.5" fill="none"/>',
    '비': W_CLOUD(-2.2, '#e6e2dc') + '<path d="M5.6 12.6 L4.8 14.8 M8.6 12.6 L7.8 14.8 M11.4 12.6 L10.6 14.8" fill="none" stroke="#7fb4d6"/>',
    '눈': W_CLOUD(-2.2, '#eef1f4') + '<g fill="#a9c6dc" stroke="none"><circle cx="5.2" cy="13.8" r="1"/><circle cx="8.2" cy="14.6" r="1"/><circle cx="11.2" cy="13.8" r="1"/></g>',
  }[label] || W_SUN;
  return `<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><g stroke="#6b5a48" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
}
async function loadWeather(loc) {
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat.toFixed(2)}&longitude=${loc.lon.toFixed(2)}` +
      `&current=temperature_2m,weather_code&daily=sunrise,sunset&timezone=auto&forecast_days=1`;
    const j = await (await fetch(u)).json();
    const [kind, label] = WMO(j.current.weather_code);
    Object.assign(weather, { kind, label, temp: Math.round(j.current.temperature_2m), place: loc.name });
    const sr = new Date(j.daily.sunrise[0]), ss = new Date(j.daily.sunset[0]);
    if (!isNaN(sr) && !isNaN(ss)) weather.sun = { rise: hhmm(sr), set: hhmm(ss) };
  } catch (e) { /* 인터넷이 안 되면 맑은 날 + 서울 근사 일출·일몰로 */ }
  const forced = params.get('weather');            // 테스트용: ?weather=snow / rain / cloudy / clear
  if (['snow', 'rain', 'cloudy', 'clear'].includes(forced)) Object.assign(weather, { kind: forced, label: { snow: '눈', rain: '비', cloudy: '흐림', clear: '맑음' }[forced] });
  renderWeatherLabel();
  renderScene();
}
// 내 위치는 글자 대신 위치 아이콘(동그라미+십자), 날씨는 그림 + 글자 + 기온
function renderWeatherLabel() {
  $('weather').innerHTML = weather.label
    ? `${weather.place === '내 위치' ? `<span class="wIc" title="내 위치">${PIN_SVG}</span>` : `<span>${weather.place}</span>`}<span class="wDot">·</span>`
      + `<span class="wIc">${weatherIcon(weather.label)}</span><span>${weather.label}${weather.temp !== null ? ' ' + weather.temp + '°' : ''}</span>`
    : '';
}
function startWeather() {
  const consent = store.get('busGame.geo', null);
  if (consent === 'yes' && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      p => loadWeather({ lat: p.coords.latitude, lon: p.coords.longitude, name: '내 위치' }),
      () => loadWeather(SEOUL), { timeout: 8000, maximumAge: 30 * 60000 });
  } else loadWeather(SEOUL);
}
function askLocation() {
  const card = $('card');
  card.innerHTML = `<h2>날씨를 함께 볼까요?</h2>
    <p>지금 계신 곳의 실제 날씨와 해·달을 메인 화면에 보여 드려요.<br>위치는 날씨를 불러올 때만 쓰고 저장하지 않아요.</p>
    <button class="btn" id="geoYes">위치 사용하기</button>
    <button class="btn alt" id="geoNo">서울 날씨로 볼게요</button>`;
  card.querySelector('#geoYes').onclick = () => { store.set('busGame.geo', 'yes'); hideOverlay(); startWeather(); askPushIfNeeded(); };
  card.querySelector('#geoNo').onclick = () => { store.set('busGame.geo', 'no'); hideOverlay(); startWeather(); askPushIfNeeded(); };
  $('overlay').classList.add('show');
}

// =====================================================================
//  하트: 최대 5개, 10분마다 1개씩 충전. 실패한 단계를 다시 하거나 그만둘 때 1개 사용.
// =====================================================================
const HEART_MAX = 5, HEART_MS = 10 * 60 * 1000;
const hearts = Object.assign({ n: HEART_MAX, t: Date.now() }, store.get('busGame.hearts', {}));
function refreshHearts() {
  if (hearts.n >= HEART_MAX) { hearts.t = Date.now(); return; }
  const k = Math.floor((Date.now() - hearts.t) / HEART_MS);
  if (k > 0) {
    hearts.n = Math.min(HEART_MAX, hearts.n + k);
    hearts.t = hearts.n >= HEART_MAX ? Date.now() : hearts.t + k * HEART_MS;
    store.set('busGame.hearts', hearts);
  }
}
const heartLeft = () => {
  const ms = Math.max(0, HEART_MS - (Date.now() - hearts.t));
  return `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
};
function useHeart() {
  refreshHearts();
  if (hearts.n <= 0) return false;
  if (hearts.n >= HEART_MAX) hearts.t = Date.now();
  hearts.n--;
  store.set('busGame.hearts', hearts);
  renderHearts();
  if (typeof syncSoon === 'function') syncSoon();   // 하트가 가득 차는 시각을 서버에 알려 둬요 (가득 차면 폰 알림)
  return true;
}
const HEART_SVG = `<svg width="18" height="16" viewBox="0 0 20 18" aria-hidden="true"><path d="M10 17 C4 12.5 1 9.5 1 5.8 C1 3 3.2 1 5.7 1 C7.5 1 9 2 10 3.6 C11 2 12.5 1 14.3 1 C16.8 1 19 3 19 5.8 C19 9.5 16 12.5 10 17Z" fill="#e9899b" stroke="#a8a097" stroke-width="1"/></svg>`;
function renderHearts() {
  refreshHearts();
  $('hearts').innerHTML = `${HEART_SVG}${hearts.n}/${HEART_MAX}<small>${hearts.n < HEART_MAX ? heartLeft() : '가득'}</small>`;
}
setInterval(renderHearts, 1000);
// 하트가 있어야 단계를 시작할 수 있어요
// 단계를 시작할 때 하트 1개를 내요. 깨면 돌려받아요. (중간에 앱을 꺼도 이미 낸 하트라 편법이 안 돼요)
function tryStart(n) {
  if (n > MAX_LEVEL) return;
  if (!useHeart()) { toast(`하트가 없어요 · ${heartLeft()} 뒤에 1개 충전`, 2200); return; }
  startLevel(n);
}
// 깨면 시작할 때 낸 하트를 돌려줘요
function refundHeart() {
  refreshHearts();
  if (hearts.n >= HEART_MAX) hearts.t = Date.now();
  hearts.n += 1;
  store.set('busGame.hearts', hearts);
  renderHearts();
  if (typeof syncSoon === 'function') syncSoon();
}

// 날리는 것: 비 오는 날엔 비, 겨울이거나 실제로 눈 오는 날엔 눈, 그 밖엔 계절 (벚꽃잎·나뭇잎·단풍).
function makeParticles() {
  const fx = $('fx');
  fx.innerHTML = '';
  const R = Math.random;
  // 겨울엔 항상 눈이 내리고, 실제로 눈이 오는 날엔 더 펑펑 내려요. 비 오는 날엔 비.
  const realSnow = weather.kind === 'snow';
  const kind = weather.kind === 'rain' ? 'rain' : (realSnow || season === 'winter') ? 'snow' : season;
  let n = kind === 'snow' ? (realSnow ? 70 : 40) : kind === 'rain' ? 70 : 20;
  if (LITE) n = Math.ceil(n / 3);                    // 가벼운 모드: 입자 1/3
  for (let i = 0; i < n; i++) {
    const p = document.createElement('div');
    p.className = 'particle' + (kind === 'rain' ? ' rainy' : '');
    p.style.left = (R() * 104 - 2) + '%';
    p.style.animationDuration = (kind === 'rain' ? 0.7 + R() * 0.5 : kind === 'snow' ? 9 + R() * 8 : 11 + R() * 9) + 's';
    p.style.animationDelay = (-R() * 20) + 's';
    let inner;
    if (kind === 'snow') {
      const sz = 2 + R() * 4;
      inner = `<span class="snow" style="width:${sz}px;height:${sz}px"></span>`;
    } else if (kind === 'rain') {
      inner = `<span class="rain"></span>`;
    } else if (kind === 'spring') {
      inner = `<svg width="11" height="10" viewBox="0 0 10 9"><path d="M5 9 C1 6 0 2 3 .5 C4 0 4.6 .8 5 1.6 C5.4 .8 6 0 7 .5 C10 2 9 6 5 9Z" fill="${pick(R, ['#f6c4d2', '#f9d6e0', '#f2b6c7'])}" stroke="#dba2b2" stroke-width=".4"/></svg>`;
    } else if (kind === 'summer') {
      inner = `<svg width="14" height="8" viewBox="0 0 12 7"><path d="M0 3.5 Q6 -2 12 3.5 Q6 9 0 3.5Z" fill="${pick(R, ['#8cc463', '#a6d17a', '#72ab50'])}"/><path d="M.5 3.5 L11 3.5" stroke="#4f7f3a" stroke-width=".5"/></svg>`;
    } else {
      inner = R() < 0.5
        ? `<svg width="16" height="16" viewBox="0 0 20 20"><path d="M10 1 L12 6 L17 4 L15 9 L19 11 L14 12 L15 17 L10 14 L5 17 L6 12 L1 11 L5 9 L3 4 L8 6Z" fill="${pick(R, ['#d9653f', '#e8913f', '#c9472f'])}" stroke="rgba(112,80,60,.5)" stroke-width=".5"/><path d="M10 14 L10 19" stroke="#8a5a3a" stroke-width=".8"/></svg>`
        : `<svg width="14" height="14" viewBox="0 0 20 20"><path d="M10 18 L3 6 Q10 0 17 6Z" fill="${pick(R, GINKGO)}" stroke="rgba(150,110,40,.5)" stroke-width=".5"/><path d="M10 18 L10 20" stroke="#8a6a3a"/></svg>`;
    }
    if (kind === 'rain') p.innerHTML = inner;
    else {
      // 떨어지면서 흔들리기를 움직임 하나로 합치고, 잎 모양은 한 번 구운 그림으로 → 움직이는 층이 절반, 다시 칠하기 없음
      p.classList.add('sway');
      if (inner.startsWith('<svg')) {
        const img = document.createElement('img');
        img.alt = ''; img.draggable = false;
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(inner.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
        p.appendChild(img);
      } else p.innerHTML = inner;
    }
    fx.appendChild(p);
  }
}

function setSeason(pref) {
  seasonPref = pref;
  store.set('busGame.seasonPref', pref);
  season = SEASONS[pref] ? pref : seasonByDate();
  renderScene();
  renderMap();
}

// =====================================================================
//  닉네임 (같은 기기에서 이어하기)
// =====================================================================
let nickname = store.get('busGame.nickname', '');
// 오른쪽 아래 버튼 묶음 접기·펴기 (상태는 기억해요). 접혀 있을 때 새 소식이 있으면 접기 버튼에 빨간 점
const SIDE_SVG = open => `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="${open ? 'M7 9.5 L12 14.5 L17 9.5' : 'M7 14.5 L12 9.5 L17 14.5'}" fill="none" stroke="#4a3b2c" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
function setSideFolded(f) {
  $('sideCol').classList.toggle('folded', f);
  store.set('busGame.sideFolded', f);
  $('sideToggle').innerHTML = SIDE_SVG(!f) + '<span class="dot"></span>';
  syncSideDot();
}
function syncSideDot() {
  const any = [...document.querySelectorAll('#sideCol .sideBtns .round')].some(b => b.classList.contains('hasDot'));
  $('sideToggle').classList.toggle('hasDot', any && $('sideCol').classList.contains('folded'));
}
$('sideToggle').onclick = () => setSideFolded(!$('sideCol').classList.contains('folded'));
setSideFolded(store.get('busGame.sideFolded', false));
new MutationObserver(syncSideDot).observe($('sideCol'), { subtree: true, attributes: true, attributeFilter: ['class'] });
function updateHello() {
  // 닉네임이 길면 닉네임만 …으로 줄이고 단계는 늘 보여요
  const nm = String(nickname || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  $('hello').innerHTML = nickname ? `<span class="nm">${nm}</span>님 · ${unlocked}단계 여행 중${myScore() ? ` · ${myScore().toLocaleString()}점` : ''}` : '';
}
// ---- 출석 선물: 하루에 처음 들어오면 하트 +1 (5개를 넘어도 받아요) ----
function checkDaily() {
  if (!nickname) return;
  const d = new Date(), today = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  if (store.get('busGame.daily', '') === today) return;
  const first = store.get('busGame.daily', '') === '' && unlocked <= 1;   // 막 시작한 사람만 (원래 하던 사람은 오늘부터 받아요)
  store.set('busGame.daily', today);
  if (first) return;                         // 처음 시작한 날은 하트가 가득이라 다음 날부터
  refreshHearts();
  if (hearts.n >= HEART_MAX) hearts.t = Date.now();
  hearts.n += 1;
  store.set('busGame.hearts', hearts);
  renderHearts();
  setTimeout(() => toast('🐾 오늘의 출석 선물: 하트 +1', 2600), 900);
  if (typeof syncSoon === 'function') syncSoon();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && !S) checkDaily(); });

function showNickname(first) {
  const card = $('card');
  card.innerHTML = `<h2>${first ? '반가워요!' : '닉네임 바꾸기'}</h2>
    <p>${first ? '멍냥이들과 여행할 이름을 알려 주세요.<br>이 기기에 저장되어 다음에 이어서 할 수 있어요.' : '새 닉네임을 적어 주세요.'}</p>
    <input class="nickInput" id="nickInput" maxlength="10" placeholder="닉네임 (최대 10자)" value="${first ? '' : nickname.replace(/"/g, '&quot;')}">
    ${first ? `<div class="consent">
      <div class="setRow"><span>📍 내 위치 날씨 보기<br><small>날씨를 불러올 때만 쓰고 저장하지 않아요</small></span><label class="switch"><input type="checkbox" id="geoOk" checked><span></span></label></div>
      ${typeof pushSupported === 'function' && pushSupported() ? `<p class="pushNote"><small>🔔 하트 도착·하트 가득·쪽지 알림을 받으려면<br>다음 화면에서 <b>알림 허용</b>을 눌러 주세요</small></p>` : ''}
    </div>` : ''}
    <button class="btn" id="nickOk">${first ? '여행 시작' : '저장'}</button>
    ${first ? '<button class="linkBtn" id="restoreBtn">🔑 백업 코드로 불러오기</button>' : X_BTN}`;
  const inp = card.querySelector('#nickInput');
  const ok = async () => {
    const v = inp.value.trim();
    if (!v) { toast('닉네임을 적어 주세요'); inp.focus(); return; }
    if (!first && v === nickname) { hideOverlay(); return; }
    // 권한 요청은 버튼을 누른 그 순간에 해야 크롬이 물어봐요
    const geoC = first && card.querySelector('#geoOk');
    // 알림은 꼭 물어봐요 (권한 창은 버튼을 누른 그 순간에만 띄울 수 있어요)
    const permP = first && pushSupported() && Notification.permission === 'default' ? Notification.requestPermission() : null;
    // 같은 닉네임은 한 사람만 써요
    const btn = card.querySelector('#nickOk'); btn.disabled = true;
    const free = typeof nickAvailable === 'function' ? await nickAvailable(v) : true;
    btn.disabled = false;
    if (!free) { toast(nickBad ? '쓸 수 없는 말이 들어 있어요. 다른 닉네임을 정해 주세요' : '이미 있는 닉네임이에요. 다른 닉네임을 정해 주세요', 2400); inp.focus(); inp.select(); return; }
    nickname = v;
    store.set('busGame.nickname', v);
    updateHello();
    hideOverlay();
    if (first) {
      store.set('busGame.geo', geoC && geoC.checked ? 'yes' : 'no');
      startWeather();
      if (permP || (pushSupported() && Notification.permission === 'granted')) enablePush(permP || undefined); else if (typeof syncSoon === 'function') syncSoon();
    } else if (typeof syncSoon === 'function') syncSoon();
  };
  card.querySelector('#nickOk').onclick = ok;
  inp.onkeydown = e => { if (e.key === 'Enter') ok(); };
  if (!first) card.querySelector('#ovClose').onclick = () => hideOverlay();
  else card.querySelector('#restoreBtn').onclick = () => showRestore(true);
  $('overlay').classList.add('show');
  setTimeout(() => inp.focus(), 50);
}

// 설정 창
function showSettings() {
  if (S && S.over) return;
  const card = $('card');
  card.innerHTML = `<h2>설정</h2>
    <div class="setRow"><span>배경음악</span><label class="switch"><input type="checkbox" id="bgmOn"><span></span></label></div>
    <div class="setRow"><input type="range" id="bgmVol" min="0" max="100" aria-label="배경음악 크기"></div>
    <div class="setRow"><span>효과음</span><label class="switch"><input type="checkbox" id="sfxOn"><span></span></label></div>
    <div class="setRow"><input type="range" id="sfxVol" min="0" max="100" aria-label="효과음 크기"></div>
    <div class="setRow"><span>계절 테마</span></div>
    <div class="seasonPick" id="seasonPick">
      <button data-s="auto">지금 계절</button><button data-s="spring">봄</button><button data-s="summer">여름</button><button data-s="autumn">가을</button><button data-s="winter">겨울</button>
    </div>
    <div class="setRow"><span>해상도</span>
      <span class="pickRow" id="litePick"><button data-l="auto">자동</button><button data-l="off">높게</button><button data-l="on">낮게</button></span></div>
    <div class="setRow"><span>글자 크기</span>
      <span class="pickRow" id="fontPick"><button data-f="s">작게</button><button data-f="m">보통</button><button data-f="l">크게</button></span></div>
    <div class="setRow"><span>폰 알림 <small>(하트 · 쪽지 · 여행 알림)</small></span><label class="switch"><input type="checkbox" id="pushOn"><span></span></label></div>
    <div class="pushWhy" id="pushWhy"></div>
    <div class="setRow"><span style="text-align:left">접속 상태 숨기기<br><small>친구에게 접속 중·마지막 접속을 안 보여요</small></span><label class="switch"><input type="checkbox" id="hideSeen"><span></span></label></div>
    <div class="setRow"><span>닉네임 · ${esc(nickname || '없음')}</span>
      <button class="btn alt mini" id="nickBtn">변경</button></div>
    <div class="setRow"><span>개발자 1:1 문의</span><button class="btn alt mini" id="askBtn">💬 문의하기</button></div>
    <div class="setRow"><span>백업 코드</span>
      <span style="display:flex;gap:6px"><button class="btn alt mini" id="backupBtn">만들기</button><button class="btn alt mini" id="restoreBtn">불러오기</button></span></div>
    <div class="setRow"><span>계정 삭제</span><button class="btn alt mini" id="delAcctBtn">지우기</button></div>
    <p class="verLine"><a href="privacy.html" target="_blank" rel="noopener">개인정보처리방침</a></p>
    ${X_BTN}
    <p class="verLine">버전 ${APP_VER}${typeof appMode === 'function' ? ' · ' + appMode() : ''}</p>`;
  card.querySelector('#nickBtn').onclick = () => showNickname(false);
  card.querySelector('#delAcctBtn').onclick = () => showDeleteAccount();
  card.querySelector('#backupBtn').onclick = () => showBackup();
  card.querySelector('#askBtn').onclick = () => showInquiry(showSettings);
  card.querySelector('#restoreBtn').onclick = () => showRestore(false);
  const markSeason = () => card.querySelectorAll('#seasonPick button').forEach(b => b.classList.toggle('on', b.dataset.s === seasonPref));
  card.querySelectorAll('#seasonPick button').forEach(b => b.onclick = () => { setSeason(b.dataset.s); markSeason(); });
  markSeason();
  const q = s => card.querySelector(s);
  // 글자 크기: 작게 / 보통 / 크게
  const markFont = () => card.querySelectorAll('#fontPick button').forEach(b => b.classList.toggle('on', b.dataset.f === (settings.font || 'm')));
  card.querySelectorAll('#fontPick button').forEach(b => b.onclick = () => {
    settings.font = b.dataset.f; saveSettings(); applyFont(); markFont();
    if (S) layout(); else if (typeof renderMap === 'function') renderMap();
  });
  markFont();
  // 해상도: 자동(느린 폰이면 저절로 낮게) / 높게 / 낮게  (낮게 = 가벼운 모드)
  const markLite = () => card.querySelectorAll('#litePick button').forEach(b => b.classList.toggle('on', b.dataset.l === litePref));
  card.querySelectorAll('#litePick button').forEach(b => b.onclick = () => {
    litePref = b.dataset.l; store.set('busGame.lite', litePref);
    if (litePref !== 'auto') store.set('busGame.liteAuto', false);
    setLite(litePref === 'on' || (litePref === 'auto' && store.get('busGame.liteAuto', false)));
    markLite();
  });
  markLite();
  q('#bgmOn').checked = settings.bgmOn;
  q('#sfxOn').checked = settings.sfxOn;
  q('#bgmVol').value = Math.round(settings.bgmVol * 100);
  q('#sfxVol').value = Math.round(settings.sfxVol * 100);
  q('#bgmOn').onchange = e => { settings.bgmOn = e.target.checked; saveSettings(); settings.bgmOn ? startBgm() : stopBgm(); };
  q('#sfxOn').onchange = e => { settings.sfxOn = e.target.checked; saveSettings(); audio(); applyVolumes(); };
  q('#bgmVol').oninput = e => { settings.bgmVol = e.target.value / 100; saveSettings(); audio(); applyVolumes(); };
  q('#sfxVol').oninput = e => { settings.sfxVol = e.target.value / 100; saveSettings(); audio(); applyVolumes(); };
  q('#sfxVol').onchange = () => sfx('depart');   // 크기 미리 듣기
  // 폰 알림 켜기/끄기 (처음 켤 때 크롬이 알림 권한을 물어봐요)
  q('#pushOn').checked = typeof pushOn === 'function' && pushOn();
  // 실제 상태를 확인해서 스위치를 맞추고, 꺼져 있으면 이유를 작게 보여 줘요
  const showWhy = on => { const w = q('#pushWhy'); if (w) w.textContent = on ? '' : (store.get('busGame.pushWhy', '') || ''); };
  if (typeof pushState === 'function') pushState().then(on => { const c = q('#pushOn'); if (c) c.checked = on; showWhy(on); });
  q('#hideSeen').checked = !!settings.hideSeen;
  q('#hideSeen').onchange = e => { settings.hideSeen = e.target.checked; saveSettings(); if (typeof syncNow === 'function') syncNow(); toast(e.target.checked ? '친구에게 접속 상태를 숨겼어요' : '친구에게 접속 상태를 보여 줘요', 1600); };
  q('#pushOn').onchange = async e => {
    if (e.target.checked) e.target.checked = await enablePush();
    else await disablePush();
    showWhy(e.target.checked);
  };
  q('#ovClose').onclick = () => hideOverlay();
  $('overlay').classList.add('show');
}

// 단계 원을 눌렀을 때 뜨는 팝업
// 계정 삭제: 한 번 더 묻고, 서버의 모든 기록과 이 기기의 기록을 지워요
function showDeleteAccount() {
  const card = $('card');
  card.innerHTML = `<h2>계정 삭제</h2>
    <p>정말 지울까요?<br><b>단계·점수·별·하트·친구·쪽지</b>가 모두 사라지고<br>되돌릴 수 없어요.</p>
    <button class="btn" id="delYes" style="background:#f3c2c2">네, 모두 지울게요</button>
    <button class="btn alt" id="delNo">아니요</button>`;
  card.querySelector('#delNo').onclick = () => showSettings();
  card.querySelector('#delYes').onclick = async e => {
    e.target.disabled = true;
    try { if (acct) await api('/account/delete', {}); }
    catch (err) { e.target.disabled = false; toast('지우지 못했어요. 인터넷을 확인해 주세요', 2200); return; }
    try { Object.keys(localStorage).filter(k => k.startsWith('busGame')).forEach(k => localStorage.removeItem(k)); } catch (x) { /* 무시 */ }
    try { const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && await reg.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); } catch (x) { /* 무시 */ }
    toast('계정을 지웠어요. 그동안 고마웠어요 🐾', 2000);
    setTimeout(() => location.replace(location.pathname), 1500);
  };
  $('overlay').classList.add('show');
}
function showLevelPopup(n) {
  const tier = TIERS[levelTier(n)];
  const card = $('card');
  const got = levelStars(n);
  card.innerHTML = `${got ? starCrown(got) : ''}<h2>${n}단계</h2>
    <p>난이도 · ${tier.name}${levelEvents(n).length ? '<br>이벤트 · ' + levelEvents(n).map(e => EVENT_NAMES[e]).join(' + ') : ''}${n < unlocked ? (got ? `<br>가장 잘한 기록 · ${bestTries()[n]}번 만에` : '<br>이미 깬 단계예요') : ''}</p>
    <div class="lvRank" id="lvRank"></div>
    <button class="btn" id="ovStart">시작하기</button>
    ${X_BTN}`;
  card.querySelector('#ovStart').onclick = () => tryStart(n);
  // 단계 랭킹: 이 단계를 가장 적은 시도로 깬 모든 사람 1~10등 + 내 순위 (친구가 아니면 닉네임 가림)
  (async () => {
    if (!acct || typeof api !== 'function') return;
    let r; try { r = await api('/rank?level=' + n); } catch (e) { return; }
    const box = card.querySelector('#lvRank');
    if (!box || !r.rank || !r.rank.length) return;
    // 위: 제목(왼쪽) + [친구만] 체크(오른쪽) / 가운데: 5명 높이로 스크롤 / 아래: 내 기록은 늘 보여요
    const row = x => `<div class="rk${x.me ? ' me' : ''}"><span class="pos">${x.pos <= 3 ? medalSvg(x.pos) : x.pos}</span><b>${esc(x.name)}${x.me ? ' (나)' : ''}</b><small>${x.tries}번 만에</small></div>`;
    const draw = onlyFriends => {
      // 친구만 볼 때는 친구 사이 순위(1, 2, 3…)로 다시 매겨요. 내 줄은 아래에 따로 있어서 목록에선 빼요
      const list = (onlyFriends ? r.rank.filter(x => x.friend || x.me).map((x, i) => ({ ...x, pos: i + 1 })) : r.rank).filter(x => !x.me);
      const mine = box.querySelector('.rkMine');
      if (mine && r.me) { const fpos = onlyFriends ? r.rank.filter(x => x.friend || x.me).findIndex(x => x.me) + 1 : r.me.pos; mine.innerHTML = row({ ...r.me, pos: fpos || r.me.pos }); }
      box.querySelector('.rkList').innerHTML = list.length ? list.map(row).join('') : `<p class="rkNone"><small>${onlyFriends ? '아직 이 단계를 깬 친구가 없어요' : '아직 다른 사람 기록이 없어요'}</small></p>`;
    };
    box.innerHTML = `<div class="rkHead"><span class="rkTitle">단계 랭킹 · ${r.total}명</span><label class="rkOnly">친구만<input type="checkbox" id="rkFriends"></label></div>
      <div class="rkList"></div>${r.me ? `<div class="rkMine">${row(r.me)}</div>` : ''}`;
    const cb = box.querySelector('#rkFriends');
    cb.checked = !!store.get('busGame.rankFriends', false);
    cb.onchange = () => { store.set('busGame.rankFriends', cb.checked); draw(cb.checked); };
    draw(cb.checked);
  })();
  card.querySelector('#ovClose').onclick = () => hideOverlay();
  $('overlay').classList.add('show');
}

