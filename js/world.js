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
  $('weather').textContent = weather.label ? `${weather.place} · ${weather.label}${weather.temp !== null ? ' ' + weather.temp + '°' : ''}` : '';
  renderScene();
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
  card.querySelector('#geoYes').onclick = () => { store.set('busGame.geo', 'yes'); hideOverlay(); startWeather(); };
  card.querySelector('#geoNo').onclick = () => { store.set('busGame.geo', 'no'); hideOverlay(); startWeather(); };
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
function tryStart(n) {
  if (n > MAX_LEVEL) return;
  refreshHearts();
  if (hearts.n <= 0) { toast(`하트가 없어요 · ${heartLeft()} 뒤에 1개 충전`, 2200); return; }
  startLevel(n);
}

// 날리는 것: 비 오는 날엔 비, 겨울이거나 실제로 눈 오는 날엔 눈, 그 밖엔 계절 (벚꽃잎·나뭇잎·단풍).
function makeParticles() {
  const fx = $('fx');
  fx.innerHTML = '';
  const R = Math.random;
  // 겨울엔 항상 눈이 내리고, 실제로 눈이 오는 날엔 더 펑펑 내려요. 비 오는 날엔 비.
  const realSnow = weather.kind === 'snow';
  const kind = weather.kind === 'rain' ? 'rain' : (realSnow || season === 'winter') ? 'snow' : season;
  const n = kind === 'snow' ? (realSnow ? 70 : 40) : kind === 'rain' ? 70 : 20;
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
    p.innerHTML = inner;
    if (kind !== 'rain') p.firstElementChild.style.animationDuration = (2 + R() * 2.5) + 's';
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
function updateHello() {
  $('hello').textContent = nickname ? `${nickname}님 · ${unlocked}단계 여행 중` : '';
}
function showNickname(first) {
  const card = $('card');
  card.innerHTML = `<h2>${first ? '반가워요!' : '닉네임 바꾸기'}</h2>
    <p>${first ? '멍냥이들과 여행할 이름을 알려 주세요.<br>이 기기에 저장되어 다음에 이어서 할 수 있어요.' : '새 닉네임을 적어 주세요.'}</p>
    <input class="nickInput" id="nickInput" maxlength="10" placeholder="닉네임 (최대 10자)" value="${first ? '' : nickname.replace(/"/g, '&quot;')}">
    ${first ? `<div class="consent">
      <div class="setRow"><span>📍 내 위치 날씨 보기<br><small>날씨를 불러올 때만 쓰고 저장하지 않아요</small></span><label class="switch"><input type="checkbox" id="geoOk" checked><span></span></label></div>
      ${typeof pushSupported === 'function' && pushSupported() ? `<div class="setRow"><span>🔔 폰 알림 받기<br><small>하트 도착 · 하트 가득</small></span><label class="switch"><input type="checkbox" id="pushOk" checked><span></span></label></div>` : ''}
    </div>` : ''}
    <button class="btn" id="nickOk">${first ? '여행 시작' : '저장'}</button>
    ${first ? '<button class="linkBtn" id="restoreBtn">🔑 백업 코드로 불러오기</button>' : '<button class="btn alt" id="ovClose">취소</button>'}`;
  const inp = card.querySelector('#nickInput');
  const ok = () => {
    const v = inp.value.trim();
    if (!v) { toast('닉네임을 적어 주세요'); inp.focus(); return; }
    // 권한 요청은 버튼을 누른 그 순간에 해야 크롬이 물어봐요
    const geoC = first && card.querySelector('#geoOk');
    const pushC = first && card.querySelector('#pushOk');
    const permP = pushC && pushC.checked ? Notification.requestPermission() : null;
    nickname = v;
    store.set('busGame.nickname', v);
    updateHello();
    hideOverlay();
    if (first) {
      store.set('busGame.geo', geoC && geoC.checked ? 'yes' : 'no');
      startWeather();
      if (permP) enablePush(permP); else if (typeof syncSoon === 'function') syncSoon();
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
    <div class="setRow"><span>폰 알림 <small>(하트 도착 · 하트 가득)</small></span><label class="switch"><input type="checkbox" id="pushOn"><span></span></label></div>
    <div class="setRow"><span>닉네임 · ${esc(nickname || '없음')}</span>
      <button class="btn alt mini" id="nickBtn">변경</button></div>
    <div class="setRow"><span>백업 코드</span>
      <span style="display:flex;gap:6px"><button class="btn alt mini" id="backupBtn">만들기</button><button class="btn alt mini" id="restoreBtn">불러오기</button></span></div>
    <button class="btn alt" id="ovClose">닫기</button>`;
  card.querySelector('#nickBtn').onclick = () => showNickname(false);
  card.querySelector('#backupBtn').onclick = () => showBackup();
  card.querySelector('#restoreBtn').onclick = () => showRestore(false);
  const markSeason = () => card.querySelectorAll('#seasonPick button').forEach(b => b.classList.toggle('on', b.dataset.s === seasonPref));
  card.querySelectorAll('#seasonPick button').forEach(b => b.onclick = () => { setSeason(b.dataset.s); markSeason(); });
  markSeason();
  const q = s => card.querySelector(s);
  q('#bgmOn').checked = settings.bgmOn;
  q('#sfxOn').checked = settings.sfxOn;
  q('#bgmVol').value = Math.round(settings.bgmVol * 100);
  q('#sfxVol').value = Math.round(settings.sfxVol * 100);
  q('#bgmOn').onchange = e => { settings.bgmOn = e.target.checked; saveSettings(); settings.bgmOn ? startBgm() : stopBgm(); };
  q('#sfxOn').onchange = e => { settings.sfxOn = e.target.checked; saveSettings(); audio(); applyVolumes(); };
  q('#bgmVol').oninput = e => { settings.bgmVol = e.target.value / 100; saveSettings(); audio(); applyVolumes(); };
  q('#sfxVol').oninput = e => { settings.sfxVol = e.target.value / 100; saveSettings(); audio(); applyVolumes(); };
  q('#sfxVol').onchange = () => sfx('go');   // 크기 미리 듣기
  // 폰 알림 켜기/끄기 (처음 켤 때 크롬이 알림 권한을 물어봐요)
  q('#pushOn').checked = typeof pushOn === 'function' && pushOn();
  q('#pushOn').onchange = async e => {
    if (e.target.checked) e.target.checked = await enablePush();
    else await disablePush();
  };
  q('#ovClose').onclick = () => hideOverlay();
  $('overlay').classList.add('show');
}

// 단계 원을 눌렀을 때 뜨는 팝업
function showLevelPopup(n) {
  const tier = TIERS[levelTier(n)];
  const card = $('card');
  card.innerHTML = `<h2>${n}단계</h2>
    <div class="stars">${'★'.repeat(tier.stars)}<span class="off">${'★'.repeat(5 - tier.stars)}</span></div>
    <p>난이도 · ${tier.name}${n >= RAIL_FROM ? '<br>이벤트 · 레일 버스' + (n >= TURN_FROM ? ' + U턴 버스' : '') + (n >= SHUFFLE_FROM ? ' + 자리 바꾸기' : '') : ''}${n < unlocked ? '<br>이미 깬 단계예요' : ''}</p>
    <button class="btn" id="ovStart">시작하기</button>
    <button class="btn alt" id="ovClose">닫기</button>`;
  card.querySelector('#ovStart').onclick = () => tryStart(n);
  card.querySelector('#ovClose').onclick = () => hideOverlay();
  $('overlay').classList.add('show');
}

