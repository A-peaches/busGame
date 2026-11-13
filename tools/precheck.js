// 멍냥이의 버스여행 - 배포 전 자동 점검
// 사용법: tools 폴더에서 `npm install` 한 번, 그다음 `node precheck.js`
//   1) 게임 폴더를 잠깐 띄우고 (http://127.0.0.1:8099)
//   2) 1~150단계가 모두 풀리는지 (이벤트 규칙 그대로)
//   3) 주요 창(설정·설명서·공지·친구·채팅·우편함·문의·단계)이 오류 없이 열리는지
//   4) 이벤트 단계(풍선·무지개비·날개·구름·목숨 하트·오늘의 경쟁)를 잠깐 실제처럼 눌러 보며 오류가 없는지
// 서버(실제 API)는 부르지 않아요: 네트워크 함수를 가짜로 바꿔서 실제 계정·기록에 영향이 없어요.
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer-core');
const ROOT = path.resolve(__dirname, '..'), PORT = 8099;
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p => fs.existsSync(p));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

const results = [];
const ok = (name, pass, info = '') => { results.push({ name, pass, info }); console.log(`${pass ? '✅' : '❌'} ${name}${info ? ' · ' + info : ''}`); };

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', userDataDir: path.join(require('os').tmpdir(), 'meow-precheck-' + Date.now()), protocolTimeout: 600000 });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.setViewport({ width: 390, height: 760 });
  await page.goto(`http://127.0.0.1:${PORT}/?test`, { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2500));
  ok('게임 열기', errs.length === 0, errs.join(' / '));

  // 가짜 서버: 실제 API 를 부르지 않아요
  await page.evaluate(() => {
    sfx = () => {};
    acct = { id: 'me', token: 'x' }; nickname = '점검냥';
    const T = Date.now();
    api = async (p, b) => {
      if (p === '/friends') return { now: T, requests: [], friends: [{ id: 'a', nickname: '친구1', unlocked: 30, lastSeen: T - 60000, nextGiftAt: 0 }, { id: 'b', nickname: '숨김', unlocked: 10, lastSeen: -1, nextGiftAt: 0 }] };
      if (p.startsWith('/friends/suggest')) return { now: T, user: { id: 's', nickname: '추천', unlocked: 5 } };
      if (p.startsWith('/chat')) return { now: T, messages: [{ id: 1, nickname: '친구1', body: '안녕', at: T, mine: false, level: 30, uid: 'a', friend: true }, { id: 2, nickname: '남', body: '하이', at: T, mine: false, level: 3, uid: 'c' }] };
      if (p.startsWith('/mail')) return { mail: [], now: T };
      if (p.startsWith('/notices')) return { notices: [{ id: 1, at: T, title: '공지', body: '• 내용' }] };
      if (p.startsWith('/inquiry')) return { inquiries: [] };
      if (p.startsWith('/rank')) return { rank: [{ nickname: '친구1', tries: 2, me: false }] };
      if (p.startsWith('/daily')) return { day: 1, rank: [{ name: '친*', tries: 1, me: false, friend: false }], me: null, total: 1 };
      return { ok: true };
    };
  });

  // 1~150단계 모두 풀리는지 (실수 없이 꺼낼 수 있는 버스부터 계속 꺼내 봐요)
  const solve = await page.evaluate(() => {
    showOverlay = () => {};
    const bad = [];
    for (let n = 1; n <= MAX_LEVEL; n++) {
      startLevel(n); hideOverlay();
      const left = () => S.vehicles.some(v => ['parked', 'sky', 'landing'].includes(v.state)) || (S.rail && S.rail.items.some(Boolean));
      const settle = () => { for (const v of S.vehicles) if (v.state === 'landing') v.state = 'parked'; if (S.balloon && S.vehicles.some(v => v.state === 'sky') && !S.vehicles.some(v => v.state === 'parked')) landBalloon(true); revealCheck(true); };
      let guard = 0;
      while (left() && guard++ < 4000) {
        const free = S.vehicles.find(v => v.state === 'parked' && parkedBlockers(v).length === 0);
        if (free) { free.state = 'gone'; countShuffle(); countBalloon(); settle(); railStep(); turnStep(); if (S.shuffle && S.shuffle.wait > 0) { S.shuffle.wait = 0; doShuffle(); } }
        else {
          const i = S.rail ? S.rail.items.findIndex((v, k) => v && (railToBoard(v, k), parkedBlockers(v).length === 0)) : -1;
          if (i >= 0) { S.rail.items[i].state = 'gone'; S.rail.items[i] = null; railStep(); turnStep(); } else unstickTurners();
        }
        settle(); for (const v of S.vehicles) { v.bump = null; v.move = null; }
      }
      if (left()) bad.push(n);
    }
    return bad;
  });
  ok(`1~${await page.evaluate(() => MAX_LEVEL)}단계 모두 풀 수 있음`, solve.length === 0, solve.length ? '막힌 단계: ' + solve.join(', ') : '');

  // 주요 창 열기
  for (const [name, fn] of [['설정', 'showSettings()'], ['설명서', 'showHelp()'], ['공지사항', 'showNotices()'], ['친구', 'showFriends()'], ['전체 채팅', 'showChat()'],
    ['우편함', 'showMail()'], ['1:1 문의', 'showInquiry()'], ['단계 팝업', 'showLevelPopup(5)'], ['오늘의 경쟁', "typeof showDaily === 'function' ? showDaily() : 0"]]) {
    const before = errs.length;
    const r = await page.evaluate(fn => { try { hideOverlay(); eval(fn); return ''; } catch (e) { return e.message; } }, fn);
    await new Promise(r => setTimeout(r, 700));
    ok(`창 열기: ${name}`, !r && errs.length === before, r || errs.slice(before).join(' / '));
  }

  // 이벤트 단계를 실제처럼 눌러 보기 (버스를 꺼내면서 이벤트가 터지게)
  for (const [name, n, setup] of [['풍선 버스', 5, ''], ['무지개비', 15, 'S.rainbow.left = 1'], ['날개 버스', 12, 'S.wing.left = 2'], ['구름', 10, ''], ['목숨 하트', 101, ''], ['레일·U턴', 66, ''], ['오늘의 경쟁', 0, '']]) {
    const before = errs.length;
    await page.evaluate((n, setup) => { hideOverlay(); if (n) startLevel(n); else startDaily(); hideOverlay(); S.slotCount = 7; if (setup) eval(setup); }, n, setup);
    for (let k = 0; k < 14; k++) {
      await page.evaluate(() => {
        if (!S || S.over) return;
        const f = S.vehicles.find(v => v.state === 'parked' && !v.hidden && parkedBlockers(v).length === 0 && freeSlot() >= 0);
        if (f) tapVehicle(f); else { const b = S.vehicles.find(v => v.state === 'parked'); if (b) tapVehicle(b); }
      });
      await new Promise(r => setTimeout(r, 350));
    }
    ok(`이벤트 해 보기: ${name}${n ? ` (${n}단계)` : ''}`, errs.length === before, errs.slice(before).join(' / '));
  }

  await browser.close();
  server.close();
  const fail = results.filter(r => !r.pass).length;
  console.log(fail ? `\n❌ ${fail}개 문제가 있어요. 배포하기 전에 고쳐 주세요.` : '\n✅ 모두 통과! 배포해도 좋아요.');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('ERR', e.message); server.close(); process.exit(2); });
