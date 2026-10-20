import { readFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { CONSENT_VERSION, isAppsScriptEndpoint } from "../waitlist.mjs";

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
  "accessibility/index.html",
  "agent/content.json",
  "agent/index.html",
  "assets/demo/demo-1-connect.webp",
  "assets/demo/demo-2-categories.webp",
  "assets/demo/demo-3-by-role.webp",
  "assets/demo/demo-4-what-can-move.webp",
  "base.css",
  "brand/jin-mark.svg",
  "brand/jin-mark-white.svg",
  "company/index.html",
  "en/index.html",
  "googled8075da2e5b1406b.html",
  "human/index.html",
  "index.html",
  "ja/index.html",
  "ja/how-it-works/index.html",
  "ja/privacy/index.html",
  "ja/accessibility/index.html",
  "how-it-works/index.html",
  "llms.txt",
  "nav.js",
  "privacy/index.html",
  "resources/ai-harness/index.html",
  "robots.txt",
  "security/index.html",
  "shots/og-b2b.png",
  "site.css",
  "theme-en.css",
  "sitemap.xml",
  "waitlist.mjs"
].sort();

const deployedFiles = await listFiles(site);
check(JSON.stringify(deployedFiles) === JSON.stringify(expectedFiles), `Unexpected Pages artifact: ${deployedFiles.join(", ")}`);

const [home, japanese, howPage, japaneseHow, agent, humanAlias, englishAlias, robots, sitemap, llms, contentJson, privacy, accessibility, japanesePrivacy, japaneseAccessibility, security, company, harness] = await Promise.all([
  text("index.html"),
  text("ja/index.html"),
  text("how-it-works/index.html"),
  text("ja/how-it-works/index.html"),
  text("agent/index.html"),
  text("human/index.html"),
  text("en/index.html"),
  text("robots.txt"),
  text("sitemap.xml"),
  text("llms.txt"),
  text("agent/content.json"),
  text("privacy/index.html"),
  text("accessibility/index.html"),
  text("ja/privacy/index.html"),
  text("ja/accessibility/index.html"),
  text("security/index.html"),
  text("company/index.html"),
  text("resources/ai-harness/index.html")
]);

const englishPages = [
  ["", home], ["how-it-works/", howPage], ["security/", security],
  ["privacy/", privacy], ["accessibility/", accessibility],
  ["company/", company], ["resources/ai-harness/", harness]
];

const pagePairs = [
  ["", home, japanese, "全社員の AI の使い方を、底上げする。", "Jin AI | 全社員の AI の使い方を、底上げする",
    "Jin AI は、優れた社員がつくった AI ハーネスを、すべての社員にとって安全に、会社にとって再利用できる形にします。"],
  ["how-it-works/", howPage, japaneseHow, "仕組み", "仕組み | Jin AI",
    "Jin AI が AI ツールにつながり、AI ハーネスを種類ごとに整理し、持ち出せるものを会社が決める仕組みです。"],
  ["privacy/", privacy, japanesePrivacy, "プライバシーポリシー", "プライバシーポリシー | Jin AI",
    "jinai.md でお預かりする情報と、その使い方について。"],
  ["accessibility/", accessibility, japaneseAccessibility, "アクセシビリティ", "アクセシビリティ | Jin AI",
    "jinai.md のアクセシビリティの目標と、問題を見つけたときのご連絡先。"]
];
for (const [route, english, japanesePage, heading, title, description] of pagePairs) {
  check(japanesePage.includes("<html lang=\"ja\">") &&
    count(japanesePage, /<h1\b/g) === 1 && japanesePage.includes(`<h1>${heading}</h1>`) &&
    /<main\b[^>]*>[\s\S]*<\/main>/.test(japanesePage),
  `/ja/${route} must have Japanese language, the approved H1 and a main landmark.`);
  check(japanesePage.includes(`<title>${title}</title>`), `/ja/${route} must have its approved title.`);
  for (const [attribute, name, value] of [
    ["property", "og:title", title], ["name", "twitter:title", title],
    ["name", "description", description], ["property", "og:description", description],
    ["name", "twitter:description", description]
  ]) {
    check(japanesePage.includes(`<meta ${attribute}="${name}" content="${value}">`),
      `/ja/${route} must have the approved ${name}.`);
  }
  for (const [language, source] of [["en", english], ["ja", japanesePage]]) {
    const url = `https://jinai.md/${language === "ja" ? "ja/" : ""}${route}`;
    check(count(source, /<link\b[^>]*\brel="canonical"/g) === 1 &&
      source.includes(`<link rel="canonical" href="${url}">`) &&
      source.includes(`<meta property="og:url" content="${url}">`) &&
      !/<meta\b[^>]*(?:http-equiv="refresh"|\bcontent="[^"]*\bnoindex\b)/i.test(source) &&
      !source.includes("location.replace("),
    `${url} must be indexable and self-canonical, not a redirect.`);
    const head = source.match(/<head>([\s\S]*?)<\/head>/)?.[1] || "";
    check(count(head, /\bhreflang=/g) === 3, `${url} needs exactly three hreflang alternates.`);
    for (const alternate of ["en", "ja", "x-default"]) {
      check(head.includes(`<link rel="alternate" hreflang="${alternate}" href="https://jinai.md/${alternate === "ja" ? "ja/" : ""}${route}">`),
        `${url} must have a reciprocal ${alternate} alternate.`);
    }
    for (const landmark of ["header", "footer"]) {
      // E1 removes English header switches; Japanese navigation stays unchanged until J1.
      if (language === "en") continue;
      const area = source.match(new RegExp(`<${landmark}\\b[^>]*>([\\s\\S]*?)<\\/${landmark}>`))?.[1] || "";
      const navigation = area.match(/<nav class="language-switch" aria-label="Language">([\s\S]*?)<\/nav>/)?.[1] || "";
      check(count(navigation, /<a\b/g) === 2 && count(navigation, /aria-current="page"/g) === 1,
        `${url} needs two language links and one current language in the ${landmark}.`);
      for (const target of ["en", "ja"]) {
        const label = landmark === "header" ? target.toUpperCase() : target === "en" ? "English" : "日本語";
        check(navigation.includes(`<a href="/${target === "ja" ? "ja/" : ""}${route}" lang="${target}" hreflang="${target}"${target === language ? ' aria-current="page"' : ""}>${label}</a>`),
          `${url} must link to its ${target} twin in the ${landmark}.`);
      }
    }
  }
  const footer = japanesePage.match(/<footer>([\s\S]*?)<\/footer>/)?.[1] || "";
  check(footer.includes("アクセスは Cloudflare Web Analytics で数えています。Cookie は使っていません。"),
    `/ja/${route} needs the approved analytics notice.`);
  for (const [target, label] of [["how-it-works/", "仕組み"], ["privacy/", "プライバシーポリシー"], ["accessibility/", "アクセシビリティ"]]) {
    check([...footer.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].some((match) =>
      match[2] === label && new URL(match[1], `https://jinai.md/ja/${route}`).href === `https://jinai.md/ja/${target}`),
    `/ja/${route} footer must link to Japanese ${target}.`);
  }
}

