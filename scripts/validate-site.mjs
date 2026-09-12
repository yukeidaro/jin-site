import { readFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { isAppsScriptEndpoint } from "../waitlist.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = path.join(root, "_site");
const errors = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

async function text(relativePath) {
  return readFile(path.join(site, relativePath), "utf8");
}

async function listFiles(directory, base = directory) {
  const entries = await readdir(directory);
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry);
    if ((await stat(fullPath)).isDirectory()) files.push(...await listFiles(fullPath, base));
    else files.push(path.relative(base, fullPath).replaceAll("\\", "/"));
  }
  return files.sort();
}

function count(source, expression) {
  return source.match(expression)?.length ?? 0;
}

const expectedFiles = [
  ".nojekyll",
  "6252d6a938298e86f40672b512227d4b.txt",
  "CNAME",
  "agent/content.json",
  "agent/index.html",
  "brand/jin-mark.svg",
  "en/index.html",
  "googled8075da2e5b1406b.html",
  "human/index.html",
  "index.html",
  "llms.txt",
  "preview-a-paper.jpg",
  "robots.txt",
  "shots/app-hero-en.jpg",
  "shots/app-page-en.jpg",
  "shots/app-workspace-en.jpg",
  "sitemap.xml",
  "waitlist.mjs"
].sort();

const deployedFiles = await listFiles(site);
check(JSON.stringify(deployedFiles) === JSON.stringify(expectedFiles), `Unexpected Pages artifact: ${deployedFiles.join(", ")}`);

const [home, agent, humanAlias, englishAlias, robots, sitemap, llms, contentJson] = await Promise.all([
  text("index.html"),
  text("agent/index.html"),
  text("human/index.html"),
  text("en/index.html"),
  text("robots.txt"),
  text("sitemap.xml"),
  text("llms.txt"),
  text("agent/content.json")
]);

check(count(home, /<link rel="canonical" href="https:\/\/jinai\.md\/">/g) === 1, "Root must have one self-canonical.");
check(home.includes("<main>") && home.includes("</main>"), "Root must have a main landmark.");
check(home.includes('id="faq-what-is-jin-ai"'), "Generated FAQ is missing.");
check(!/<img(?![^>]*\bsrc=)[^>]*>/i.test(home), "Every root image must have a static src.");
check(!/<img(?![^>]*\balt=)[^>]*>/i.test(home), "Every root image must have alt text.");
check(!/<img(?![^>]*\bwidth=)[^>]*>/i.test(home), "Every root image must have intrinsic width.");
check(!/<img(?![^>]*\bheight=)[^>]*>/i.test(home), "Every root image must have intrinsic height.");
check(!home.includes("FAQPage"), "FAQPage schema must not be published.");

const jsonLdMatches = [...home.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g)];
check(jsonLdMatches.length === 1, "Root must contain one generated JSON-LD graph.");
if (jsonLdMatches.length === 1) JSON.parse(jsonLdMatches[0][1]);

for (const [name, alias] of [["human", humanAlias], ["English", englishAlias]]) {
  check(alias.includes('content="0;url=/"'), `${name} alias must redirect to root.`);
  check(alias.includes('location.replace(\'/\')'), `${name} alias must use a JavaScript root redirect.`);
  check(alias.includes('content="noindex,follow"'), `${name} alias must be noindex,follow.`);
  check(alias.includes('href="https://jinai.md/"'), `${name} alias must canonicalize to root.`);
}

check(count(agent, /<link rel="canonical" href="https:\/\/jinai\.md\/">/g) === 1, "Agent page must have one root canonical.");
check(count(agent, /<link rel="alternate" type="application\/json" href="https:\/\/jinai\.md\/agent\/content\.json">/g) === 1, "Agent page must advertise structured JSON once.");
check(count(agent, /<meta name="robots" content="index,follow,max-snippet:-1">/g) === 1, "Agent page must remain crawlable.");
check(agent.includes('data-content-version="2.0"'), "Agent page is not generated from content version 2.0.");

