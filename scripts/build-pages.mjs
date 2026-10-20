import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "_site");

const files = [
  ".nojekyll",
  "CNAME",
  "index.html",
  "site.css",
  "base.css",
  "theme-en.css",
  "ja/index.html",
  "ja/how-it-works/index.html",
  "ja/privacy/index.html",
  "ja/accessibility/index.html",
  "how-it-works/index.html",
  "security/index.html",
  "company/index.html",
  "resources/ai-harness/index.html",
  "privacy/index.html",
  "accessibility/index.html",
  "waitlist.mjs",
  "language.js",
  "nav.js",
  "problem.js",
  "robots.txt",
  "sitemap.xml",
  "llms.txt",
  "googled8075da2e5b1406b.html",
  "6252d6a938298e86f40672b512227d4b.txt",
  "human/index.html",
  "en/index.html",
  "agent/index.html",
  "agent/content.json",
  "brand/jin-mark.svg",
  "brand/jin-mark-white.svg",
  "assets/demo/app.html",
  "assets/demo/app/jin-logo.webp",
  "assets/demo/app/cursor.webp",
  "assets/demo/app/muse-code.webp",
  "assets/demo/demo-1-connect.webp",
  "assets/demo/demo-2-categories.webp",
  "assets/demo/demo-3-by-role.webp",
  "assets/demo/demo-4-what-can-move.webp",
  "shots/og-b2b.png"
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const relativePath of files) {
  const destination = path.join(output, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(path.join(root, relativePath), destination);
}

console.log(`Built ${files.length} allowlisted files in _site.`);