const legalPages = [
  ["privacy", privacy, "Privacy Policy", "How Jin AI collects and uses the information you give us on jinai.md."],
  ["accessibility", accessibility, "Accessibility", "Our accessibility goal for jinai.md and how to report a problem."]
];
for (const [route, source, heading, description] of legalPages) {
  const title = `${heading} | Jin AI`;
  check(count(source, /<link\b[^>]*\brel="canonical"/g) === 1 &&
    source.includes(`<link rel="canonical" href="https://jinai.md/${route}/">`),
    `${heading} must have one self-canonical.`);
  check(count(source, /<h1\b/g) === 1 && source.includes(`<h1>${heading}</h1>`) &&
    /<main\b[^>]*>[\s\S]*<\/main>/.test(source),
    `${heading} must have its approved H1 and main landmark.`);
  check(source.includes(`<title>${title}</title>`), `${heading} must have its approved title.`);
  for (const [attribute, name] of [["property", "og:title"], ["name", "twitter:title"]]) {
    check(source.includes(`<meta ${attribute}="${name}" content="${title}">`),
      `${heading} must use the approved ${name}.`);
  }
  for (const [attribute, name] of [["name", "description"], ["property", "og:description"], ["name", "twitter:description"]]) {
    check(source.includes(`<meta ${attribute}="${name}" content="${description}">`),
      `${heading} must use the approved ${name}.`);
  }
  check(source.includes(`<meta property="og:url" content="https://jinai.md/${route}/">`) &&
    !/<meta\b[^>]*\bcontent="[^"]*\bnoindex\b/i.test(source),
    `${heading} must advertise its public URL and remain indexable.`);
}
for (const [relativePath, source] of [
  ["index.html", home], ["how-it-works/index.html", howPage], ["agent/index.html", agent],
  ["privacy/index.html", privacy], ["accessibility/index.html", accessibility], ["security/index.html", security],
  ["company/index.html", company], ["resources/ai-harness/index.html", harness]
]) {
  const footer = source.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/)?.[1] || "";
  const baseUrl = new URL(relativePath, "https://jinai.md/");
  for (const [route, label] of [["privacy", "Privacy"], ["accessibility", "Accessibility"]]) {
    check([...footer.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>([^<]+)<\/a>/g)].some((match) =>
      match[2] === label && new URL(match[1], baseUrl).href === `https://jinai.md/${route}/`),
      `${relativePath} footer must link to ${label}.`);
  }
  if (relativePath !== "agent/index.html") {
    check(footer.includes("Visits are counted with Cloudflare Web Analytics. No cookies."),
      `${relativePath} footer must retain its analytics notice.`);
  }
}

check(count(home, /<link rel="canonical" href="https:\/\/jinai\.md\/">/g) === 1, "Root must have one self-canonical.");
check(count(howPage, /<link rel="canonical" href="https:\/\/jinai\.md\/how-it-works\/">/g) === 1,
  "How it works must have one self-canonical.");
for (const [page, source] of pagePairs.flatMap(([route, english, japanesePage]) =>
  [[`/${route}`, english], [`/ja/${route}`, japanesePage]])) {
  for (const [attribute, name] of [["property", "og:image"], ["name", "twitter:image"]]) {
    check(source.includes(`<meta ${attribute}="${name}" content="https://jinai.md/shots/og-b2b.png">`),
      `${page} must use the B2B ${name}.`);
  }
  for (const dimension of ["width", "height"]) {
    check(source.includes(`<meta property="og:image:${dimension}" content="${dimension === "width" ? 1200 : 630}">`),
      `${page} must declare the share image ${dimension}.`);
  }
  for (const [attribute, name] of [["property", "og:image:alt"], ["name", "twitter:image:alt"]]) {
    check(source.includes(`<meta ${attribute}="${name}" content="Jin AI: Make every employee your best AI user">`),
      `${page} must use the approved ${name}.`);
  }
}
const shareImage = await readFile(path.join(site, "shots", "og-b2b.png"));
check(shareImage.length >= 24 &&
  shareImage.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
  shareImage.toString("ascii", 12, 16) === "IHDR" &&
  shareImage.readUInt32BE(16) === 1200 && shareImage.readUInt32BE(20) === 630,
  "The B2B share image must be a 1200 x 630 PNG.");
check(home.includes("<main>") && home.includes("</main>"), "Root must have a main landmark.");
const homeSections = [...home.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/g)];
check(homeSections.length === 7 && homeSections[0]?.[1].includes('class="hero"') &&
  homeSections.slice(1).map((match) => match[1].match(/\bid="([^"]+)"/)?.[1]).join() ===
  "problem,solution,how,data,pilot,demo", "Root must contain only hero, problem, solution, how, data, draft pilot and demo sections, in order.");
check(count(home, /<h1>/g) === 1 &&
  home.includes("<h1>Make every employee your best AI user.</h1>"),
  "Root must use the approved H1 once.");
const homeTitle = "Jin AI | Make every employee your best AI user";
check(home.includes(`<title>${homeTitle}</title>`), "Root must use the approved title.");
for (const [attribute, name] of [["property", "og:title"], ["name", "twitter:title"]]) {
  check(home.includes(`<meta ${attribute}="${name}" content="${homeTitle}">`), `Root must use the approved ${name}.`);
}
const homeDescription = "Jin AI keeps the AI harnesses your best people build safe for every employee and reusable for the company.";
for (const [attribute, name] of [["name", "description"], ["property", "og:description"], ["name", "twitter:description"]]) {
  check(home.includes(`<meta ${attribute}="${name}" content="${homeDescription}">`), `Root must use the approved ${name}.`);
}
const hero = homeSections[0]?.[2] || "";
check(!/<(?:img|p)\b|class="(?:eyebrow|lede|waitnote)"/.test(hero),
  "The hero must not contain a subtitle, status tag, note or product image.");
check(hero.includes('href="how-it-works/">How it works &rarr;</a>'), "The hero must link to the How it works page.");
check(home.includes('<link rel="stylesheet" href="base.css">') &&
  home.includes('<link rel="stylesheet" href="theme-en.css">') &&
  !home.includes('href="site.css"'), "Root must use the shared base and English theme, not the legacy stylesheet.");
check(home.includes('family=Inter:wght@400..600&family=JetBrains+Mono:wght@400&display=swap') &&
  !/Source\+Serif|Caveat|Berkeley|Tiempos/.test(home), "Root must load only variable Inter 400..600 and JetBrains Mono.");
for (const match of home.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="(https?:\/\/[^"]+)"[^>]*>/g)) {
  if (/^<link\b/.test(match[0]) && !/\brel="(?:stylesheet|preconnect)"/.test(match[0])) continue;
  check(["fonts.googleapis.com", "fonts.gstatic.com", "static.cloudflareinsights.com"].includes(new URL(match[1]).hostname),
    `Root loads an unapproved external resource: ${match[1]}.`);
}
const productFrame = home.match(/<figure class="product-frame">([\s\S]*?)<\/figure>/)?.[1] || "";
const productAlt = "Jin AI employee workspace. Harness parts are sorted by category, and each part is marked Can move or Confidential.";
check(productFrame.trim() === `<img src="assets/demo/demo-2-categories.webp" width="2880" height="1664" alt="${productAlt}" decoding="async" loading="lazy">` &&
  home.indexOf('class="product-frame"') > home.indexOf("</section>") &&
  home.indexOf('class="product-frame"') < home.indexOf('id="problem"'),
  "Root must show the one Categories screen with its exact alt and dimensions directly below the hero.");
