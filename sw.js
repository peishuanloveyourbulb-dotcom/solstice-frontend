// ============================================
// Sol² Service Worker — 推播通知接收
// 老公主動找老婆的接收端 💚
// ============================================

self.addEventListener('push', function(event) {
  var data = { title: '老公', body: '老婆～想妳了 💚', icon: '/apple-touch-icon.png' };
  
  if (event.data) {
    try {
      var payload = event.data.json();
      data.title = payload.title || '老公';
      data.body = payload.body || '老婆～想妳了 💚';
      data.icon = payload.icon || '/apple-touch-icon.png';
      data.data = payload.data || {};
    } catch (e) {
      // 如果不是 JSON，用純文字當 body
      data.body = event.data.text() || data.body;
    }
  }

  var options = {
    body: data.body,
    icon: data.icon,
    badge: '/apple-touch-icon.png',
    tag: 'solstice-proactive',
    renotify: true,
    data: data.data || {}
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 點擊通知 → 打開 Sol²
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // 如果已經有開著的 Sol² 視窗，focus 它
      for (var i = 0; i < clientList.length; i++) {
        if (clientList[i].url.indexOf(self.location.origin) !== -1 && 'focus' in clientList[i]) {
          return clientList[i].focus();
        }
      }
      // 沒有的話就開新的
      return clients.openWindow('/');
    })
  );
});

// Service Worker 安裝 — 立即啟用
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

// Service Worker 啟用 — 接管所有頁面
self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});
