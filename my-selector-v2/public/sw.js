// --- Service Worker (sw.js) ---

// 1. キャッシュのバージョン管理
// index.htmlのappVersionと連動させます。
// アプリを更新するたびに、このバージョンも変更する必要があります。
const APP_VERSION = 'v2.7.12';
const CACHE_NAME = `r18-selector-shell-${APP_VERSION}`;

// 2. キャッシュするファイルの厳密な指定 (方針7準拠)
// 外部CDN (Tailwind, FontAwesome等) はキャッシュせず、
// 自分のアプリの核となるファイルのみキャッシュします。
const FILES_TO_CACHE = [
  './',          // アプリのルート
  'index.html',  // メインのHTML
  'manifest.json' // マニフェストファイル
];

// 3. インストール (install) イベント
// アプリの核となるファイルをキャッシュします。
self.addEventListener('install', event => {
  console.log('[SW] Install event');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app shell:', FILES_TO_CACHE);
        return cache.addAll(FILES_TO_CACHE);
      })
      .then(() => {
        // 新しいワーカーをすぐに有効化
        return self.skipWaiting();
      })
  );
});

// 4. 有効化 (activate) イベント
// 古いバージョンのキャッシュを削除します (方針7準拠)。
self.addEventListener('activate', event => {
  console.log('[SW] Activate event');
  event.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(keyList.map(key => {
        // CACHE_NAMEと異なるキャッシュ(＝古いバージョン)を削除
        if (key !== CACHE_NAME) {
          console.log('[SW] Removing old cache:', key);
          return caches.delete(key);
        }
      }));
    })
  );
  // クライアントを即座に制御
  return self.clients.claim();
});

// 5. 通信傍受 (fetch) イベント
// 通信を監視し、キャッシュ戦略を実行します。
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // 方針7: Firebase/API/AppCheck通信は除外
  if (requestUrl.hostname.includes('googleapis.com') || 
      requestUrl.hostname.includes('firebaseappcheck.googleapis.com')) {
    return; // Service Workerは何もしない
  }

  // 方針7: GETメソッド以外はキャッシュしない
  if (event.request.method !== 'GET') {
    return; // Service Workerは何もしない
  }

  // 方針7: 外部CDN (Tailwind, Chart.js, FontAwesome) はキャッシュしない
  if (!event.request.url.startsWith(self.location.origin)) {
    return; // Service Workerは何もしない
  }
  
  // ★ 修正: ページナビゲーションリクエスト (index.htmlへのアクセス) は Network First に変更
  if (event.request.mode === 'navigate') {
    event.respondWith(
      // 1. ネットワークにまず接続
      fetch(event.request)
        .then(response => {
          // 1a. 成功したら、レスポンスをキャッシュに保存して...
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
              console.log('[SW] Fetched and cached new page:', event.request.url);
            });
          // ...ネットワークから取得した最新版を返す
          return response;
        })
        .catch(error => {
          // 1b. 失敗したら (オフライン)、キャッシュから探す
          console.log('[SW] Network failed, using cache for:', event.request.url);
          return caches.match(event.request)
            .then(response => {
              // 'FILES_TO_CACHE' には './' があるので、それがフォールバックになる
              return response || caches.match('./'); 
            });
        })
    );
  } else {
    // ★ 既存の戦略: manifest.json などは Cache First
    // (ナビゲーション以外のリクエスト。例: manifest.json)
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            // キャッシュに存在した場合
            return response;
          }
          // キャッシュにない場合はネットワークから取得
          return fetch(event.request);
        })
    );
  }
});