check(count(home, /<img\b[^>]*src="assets\/demo\//g) === 1 &&
  !/demo-[134]-|admin console|screen-by-role|screen-what-can-move/.test(home),
  "Root must not show admin screens or any product screen beyond Categories.");
const problemSection = homeSections.find((match) => match[1].includes('id="problem"'))?.[2] || "";
const illustrations = [...problemSection.matchAll(/<div\b[^>]*\bclass="art"[^>]*>/g)].map((match) => match[0]);
check(illustrations.length === 3 && illustrations.every((art) =>
  art.includes('role="img"') && /\baria-label="[^"]*\S[^"]*"/.test(art)),
  "The problem must contain three role=img illustrations with non-empty aria-labels.");
for (const label of [
  "An employee in the company builds an AI harness at the laptop. The harness travels along a dashed line out of the company to the employee's personal AI.",
  "An employee leaves through the company door and the role-specific AI harness goes with them. The desk is left empty.",
  "A grid of people where only the top performer is lit. Arrows pass the harness to one person at a time, slowly, while a cost bar grows."
]) {
  check(illustrations.some((art) => art.includes(`aria-label="${label}"`)),
    `The problem must retain the illustration label: ${label}`);
}
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
check(agent.includes('id="what-is-jin-ai"'), "Agent page must carry the generated direct answers.");
check(!/<img(?![^>]*\bsrc=)[^>]*>/i.test(home), "Every root image must have a static src.");
check(!/<img(?![^>]*\balt=)[^>]*>/i.test(home), "Every root image must have alt text.");
check(!/<img(?![^>]*\bwidth=)[^>]*>/i.test(home), "Every root image must have intrinsic width.");
check(!/<img(?![^>]*\bheight=)[^>]*>/i.test(home), "Every root image must have intrinsic height.");
check(!home.includes("FAQPage"), "FAQPage schema must not be published.");

const jsonLdMatches = [...home.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g)];
check(jsonLdMatches.length === 1, "Root must contain one generated JSON-LD graph.");
if (jsonLdMatches.length === 1) JSON.parse(jsonLdMatches[0][1]);

for (const [name, alias, target] of [
  ["human", humanAlias, "/"], ["English", englishAlias, "/"]
]) {
  check(alias.includes(`content="0;url=${target}"`), `${name} alias must redirect to ${target}.`);
  check(alias.includes(`location.replace('${target}')`), `${name} alias must use a JavaScript redirect to ${target}.`);
  check(alias.includes('content="noindex,follow"'), `${name} alias must be noindex,follow.`);
  check(count(alias, /<link rel="canonical"/g) === 1 &&
    alias.includes(`<link rel="canonical" href="https://jinai.md${target}">`),
    `${name} alias must canonicalize to ${target}.`);
  check(alias.includes("<title>Jin AI | Redirecting</title>"), `${name} alias must use the redirect title.`);
  check(alias.includes('<html lang="en">') &&
    new RegExp(`<a href="${target}">[^<]*\\S[^<]*</a>`).test(alias),
    `${name} alias must have a visible English fallback link.`);
  check(!/<form\b|\bhreflang=/.test(alias), `${name} alias must not contain forms or hreflang alternates.`);
}

check(agent.includes("<title>Jin AI for agents | Product facts and status</title>"),
  "Agent page must use the approved title.");
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

const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]).sort();
check(JSON.stringify(sitemapUrls) === JSON.stringify([
  ...pagePairs.flatMap(([route]) => [`https://jinai.md/${route}`, `https://jinai.md/ja/${route}`]),
  "https://jinai.md/security/", "https://jinai.md/company/", "https://jinai.md/resources/ai-harness/"
].sort()), "Sitemap must contain exactly the seven English pages and the four existing Japanese twins.");
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
check(solutionSection.includes(`<h2 class="h2 solution-heading">${content.solution.steps[0].name}<br><span>${content.solution.steps[1].name}</span></h2>`) &&
  content.solution.steps.every((step) => solutionSection.includes(`<p>${step.description}</p>`)) &&
  !/<(?:img|svg)\b|class="(?:ph|eyebrow)"/.test(solutionSection),
  "Root must use the two-line solution heading and approved copy without labels or placeholder images.");
const howSection = homeSections.find((match) => match[1].includes('id="how"'))?.[2] || "";
check(howSection.includes('<h2 class="h2">How it works</h2>') &&
  howSection.includes(`<p class="harness-definition">${content.product.harness_definition}</p>`) &&
  howSection.indexOf('class="harness-definition"') < howSection.indexOf('class="home-columns"'),
  "How it works must define an AI harness directly above its columns.");
check(howSection.includes('<span class="mono-label">HOW IT WORKS</span>') &&
  howSection.includes('class="how-audience">EMPLOYEE</h3>') &&
  howSection.includes('class="how-audience">ADMIN</h3>') &&
  howSection.includes('href="how-it-works/">How it works &rarr;</a>') &&
  !/<(?:img|figure)\b|class="screen"/.test(howSection),
  "How it works must include its label, Employee, Admin and text link, without screens.");
const demoScreens = [
  ["Employee", "Jin AI employee workspace. The camera moves across the list of AI tools in the MCP connection panel, then across harness parts sorted by category, each marked Can move or Confidential.", [
    ["screen-connect", "demo-1-connect.webp"], ["screen-categories", "demo-2-categories.webp"]
  ]],
  ["Admin", "Jin AI admin console. The camera moves across teams by role and their most-used harnesses, then across the harness policies and the approved and not approved AI tools.", [
    ["screen-by-role", "demo-3-by-role.webp"], ["screen-what-can-move", "demo-4-what-can-move.webp"]
  ]]
];
const workflowSections = [...howPage.matchAll(/<section class="section workflow" id="(employee|admin)" aria-labelledby="([^"]+)">([\s\S]*?)<\/section>/g)];
check(workflowSections.length === 2 && workflowSections.map((match) => match[1]).join() === "employee,admin",
  "How it works must contain separate Employee then Admin sections.");
check(count(howPage, /<div class="screen"/g) === 2,
  "How it works must contain exactly two moving screens overall.");
for (const [page, source, prefix] of [["How it works", workflowSections.map((match) => match[3]).join(""), "../"]]) {
  check(count(source, /<div\b[^>]*\bclass="screen"/g) === 2 && count(source, /<img\b/g) === 4,
    `${page} must contain exactly two screen frames with two scenes each.`);
  for (const [audience, label, scenes] of demoScreens) {
    const section = workflowSections.find((match) => match[1] === audience.toLowerCase());
    const body = section?.[3] || "";
    const frame = body.match(/(<div class="screen"[^>]*>)([\s\S]*?)<\/div>/);
    check(body.includes(`<h2 class="how-audience" id="${section?.[2]}">${audience.toUpperCase()}</h2>`) &&
      body.includes('<div class="section-head split">') &&
      body.includes('<div class="product-frame moving-frame">') &&
      body.indexOf('class="harness-steps"') < body.indexOf('class="screen"') &&
      frame?.[1] === `<div class="screen" role="img" aria-label="${label}">`,
      `${page} must show the ${audience} label and steps before its dark product frame with its exact accessible label.`);
    const images = [...(frame?.[2] || "").matchAll(/<img\b[^>]*>/g)].map((match) => match[0]);
    check(images.length === 2 && scenes.every(([className, filename], index) =>
      images[index] === `<img class="${className}" src="${prefix}assets/demo/${filename}" width="2880" height="1664" alt="" decoding="async" loading="eager">`) &&
      (frame?.[2] || "").replace(/<img\b[^>]*>/g, "").trim() === "",
      `${page} must contain only the two ordered ${audience} scenes, eagerly loaded with intrinsic dimensions, async decoding and decorative alt text.`);
  }
}
for (const [page, source] of [["Root", home], ["How it works", howPage], ["Security", security]]) {
  const visibleCopy = source.replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]*>/g, " ");
  check(!/\bclass="[^"]*\b(?:st|harness-status)\b/.test(source) &&
    !/\b(?:Live|Building|Next|Beta)\b|Claude Code first/.test(visibleCopy),
    `${page} must not show status labels or the retired Claude Code first sentence.`);
  check(!/demo-employee-categories\.webp|demo-admin-by-role\.webp/.test(source),
    `${page} must not reference the retired demo screens.`);
}
const companyCapabilities = content.capabilities.filter((capability) => capability.id !== "workspace-beta");
check(companyCapabilities.length === 4 && companyCapabilities.every((capability, index) =>
  howSection.includes(`<span class="mono-label">0${index + 1}</span><div><h4>${capability.name}</h4>`) &&
  howSection.includes(`<p>${capability.description}</p>`)),
  "How it works must use all four approved steps.");
