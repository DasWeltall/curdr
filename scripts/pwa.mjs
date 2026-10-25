import { readFileSync, writeFileSync } from "node:fs";
const path = "dist/index.html";
let html = readFileSync(path, "utf8");
html = html
  .replace('<html lang="en">', '<html lang="en">')
  .replace("<title>", "<title>");
if (!/<title>/.test(html))
  html = html.replace("</head>", "<title>curdr</title></head>");
html = html.replace(
  "</head>",
  '<style>html,body,#root{height:var(--curdr-viewport-height,100dvh);overflow:hidden}</style><link rel="apple-touch-icon" href="/icon-192.png"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="curdr"><link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#F9F8F5"><meta name="description" content="Your personal agent."></head>',
);
html = html.replace(
  /<meta name="viewport"[^>]*>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />',
);
writeFileSync(path, html);
