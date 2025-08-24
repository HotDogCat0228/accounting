const CACHE_NAME = 'wallet-app-v1.0.3';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './firebase-script.js',
  './manifest.json',
  './favicon.ico',
  './icons/icon-144x144.svg'
];

// 強制清理所有舊緩存
const FORCE_UPDATE = true;

// 安裝 Service Worker
self.addEventListener('install', function(event) {
  console.log('Service Worker installing...');
  event.waitUntil(
    Promise.resolve()
      .then(() => {
        // 如果強制更新，先清理所有緩存
        if (FORCE_UPDATE) {
          console.log('Force update: clearing all caches');
          return caches.keys().then(cacheNames => {
            return Promise.all(
              cacheNames.map(cacheName => {
                console.log('Deleting cache:', cacheName);
                return caches.delete(cacheName);
              })
            );
          });
        }
      })
      .then(() => {
        // 重新建立緩存
        return caches.open(CACHE_NAME);
      })
      .then(function(cache) {
        console.log('Opened fresh cache');
        // 一個一個添加文件，跳過失敗的
        const cachePromises = urlsToCache.map(url => {
          return fetch(url)
            .then(response => {
              if (response.ok) {
                console.log('Caching:', url);
                return cache.put(url, response);
              } else {
                console.warn('Skipping failed fetch:', url, response.status);
                return null;
              }
            })
            .catch(err => {
              console.warn('Failed to cache:', url, err.message);
              return null;
            });
        });
        
        return Promise.allSettled(cachePromises);
      })
      .then(function(results) {
        const successful = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
        console.log('Cache setup completed:', successful, 'of', results.length, 'items cached');
        // 強制激活新的 service worker
        return self.skipWaiting();
      })
      .catch(function(error) {
        console.error('Service Worker install failed:', error);
        throw error;
      })
  );
});

// 啟動 Service Worker
self.addEventListener('activate', function(event) {
  console.log('Service Worker activating...');
  event.waitUntil(
    Promise.all([
      // 清理舊緩存
      caches.keys().then(function(cacheNames) {
        return Promise.all(
          cacheNames.map(function(cacheName) {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // 立即接管所有客戶端
      self.clients.claim()
    ])
  );
});

// 處理請求 - Cache First 策略
self.addEventListener('fetch', function(event) {
  // 跳過非 GET 請求
  if (event.request.method !== 'GET') {
    return;
  }

  // 跳過 Firebase API 請求，這些需要網路連線
  if (event.request.url.includes('firebase') || 
      event.request.url.includes('googleapis') ||
      event.request.url.includes('firebaseapp')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // 如果在快取中找到，直接回傳
        if (response) {
          return response;
        }

        // 如果沒有快取，從網路抓取
        return fetch(event.request)
          .then(function(response) {
            // 檢查回應是否有效
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // 複製回應並加入快取（排除不支援的協議）
            if (!event.request.url.startsWith('chrome-extension:') && 
                !event.request.url.startsWith('moz-extension:') &&
                !event.request.url.startsWith('webkit-extension:')) {
                var responseToCache = response.clone();
                caches.open(CACHE_NAME)
                  .then(function(cache) {
                    cache.put(event.request, responseToCache);
                  })
                  .catch(function(error) {
                    console.log('緩存失敗:', error);
                  });
            }

            return response;
          })
          .catch(function() {
            // 網路失敗時的備用處理
            if (event.request.destination === 'document') {
              return caches.match('./index.html');
            }
          });
      })
  );
});

// 背景同步 (當網路恢復時同步資料)
self.addEventListener('sync', function(event) {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'wallet-sync') {
    event.waitUntil(
      syncWalletData()
    );
  }
});

// 推播通知處理
self.addEventListener('push', function(event) {
  console.log('Push message received:', event);
  
  const options = {
    body: event.data ? event.data.text() : '您有新的財務提醒',
    icon: './icons/icon-144x144.svg',
    badge: './favicon.ico',
    vibrate: [200, 100, 200],
    data: {
      url: './'
    }
  };

  event.waitUntil(
    self.registration.showNotification('錢包管理', options)
  );
});

// 點擊通知處理
self.addEventListener('notificationclick', function(event) {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});

// 同步錢包資料的函數
async function syncWalletData() {
  try {
    // 這裡可以實作與 Firebase 的資料同步邏輯
    console.log('Syncing wallet data in background...');
    
    // 獲取離線存儲的待同步資料
    const pendingData = await getStoredPendingData();
    
    if (pendingData && pendingData.length > 0) {
      // 嘗試同步至 Firebase
      await syncToFirebase(pendingData);
      
      // 清除已同步的資料
      await clearPendingData();
    }
  } catch (error) {
    console.log('Background sync failed:', error);
  }
}

// 獲取待同步資料
function getStoredPendingData() {
  return new Promise((resolve) => {
    // 這裡應該從 IndexedDB 或其他持久化存儲獲取資料
    resolve([]);
  });
}

// 同步到 Firebase
function syncToFirebase(data) {
  return new Promise((resolve, reject) => {
    // 實作 Firebase 同步邏輯
    setTimeout(() => resolve(), 1000);
  });
}

// 清除待同步資料
function clearPendingData() {
  return new Promise((resolve) => {
    // 清除本地待同步資料
    resolve();
  });
}
