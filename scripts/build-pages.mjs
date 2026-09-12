import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "_site");

const files = [
  ".nojekyll",
  "CNAME",
  "index.html",
  "waitlist.mjs",
  "robots.txt",
  "sitemap.xml",
  "llms.txt",
  "googled8075da2e5b1406b.html",
  "6252d6a938298e86f40672b512227d4b.txt",
  "preview-a-paper.jpg",
  "human/index.html",
  "en/index.html",
  "agent/index.html",
  "agent/content.json",
  "brand/jin-mark.svg",
  "shots/app-hero-en.jpg",
  "shots/app-workspace-en.jpg",
  "shots/app-page-en.jpg"
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const relativePath of files) {
  const destination = path.join(output, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(path.join(root, relativePath), destination);
}

console.log(`Built ${files.length} allowlisted files in _site.`);
