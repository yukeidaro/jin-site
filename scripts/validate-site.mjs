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
  // Windows checkouts (core.autocrlf) use CRLF; CI uses LF. Check the same text either way.
  return (await readFile(path.join(site, relativePath), "utf8")).replace(/\r\n/g, "\n");
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
  "ja/index.html",
  "llms.txt",
  "preview-a-paper.jpg",
  "privacy-tabs.mjs",
  "robots.txt",
  "shots/app-hero-en.jpg",
  "shots/app-page-en.jpg",
  "shots/app-workspace-en.jpg",
  "shots/og-en.png",
  "shots/ill-files.png",
  "shots/ill-once.png",
  "shots/ill-prompts.png",
  "shots/og-ja.png",
  "shots/plugin-screen.png",
  "site.css",
  "sitemap.xml",
  "waitlist.mjs"
].sort();

const deployedFiles = await listFiles(site);
check(JSON.stringify(deployedFiles) === JSON.stringify(expectedFiles), `Unexpected Pages artifact: ${deployedFiles.join(", ")}`);

const [home, japanese, agent, humanAlias, englishAlias, robots, sitemap, llms, contentJson] = await Promise.all([
  text("index.html"),
  text("ja/index.html"),
  text("agent/index.html"),
  text("human/index.html"),
  text("en/index.html"),
  text("robots.txt"),
  text("sitemap.xml"),
  text("llms.txt"),
  text("agent/content.json")
]);

check(count(home, /<link rel="canonical" href="https:\/\/jinai\.md\/">/g) === 1, "Root must have one self-canonical.");
check(count(japanese, /<link rel="canonical" href="https:\/\/jinai\.md\/ja\/">/g) === 1, "Japanese page must have one self-canonical.");
for (const [page, source] of [["English", home], ["Japanese", japanese]]) {
  for (const [language, url] of [["en", "https://jinai.md/"], ["ja", "https://jinai.md/ja/"], ["x-default", "https://jinai.md/"]]) {
    check(source.includes(`<link rel="alternate" hreflang="${language}" href="${url}">`),
      `${page} page must link its ${language} hreflang alternate.`);
  }
  check(source.includes('id="benefits"') && source.includes('id="privacy"') && source.includes('id="waitlist"'),
    `${page} page must have benefits, privacy and waitlist sections.`);
  check(source.includes('role="tablist"') && count(source, /role="tab"/g) === 2 &&
    source.includes('aria-selected="true"') && source.includes('aria-selected="false"'),
  `${page} page must expose both accessible privacy tabs.`);
  check(source.includes('plugin-screen.png') && source.includes('src="') &&
    source.includes('privacy-tabs.mjs'), `${page} page must include the product image and tab interaction.`);
}
check(home.includes("<main>") && home.includes("</main>"), "Root must have a main landmark.");
check(!/id="(?:problem|work|solution)"/.test(home), "Root must not publish retired sections.");
check(home.includes("The one-click setup that makes AI know you from the start"), "Root must use the approved headline.");
check(japanese.replaceAll("<wbr>", "").includes("ワンクリックで、AIが最初からあなたを知っている状態に。"),
  "Japanese page must use the approved headline.");
check(agent.includes('id="what-is-jin-ai"'), "Agent page must carry the generated direct answers.");
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

check(count(sitemap, /<loc>/g) === 2 &&
  sitemap.includes("<loc>https://jinai.md/</loc>") &&
  sitemap.includes("<loc>https://jinai.md/ja/</loc>"), "Sitemap must contain both canonical language routes.");
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
check(japanese.includes(`data-endpoint="${access.form.endpoint || ""}"`), "The Japanese form must use the declared endpoint.");
for (const name of ["name", "email", "role"]) {
  check(home.includes(`name="${name}"`), `The waitlist is missing its ${name} field.`);
}
check(home.includes('src="waitlist.mjs"'), "The waitlist client must be loaded.");
check(!home.includes("waitlistSink") && !home.includes("formResponse"), "Google Forms and iframe-load confirmations must not be used.");
check(!home.includes("A welcome email is on its way"), "The page must not promise email before the server confirms a send.");
check(count(home, /<form[^>]+id="waitlistForm"/g) === 1, "There must be exactly one waitlist form.");
check(count(japanese, /<form[^>]+id="waitlistForm"/g) === 1, "There must be exactly one Japanese waitlist form.");
for (const name of ["name", "email", "role"]) {
  check(japanese.includes(`name="${name}"`), `The Japanese waitlist is missing its ${name} field.`);
}
check(japanese.includes('src="../waitlist.mjs"'), "The Japanese waitlist client must be loaded.");
const surveyForm = home.match(/<form\b[^>]*\bid="waitlistSurvey"[^>]*>[\s\S]*?<\/form>/);
check(count(home, /id="waitlistSurvey"/g) === 1 && Boolean(surveyForm), "There must be exactly one survey form.");
if (surveyForm) {
  const opening = surveyForm[0].slice(0, surveyForm[0].indexOf(">") + 1);
  check(/\shidden(?:\s|>)/.test(opening), "The survey must be hidden until registration is saved.");
  check(opening.includes(`data-survey-id="${access.survey?.id}"`), "The survey id must match structured data.");
  const radios = [...surveyForm[0].matchAll(/<input\b[^>]*\btype="radio"[^>]*>/g)].map((match) => match[0]);
  check(radios.length === 4 && radios.every((radio) => radio.includes('name="answer"')),
    "The survey must offer four answer radios.");
  check(radios.map((radio) => radio.match(/\bvalue="([^"]*)"/)?.[1]).join() ===
    access.survey?.options.map((option) => option.value).join(), "The survey answers must match structured data.");
}
const japaneseSurvey = japanese.match(/<form\b[^>]*\bid="waitlistSurvey"[^>]*>[\s\S]*?<\/form>/)?.[0];
check(Boolean(japaneseSurvey) && japaneseSurvey.includes(`data-survey-id="${access.survey?.id}"`) &&
  [...japaneseSurvey.matchAll(/<input\b[^>]*\btype="radio"[^>]*>/g)]
    .map((match) => match[0].match(/\bvalue="([^"]*)"/)?.[1]).join() ===
  access.survey?.options.map((option) => option.value).join(), "Japanese survey must keep the same id and answer values.");
check(home.includes('href="#waitlist"'), "The hero CTA must jump to the waitlist form.");
check(!/<a[^>]*class="btn[^"]*"[^>]*href="#?"/.test(home), "No CTA may link to an empty or placeholder target.");
if (access.community?.url) {
  check(home.includes(`href="${access.community.url}"`), "Community CTA must be published once its URL is set.");
}

const customerFacingTextFiles = deployedFiles.filter((file) => /\.(html|json|txt|xml|svg|mjs)$/.test(file));
for (const relativePath of customerFacingTextFiles) {
  const source = await text(relativePath);
  check(!source.includes("JinAI"), `${relativePath} contains the obsolete JinAI spelling.`);
  if (relativePath !== "ja/index.html") {
    const englishSource = relativePath === "index.html"
      ? source.replace('<a href="ja/" lang="ja">日本語</a>', "")
      : source;
    check(!/[\u3040-\u30ff\u3400-\u9fff]/u.test(englishSource),
      `${relativePath} contains CJK characters outside the Japanese page and its language link.`);
  }
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
