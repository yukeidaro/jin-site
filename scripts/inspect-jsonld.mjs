import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../_site/index.html", import.meta.url), "utf8");
const match = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
if (!match) throw new Error("No JSON-LD block found in the built root page.");

const graph = JSON.parse(match[1])["@graph"];
for (const node of graph) console.log(String(node["@type"]).padEnd(20), Object.keys(node).join(", "));

console.log("\nOrganization node:");
console.log(JSON.stringify(graph.find((node) => node["@type"] === "Organization"), null, 2));