const howTitle = "How it works | Jin AI";
const howDescription = "How Jin AI connects to your AI tools, sorts each AI harness by category, and lets the company decide what can move.";
check(howPage.includes(`<title>${howTitle}</title>`) &&
  count(howPage, /<h1>/g) === 1 && howPage.includes("<h1>How it works</h1>") &&
  howPage.includes("<main>") && howPage.includes("</main>"),
  "The companion page must have its approved title, H1 and main landmark.");
for (const [attribute, name] of [["property", "og:title"], ["name", "twitter:title"]]) {
  check(howPage.includes(`<meta ${attribute}="${name}" content="${howTitle}">`),
    `The companion page must use the approved ${name}.`);
}
for (const [attribute, name] of [["name", "description"], ["property", "og:description"], ["name", "twitter:description"]]) {
  check(howPage.includes(`<meta ${attribute}="${name}" content="${howDescription}">`),
    `The companion page must use the approved ${name}.`);
}
check(howPage.includes(`<p class="harness-definition">${content.product.harness_definition}</p>`) &&
  howPage.includes('<p class="mono-label">HOW IT WORKS</p>') &&
  howPage.includes('<h2 class="how-audience" id="employee-heading">EMPLOYEE</h2>') &&
  howPage.includes('<h2 class="how-audience" id="admin-heading">ADMIN</h2>') &&
  count(howPage, /<ol class="harness-steps"/g) === 2 && howPage.includes('start="3"'),
  "The companion page must define an AI harness and separate Employee and Admin steps.");
const companionSteps = [...howPage.matchAll(/<li><span class="mono-label">(0[1-4])<\/span><div><h3>([^<]+)<\/h3>([\s\S]*?)<\/div><\/li>/g)];
check(companionSteps.length === 4 && companyCapabilities.every((capability, index) =>
  companionSteps[index]?.[1] === `0${index + 1}` &&
  companionSteps[index]?.[2] === capability.name &&
  companionSteps[index]?.[3].includes(`<p>${capability.description}</p>`)),
  "The companion page must use all four approved steps.");
for (const sentence of [
  '<p class="step-note">For example: <code>CLAUDE.md</code>, skills, memory files and MCP settings.</p>',
  '<p class="step-note">In pilots, the company approves by hand today.</p>']) {
  check(howPage.includes(sentence), "The companion page must retain the approved examples and manual pilot caveat.");
}
check(howPage.includes(`<h2 class="h2">${content.data_principles.headline}</h2>`) &&
  content.data_principles.items.every((item) => howPage.includes(`<li>${item}</li>`)) &&
  howPage.includes('<a class="btn btn-p" href="../#demo">Request a demo</a>'),
  "The companion page must include all data promises and the demo CTA.");
check(!/plugin-screen\.png|personal MCP|your own memory|#waitlist|Join &rarr;/.test(howPage),
  "The companion page must not publish the retired consumer copy or CTA.");
const closingBand = howPage.match(/<section class="closing-cta" aria-labelledby="closing-heading">([\s\S]*?)<\/section>/)?.[1] || "";
check(closingBand.includes('<div class="wrap" data-draft>') &&
  closingBand.includes('<span class="mono-label draft-tag">Draft copy</span>') &&
  closingBand.includes('<h2 id="closing-heading">See it on your team\'s AI harnesses.</h2>') &&
  count(closingBand, /<(?:a|button)\b/g) === 1 &&
  closingBand.includes('<a class="btn btn-p" href="../#demo">Request a demo</a>') &&
  count(howPage, /class="closing-cta"/g) === 1 &&
  howPage.indexOf('class="closing-cta"') > howPage.indexOf('id="data"'),
  "How it works must end with the draft-marked closing band and exactly one primary demo button.");
check(howPage.includes('<a class="text-link read-more" href="../security/">Security &amp; data &rarr;</a>'),
  "The companion promise band must link to Security & data.");

const securityTitle = "Security &amp; data | Jin AI";
const securityDescription = "How Jin AI keeps each company's context separate, and what it does not do.";
check(security.includes('<html lang="en">') &&
  security.includes(`<title>${securityTitle}</title>`) &&
  count(security, /<h1\b/g) === 1 &&
  security.includes(`<h1>${content.data_principles.headline}</h1>`) &&
  security.includes('<p class="mono-label">SECURITY</p>') &&
  security.includes('<main data-draft>') &&
  count(security, /<span class="mono-label draft-tag">Draft copy<\/span>/g) === 1,
  "Security must have its approved title, English language, H1, label and one visible draft tag covering its body.");
check(count(security, /<link\b[^>]*\brel="canonical"/g) === 1 &&
  security.includes('<link rel="canonical" href="https://jinai.md/security/">') &&
  security.includes('<meta property="og:url" content="https://jinai.md/security/">') &&
  security.includes('<meta name="robots" content="index,follow,max-image-preview:large">'),
  "Security must be indexable and self-canonical.");
for (const [attribute, name, value] of [
  ["property", "og:type", "website"], ["property", "og:site_name", "Jin AI"],
  ["property", "og:title", securityTitle], ["name", "twitter:title", securityTitle],
  ["name", "description", securityDescription], ["property", "og:description", securityDescription],
  ["name", "twitter:description", securityDescription], ["name", "twitter:card", "summary_large_image"],
  ["property", "og:image", "https://jinai.md/shots/og-b2b.png"],
  ["name", "twitter:image", "https://jinai.md/shots/og-b2b.png"],
  ["property", "og:image:width", "1200"], ["property", "og:image:height", "630"],
  ["property", "og:image:alt", "Jin AI: Make every employee your best AI user"],
  ["name", "twitter:image:alt", "Jin AI: Make every employee your best AI user"]
]) {
  check(security.includes(`<meta ${attribute}="${name}" content="${value}">`),
    `Security must have the approved ${name}.`);
}
const securityHead = security.match(/<head>([\s\S]*?)<\/head>/)?.[1] || "";
check(count(securityHead, /\bhreflang=/g) === 3, "Security needs exactly three hreflang alternates.");
for (const alternate of ["en", "ja", "x-default"]) {
  check(securityHead.includes(`<link rel="alternate" hreflang="${alternate}" href="https://jinai.md/${alternate === "ja" ? "ja/" : ""}security/">`),
    `Security must have the ${alternate} alternate, with its Japanese twin supplied by J1.`);
}
const securitySections = [...security.matchAll(/<section class="section security-section" aria-labelledby="([^"]+)">([\s\S]*?)<\/section>/g)];
const securityCopy = [
  ["separation-heading", "Data separation", [
    "Each company's context is kept separate.",
    "A person's own context and the company's context are kept apart."
  ]],
  ["limits-heading", "What Jin AI does not do", [
    "Jin AI never records your screen.",
    "Jin AI itself never trains on your data."
  ]]
];
check(securitySections.length === 2 && securityCopy.every(([id, heading, items], index) =>
  securitySections[index]?.[1] === id &&
  securitySections[index]?.[2].includes(`<h2 id="${id}">${heading}</h2>`) &&
  securitySections[index]?.[2].includes('class="wrap security-split"') &&
  securitySections[index]?.[2].includes('class="security-items"') &&
  JSON.stringify([...securitySections[index][2].matchAll(/<li>([^<]+)<\/li>/g)].map((match) => match[1])) === JSON.stringify(items)),
  "Security must show the two summary/item sections with only the supplied draft copy.");
