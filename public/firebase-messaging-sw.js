importScripts("https://www.gstatic.com/firebasejs/12.12.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.12.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBJKgaXvbk0s98R0nWIxkOXNfTXaTxDlCY",
  authDomain: "yushef-b3534.firebaseapp.com",
  projectId: "yushef-b3534",
  storageBucket: "yushef-b3534.firebasestorage.app",
  messagingSenderId: "891752164449",
  appId: "1:891752164449:web:05aeb0ca745745255d4e20",
  measurementId: "G-YPNKM9S7TZ"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const fromName = payload.data?.fromName || getUserDisplayName(payload.data?.fromUid || payload.data?.fromUserId);
  const title = payload.notification?.title || `${fromName} ❤️`;
  const options = {
    body: payload.notification?.body || payload.data?.message || "A little nudge arrived.",
    icon: "/icons/icon-192.png",
    badge: "/apple-touch-icon.png",
    data: {
      url: "/",
      ...payload.data
    }
  };

  self.registration.showNotification(title, options);
});

function getUserDisplayName(uid) {
  const displayNames = {
    xLUPD71OGYfG4NByDz0buh8ZIsy2: "Shosho",
    orPQHip5ooOtfSSkyLYhl5hx9Kg1: "Yuyu"
  };

  return displayNames[uid] || "Someone";
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
