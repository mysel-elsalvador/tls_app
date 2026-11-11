// Service worker: makes the site installable as an app and shows push
// notifications. It does not cache anything: the data must always be live,
// and pages are already served with no-cache (scripts/deploy.sh).

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Payload: { title, body, url } (sent by the alert notifier).
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "StationsView", {
      body: data.body || "",
      icon: "/192x192.png",
      badge: "/192x192.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data.url, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => {
      for (const tab of tabs) {
        if ("focus" in tab) return tab.navigate(url).then((t) => (t || tab).focus());
      }
      return self.clients.openWindow(url);
    }),
  );
});