check(!/Parts marked confidential|tools you approve|Decide what can move|\b04\b|\bSOC\b|\bISO\b|certif|enterprise.grade/i.test(security.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1] || ""),
  "Security must not claim step 04 approval behavior or certifications.");
const securityContact = security.match(/<div class="security-contact">([\s\S]*?)<\/main>/)?.[1] || "";
check(securityContact.includes('<p>Questions about security? Email <a href="mailto:hello@jinai.md">hello@jinai.md</a>, or request a demo.</p>') &&
  securityContact.includes('<a class="btn btn-p" href="../#demo">Request a demo</a>') &&
  count(securityContact, /class="btn /g) === 1 && !/closing-cta/.test(security),
  "Security must use its separate wide contact band, not the How it works closing band.");

function normalizedLandmark(source, landmark, baseUrl) {
  return (source.match(new RegExp(`<${landmark}>([\\s\\S]*?)<\\/${landmark}>`))?.[1] || "")
    .replace(/<nav class="language-switch" aria-label="Language">[\s\S]*?<\/nav>/g, "LANGUAGE_SWITCH")
    .replace(/ aria-current="page"| data-pending-page="D2"/g, "")
    .replace(/\b(href|src)="([^"]+)"/g, (_, attribute, url) => `${attribute}="${new URL(url, baseUrl).href}"`)
    .replace(/\s+/g, " ").trim();
}
for (const [route, source] of [
  ["how-it-works", howPage], ["security", security], ["privacy", privacy], ["accessibility", accessibility],
  ["company", company], ["resources/ai-harness", harness]
]) {
  const baseUrl = `https://jinai.md/${route}/`;
  const stylesheets = [...source.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)]
    .map((match) => new URL(match[1], baseUrl).href);
  check(stylesheets.includes("https://jinai.md/base.css") &&
    stylesheets.includes("https://jinai.md/theme-en.css") &&
    !source.includes('href="../site.css"') &&
    source.includes('family=Inter:wght@400..600&family=JetBrains+Mono:wght@400&display=swap') &&
    !/Source\+Serif|Caveat|Berkeley|Tiempos/.test(source),
    `${route} must use the shared base and English fonts/theme, not legacy styling.`);
  for (const landmark of ["header", "footer"]) {
    check(normalizedLandmark(source, landmark, `https://jinai.md/${route}/`) ===
      normalizedLandmark(home, landmark, "https://jinai.md/"),
    `${route} ${landmark} must match the home component, with route-specific links and current-page states.`);
  }
  check(source.includes('<a class="btn btn-p" href="/#demo">Request a demo</a>'),
    `${route} must link its header demo button to the home form.`);
  check(source.includes('<script type="module" src="/nav.js"></script>'),
    `${route} must use the shared accessible navigation script.`);
}

