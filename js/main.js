// 멍냥이의 버스여행 - 시작!
// =====================================================================
//  시작!
// =====================================================================
// 매 프레임: 초당 60번까지만 그려요. 120Hz 화면 폰에서도 60번이라 발열이 줄고, 60Hz 폰은 그대로 부드러워요
let last = performance.now(), lastDraw = 0;
function loop(now) {
  requestAnimationFrame(loop);              // 먼저 다음 프레임을 예약해요 → 아래에서 오류가 나도 게임이 얼지 않아요
  if (now - lastDraw < 14) return;          // 너무 잦은 프레임(120Hz)은 건너뛰어요
  const dt = Math.min(0.1, (now - last) / 1000);   // 화면이 잠깐 느려져도 게임 속도는 그대로 (0.1초까지 따라잡아요)
  last = now; lastDraw = now;
  try {
    update(dt);
    if (S) draw();
  } catch (e) { reportError(e); }
}

// 테스트용 주소: ?level=10 (그 단계로 바로), ?season=winter (계절 미리 보기), ?test (닉네임 묻지 않기)
const params = new URLSearchParams(location.search);
if (SEASONS[params.get('season')]) season = params.get('season');
renderScene();
const urlLevel = parseInt(params.get('level'), 10);
renderHearts();
startWeather();
if (urlLevel > 0) startLevel(urlLevel);
else {
  showMenu();
  if (!params.has('test')) {
    if (!nickname) showNickname(true);                                  // 처음 온 사람에게 닉네임 받기
    else if (store.get('busGame.geo', null) === null) askLocation();    // 그다음 위치 동의
    else askPushIfNeeded();                                             // 알림 동의도 꼭
    checkDaily();                                                       // 출석 선물 (하루 한 번 하트 +1)
  }
}
requestAnimationFrame(loop);
