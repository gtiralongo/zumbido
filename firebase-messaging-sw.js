importScripts('https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging.js');

firebase.initializeApp({
  apiKey: "AIzaSyAl_jrOOxnMuBpWGRB_dxdvao39GMhlV-Y",
  authDomain: "studio-1888292451-fc60d.firebaseapp.com",
  projectId: "studio-1888292451-fc60d",
  storageBucket: "studio-1888292451-fc60d.firebasestorage.app",
  messagingSenderId: "873003768289",
  appId: "1:873003768289:web:5e3d7a85ebaea725469aa0"
});

const CACHE = 'zumbido-v2';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-192.svg', './icon-512.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('firebase') || e.request.url.includes('gstatic.com')) {
    e.respondWith(fetch(e.request));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  self.registration.showNotification(d.title || '¡ZUMBIDO!', {
    body: d.body || (d.fromName ? d.fromName + ' te ha enviado un zumbido' : 'Alguien te ha enviado un zumbido'),
    icon: 'icon-192.svg',
    badge: 'icon-192.svg',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    tag: 'zumbido-' + (d.fromUid || Date.now()),
    data: { fromUid: d.fromUid || '', fromName: d.fromName || '' },
    actions: [
      { action: 'reply', title: '🔔 Responder' },
      { action: 'open', title: 'Abrir' }
    ]
  });
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const d = e.notification.data || {};

  if (e.action === 'reply') {
    e.waitUntil(clients.openWindow('/?replyTo=' + encodeURIComponent(d.fromUid || '') + '&replyName=' + encodeURIComponent(d.fromName || '')));
    return;
  }

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      return clients.openWindow('/');
    })
  );
});