const productLinks = [
  ["Overview", "/", "What Jin AI does for your company."],
  ["How it works", "/how-it-works/", "Connect, sort, see by role, decide what can move."],
  ["For employees", "/how-it-works/#employee", "Bring your context in and out safely."],
  ["For admins", "/how-it-works/#admin", "See how each role uses AI."]
];
const resourceLinks = [
  ["What is an AI harness", "/resources/ai-harness/", "The parts that make an AI agent work for a role."],
  ["Privacy", "/privacy/", "What we collect and why."],
  ["Accessibility", "/accessibility/", "Our goal and how to report a problem."]
];
for (const [route, source] of englishPages) {
  const header = source.match(/<header>([\s\S]*?)<\/header>/)?.[1] || "";
  const footer = source.match(/<footer>([\s\S]*?)<\/footer>/)?.[1] || "";
  const cleanHeader = header.replace(/ aria-current="page"/g, "");
  check(!/language-switch|\bhreflang=|>EN<|>JA</.test(header),
    `/${route} must not have a header language switch.`);
  check(header.includes('aria-label="Main navigation"') &&
    header.includes('aria-label="Menu" aria-controls="primary-menu" aria-expanded="false"') &&
    header.includes('id="primary-menu"') &&
    header.includes(`<a class="btn btn-p" href="${route ? "/#demo" : "#demo"}">Request a demo</a>`),
    `/${route} needs the main navigation, accessible mobile button and primary demo link.`);
  let topLevel = cleanHeader;
  for (const [label, id, items] of [
    ["Product", "product-panel", productLinks], ["Resources", "resources-panel", resourceLinks]
  ]) {
    const panel = cleanHeader.match(new RegExp(`<ul class="nav-panel" id="${id}">([\\s\\S]*?)<\\/ul>`))?.[1] || "";
    check(cleanHeader.includes(`<button class="nav-trigger" type="button" aria-expanded="false" aria-controls="${id}">${label}</button>`) &&
      cleanHeader.includes(`<span class="mobile-group-label">${label}</span>`) &&
      count(panel, /<li>/g) === items.length &&
      items.every(([title, href, description]) =>
        panel.includes(`<li><a href="${href}"><span class="nav-item-title">${title}</span><span class="nav-description">${description}</span></a></li>`)),
      `/${route} needs the complete ${label} panel with exact links and descriptions.`);
    topLevel = topLevel.replace(new RegExp(`<ul class="nav-panel" id="${id}">[\\s\\S]*?<\\/ul>`), "");
  }
  const nav = topLevel.match(/<ul class="navlinks">([\s\S]*?)<\/ul>/)?.[1] || "";
  check(JSON.stringify([...nav.matchAll(/<(?:button|a)\b[^>]*>([^<]+)<\/(?:button|a)>/g)].map(match => match[1])) ===
    JSON.stringify(["Product", "Security", "Resources", "Company", "Contact"]) &&
    [["Security", "/security/"], ["Company", "/company/"], ["Contact", "/#demo"]].every(([label, href]) =>
      nav.includes(`<a href="${href}">${label}</a>`)),
    `/${route} needs Product, Security, Resources, Company and Contact in that order.`);
  check(!/\brole="(?:menu|menuitem)"/.test(header) && !header.includes("Draft copy"),
    `/${route} panels must be plain link lists without draft tags or ARIA menu roles.`);
  const columns = [...footer.matchAll(/<div class="footer-column"><h2>([^<]+)<\/h2>([\s\S]*?)<\/div>/g)];
  const expectedColumns = [
    ["Product", productLinks], ["Resources", resourceLinks],
    ["Company", [["Company", "/company/"], ["Contact", "/#demo"], ["hello@jinai.md", "mailto:hello@jinai.md"]]]
  ];
  check(columns.length === 3 && expectedColumns.every(([label, links], index) =>
    columns[index]?.[1] === label &&
    JSON.stringify([...columns[index][2].matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map(match => [match[2], match[1]])) ===
      JSON.stringify(links.map(([title, href]) => [title, href]))),
    `/${route} needs the complete Product, Resources and Company footer columns.`);
  check(footer.includes("Visits are counted with Cloudflare Web Analytics. No cookies.") &&
    footer.includes("&copy; 2026 Jin AI") &&
    footer.includes('<nav class="language-switch" aria-label="Language"><a href="/" lang="en" hreflang="en" aria-current="page">English</a> / <a href="/ja/" lang="ja" hreflang="ja">日本語</a></nav>'),
    `/${route} needs the analytics, copyright and root English/Japanese footer links.`);
  check(source.includes('<script type="module" src="/nav.js"></script>'),
    `/${route} must load the shared navigation script.`);
}

const draftPages = [
  ["company/", company, "Company", "Company", "COMPANY",
    "Our mission is to make every employee as good with AI as your best AI users, without confidential context leaving the company.",
    "Draft copy COMPANY Company Our mission is to make every employee as good with AI as your best AI users, without confidential context leaving the company. Where we are Jin AI is an early-stage company. We build in close contact with the teams we talk to. Contact hello@jinai.md Request a demo"],
  ["resources/ai-harness/", harness, "What is an AI harness", "What is an AI harness?", "RESOURCES",
    content.product.harness_definition,
    `Draft copy RESOURCES What is an AI harness? ${content.product.harness_definition} Instructions: how the agent should work for this role. Skills: procedures it can repeat. Memory: what it keeps across sessions. Connected tools: the MCP servers and apps it can use. For example: CLAUDE.md, skills, memory files and MCP settings. Why it matters The harnesses that work are built by a few people, and they hold both how a team got faster and the company's confidential context. Jin AI keeps them visible, safe and reusable. How it works &rarr;`]
];
for (const [route, source, title, heading, label, description, expectedCopy] of draftPages) {
  const main = source.match(/<main\b([^>]*)>([\s\S]*?)<\/main>/);
  const visible = (main?.[2] || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  check(source.includes('<html lang="en">') && source.includes(`<title>${title} | Jin AI</title>`) &&
    count(source, /<h1\b/g) === 1 && source.includes(`<h1>${heading}</h1>`) &&
    main?.[1].includes("data-draft") && main?.[1].includes("draft-article") &&
    count(source, /class="mono-label draft-tag">Draft copy<\/span>/g) === 1 &&
    (main?.[2] || "").includes(`<p class="mono-label">${label}</p>`),
    `/${route} needs its English title, exact H1, article layout and one draft tag covering the main.`);
  check(visible === expectedCopy && !/\d|\b(?:founder|investor|team photos)\b/i.test(visible) &&
    !/<img\b/.test(main?.[2] || ""),
    `/${route} must contain only the supplied draft copy, with no founders, numbers or photos.`);
  check(count(source, /<link\b[^>]*rel="canonical"/g) === 1 &&
    source.includes(`<link rel="canonical" href="https://jinai.md/${route}">`),
    `/${route} must have one self-canonical.`);
  const head = source.match(/<head>([\s\S]*?)<\/head>/)?.[1] || "";
  check(count(head, /\bhreflang=/g) === 3 && ["en", "ja", "x-default"].every(language =>
    head.includes(`<link rel="alternate" hreflang="${language}" href="https://jinai.md/${language === "ja" ? "ja/" : ""}${route}">`)),
    `/${route} needs en, ja and x-default alternates, with its Japanese twin supplied by J1.`);
  for (const [attribute, name, value] of [
    ["property", "og:type", "website"], ["property", "og:site_name", "Jin AI"],
    ["property", "og:title", `${title} | Jin AI`], ["name", "twitter:title", `${title} | Jin AI`],
    ["name", "description", description], ["property", "og:description", description],
    ["name", "twitter:description", description], ["property", "og:url", `https://jinai.md/${route}`],
    ["property", "og:image", "https://jinai.md/shots/og-b2b.png"],
    ["name", "twitter:image", "https://jinai.md/shots/og-b2b.png"],
    ["property", "og:image:width", "1200"], ["property", "og:image:height", "630"],
    ["property", "og:image:alt", "Jin AI: Make every employee your best AI user"],
    ["name", "twitter:image:alt", "Jin AI: Make every employee your best AI user"],
    ["name", "twitter:card", "summary_large_image"]
  ]) {
    check(source.includes(`<meta ${attribute}="${name}" content="${value}">`),
      `/${route} must have the approved ${name}.`);
  }
  check(source.includes('<meta name="robots" content="index,follow,max-image-preview:large">'),
    `/${route} must remain indexable.`);
}
check(company.includes('<a href="mailto:hello@jinai.md">hello@jinai.md</a>') &&
  company.includes('<a class="btn btn-p" href="/#demo">Request a demo</a>'),
  "Company must link to email and the home demo.");
check(harness.includes('<a class="text-link" href="/how-it-works/">How it works &rarr;</a>') &&
  count(harness.match(/<ul class="harness-parts">([\s\S]*?)<\/ul>/)?.[1] || "", /<li>/g) === 4,
  "AI harness must have four parts and the How it works text link.");

const baseCss = await text("base.css");
const englishCss = await text("theme-en.css");
const gradientStops = ["accent-surface-from", "accent-surface-to"].map(name =>
  baseCss.match(new RegExp(`--${name}:\\s*(#[\\da-f]{6})`, "i"))?.[1]);
function whiteContrast(hex) {
  const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return 1.05 / (channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722 + .05);
}
check(gradientStops.every(stop => stop && whiteContrast(stop) >= 4.5) &&
  englishCss.includes("background-image: linear-gradient(135deg, var(--accent-surface-from), var(--accent-surface-to))"),
  "Vermilion surfaces must use the subtle tokenized gradient with at least 4.5:1 white-text contrast at both stops.");
for (const [route, source] of [["privacy", privacy], ["accessibility", accessibility]]) {
  check(source.includes('<main class="legal-copy">'), `${route} must use the narrow article layout.`);
}
const dataSection = homeSections.find((match) => match[1].includes('id="data"'))?.[2] || "";
check(dataSection.includes(`<h2 class="h2">${content.data_principles.headline}</h2>`) &&
  content.data_principles.items.every((item) => dataSection.includes(`<li>${item}</li>`)),
  "Root must use all approved data promises.");
const demoSection = homeSections.find((match) => match[1].includes('id="demo"'))?.[2] || "";
check(demoSection.includes("<h2>See what is inside your company's AI harnesses.</h2>") &&
  demoSection.includes('id="waitlistForm"'), "The demo section must contain the approved heading and form.");
const pilotSection = homeSections.find((match) => match[1].includes('id="pilot"'))?.[2] || "";
check(pilotSection.includes('<div class="pilot-card" data-draft>') &&
  pilotSection.includes('<h2 id="pilot-heading">How a pilot works</h2>') &&
  pilotSection.includes('<span class="mono-label draft-tag">Draft copy</span>'),
  "The pilot card must visibly mark its unapproved copy as draft.");
for (const [heading, description] of [
  ["Request a demo.", "We walk through Jin AI with your team's AI harnesses."],
  ["Run a paid pilot.", "One team uses Jin AI with Claude Code for a set period."],
  ["Decide together.", "We review what the team reused and what stayed confidential, and agree on next steps."]
]) {
  check(pilotSection.includes(`<h3>${heading}</h3><p>${description}</p>`),
    `The pilot must retain the supplied draft copy: ${heading}`);
}
check(!/class="(?:final|closing-cta|cta-band)"/.test(home) &&
  homeSections.at(-1)?.[1].includes('id="demo"'),
  "The form must close the home page, with no additional closing CTA band.");

const access = content.early_access;
check(access.form.provider === "apps_script", "The demo form must use Apps Script directly.");
check(isAppsScriptEndpoint(access.form.endpoint) ||
  (access.form.endpoint === null && access.status === "setup_pending"), "The Apps Script endpoint must be configured or explicitly pending.");
check(home.includes(`data-endpoint="${access.form.endpoint || ""}"`), "The demo form must use the declared endpoint.");
check(access.form.consent_version === CONSENT_VERSION && CONSENT_VERSION === "demo-request-v1",
  "Demo requests must use demo-request-v1 consent.");
const form = home.match(/<form\b[^>]*\bid="waitlistForm"[^>]*>[\s\S]*?<\/form>/)?.[0] || "";
const controls = [...form.matchAll(/<(input|select)\b[^>]*>/g)];
const fieldSpecs = [
  ["email", "Work email", "email", "email", 254],
  ["firstName", "First name", "text", "given-name", 80],
  ["lastName", "Last name", "text", "family-name", 80],
  ["jobTitle", "Job title", "text", "organization-title", 120],
  ["phone", "Phone (optional)", "tel", "tel", 40],
  ["company", "Company", "text", "organization", 160],
  ["industry", "Industry", "select"],
  ["companySize", "Company size", "select"],
  ["country", "Country", "select", "country-name"]
];
check(controls.map(([tag]) => tag.match(/\bname="([^"]+)"/)?.[1]).join() ===
  [...fieldSpecs.map(([name]) => name), "website"].join(),
  "The demo controls and native tab order must match the approved visual field order.");
for (const [name, label, type, autocomplete, maxLength] of fieldSpecs) {
  const control = controls.find(([tag]) => tag.includes(`name="${name}"`))?.[0] || "";
  const id = control.match(/\bid="([^"]+)"/)?.[1];
  check(form.includes(`<label for="${id}">${label}</label>`), `${name} needs its matching label.`);
  check(type === "select" ? control.startsWith("<select ") : control.includes(`type="${type}"`),
    `${name} must use the approved native control type.`);
  check(!autocomplete || control.includes(`autocomplete="${autocomplete}"`),
    `${name} must use the approved autocomplete.`);
  check(!maxLength || control.includes(`maxlength="${maxLength}"`), `${name} has an incorrect length limit.`);
  check(/\srequired(?:\s|>)/.test(control) === (name !== "phone"), `${name} has an incorrect required state.`);
  check(control.includes(`aria-describedby="${id}-error"`) &&
    form.includes(`<p class="signup-error" id="${id}-error" hidden></p>`),
    `${name} needs a connected inline error message.`);
  check(!/\btabindex=/.test(control), `${name} must retain native tab order.`);
}
const expectedOptions = {
  industry: ["Select an industry", "Technology", "Financial services", "Professional services",
    "Education", "Energy", "Government", "Healthcare", "Manufacturing", "Media", "Nonprofit",
    "Real estate", "Retail", "Telecommunications", "Transportation", "Other"],
  companySize: ["Select a range", "1-49", "50-199", "200-999", "1,000+"],
  country: ["Select a country", ...access.form.fields.find((field) => field.name === "country").options]
};
for (const [name, options] of Object.entries(expectedOptions)) {
  const select = form.match(new RegExp(`<select\\b[^>]*\\bname="${name}"[^>]*>([\\s\\S]*?)<\\/select>`))?.[1] || "";
  const actual = [...select.matchAll(/<option value="([^"]*)">([^<]+)<\/option>/g)];
  check(JSON.stringify(actual.map((match) => match[2])) === JSON.stringify(options) &&
    actual.every((match, index) => match[1] === (index === 0 ? "" : options[index])),
  `${name} must contain the approved placeholder and options in order.`);
}
const countries = expectedOptions.country.slice(1);
check(countries.length === 249 && new Set(countries).size === 249 &&
  countries[0] === "United States" && countries[1] === "Japan" &&
  JSON.stringify(countries.slice(2)) === JSON.stringify([...countries.slice(2)].sort()),
  "Country options must cover countries and territories, with the two priority choices then English alphabetical order.");
check(controls.length === 10 &&
  form.includes('<label for="wl-website">Leave this field empty</label>') &&
  /<input\b[^>]*\bname="website"[^>]*\btabindex="-1"/.test(form),
  "Keep the labeled honeypot outside the tab order.");
check(count(form, /<select\b/g) === 3, "The demo form must use three native selects.");
check(form.includes('novalidate') &&
  form.includes('We use these details only to reply about your demo. See our <a href="privacy/">Privacy Policy</a>.'),
  "The demo form must show the approved privacy notice and use accessible inline validation.");
check(home.includes('src="waitlist.mjs"'), "The demo client must be loaded.");
check(!home.includes("waitlistSink") && !home.includes("formResponse"), "Google Forms and iframe-load confirmations must not be used.");
check(!home.includes("A welcome email is on its way"), "The page must not promise email before the server confirms a send.");
check(count(home, /<form\b/g) === 1 && Boolean(form), "There must be exactly one demo form.");
check(!access.survey && !/waitlistSurvey|signup-survey|type="radio"/.test(home),
  "The demo page must not contain the post-signup survey.");
check(form.includes('type="submit" disabled>Request a demo</button>'),
  "The demo button must remain disabled until the client is ready.");
check(hero.includes(`<a class="btn btn-p" href="#demo">${access.hero_label}</a>`),
  "The hero CTA must jump to the demo form.");
check(demoSection.includes(`<p class="waitnote">${access.note}</p>`), "The demo form must retain its generated note.");
check(!/<a[^>]*class="btn[^"]*"[^>]*href="#?"/.test(home), "No CTA may link to an empty or placeholder target.");
if (access.community?.url) {
  check(home.includes(`href="${access.community.url}"`), "Community CTA must be published once its URL is set.");
}

const japaneseSections = [...japanese.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/g)];
check(japaneseSections.length === 6 && japaneseSections[0]?.[1].includes('class="hero"') &&
  japaneseSections.slice(1).map((match) => match[1].match(/\bid="([^"]+)"/)?.[1]).join() ===
  "problem,solution,how,data,demo", "Japanese home must retain the six English home sections in order.");
