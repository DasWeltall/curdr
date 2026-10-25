import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
export function serve(port) {
  const root = resolve("dist");
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript",
    ".css": "text/css",
    ".ttf": "font/ttf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".json": "application/json",
    ".webmanifest": "application/manifest+json",
  };
  createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      let p = resolve(root, "." + pathname);
      if (p !== root && !p.startsWith(root + sep)) {
        res.writeHead(403).end();
        return;
      }
      let s = await stat(p).catch(() => null);
      if (!s || s.isDirectory()) p = resolve(root, "index.html");
      const data = await readFile(p);
      res
        .writeHead(200, {
          "Content-Type": types[extname(p)] || "application/octet-stream",
          "Cache-Control": "no-cache",
        })
        .end(data);
    } catch {
      res.writeHead(404).end();
    }
  }).listen(Number(port), "0.0.0.0", () =>
    console.log(`curdr export on port ${port}`),
  );
}
