// Cache the app shell only. Never cache Gateway/SSE responses or credentials.
const CACHE='curdr-shell-v6';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['/','/manifest.webmanifest','/icon-192.png','/icon-512.png']))));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('curdr-shell-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{const req=event.request;const url=new URL(req.url);if(req.method!=='GET'||url.origin!==self.location.origin||req.headers.has('authorization')||!['/','/index.html','/manifest.webmanifest','/icon-192.png','/icon-512.png'].includes(url.pathname)&&!url.pathname.startsWith('/_expo/static/'))return;event.respondWith(fetch(req).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(cache=>cache.put(req,copy));}return res;}).catch(()=>caches.match(req).then(res=>res||Response.error())));});
