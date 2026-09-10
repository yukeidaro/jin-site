import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "_site");

const files = [
  ".nojekyll",
  "CNAME",
  "index.html",
  "robots.txt",
  "sitemap.xml",
  "llms.txt",
  "preview-a-paper.jpg",
  "human/index.html",
  "en/index.html",
  "agent/index.html",
  "agent/content.json",
  "brand/jin-mark.svg",
  "shots/shot-notebook-en.png",
  "shots/shot-project-en.png"
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const relativePath of files) {
  const destination = path.join(output, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(path.join(root, relativePath), destination);
}

console.log(`Built ${files.length} allowlisted files in _site.`);
