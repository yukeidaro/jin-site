import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../_site/index.html", import.meta.url), "utf8");

const pick = (pattern) => {
  const match = html.match(pattern);
  return match ? match[1].replace(/<[^>]+>/g, " ").replace(/&mdash;/g, "-").replace(/\s+/g, " ").trim() : "--";
};

console.log("title    :", pick(/<title>([\s\S]*?)<\/title>/));
console.log("h1       :", pick(/<h1[^>]*>([\s\S]*?)<\/h1>/));
console.log("problem  :", pick(/problem\.h2">([\s\S]*?)<\/h2>/));
console.log("solution :", pick(/sol\.h2">([\s\S]*?)<\/h2>/));
console.log("outcome  :", pick(/out\.h2">([\s\S]*?)<\/h2>/));
console.log("cta      :", pick(/final\.h2">([\s\S]*?)<\/h2>/));

console.log("\nCTA blocks:");
for (const match of html.matchAll(/<div class="wait">([\s\S]*?)<\/div>/g)) {
  const links = [...match[1].matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
    .map((link) => `${link[2].trim()} -> ${link[1]}`);
  console.log(" ", links.join(" | "));
}
for (const match of html.matchAll(/<div class="waitnote"[^>]*>([\s\S]*?)<\/div>/g)) {
  console.log("  note:", match[1].replace(/\s+/g, " ").trim());
}
