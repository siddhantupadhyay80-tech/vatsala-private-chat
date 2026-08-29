// AntiGravity Duo Service Worker — Background Web Push & Lock-Screen Notifications

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 1. Real Web Push Listener (Fires when browser is closed / phone locked)
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {
      title: 'AntiGravity Duo Alert',
      body: event.data ? event.data.text() : 'Partner is calling you into your private space!'
    };
  }

  const title = data.title || '🔔 AntiGravity Duo Alert';
  const isCall = Boolean(data.isCall);

  const options = {
    body: data.body || 'Partner sent you a private alert!',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: data.tag || (isCall ? 'duo-call-alert' : 'duo-push-alert'),
    vibrate: isCall ? [500, 200, 500, 200, 800, 200, 1000] : [400, 150, 400, 150, 600],
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.url || '/',
      timestamp: Date.now()
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 2. Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// 3. In-App Message Listener
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, icon, tag, isCall } = event.data;
    
    self.registration.showNotification(title, {
      body,
      icon: icon || '/favicon.svg',
      badge: '/favicon.svg',
      tag: tag || (isCall ? 'duo-call-alert' : 'duo-alert'),
      vibrate: isCall ? [500, 200, 500, 200, 800, 300, 1000] : [300, 100, 300, 100, 400],
      renotify: true,
      requireInteraction: isCall ? true : false,
      data: { url: '/' }
    });
  }
});
