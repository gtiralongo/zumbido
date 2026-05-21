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

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  self.registration.showNotification(d.title || '¡ZUMBIDO!', {
    body: d.body || 'Alguien te ha enviado un zumbido',
    icon: 'icon-192.svg',
    badge: 'icon-192.svg',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    tag: 'zumbido'
  });
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('/') && 'focus' in c) return c.focus();
      }
      return clients.openWindow('/');
    })
  );
});