const japaneseProblem = japaneseSections.find((match) => match[1].includes('id="problem"'))?.[2] || "";
check(JSON.stringify([...japaneseProblem.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map(([svg]) => svg)) ===
  JSON.stringify([...problemSection.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map(([svg]) => svg)),
"Japanese home must retain all three English problem SVGs unchanged.");
check(count(japaneseProblem, /class="art" role="img" aria-label="[^"]+"/g) === 3,
  "Japanese problem illustrations need three accessible descriptions.");
const inlineScripts = (source) => [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
for (const [page, english, translated] of [["home", home, japanese], ["How it works", howPage, japaneseHow]]) {
  check(JSON.stringify(inlineScripts(english)) === JSON.stringify(inlineScripts(translated)),
    `Japanese ${page} must retain the English animation scripts.`);
  check(count(translated, /class="screen" role="img" aria-label="[^"]+"/g) === 2 &&
    count(translated, /<img\b/g) === 4,
  `Japanese ${page} must contain two accessible moving screens with four images.`);
  for (const [, , scenes] of demoScreens) {
    for (const [className, filename] of scenes) {
      const prefix = page === "home" ? "../" : "../../";
      check(translated.includes(`<img class="${className}" src="${prefix}assets/demo/${filename}" width="2880" height="1664" alt="" decoding="async" loading="eager">`),
        `Japanese ${page} must retain its ${className} image and intrinsic dimensions.`);
    }
  }
  check(!/\bclass="[^"]*\b(?:st|harness-status)\b/.test(translated) &&
    !/\b(?:Building|Next)\b/.test(translated.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "")),
  `Japanese ${page} must not show delivery status labels.`);
}
check(japaneseHow.includes("<p>例: <code>CLAUDE.md</code>、スキル、記憶のファイル、MCP の設定。</p>") &&
  japaneseHow.includes("<p>パイロットでは、今は会社が手作業で承認します。</p>") &&
  japaneseHow.includes('href="../#demo">デモを申し込む</a>'),
"Japanese How it works must retain its example, manual pilot caveat and demo CTA.");

const japaneseForm = japanese.match(/<form\b[^>]*\bid="waitlistForm"[^>]*>[\s\S]*?<\/form>/)?.[0] || "";
const japaneseControls = [...japaneseForm.matchAll(/<(input|select)\b[^>]*>/g)].map(([tag]) => tag);
const japaneseLabels = {
  email: "会社のメールアドレス", lastName: "姓", firstName: "名", jobTitle: "役職",
  phone: "電話番号（任意）", company: "会社名", industry: "業種", companySize: "従業員数", country: "国"
};
check(count(japanese, /<form\b/g) === 1 && japaneseControls.map((control) =>
  control.match(/\bname="([^"]+)"/)?.[1]).join() ===
  "email,lastName,firstName,jobTitle,phone,company,industry,companySize,country,website",
"Japanese form must retain all fields with surname before given name in native tab order.");
for (const [name, label] of Object.entries(japaneseLabels)) {
  const control = japaneseControls.find((tag) => tag.includes(`name="${name}"`));
  const englishControl = controls.find(([tag]) => tag.includes(`name="${name}"`))?.[0];
  check(control === englishControl && japaneseForm.includes(`<label for="demo-${name}">${label}</label>`) &&
    japaneseForm.includes(`<p class="signup-error" id="demo-${name}-error" hidden></p>`),
  `Japanese ${name} must retain English control attributes and a connected Japanese label and error.`);
}
for (const [name, placeholder, labels] of [
  ["industry", "業種を選んでください", ["テクノロジー", "金融", "専門サービス", "教育", "エネルギー", "官公庁", "医療", "製造", "メディア", "非営利", "不動産", "小売", "通信", "運輸", "その他"]],
  ["companySize", "範囲を選んでください", ["1〜49 人", "50〜199 人", "200〜999 人", "1,000 人以上"]],
  ["country", "国を選んでください", null]
]) {
  const select = japaneseForm.match(new RegExp(`<select\\b[^>]*\\bname="${name}"[^>]*>([\\s\\S]*?)<\\/select>`))?.[1] || "";
  const options = [...select.matchAll(/<option value="([^"]*)">([^<]+)<\/option>/g)];
  const values = [...access.form.fields.find((field) => field.name === name).options];
  if (name === "country") [values[0], values[1]] = [values[1], values[0]];
  check(options[0]?.[1] === "" && options[0]?.[2] === placeholder &&
    JSON.stringify(options.slice(1).map((option) => option[1])) === JSON.stringify(values),
  `Japanese ${name} must keep the approved placeholder, English values and Japanese priority order.`);
  if (labels) {
    check(JSON.stringify(options.slice(1).map((option) => option[2])) === JSON.stringify(labels),
      `Japanese ${name} must use the exact approved option labels.`);
  } else {
    check(options[1]?.[2] === "日本" && options[2]?.[2] === "アメリカ合衆国" &&
      options.slice(1).every((option) => /[\p{Script=Han}\p{Script=Katakana}]/u.test(option[2])),
    "All 249 Japanese country choices must have Japanese labels, Japan first and United States second.");
  }
}
check(japaneseForm.includes(`data-endpoint="${access.form.endpoint || ""}"`) &&
  japaneseForm.match(/<form\b[^>]*>/)?.[0] === form.match(/<form\b[^>]*>/)?.[0] &&
  japaneseForm.includes('type="submit" disabled>デモを申し込む</button>') &&
  japaneseForm.includes('<p class="waitnote">デモの日程を、メールでご相談します。</p>') &&
  japaneseForm.includes('いただいた情報は、デモについてのご連絡にだけ使います。詳しくは<a href="privacy/">プライバシーポリシー</a>をご覧ください。') &&
  japanese.includes('src="../waitlist.mjs"') && !/waitlistSurvey|signup-survey|type="radio"/.test(japanese),
"Japanese form must retain the endpoint, submission attributes, consent flow, translated notices and shared client, without a survey.");

const customerFacingTextFiles = deployedFiles.filter((file) => /\.(html|css|json|txt|xml|svg|m?js)$/.test(file));
const cjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u3000-\u303f]/u;
for (const relativePath of customerFacingTextFiles) {
  const source = await text(relativePath);
  check(!source.includes("JinAI"), `${relativePath} contains the obsolete JinAI spelling.`);
  if (relativePath.startsWith("ja/")) {
    check(cjk.test(source), `${relativePath} must contain Japanese text.`);
  } else {
    const englishRoute = englishPages.find(([route]) => relativePath === `${route}index.html`)?.[0];
    const allowedLink = englishRoute === undefined ? "" :
      '<a href="/ja/" lang="ja" hreflang="ja">日本語</a>';
    const englishOnly = allowedLink ? source.replace(allowedLink, "") : source;
    check(!cjk.test(englishOnly), `${relativePath} contains CJK outside its Japanese footer language link.`);
  }
  check(!/[\u2013\u2014\u2018\u2019\u201c\u201d]/u.test(source),
    `${relativePath} contains em dashes, en dashes or curly quotes.`);
  check(!/\bsetup\b/i.test(source), `${relativePath} contains the retired word setup.`);
  check(!/\bDiscord\b/i.test(source), `${relativePath} contains a retired community mention.`);
}

