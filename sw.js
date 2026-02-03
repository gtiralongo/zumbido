self.addEventListener('push', (event) => {
    const data = event.data.json();
    self.registration.showNotification(data.title, {
        body: data.body,
        icon: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zumbido',
        vibrate: [200, 100, 200]
    });
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/')
    );
});
