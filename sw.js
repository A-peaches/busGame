// 멍냥이의 버스여행 - 서비스 워커 (폰 웹 푸시 알림)
// 서버가 "깨우기" 푸시를 보내면, 메시지함(/inbox)에서 내용을 가져와 알림으로 보여 줘요.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

const AUTH_KEY = new URL('__meow_auth', self.registration.scope).href;

self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let notes = [];
    try {
      const cache = await caches.open('meow');
      const r = await cache.match(AUTH_KEY);
      if (r) {
        const { token, api } = await r.json();
        const res = await fetch(api + '/inbox', { headers: { Authorization: 'Bearer ' + token } });
        notes = (await res.json()).notes || [];
      }
    } catch (err) { /* 네트워크가 안 되면 기본 문구로 */ }
    if (!notes.length) notes = [{ id: 0, title: '멍냥이의 버스여행', body: '새 소식이 있어요!' }];
    for (const n of notes.slice(0, 3)) {
      await self.registration.showNotification(n.title, {
        body: n.body, tag: 'meow-' + (n.id || Date.now()), renotify: true,
        icon: 'icon.png', badge: 'icon.png',
      });
    }
  })());
});

// 알림을 누르면 게임을 열어요
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow(self.registration.scope);
  })());
});
