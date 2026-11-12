// 멍냥이의 버스여행 - 시작!
// =====================================================================
//  시작!
// =====================================================================
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
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
