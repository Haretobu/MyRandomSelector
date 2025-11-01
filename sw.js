// キャッシュするアセット（アプリの「殻」）のリスト
const CACHE_NAME = 'r18-selector-shell-v1';
const APP_SHELL_URLS = [
  'index.html', // 修正点
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'
];

// 1. インストール時: アプリの「殻」をキャッシュする
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching App Shell');
        // CDNからのリソースもキャッシュする
        const requests = APP_SHELL_URLS.map(url => 
            new Request(url, { mode: 'no-cors' }) // no-corsモードでCDNリソースをリクエスト
        );
        return cache.addAll(requests);
      })
      .catch(err => console.error('Service Worker: Cache addAll failed', err))
  );
});

// 2. 有効化時: 古いキャッシュを削除する
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 3. フェッチ時: キャッシュを優先して返す (Cache-First戦略)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // キャッシュにあれば、それを即座に返す
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // キャッシュになければ、ネットワークから取得する
        // (Firebaseのデータ通信などはここを通る)
        return fetch(event.request);
      })
  );
});