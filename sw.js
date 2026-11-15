// 예전 주소의 서비스 워커를 정리해요: 예전에 설치된 게임 서비스 워커가 이 파일로 업데이트되면
//   저장해 둔 예전 게임 파일을 지우고 스스로 물러나요 (그다음부터는 이사 안내 페이지가 바로 열려요)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    try { for (const k of await caches.keys()) await caches.delete(k); } catch (err) { /* 무시 */ }
    try { await self.registration.unregister(); } catch (err) { /* 무시 */ }
    try { for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url); } catch (err) { /* 무시 */ }
  })());
});
