const CACHE_NAME = 'wallet-app-v1.0.0';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './firebase-script.js',
  './script.js',
  './manifest.json',
  // Firebase SDK
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js',
  // Icons (will be added later)
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './icons/apple-touch-icon.png'
];

// 安裝 Service Worker
self.addEventListener('install', function(event) {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch(function(error) {
        console.log('Cache add failed:', error);
      })
  );
});

// 啟動 Service Worker
self.addEventListener('activate', function(event) {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
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

            // 複製回應並加入快取
            var responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(function(cache) {
                cache.put(event.request, responseToCache);
              });

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
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-72x72.png',
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
