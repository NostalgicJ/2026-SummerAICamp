const CACHE_NAME = 'algoping-v1';
// 오프라인에서도 "오늘의 문제" 화면 자체는 뜨도록, 그 화면을 그리는 데 필요한 최소 자원만 미리 캐싱한다.
const APP_SHELL = ['/', '/style.css', '/app.js', '/manifest.json', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// 캐시에서 꺼내온 응답이라는 걸 페이지 쪽에서 알 수 있도록 헤더를 하나 얹어서 돌려준다.
async function respondFromCacheWithFlag(request) {
  const cached = await caches.match(request);
  if (!cached) {
    return new Response(JSON.stringify({ error: '오프라인 상태이고 저장된 데이터도 없습니다.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const headers = new Headers(cached.headers);
  headers.set('X-From-Cache', '1');
  return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // 건너뛰기/풀었음 체크 등 POST는 오프라인에서 의미가 없으니 그대로 둔다.

  const url = new URL(request.url);

  // 오늘의 문제 API: 온라인이면 항상 최신을 받아오고, 그 응답을 다음 오프라인 대비용으로 캐시에 저장.
  // 네트워크 요청 자체가 실패하면(오프라인) 마지막으로 캐시해둔 응답을 대신 내려준다.
  if (url.pathname === '/api/today') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => respondFromCacheWithFlag(request))
    );
    return;
  }

  // 앱 쉘 정적 파일: 캐시 우선이 아니라 네트워크 우선으로 — 그래야 온라인일 땐 항상 최신 코드를
  // 받고, 오프라인일 때만 마지막으로 저장해둔 버전으로 대체된다. (캐시 우선이면 배포로 파일이
  // 바뀌어도 이미 캐시된 사용자에게는 영원히 옛날 버전만 보이는 문제가 생긴다.)
  if (APP_SHELL.includes(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request))
    );
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    data = { title: 'AlGoPing 오늘의 문제 도착!', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'AlGoPing 오늘의 문제 도착!';
  const options = {
    body: data.body || '알고핑에서 확인해보세요.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
