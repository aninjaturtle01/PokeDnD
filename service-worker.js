const CACHE = 'pokemon-d20-v025-premade-1';
const SPRITES = Array.from({length:151},(_,i)=>`./assets/pokemon/${String(i+1).padStart(4,'0')}.png`).concat('./assets/pokemon/substitute.png');
const CORE = [
  './','./index.html','./styles.css','./app.js','./data-bundle.js','./manifest.webmanifest','./assets/icon.svg',
  './data/pokemon.json','./data/moves.json','./data/items.json','./data/classes.json',
  './data/backgrounds.json','./data/evolutions.json','./data/type-chart.json','./data/conditions.json','./data/skills.json',
  ...SPRITES
];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request).then(resp => {
    const copy = resp.clone(); caches.open(CACHE).then(c => c.put(event.request, copy)); return resp;
  }).catch(() => caches.match('./index.html'))));
});
