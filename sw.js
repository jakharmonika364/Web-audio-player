const CACHE_NAME = 'web-audio-player-v2';
const ASSETS = [
    './',
    './index.html',
    './styles.css',
    './js/app.js',
    './js/modules/EventBus.js',
    './js/modules/StorageManager.js',
    './js/modules/AudioController.js',
    './js/modules/PlaylistManager.js',
    './js/modules/LibraryManager.js',
    './js/modules/WaveformVisualizer.js',
    './js/modules/UIController.js'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});