check(robots.replaceAll("\r\n", "\n") === `User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: *
Allow: /

Sitemap: https://jinai.md/sitemap.xml
`, "robots.txt policy has drifted.");

check(count(sitemap, /<loc>/g) === 1 && sitemap.includes("<loc>https://jinai.md/</loc>"), "Sitemap must contain only the canonical root.");
check(!llms.includes(".md)"), "llms.txt must not link to Markdown mirrors.");
check(llms.startsWith("# Jin AI\n\n> "), "llms.txt must begin with an H1 and blockquote summary.");

const content = JSON.parse(contentJson);
check(content.product.name === "Jin AI", "Structured data product name is invalid.");
check(content.product.status === "in_build", "Structured data must state the in-build status.");

const access = content.early_access;
check(access.form.provider === "apps_script", "The waitlist must use Apps Script directly.");
check(isAppsScriptEndpoint(access.form.endpoint) ||
  (access.form.endpoint === null && access.status === "setup_pending"), "The Apps Script endpoint must be configured or explicitly pending.");
check(home.includes(`data-endpoint="${access.form.endpoint || ""}"`), "The waitlist form must use the declared endpoint.");
for (const name of ["name", "email", "role"]) {
  check(home.includes(`name="${name}"`), `The waitlist is missing its ${name} field.`);
}
check(home.includes('src="waitlist.mjs"'), "The waitlist client must be loaded.");
check(!home.includes("waitlistSink") && !home.includes("formResponse"), "Google Forms and iframe-load confirmations must not be used.");
check(!home.includes("A welcome email is on its way"), "The page must not promise email before the server confirms a send.");
check(count(home, /<form[^>]+id="waitlistForm"/g) === 1, "There must be exactly one waitlist form.");
check(home.includes('href="#waitlist"'), "The hero CTA must jump to the waitlist form.");
check(!/<a[^>]*class="btn[^"]*"[^>]*href="#?"/.test(home), "No CTA may link to an empty or placeholder target.");
if (access.community?.url) {
  check(home.includes(`href="${access.community.url}"`), "Community CTA must be published once its URL is set.");
}

const customerFacingTextFiles = deployedFiles.filter((file) => /\.(html|json|txt|xml|svg|mjs)$/.test(file));
for (const relativePath of customerFacingTextFiles) {
  const source = await text(relativePath);
  check(!source.includes("JinAI"), `${relativePath} contains the obsolete JinAI spelling.`);
  check(!/[\u3040-\u30ff\u3400-\u9fff]/u.test(source), `${relativePath} contains CJK characters.`);
}

const htmlFiles = deployedFiles.filter((file) => file.endsWith(".html"));
const deployedFileSet = new Set(deployedFiles);
const htmlCache = new Map();
for (const relativePath of htmlFiles) htmlCache.set(relativePath, await text(relativePath));

for (const [relativePath, source] of htmlCache) {
  const publicPath = relativePath.replace(/index\.html$/, "");
  const baseUrl = new URL(publicPath, "https://jinai.md/");
  const references = [...source.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((match) => match[1]);

  for (const reference of references) {
    if (/^(?:data|mailto|javascript):/i.test(reference)) continue;
    const resolved = new URL(reference, baseUrl);
    if (resolved.origin !== "https://jinai.md") continue;

    let targetPath = decodeURIComponent(resolved.pathname).replace(/^\/+/, "");
    if (!targetPath || targetPath.endsWith("/")) targetPath += "index.html";
    check(deployedFileSet.has(targetPath), `${relativePath} references missing artifact ${targetPath}.`);

    if (resolved.hash && deployedFileSet.has(targetPath) && targetPath.endsWith(".html")) {
      const targetHtml = htmlCache.get(targetPath);
      const fragment = decodeURIComponent(resolved.hash.slice(1));
      check(
        targetHtml?.includes(`id="${fragment}"`) || targetHtml?.includes(`name="${fragment}"`),
        `${relativePath} references missing fragment #${fragment} in ${targetPath}.`
      );
    }
  }
}

if (errors.length) {
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Pages artifact passed canonical, AEO, crawler and content checks.");
}
