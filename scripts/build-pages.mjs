import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "_site");

const files = [
  ".nojekyll",
  "CNAME",
  "favicon.svg",
  "favicon.ico",
  "index.html",
  "site.css",
  "base.css",
  "theme-en.css",
  "theme-ja.css",
  "site-page.css",
  "scroll-motion.js",
  "ja/index.html",
  "ja/how-it-works/index.html",
  "ja/privacy/index.html",
  "ja/accessibility/index.html",
  "ja/security/index.html",
  "ja/company/index.html",
  "how-it-works/index.html",
  "security/index.html",
  "company/index.html",
  "privacy/index.html",
  "accessibility/index.html",
  "waitlist.mjs",
  "language.js",
  "copy.js",
  "nav.js",
  "problem.js",
  "workflow.js",
  "robots.txt",
  "sitemap.xml",
  "llms.txt",
  "googled8075da2e5b1406b.html",
  "6252d6a938298e86f40672b512227d4b.txt",
  "human/index.html",
  "en/index.html",
  // Compatibility redirects only; the retired articles are not public content pages.
  "resources/ai-harness/index.html",
  "ja/resources/ai-harness/index.html",
  "agent/index.html",
  "agent/content.json",
  "brand/jin-mark.svg",
  "brand/jin-mark-white.svg",
  "brand/jin-mark-email.png",
  "assets/demo/app.html",
  "assets/demo/app/jin-logo.webp",
  "assets/demo/app/cursor.webp",
  "assets/demo/app/muse-code.webp",
  "assets/demo/demo-1-connect.webp",
  "assets/demo/demo-2-categories.webp",
  "assets/demo/demo-3-by-role.webp",
  "assets/demo/demo-4-what-can-move.webp",
  "assets/demo/video/jin-inbox-demo-en.webm",
  "assets/demo/video/jin-inbox-demo-en.mp4",
  "assets/demo/video/jin-inbox-demo-en-poster.webp",
  "assets/demo/video/jin-inbox-demo-ja.webm",
  "assets/demo/video/jin-inbox-demo-ja.mp4",
  "assets/demo/video/jin-inbox-demo-ja-poster.webp",
  "assets/figures/problem-tools.webp",
  "assets/figures/problem-busy.webp",
  "assets/figures/problem-how.webp",
  "assets/figures/how-connect.webp",
  "assets/figures/how-spot.webp",
  "assets/figures/how-prepare.webp",
  "assets/figures/how-share.webp",
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
