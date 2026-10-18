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
  "ja/how-it-works/index.html",
  "how-it-works/index.html",
  "llms.txt",
  "preview-a-paper.jpg",
  "privacy-tabs.mjs",
  "robots.txt",
  "shots/app-hero-en.jpg",
  "shots/app-page-en.jpg",
  "shots/app-workspace-en.jpg",
  "shots/og-en-2.png",
  "shots/ill-files.png",
  "shots/ill-once.png",
  "shots/ill-prompts.png",
  "shots/og-ja-2.png",
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
}
check(japanese.includes('id="benefits"') && japanese.includes('id="privacy"') && japanese.includes('id="waitlist"'),
  "Japanese page must have benefits, privacy and waitlist sections.");
check(japanese.includes('role="tablist"') && count(japanese, /role="tab"/g) === 2 &&
  japanese.includes('aria-selected="true"') && japanese.includes('aria-selected="false"'),
  "Japanese page must expose both accessible privacy tabs.");
check(japanese.includes('plugin-screen.png') && japanese.includes('src="') &&
  japanese.includes('privacy-tabs.mjs'), "Japanese page must include the product image and tab interaction.");
check(home.includes("<main>") && home.includes("</main>"), "Root must have a main landmark.");
const homeSections = [...home.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/g)];
check(homeSections.length === 6 && homeSections[0]?.[1].includes('class="hero"') &&
  homeSections.slice(1).map((match) => match[1].match(/\bid="([^"]+)"/)?.[1]).join() ===
  "problem,solution,how,data,demo", "Root must contain only hero, problem, solution, how, data and demo sections, in order.");
check(count(home, /<h1>/g) === 1 &&
  home.includes("<h1>Keep your top performers' AI harnesses inside the company.</h1>"),
  "Root must use the approved H1 once.");
const homeTitle = "Jin AI | Keep your top performers' AI harnesses inside the company";
check(home.includes(`<title>${homeTitle}</title>`), "Root must use the approved title.");
for (const [attribute, name] of [["property", "og:title"], ["name", "twitter:title"],
  ["property", "og:image:alt"], ["name", "twitter:image:alt"]]) {
  check(home.includes(`<meta ${attribute}="${name}" content="${homeTitle}">`), `Root must use the approved ${name}.`);
}
const homeDescription = "Jin AI keeps the AI harnesses your best people build safe for every employee and reusable for the company.";
for (const [attribute, name] of [["name", "description"], ["property", "og:description"], ["name", "twitter:description"]]) {
  check(home.includes(`<meta ${attribute}="${name}" content="${homeDescription}">`), `Root must use the approved ${name}.`);
}
const hero = homeSections[0]?.[2] || "";
check(!/<(?:img|p)\b|class="(?:eyebrow|lede|waitnote)"/.test(hero),
  "The hero must not contain a subtitle, status tag, note or product image.");
check(hero.includes('href="#how">How it works</a>'), "The hero must link to How it works.");
check(home.includes('<a href="#how">How it works</a>') &&
  home.includes('<a class="btn btn-p" href="#demo">Request a demo</a>'),
  "The nav must link to How it works and the demo.");
const problemSection = homeSections.find((match) => match[1].includes('id="problem"'))?.[2] || "";
const illustrations = [...problemSection.matchAll(/<div\b[^>]*\bclass="art"[^>]*>/g)].map((match) => match[0]);
check(illustrations.length === 3 && illustrations.every((art) =>
  art.includes('role="img"') && /\baria-label="[^"]*\S[^"]*"/.test(art)),
  "The problem must contain three role=img illustrations with non-empty aria-labels.");
for (const id of ["sa-svg", "ho-svg", "ed-svg"]) {
  check(count(problemSection, new RegExp(`<svg\\b[^>]*\\bid="${id}"`, "g")) === 1,
    `The problem must include the inline ${id} illustration once.`);
}
check(!home.includes("Turn the AI you already use into an assistant that actually knows you") &&
  !home.includes("plugin-screen.png") && !home.includes("privacy-tabs.mjs") &&
  !/<section\b[^>]*\bid="(?:what|benefits|privacy|waitlist)"/.test(home),
  "Root must not publish the old headline, product image, privacy tabs or retired sections.");
check(!/[\u2013\u2014\u2018\u2019\u201c\u201d]/u.test(home),
  "Root must not contain em dashes, en dashes or curly quotes.");
check(!/(?:\$|\bPro\b|\bDiscord\b|Cloud Sync|Baby Voice|TikTok|\bsetup\b)/i.test(home),
  "Root contains retired offers, products or terminology.");
