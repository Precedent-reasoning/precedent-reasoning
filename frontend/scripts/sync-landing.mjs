#!/usr/bin/env node
// Copies the shared landing-page files from ../../landing (the authored
// source) into ../public/landing (what Next.js actually serves at `/`).
//
// Next.js can only serve files that physically live inside its own public/
// directory, so this repo keeps one authored copy in landing/ and generates
// this one. Run automatically via predev/prebuild — see package.json.
//
// public/landing/index.html is NOT generated: it's hand-maintained so it can
// set `window.APP_URL = "/app"` before the shared scripts load, pointing
// CTAs at the real app route instead of landing/'s local demo mock.
//
// app-screen.jsx, app-styles.css, and the demo "Legal Case Finder App.html"
// are intentionally excluded — they're the local demo mock, not needed
// here since the real /app already exists.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = path.resolve(__dirname, "../../landing");
const DEST_DIR = path.resolve(__dirname, "../public/landing");

const FILES = [
  "sections.jsx",
  "search.jsx",
  "case-data.jsx",
  "app.jsx",
  "theme.jsx",
  "tweaks-panel.jsx",
  "styles.css",
];

const HEADER = (file) => {
  const generated =
    `AUTO-GENERATED — DO NOT EDIT DIRECTLY.\n` +
    `Copied from landing/${file} by frontend/scripts/sync-landing.mjs\n` +
    `(runs automatically via predev/prebuild). Edit the source in landing/\n` +
    `instead, then rerun \`npm run sync-landing\`.`;
  return file.endsWith(".css")
    ? `/* ${generated.split("\n").join("\n   ")} */\n\n`
    : `// ${generated.split("\n").join("\n// ")}\n\n`;
};

mkdirSync(DEST_DIR, { recursive: true });

for (const file of FILES) {
  const src = path.join(SOURCE_DIR, file);
  const dest = path.join(DEST_DIR, file);
  const content = readFileSync(src, "utf8");
  writeFileSync(dest, HEADER(file) + content);
  console.log(`synced landing/${file} -> frontend/public/landing/${file}`);
}

console.log(`\n${FILES.length} files synced. index.html was left untouched (hand-maintained).`);
