self.addEventListener('push', function(event) {
    if (event.data) {
        const payload = event.data.json();
        const options = {
            body: payload.body,
            icon: '/small-logo.png',
            requireInteraction: true,
            data: payload.data
        };
        
        if (payload.data && payload.data.tag) {
            options.tag = payload.data.tag;
        }
        
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
                if (clientList.length > 0) {
                    // The frontend tab is open, so TaskReminderProvider will handle the OS notification.
                    return; 
                }
                return self.registration.showNotification(payload.title, options);
            })
        );
    }
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    // This looks to see if the current is already open and focuses if it is
    event.waitUntil(clients.matchAll({
        type: "window"
    }).then(function(clientList) {
        for (var i = 0; i < clientList.length; i++) {
            var client = clientList[i];
            if (client.url.includes('/task-management') && 'focus' in client)
                return client.focus();
        }
        if (clients.openWindow)
            return clients.openWindow('/task-management');
    }));
});