check(japanese.replaceAll("<wbr>", "").includes("いつものAIを、あなたを本当に理解するアシスタントに。"),
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

check(count(sitemap, /<loc>/g) === 4 &&
  sitemap.includes("<loc>https://jinai.md/how-it-works/</loc>") &&
  sitemap.includes("<loc>https://jinai.md/ja/how-it-works/</loc>") &&
  sitemap.includes("<loc>https://jinai.md/</loc>") &&
  sitemap.includes("<loc>https://jinai.md/ja/</loc>"), "Sitemap must contain the home and How it works routes in both languages.");
check(!llms.includes(".md)"), "llms.txt must not link to Markdown mirrors.");
check(llms.startsWith("# Jin AI\n\n> "), "llms.txt must begin with an H1 and blockquote summary.");

const content = JSON.parse(contentJson);
check(content.product.name === "Jin AI", "Structured data product name is invalid.");
check(content.product.status === "building", "Structured data must state the Building status.");
check(home.includes(`<h2 class="h2">${content.problem.headline}</h2>`), "Root must use the approved problem heading.");
for (const point of content.problem.points) {
  check(problemSection.includes(`<h3>${point.name}</h3>`) && problemSection.includes(`<p>${point.description}</p>`),
    `Root must use the approved ${point.name} copy.`);
}
const solutionSection = homeSections.find((match) => match[1].includes('id="solution"'))?.[2] || "";
check(solutionSection.includes(`<h2 class="h2">${content.solution.steps.map((step) => step.name).join("<br>")}</h2>`) &&
  content.solution.steps.every((step) => solutionSection.includes(`<p>${step.description}</p>`)) &&
  !/<(?:img|svg)\b|class="(?:ph|eyebrow)"/.test(solutionSection),
  "Root must use the two-line solution heading and approved copy without labels or placeholder images.");
const howSection = homeSections.find((match) => match[1].includes('id="how"'))?.[2] || "";
check(howSection.includes('<h2 class="h2">How it works</h2>') &&
  howSection.includes(`<p class="harness-definition">${content.product.harness_definition}</p>`) &&
  howSection.indexOf('class="harness-definition"') < howSection.indexOf('class="home-columns"'),
  "How it works must define an AI harness directly above its columns.");
check(howSection.includes('class="how-audience">Employee</h3>') &&
  howSection.includes('class="how-audience">Admin</h3>') &&
  howSection.includes('href="how-it-works/">Read more</a>'),
  "How it works must include Employee, Admin and Read more.");
const companyCapabilities = content.capabilities.filter((capability) => capability.id !== "workspace-beta");
check(companyCapabilities.length === 4 && companyCapabilities.every((capability, index) =>
  howSection.includes(`<h4>${index + 1}. ${capability.name}</h4>`) &&
  howSection.includes(`<p>${capability.description}</p>`)),
  "How it works must use all four approved steps.");
check(count(howSection, /<small class="harness-status">Building: Claude Code first<\/small>/g) === 1 &&
  count(howSection, /<small class="harness-status">Building<\/small>/g) === 1 &&
  count(howSection, /<small class="harness-status next">Next<\/small>/g) === 2,
  "How it works must distinguish the two Building steps from the two Next steps.");
const dataSection = homeSections.find((match) => match[1].includes('id="data"'))?.[2] || "";
check(dataSection.includes(`<h2 class="h2">${content.data_principles.headline}</h2>`) &&
  content.data_principles.items.every((item) => dataSection.includes(`<li>${item}</li>`)),
  "Root must use all approved data promises.");
const demoSection = homeSections.find((match) => match[1].includes('id="demo"'))?.[2] || "";
check(demoSection.includes("<h2>See what is inside your company's AI harnesses.</h2>") &&
  demoSection.includes('id="waitlistForm"'), "The demo section must contain the approved heading and form.");

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
check(hero.includes(`<a class="btn btn-p" href="#demo">${access.hero_label}</a>`),
  "The hero CTA must jump to the demo form.");
check(demoSection.includes(`<p class="waitnote">${access.note}</p>`), "The demo form must retain its generated note.");
check(!/<a[^>]*class="btn[^"]*"[^>]*href="#?"/.test(home), "No CTA may link to an empty or placeholder target.");
if (access.community?.url) {
  check(home.includes(`href="${access.community.url}"`), "Community CTA must be published once its URL is set.");
}

const customerFacingTextFiles = deployedFiles.filter((file) => /\.(html|json|txt|xml|svg|mjs)$/.test(file));
for (const relativePath of customerFacingTextFiles) {
  const source = await text(relativePath);
  check(!source.includes("JinAI"), `${relativePath} contains the obsolete JinAI spelling.`);
  if (!relativePath.startsWith("ja/")) {
    // English pages may carry only the language switch link in Japanese.
    const englishSource = source.replace(/<a href="[^"]*" lang="ja"[^>]*>日本語<\/a>/g, "");
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
