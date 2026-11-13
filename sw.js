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
    // 가져갈 소식이 없으면(이미 앞 알림에서 보여 줬으면) 방금 띄운 알림을 다시 띄워 겹치지 않게 해요.
    //   (아이폰은 깨우기마다 알림을 꼭 보여 줘야 해서, 같은 태그로 덮어써 한 개로 보이게)
    if (!notes.length) {
      const shown = await self.registration.getNotifications();
      if (shown.length) {
        const last = shown[shown.length - 1];
        await self.registration.showNotification(last.title, { body: last.body, tag: last.tag, renotify: false, icon: 'icon.png', badge: 'icons/badge.png' });
        return;
      }
      notes = [{ id: 0, title: '멍냥이의 버스여행', body: '새 소식이 있어요!' }];
    }
    for (const n of notes.slice(0, 3)) {
      await self.registration.showNotification(n.title, {
        body: n.body, tag: n.id ? 'meow-' + n.id : 'meow-news', renotify: !!n.id,
        icon: 'icon.png', badge: 'icons/badge.png',   // 알림 막대 작은 아이콘: 하얀 고양이 얼굴 (안드로이드는 모양만 써요)
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