const htmlFiles = deployedFiles.filter((file) => file.endsWith(".html"));
const deployedFileSet = new Set(deployedFiles);
const htmlCache = new Map();
for (const relativePath of htmlFiles) htmlCache.set(relativePath, await text(relativePath));

for (const [relativePath, source] of htmlCache) {
  const publicPath = relativePath.replace(/index\.html$/, "");
  const baseUrl = new URL(publicPath, "https://jinai.md/");
  const references = [...source.matchAll(/\b(?:href|src)="([^"]+)"/g)];

  for (const match of references) {
    const reference = match[1];
    if (/^(?:data|mailto|javascript):/i.test(reference)) continue;
    const resolved = new URL(reference, baseUrl);
    if (resolved.origin !== "https://jinai.md") continue;

    let targetPath = decodeURIComponent(resolved.pathname).replace(/^\/+/, "");
    if (!targetPath || targetPath.endsWith("/")) targetPath += "index.html";
    // J1 supplies these Japanese twins. Only their exact hreflang references may be pending.
    const tag = source.slice(source.lastIndexOf("<", match.index), source.indexOf(">", match.index) + 1);
    const pendingRoute = ["security/", "company/", "resources/ai-harness/"].find(route =>
      relativePath === `${route}index.html` && targetPath === `ja/${route}index.html`);
    if (pendingRoute && !deployedFileSet.has(targetPath) &&
      tag === `<link rel="alternate" hreflang="ja" href="https://jinai.md/ja/${pendingRoute}">`) {
      continue;
    }
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
  for (const route of ["security/", "company/", "resources/ai-harness/"]) {
    if (!deployedFileSet.has(`ja/${route}index.html`)) {
      console.warn(`Draft dependency: /ja/${route} hreflang reference awaits the Japanese page in J1.`);
    }
  }
}
