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
  '<style>@font-face{font-family:Gabarito;src:url(/fonts/gabarito-regular.ttf) format("truetype");font-weight:400;font-display:swap}@font-face{font-family:Gabarito;src:url(/fonts/gabarito-semibold.ttf) format("truetype");font-weight:600 900;font-display:swap}body,input,button,textarea,select{font-family:Gabarito,sans-serif}html,body,#root{height:var(--curdr-viewport-height,100dvh);overflow:hidden}</style><link rel="apple-touch-icon" href="/icon-192.png"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="curdr"><link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#F9F8F5"><meta name="description" content="Your personal agent."></head>',
);
html = html.replace(
  /<meta name="viewport"[^>]*>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />',
);
writeFileSync(path, html);
