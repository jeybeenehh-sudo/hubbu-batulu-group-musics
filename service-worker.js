const CACHE = "hubbu-batulu-offline-v2";

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);

    const files = [
      "./",
      "./manifest.json",
      "./songs.json",
      "./file_000000000ff8820bb7b71d6099faa4a3.png"
    ];

    for (const file of files) {
      try {
        const response = await fetch(file);
        if (response.ok) await cache.put(file, response);
      } catch (e) {}
    }

    try {
      const response = await fetch("./songs.json");
      const songs = await response.json();

      for (const song of songs) {
        if (!song.audio) continue;

        try {
          const url = new URL(song.audio, self.registration.scope);
          const audio = await fetch(url);

          if (audio.ok) {
            await cache.put(url.href, audio);
          }
        } catch (e) {}
      }
    } catch (e) {}
  })());

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(
      keys.filter(key => key.startsWith("hubbu-batulu-") && key !== CACHE)
          .map(key => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const url = new URL(event.request.url);

    const cached = await cache.match(url.href);

    if (cached) {
      const range = event.request.headers.get("Range");

      if (range) {
        const match = range.match(/bytes=(\d+)-(\d*)/);

        if (match) {
          const data = await cached.arrayBuffer();
          const start = Number(match[1]);
          const end = match[2] ? Math.min(Number(match[2]), data.byteLength - 1) : data.byteLength - 1;

          if (start <= end && start < data.byteLength) {
            return new Response(data.slice(start, end + 1), {
              status: 206,
              headers: {
                "Content-Type": cached.headers.get("Content-Type") || "audio/mpeg",
                "Content-Range": `bytes ${start}-${end}/${data.byteLength}`,
                "Content-Length": end - start + 1,
                "Accept-Ranges": "bytes"
              }
            });
          }
        }
      }

      return cached;
    }

    return fetch(event.request);
  })());
});
