// Service Worker for Firebase Cloud Messaging & Custom push notifications
self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push Received.');

  let title = 'Machine Alert';
  let options = {
    body: 'A critical event has occurred.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: {},
    tag: 'cat-machine-alert',
    requireInteraction: true
  };

  if (event.data) {
    try {
      const data = event.data.json();
      console.log('[Service Worker] Push data JSON parsed:', data);

      // Extract title and body
      // FCM structures this either under notification or data payload
      const notification = data.notification || {};
      const payloadData = data.data || data || {};

      title = notification.title || payloadData.title || title;
      options.body = notification.body || payloadData.body || options.body;
      options.icon = notification.icon || payloadData.icon || options.icon;
      options.data = payloadData;

      // Extract category/severity to customize look or tag
      const category = payloadData.category || payloadData.severity || 'Information';
      options.tag = `cat-${payloadData.machine_id || 'general'}-${payloadData.alert_id || 'event'}`;
      
      // Customize notification aesthetics based on severity
      if (category === 'Critical') {
        title = `🚨 CRITICAL: ${title}`;
      } else if (category === 'Warning') {
        title = `⚠️ WARNING: ${title}`;
      } else if (category === 'Maintenance') {
        title = `🔧 MAINTENANCE: ${title}`;
      } else if (category === 'Inspection') {
        title = `🔍 INSPECTION: ${title}`;
      }

    } catch (e) {
      // Fallback if payload is plain text
      console.log('[Service Worker] Push data as text:', event.data.text());
      options.body = event.data.text();
    }
  }

  const notificationPromise = self.registration.showNotification(title, options);
  event.waitUntil(notificationPromise);
});

self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Notification click Received.', event.notification);

  event.notification.close();

  const data = event.notification.data || {};
  const machineId = data.machine_id;
  const alertId = data.alert_id;

  // Build target URL
  let targetUrl = '/dashboard';
  if (machineId) {
    targetUrl = `/dashboard?machine_id=${machineId}`;
    if (alertId) {
      targetUrl += `&alert_id=${alertId}`;
    }
  }

  // Find open windows and navigate them, or open a new window
  const urlToOpen = new URL(targetUrl, self.location.origin).href;

  const promiseChain = clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then((windowClients) => {
    let matchingClient = null;

    for (let i = 0; i < windowClients.length; i++) {
      const windowClient = windowClients[i];
      if (windowClient.url === urlToOpen || windowClient.url.includes('/dashboard')) {
        matchingClient = windowClient;
        break;
      }
    }

    if (matchingClient) {
      // Navigate window client to target if needed and focus
      if (machineId) {
        matchingClient.navigate(urlToOpen);
      }
      return matchingClient.focus();
    } else {
      return clients.openWindow(urlToOpen);
    }
  });

  event.waitUntil(promiseChain);
});
