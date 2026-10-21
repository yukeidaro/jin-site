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

const communityUrl = "https://discord.gg/C5m4jGgKXD";
const communityLink = `<a href="${communityUrl}" target="_blank" rel="noopener">Discord</a>`;
function emailComponent(japanese = false) {
  return `<span class="email-contact"><span class="email-address">hello@jinai.md</span> <button type="button" class="copy-email" data-copy="hello@jinai.md">${japanese ? "コピー" : "Copy"}</button></span>`;
}

function withoutJapanesePhrases(source) {
  return source.replace(/<span class="ja-phrase">([^<]*)<\/span>/g, "$1");
}

function headingLines(source) {
  return source.split(/<br\s*\/?>/i).map(line => line.replace(/<[^>]*>/g, "")
    .replace(/&#(?:46|x2e);|&period;/gi, ".").replace(/&nbsp;|&#160;/gi, " ").trim());
}

const expectedFiles = [
  ".nojekyll",
  "6252d6a938298e86f40672b512227d4b.txt",
  "CNAME",
  "accessibility/index.html",
  "agent/content.json",
  "agent/index.html",
  "assets/demo/app.html",
  "assets/demo/app/jin-logo.webp",
  "assets/demo/app/cursor.webp",
  "assets/demo/app/muse-code.webp",
  "assets/demo/demo-1-connect.webp",
  "assets/demo/demo-2-categories.webp",
  "assets/demo/demo-3-by-role.webp",
  "assets/demo/demo-4-what-can-move.webp",
  "base.css",
  "brand/jin-mark.svg",
  "brand/jin-mark-white.svg",
  "company/index.html",
  "copy.js",
  "en/index.html",
  "googled8075da2e5b1406b.html",
  "human/index.html",
  "index.html",
  "ja/index.html",
  "ja/how-it-works/index.html",
  "ja/privacy/index.html",
  "ja/accessibility/index.html",
  "ja/security/index.html",
  "ja/company/index.html",
  "ja/resources/ai-harness/index.html",
  "language.js",
  "how-it-works/index.html",
  "llms.txt",
  "nav.js",
  "privacy/index.html",
  "problem.js",
  "resources/ai-harness/index.html",
  "robots.txt",
  "security/index.html",
  "shots/og-b2b.png",
  "site.css",
  "theme-en.css",
  "theme-ja.css",
  "sitemap.xml",
  "waitlist.mjs",
  "workflow.js"
].sort();

const deployedFiles = await listFiles(site);
check(JSON.stringify(deployedFiles) === JSON.stringify(expectedFiles), `Unexpected Pages artifact: ${deployedFiles.join(", ")}`);

const [home, japanese, howPage, japaneseHow, agent, humanAlias, englishAlias, robots, sitemap, llms, contentJson, privacy, accessibility, japanesePrivacy, japaneseAccessibility, security, company, harness, japaneseSecurity, japaneseCompany, japaneseHarness] = await Promise.all([
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
  text("resources/ai-harness/index.html"),
  text("ja/security/index.html"),
  text("ja/company/index.html"),
  text("ja/resources/ai-harness/index.html")
]);

const englishPages = [
  ["", home], ["how-it-works/", howPage], ["security/", security],
  ["privacy/", privacy], ["accessibility/", accessibility],
  ["company/", company]
];

for (const [route, source] of [...englishPages, ["agent/", agent]]) {
  for (const [, tag, , inner] of source.matchAll(/<([a-z][\w-]*)\b([^>]*\bclass="[^"]*\b(?:nav-item-title|mobile-group-label|figure-title|card-title|step-title|article-title|form-title)\b[^"]*"[^>]*)>([\s\S]*?)<\/\1>/g)) {
    check(headingLines(inner).every(line => !line.endsWith(".")),
      `/${route} ${tag} title must not end a line with a period: ${headingLines(inner).join(" / ")}`);
  }
  for (const [, tag, inner] of source.matchAll(/<(h[1-4])\b[^>]*>([\s\S]*?)<\/\1>/g)) {
    check(headingLines(inner).every(line => !line.endsWith(".")),
      `/${route} ${tag} must not end a line with a period: ${headingLines(inner).join(" / ")}`);
  }
}
for (const filename of deployedFiles.filter(file => file.endsWith(".html"))) {
  const source = await text(filename);
  check(!/\b(?:data-draft|draft-tag)\b|Draft copy|文案（承認待ち）/.test(source),
    `${filename} must not contain draft attributes, classes or approval tags.`);
}
const demoClient = await text("waitlist.mjs");
check([...demoClient.matchAll(/\bheading:\s*(?:[^?\n]+\?\s*)?"([^"]+)"/g)]
  .every(([, heading]) => !heading.endsWith(".")) &&
  !demoClient.includes('"Your request is not confirmed."'),
  "Demo success and error headings must not end with periods.");

const pagePairs = [
  ["", home, japanese, "AIを、会社の資産に。", "Jin AI | AIを、会社の資産に",
    "Jin AI は、優れた社員がつくった AI ハーネスを、すべての社員にとって安全に、会社にとって再利用できる形にします。"],
  ["how-it-works/", howPage, japaneseHow, "仕組み", "仕組み | Jin AI",
    "Jin AI が AI ツールにつながり、AI ハーネスを種類ごとに整理し、持ち出せるものを会社が決める仕組みです。"],
  ["security/", security, japaneseSecurity, "会社のコンテクストは、会社のもの。", "セキュリティ | Jin AI",
    "会社ごとにコンテクストを分けて保管します。個人のコンテクストと会社のコンテクストも、分けて扱います。"],
  ["company/", company, japaneseCompany, "会社情報", "会社情報 | Jin AI",
    "私たちの使命は、会社のAIを、その会社の資産にすることです。安全に、みんなで使えて、いつも最新の状態で。"],
  ["privacy/", privacy, japanesePrivacy, "プライバシーポリシー", "プライバシーポリシー | Jin AI",
    "jinai.md でお預かりする情報と、その使い方について。"],
  ["accessibility/", accessibility, japaneseAccessibility, "アクセシビリティ", "アクセシビリティ | Jin AI",
    "jinai.md のアクセシビリティの目標と、問題を見つけたときのご連絡先。"]
];
for (const [route, english, japanesePage, heading, title, description] of pagePairs) {
  check(japanesePage.includes("<html lang=\"ja\">") &&
    count(japanesePage, /<h1\b/g) === 1 &&
    japanesePage.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]*>/g, "") === heading &&
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
      !source.replace(/<script id="jin-language-choice">[\s\S]*?<\/script>/, "").includes("location.replace("),
    `${url} must be indexable and self-canonical, with only the home language-choice redirect allowed.`);
    const head = source.match(/<head>([\s\S]*?)<\/head>/)?.[1] || "";
    check(count(head, /\bhreflang=/g) === 3, `${url} needs exactly three hreflang alternates.`);
    for (const alternate of ["en", "ja", "x-default"]) {
      check(head.includes(`<link rel="alternate" hreflang="${alternate}" href="https://jinai.md/${alternate === "ja" ? "ja/" : ""}${route}">`),
        `${url} must have a reciprocal ${alternate} alternate.`);
    }
    for (const landmark of ["header", "footer"]) {
      const area = source.match(new RegExp(`<${landmark}\\b[^>]*>([\\s\\S]*?)<\\/${landmark}>`))?.[1] || "";
      if (landmark === "header") {
        check(!/language-switch|\bhreflang=|>EN<|>JA</.test(area),
          `${url} must not have a header language switch.`);
        continue;
      }
      if (language === "en") continue;
      const navigation = area.match(/<nav class="language-switch" aria-label="言語">([\s\S]*?)<\/nav>/)?.[1] || "";
      check(count(navigation, /<a\b/g) === 2 && count(navigation, /aria-current="page"/g) === 1,
        `${url} needs two language links and one current language in the ${landmark}.`);
      for (const target of ["en", "ja"]) {
        const label = target === "en" ? "English" : "日本語";
        check(navigation.includes(`<a href="/${target === "ja" ? "ja/" : ""}${route}" lang="${target}" hreflang="${target}"${target === language ? ' aria-current="page"' : ""} data-jin-lang="${target}">${label}</a>`),
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
  ["company/index.html", company]
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
    const imageAlt = page.startsWith("/ja/") ? "Jin AI: AIを、会社の資産に" : "Jin AI: Turn AI into a company asset";
    check(source.includes(`<meta ${attribute}="${name}" content="${imageAlt}">`),
      `${page} must use the approved ${name}.`);
  }
}
const shareImage = await readFile(path.join(site, "shots", "og-b2b.png"));
check(shareImage.length >= 24 && shareImage.length < 300000 &&
  shareImage.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
  shareImage.toString("ascii", 12, 16) === "IHDR" &&
  shareImage.readUInt32BE(16) === 1200 && shareImage.readUInt32BE(20) === 630,
  "The B2B share image must be a 1200 x 630 PNG below 300 KB.");
check(home.includes("<main>") && home.includes("</main>"), "Root must have a main landmark.");
const homeSections = [...home.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/g)];
check(homeSections.length === 6 && homeSections[0]?.[1].includes('class="hero"') &&
  homeSections.slice(1).map((match) => match[1].match(/\bid="([^"]+)"/)?.[1]).join() ===
  "problem,solution,how,data,demo", "Root must contain only hero, problem, solution, how, data and demo sections, in order.");
check(count(home, /<h1\b/g) === 1 &&
  home.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]*>/g, "") === "Turn AI into a company asset",
  "Root must use the approved H1 once.");
const homeTitle = "Jin AI | Turn AI into a company asset";
check(home.includes(`<title>${homeTitle}</title>`), "Root must use the approved title.");
for (const [attribute, name] of [["property", "og:title"], ["name", "twitter:title"]]) {
  check(home.includes(`<meta ${attribute}="${name}" content="${homeTitle}">`), `Root must use the approved ${name}.`);
}
const homeDescription = "Jin AI keeps the AI harnesses your best people build safe for every employee and reusable for the company.";
for (const [attribute, name] of [["name", "description"], ["property", "og:description"], ["name", "twitter:description"]]) {
  check(home.includes(`<meta ${attribute}="${name}" content="${homeDescription}">`), `Root must use the approved ${name}.`);
}
const hero = homeSections[0]?.[2] || "";
check(count(hero, /<p\b/g) === 1 && hero.includes('<p class="hero-intro">') &&
  !/<img\b|class="(?:eyebrow|lede|waitnote)"/.test(hero),
  "The hero must contain only the R7 intro paragraph, without a status tag, note or product image.");
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
const productFrame = home.match(/<figure class="demo-stage">([\s\S]*?)<\/figure>/)?.[1] || "";
const productAlt = "Jin AI employee workspace. Harness parts are sorted by category, and each part is marked Can move or Confidential.";
const stillTag = productFrame.match(/<img\b[^>]*>/)?.[0] || "";
check(stillTag === `<img src="assets/demo/demo-2-categories.webp" width="2880" height="1664" alt="${productAlt}" decoding="async" loading="eager" fetchpriority="high" elementtiming="hero-still">` &&
  productFrame.includes('class="hero-screen"') &&
  home.indexOf('class="demo-stage"') > home.indexOf("</section>") &&
  home.indexOf('class="demo-stage"') < home.indexOf('id="problem"'),
  "Root must retain the eager Categories fallback, exact alt and dimensions directly below the hero.");
const demoTemplate = productFrame.match(/<template id="hero-demo-template">([\s\S]*?)<\/template>/)?.[1] || "";
const demoIframe = demoTemplate.match(/<iframe\b[^>]*>/)?.[0] || "";
check(count(productFrame, /<iframe\b/g) === 1 && demoIframe.includes('src="assets/demo/app.html?embed=hero"') &&
  demoIframe.includes('title="Jin AI employee workspace demo"') &&
  demoIframe.includes('width="1440"') && demoIframe.includes('height="832"') &&
  demoIframe.includes('tabindex="-1"') && /\sinert(?:\s|>)/.test(demoIframe) &&
  demoIframe.includes('aria-hidden="true"') && demoIframe.includes('scrolling="no"') &&
  !/\bloading="lazy"/.test(demoIframe),
  "Root needs one non-lazy, inert, aria-hidden, untabbable native-size hero iframe in an unloaded template.");
const heroDemoScript = home.match(/<script id="jin-hero-demo">([\s\S]*?)<\/script>/)?.[1] || "";
check(heroDemoScript.includes('matchMedia("(prefers-reduced-motion: reduce)")') &&
  heroDemoScript.includes("if (!painted || reduced.matches || iframe) return;") &&
  heroDemoScript.includes("iframe?.remove()") && heroDemoScript.includes("new IntersectionObserver") &&
  heroDemoScript.includes('"visibilitychange"') && heroDemoScript.includes("!document.hidden") &&
  heroDemoScript.includes("new ResizeObserver") && heroDemoScript.includes("/ 1440") &&
  heroDemoScript.includes('event.source !== iframe.contentWindow') &&
  heroDemoScript.includes('event.origin !== location.origin') &&
  heroDemoScript.includes('event.data.action !== "ready"') &&
  heroDemoScript.includes("setTimeout(() => reveal(frame), 500)"),
  "Hero lifecycle must gate creation on still paint and reduced motion, scale, authenticate readiness and pause off screen or in a hidden tab.");
const demoApp = await text("assets/demo/app.html");
check(demoApp.includes('new URLSearchParams(location.search).get("embed") === "hero"') &&
  demoApp.includes(".hero-embed .controls,.hero-embed .progress,.hero-embed .stats{display:none!important}") &&
  demoApp.includes(".hero-embed .cursor{display:block!important;overflow:visible;filter:none;left:0;top:0;transition:transform .65s ease}") &&
  !/[^{}]*hero-embed[^{}]*\.cursor[^{}]*\{[^}]*display:\s*none/.test(demoApp) &&
  demoApp.includes(".hero-embed .tool-option:not(.chosen) .tool-ready{visibility:hidden}") &&
  demoApp.includes("document.body.inert = true"),
  "Demo copy must show the hero cursor while hiding controls/progress/stats, retaining chosen-only Ready labels and disabled interaction.");
const heroPhases = demoApp.match(/const phases = \[([\s\S]*?)\];/)?.[1] || "";
check(JSON.stringify([...heroPhases.matchAll(/scene: (\d+)/g)].map(match => Number(match[1]))) === "[0,0,0,1]" &&
  !/By role|What can move|go\([23]\)/.test(heroPhases) &&
  demoApp.includes("Math.min(heroEmbed?1:3,n)") &&
  demoApp.includes("const views=heroEmbed?[connectView,categoryView]:[connectView,categoryView,roleView,policyView]") &&
  demoApp.includes('const stepNames=heroEmbed?[\'Connect\',\'Categories\']') &&
  demoApp.includes('event.source !== parent || event.origin !== location.origin') &&
  demoApp.includes('event.data.action !== "pause" && event.data.action !== "play"') &&
  demoApp.includes("clearTimeout(timeout)") && demoApp.includes("animation.pause()"),
  "Hero demo must loop Connect then Categories only, prevent admin navigation, and authenticate pause/play for timers and animations.");
const heroTargets = [...heroPhases.matchAll(/target: '([^']+)'/g)].map(match => match[1]);
const heroDuration = [...heroPhases.matchAll(/duration: (\d+)/g)].reduce((sum, match) => sum + Number(match[1]), 0);
const heroSchedule = demoApp.match(/function schedule\(\) \{([\s\S]*?)\n  function updatePlayback/)?.[1] || "";
check(JSON.stringify(heroTargets) === JSON.stringify([
  '[data-step="0"]', '[data-connect-tool="ChatGPT"]', '[data-connect-tool="Claude Code"]', '[data-step="1"]'
]) && heroDuration >= 9200 && heroDuration <= 11200 &&
  demoApp.includes("const travel = 650;") &&
  heroSchedule.includes("move(phases[phase].target)") && heroSchedule.includes("click(phases[phase].target)") &&
  heroSchedule.includes("if (approaching)") && heroSchedule.includes("remaining = phases[phase].duration - travel") &&
  demoApp.includes("if(heroEmbed)el.onclick();else el.click()") &&
  demoApp.includes("s.height/$('stage').offsetHeight") &&
  demoApp.includes("if(!heroEmbed)el.scrollIntoView({block:'nearest'})") &&
  demoApp.includes("if(heroEmbed)$('cursor').style.transform=`translate(${x}px,${y}px)`") &&
  demoApp.includes('.hero-embed .cursor.click circle{animation:embed-click .35s ease-out}') &&
  demoApp.includes('addEventListener("animationend", () => $(\'cursor\').classList.remove("click"))') &&
  demoApp.includes('<circle cx="2" cy="2" r="14" style="opacity:0"/>'),
  "Hero must move then click every target without scrolling the parent or shifting cursor layout, show a pausable ring, use the actual stage height and keep its loop within one second of 10.2s.");
check(demoApp.includes('content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src \'self\' data:; base-uri \'none\'; form-action \'none\'"') &&
  !/<(?:script|img|link)\b[^>]*(?:src|href)=["']https?:\/\//i.test(demoApp),
  "Demo must prohibit off-site resources and network connections.");
check(count(home, /<img\b[^>]*src="assets\/demo\//g) === 1 &&
  !/demo-[134]-|admin console|screen-by-role|screen-what-can-move/.test(home),
  "Root must not show admin screens or any still beyond the Categories fallback.");
const problemMatch = homeSections.find((match) => match[1].includes('id="problem"'));
const problemSection = problemMatch?.[2] || "";
const problemCopy = [
  ["shadow", "Shadow AI", "Work context flows into personal AI tools, outside the company's control."],
  ["dependency", "Agents that depend on one person", "Agents, context and workflows live with whoever built them. When that person leaves, the agents stop and the successor starts over."],
  ["teams", "Skills stuck in one team", "One team finds what works. The rest of the company never sees it."]
];
const problemFigures = [...problemSection.matchAll(/<figure class="problem-column" data-problem="([^"]+)" data-state="idle"([^>]*)>([\s\S]*?)<\/figure>/g)];
check(problemSection.includes('<span class="mono-label">Problem</span>') &&
  problemSection.includes('<h2 class="h2">AI is everywhere now. Is it really set up to last?</h2>') &&
  !/Draft copy|\bdata-draft\b/.test((problemMatch?.[1] || "") + problemSection),
  "Problem must use the exact approved label and H2 without a Draft copy tag or data-draft.");
check(problemFigures.length === 3 && count(problemSection, /<svg\b/g) === 3 &&
  count(problemSection, /<h2\b/g) === 1 && count(problemSection, /<h3\b/g) === 3 &&
  count(problemSection, /<p\b/g) === 6,
  "Problem needs exactly three interactive isometric figures: Shadow AI, dependency and teams.");
for (const [index, [id, title, description]] of problemCopy.entries()) {
  const attributes = problemFigures[index]?.[2] || "";
  const body = problemFigures[index]?.[3] || "";
  const svg = body.match(/<svg\b[^>]*>/)?.[0] || "";
  const status = body.match(new RegExp(`<p class="problem-status" id="problem-${id}-status" aria-live="polite" aria-atomic="true"[^>]*>([^<]+)</p>`));
  check(problemFigures[index]?.[1] === id &&
    attributes.includes('tabindex="0"') && /\baria-label="Figure: [^"]+"/.test(attributes) &&
    !/Fig\.\s*0[123]|problem-action|data-action-|Reset/.test(body) &&
    [...body.matchAll(/<button\b[^>]*>/g)].every(([button]) => id === "teams" && button.includes('class="team-control"')) &&
    body.includes(`<figcaption><h3>${title}</h3><p>${description}</p></figcaption>`) &&
    svg.includes('viewBox="0 0 420 320"') && svg.includes('role="img"') &&
    svg.match(/\baria-label="([^"]*)"/)?.[1].trim() &&
    svg.match(/\bdata-label-idle="([^"]*)"/)?.[1].trim() &&
    (id === "teams" || (svg.match(/\bdata-label-playing="([^"]*)"/)?.[1].trim() &&
      svg.match(/\bdata-label-changed="([^"]*)"/)?.[1].trim())) &&
    status?.[1].trim() &&
    /\bdata-status-idle="[^"]+"/.test(status?.[0] || "") &&
    (id === "teams" || ["idle", "playing", "changed"].every(state => (status?.[0] || "").includes(`data-status-${state}="`))),
    `Problem figure ${index + 1} needs exact copy, a focusable named figure, no number/action/reset, shared SVG size, state descriptions and polite status.`);
}
const shadowFigure = problemFigures[0]?.[3] || "";
check(problemFigures[0]?.[2].includes('aria-label="Figure: company work flows into a personal AI"') &&
  ["shadow-company", "shadow-boundary", "shadow-employee iso-highlight", "shadow-ai", "shadow-ai-outline",
    "shadow-route", "shadow-warning-pulse", "shadow-warning", "shadow-document", "shadow-confidential"]
    .every(name => shadowFigure.includes(`class="${name}"`)) &&
  count(shadowFigure, /<path\b[^>]*\bd="[^"]+"/g) >= 20 &&
  shadowFigure.includes('data-status-changed="A confidential document left the company for a personal AI."') &&
  !shadowFigure.includes("R2 draws this") &&
  !/<button\b/.test(shadowFigure),
  "Shadow AI needs its exact accessible name, company boundary, employee and desk, separate AI, confidential document, dashed route, warning and completed live status.");
check(!/\b(?:sa-|ho-|ed-)|class="art"|animateMotion/.test(problemSection) &&
  !/sa-svg|ho-svg|ed-svg|ed-tiles|ed-arrows|pauseAnimations/.test(home),
  "English home must not retain the old shadow AI, handover or education illustrations or controller.");
const ownerFigure = problemFigures[1]?.[3] || "";
const ownerConnections = ownerFigure.slice(ownerFigure.indexOf('<g class="owner-links">'), ownerFigure.indexOf('<g transform="translate(90 80)">'));
check(count(ownerFigure, /class="owner-link"/g) === 4 &&
  count(ownerFigure, /class="owner-light"/g) === 4 &&
  count(ownerFigure, /class="owner-stop"/g) === 4 &&
  count(ownerConnections, /class="owner-stop"/g) === 4 &&
  ["M144 143 156 155M156 143 144 155", "M264 143 276 155M276 143 264 155",
    "M144 215.5 156 227.5M156 215.5 144 227.5", "M264 215.5 276 227.5M276 215.5 264 227.5"]
    .every(d => ownerConnections.includes(`d="${d}"`)),
  "Owner needs four grey connections, four accent lights and exactly four x marks centered on the lines, not on agents.");
const handoverFigure = problemFigures[1]?.[3] || "";
const rebuildLayers = [...handoverFigure.matchAll(/<g class="handover-rebuild" style="--step:(\d)" transform="translate\(280 (\d+)\)" data-layer="([^"]+)">([\s\S]*?)<\/text>/g)];
check(rebuildLayers.length === 4 && rebuildLayers.every((layer, index) =>
  layer[1] === String(index) && Number(layer[2]) === 220 - index * 36 &&
  layer[3] === ["context", "rules", "tools", "exceptions"][index] &&
  layer[4].includes('class="rebuild-trace" pathLength="1"') &&
  layer[4].includes('class="rebuild-outline" mask="url(#problem-rebuild-') &&
  layer[4].includes(`<text x="50" y="7">${["Context", "Rules", "Tools", "Exceptions"][index]}`)) &&
  count(handoverFigure, /<text\b/g) === 8 && !/<text\b[^>]*transform=/.test(handoverFigure) &&
  count(handoverFigure.match(/<g class="handover-layers">([\s\S]*?)<\/g>/)?.[1] || "", /<use\b/g) === 4 &&
  handoverFigure.includes('transform="translate(0 8) scale(.52)"') &&
  handoverFigure.includes('data-label-rebuilding="') && handoverFigure.includes('data-status-rebuilding="'),
  "Handover needs four masked dashed successor layers in Context/Rules/Tools/Exceptions build order, retained predecessor layers and eight horizontal leader labels.");
const teamFigure = problemFigures[2]?.[3] || "";
for (const team of ["a", "b", "c"]) {
  check(teamFigure.includes(`data-team-art="${team}"`) &&
    new RegExp(`<button\\b[^>]*class="team-control"[^>]*data-team="${team}"[^>]*aria-pressed="false"[^>]*data-label="[^"]+"[^>]*data-status="[^"]+"[^>]*><span class="problem-status">Open Team ${team.toUpperCase()}</span></button>`).test(teamFigure),
    `Team ${team.toUpperCase()} needs an independently focusable, named HTML button and translated-in-place state strings.`);
}
check(teamFigure.indexOf('class="team-controls"') > teamFigure.indexOf("</svg>") &&
  count(problemSection, /<text\b/g) === 8 &&
  ["Context", "Rules", "Tools", "Exceptions"].every(label =>
    problemSection.includes(`>${label}</text>`)) &&
  count(home, /<script type="module" src="problem.js"><\/script>/g) === 1,
  "Team controls must sit outside role=img; only the eight stack labels may be SVG text; home must load problem.js once.");
const problemClient = await text("problem.js");
check(problemClient.includes('matchMedia("(prefers-reduced-motion: reduce)")') &&
  problemClient.includes('querySelectorAll("[data-problem]")') &&
  problemClient.includes('figure.dataset.problem === "shadow" || figure.dataset.problem === "dependency"') &&
  problemClient.includes('figure.dataset.problem === "dependency"') &&
  problemClient.includes('event.animationName === "problem-handover"') &&
  problemClient.includes('describe("Rebuilding")') &&
  problemClient.includes("event.target.matches('[data-layer=\"exceptions\"] text')") &&
  problemClient.includes('querySelector(".shadow-document").addEventListener("animationend"') &&
  problemClient.includes('event.animationName === "problem-shadow-document" && figure.dataset.busy === "true"') &&
  problemClient.includes("new IntersectionObserver") && problemClient.includes('"visibilitychange"') &&
  problemClient.includes("!document.hidden") && problemClient.includes("visible.has(figure)") &&
  problemClient.includes('if (figure.dataset.busy === "true") return;') &&
  problemClient.includes("clearTimeout(timer)") &&
  problemClient.includes("cancelAnimationFrame(frame)") &&
  problemClient.includes('threshold: [0, .5]') && problemClient.includes("controller.reset()") &&
  problemClient.includes('figure.addEventListener("focus"') &&
  problemClient.includes('figure.addEventListener("pointerenter"') &&
  problemClient.includes('figure.addEventListener("click"') &&
  !problemClient.includes("later(end,") &&
  problemClient.includes('control.addEventListener("focus", select)') &&
  problemClient.includes('control.addEventListener("pointerenter"') &&
  problemClient.includes('control.addEventListener("click", select)'),
  "Problem sequences must play once at half-view, reset on exit, guard repeated focus/hover/tap input, finish within five seconds using animation completion and support reduced motion and flow pause.");
check(!home.includes("Turn the AI you already use into an assistant that actually knows you") &&
  !home.includes("plugin-screen.png") && !home.includes("privacy-tabs.mjs") &&
  !/<section\b[^>]*\bid="(?:what|benefits|privacy|waitlist)"/.test(home),
  "Root must not publish the old headline, product image, privacy tabs or retired sections.");
check(!/[\u2013\u2014\u2018\u2019\u201c\u201d]/u.test(home),
  "Root must not contain em dashes, en dashes or curly quotes.");
check(!/(?:\$|\bPro\b|Cloud Sync|Baby Voice|TikTok|\bsetup\b)/i.test(home),
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
check(JSON.stringify(sitemapUrls) === JSON.stringify(
  pagePairs.flatMap(([route]) => [`https://jinai.md/${route}`, `https://jinai.md/ja/${route}`]).sort()),
  "Sitemap must contain exactly the twelve English and Japanese content page URLs, without retired articles.");
check(!llms.includes(".md)"), "llms.txt must not link to Markdown mirrors.");
check(llms.startsWith("# Jin AI\n\n> "), "llms.txt must begin with an H1 and blockquote summary.");

const content = JSON.parse(contentJson);
check(content.product.name === "Jin AI", "Structured data product name is invalid.");
check(content.product.status === "building", "Structured data must state the Building status.");
check(home.includes(`<h2 class="h2">${content.problem.headline}</h2>`), "Root must use the approved problem heading.");
check(JSON.stringify(content.problem.points) === JSON.stringify(problemCopy.map(([, name, description]) => ({ name, description }))),
  "Problem facts must contain exactly the three approved Keep titles and bodies.");
for (const point of content.problem.points) {
  check(problemSection.includes(`<h3>${point.name}</h3>`) && problemSection.includes(`<p>${point.description}</p>`),
    `Root must use the approved ${point.name} copy.`);
}
const solutionSection = homeSections.find((match) => match[1].includes('id="solution"'))?.[2] || "";
const solutionCopy = [
  ["Keep it safe", "Confidential parts stay inside the company and connect only to the AI tools you approve."],
  ["Keep it in the company", "Agents, context and workflows stay with the role, not the person. A successor starts where the last person left off."],
  ["Keep it shared", "The best skills reach every team that does the same work."]
];
const solutionClosing = "As people improve their setups, Jin AI keeps the shared version up to date.";
function exactElement(source, tag, value) {
  return [...withoutJapanesePhrases(source).matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "g"))]
    .filter(([, inner]) => inner === value).length === 1;
}
check(exactElement(solutionSection, "h2", "How Jin AI keeps your AI") &&
  count(solutionSection, /<li>/g) === 3 && count(solutionSection, /<h3\b/g) === 3 &&
  count(solutionSection, /<p\b/g) === 4 &&
  solutionCopy.every(([title, body]) => exactElement(solutionSection, "h3", title) && exactElement(solutionSection, "p", body)) &&
  exactElement(solutionSection, "p", solutionClosing) &&
  !/<(?:img|svg)\b|class="(?:ph|eyebrow)"/.test(solutionSection),
  "Root Solution needs the exact Keep heading, three title/body pairs and closing line, each once.");
const howSection = homeSections.find((match) => match[1].includes('id="how"'))?.[2] || "";
const featureCopy = [
  ["connect", "Connect once", "一度つなぐだけ", "Connect your usual AI tools once, through MCP.", "MCPで、いつものAIツールに一度つなぐだけ。", "Connect in one click", "ワンクリックでつなぐ", "demo-1-connect.webp", "connect"],
  ["categories", "See every part by type", "種類ごとに見る", "Skills, prompts, memory and MCP settings, sorted by type.", "スキル・プロンプト・記憶・MCPの設定を、種類ごとに整理して見られる。", "See every part by type", "種類ごとに見る", "demo-2-categories.webp", "categories"],
  ["departments", "See what each team uses most", "部署ごとの使われ方を見る", "See which harnesses each department uses most.", "部署ごとに、何がいちばん使われているかが分かる。", "See what each team uses most", "部署ごとの使われ方", "demo-3-by-role.webp", "by-role"],
  ["classify", "Separate personal from company", "個人と会社を分ける", "Keep what came from personal AI apart from parts that hold confidential company context.", "個人のAIから持ってきたものと、会社の機密を含むものを分けて管理できる。", "Separate personal from company", "個人と会社を分ける", "demo-4-what-can-move.webp", "what-can-move"],
  ["tools", "Control approved AI tools", "承認したツールだけに", "Let people use only the tools you approve. For example: Claude Code for developers only, your company policy in Copilot, and only non-confidential parts in ChatGPT.", "承認したツールだけを使わせる。たとえば、Claude Codeは開発者だけ、Copilotには会社のポリシー、ChatGPTには機密を含まないものだけ。", "Control approved AI tools", "承認したツールだけに"]
];
check(content.solution.status === "building" && content.solution.headline === "How Jin AI keeps your AI" &&
  content.solution.closing === solutionClosing &&
  JSON.stringify(content.solution.steps) === JSON.stringify(solutionCopy.map(([name, description]) => ({ name, description }))) &&
  JSON.stringify(content.how_it_works?.features) === JSON.stringify(featureCopy.map(f => ({ name: f[1], description: f[3] }))),
  "Facts need the three Keep solutions, their closing line, unchanged five features and Building status.");
for (const [ja, page] of [[false, howPage], [true, japaneseHow]]) {
  const heading = ja ? "仕組み" : "How it works";
  const introduction = ja
    ? "一度つなぐだけ。すべてを種類ごとに見られて、チームで共有する設定はJin AIがいつも最新に保ちます。"
    : "Connect once, see every part, and Jin AI keeps each team's shared harness up to date.";
  const top = page.match(/<section class="hero how-hero">([\s\S]*?)<\/section>/)?.[1] || "";
  check(exactElement(top, "h1", heading) && exactElement(top, "p", introduction) &&
    count(top, /<p\b/g) === 1 && !top.includes("mono-label"),
    "How it works must show its heading once, followed by its exact Keep introduction.");
  if (!ja) check(content.how_it_works?.introduction === introduction, "How it works facts must match the approved introduction.");
}
const closingCopy = "Turn your team's AI into a company asset";
const japaneseClosingCopy = "御社のAIを、会社の資産に。";
for (const [ja, page, mission] of [
  [false, company, "Our mission is to turn every company's AI into an asset it owns: secure, shared, and always up to date."],
  [true, japaneseCompany, "私たちの使命は、会社のAIを、その会社の資産にすることです。安全に、みんなで使えて、いつも最新の状態で。"]
]) {
  const main = page.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1] || "";
  check(exactElement(main, "h1", ja ? "会社情報" : "Company") &&
    exactElement(main, "p", mission) && !main.includes('class="mono-label"') &&
    /<h1>[^<]+<\/h1>\s*<p class="article-lead">/.test(main),
    "Company must show one H1 directly followed by the exact R8 mission, without a repeated label.");
}
for (const [page, paragraph] of [
  [privacy, "When you request a demo, we collect the details you type into the form: your work email, first and last name, job title, phone number, company, industry, company size and country. We use your phone number only to arrange your demo. We also record the time of your request and whether our reply email was sent."],
  [japanesePrivacy, "デモをお申し込みいただくとき、フォームに入力された情報をお預かりします。会社のメールアドレス、姓名、役職、電話番号、会社名、業種、従業員数、国です。電話番号は、デモの日程調整のためだけに使います。あわせて、お申し込みの日時と、こちらからの返信メールを送れたかどうかを記録します。"]
]) {
  check(exactElement(page, "p", paragraph),
    "Privacy must state the required phone collection and demo-only purpose immediately after the collection sentence.");
}
for (const [ja, page] of [[false, home], [true, japanese], [false, howPage], [true, japaneseHow]]) {
  const closing = page.match(/<section class="(?:demo|closing-cta)"[^>]*>([\s\S]*?)<\/section>/)?.[1] || "";
  check(exactElement(closing, "h2", ja ? japaneseClosingCopy : closingCopy),
    "Both home and companion closing headings must match the approved Keep copy exactly once.");
}
for (const [ja, source, homeSource] of [[false, howPage, home], [true, japaneseHow, japanese]]) {
  const label = ja ? "Japanese" : "English";
  const blocks = [...source.matchAll(/<section class="section workflow" id="(employee|admin)" aria-labelledby="([^"]+)">([\s\S]*?)<\/section>/g)];
  const excerpt = homeSource.match(/<section class="section" id="how">([\s\S]*?)<\/section>/)?.[1] || "";
  check(blocks.length === 2 && blocks.map(b => b[1]).join() === "employee,admin" &&
    blocks.every((b, index) => b[3].includes(`<h2 class="how-audience" id="${b[1]}-heading">${ja ? ["社員", "管理者"][index] : ["Employees", "Admins"][index]}</h2>`) &&
      count(b[3], /class="feature-row"/g) === [2, 3][index]) &&
    !/harness-steps|section-head split|<ol\b|>0[1-4]</.test(source),
    `${label} How it works needs five unnumbered feature rows in Employees then Admins blocks, without split columns.`);
  const rows = [...source.matchAll(/<li class="feature-row" data-demo-scene="([^"]+)" data-demo-src="([^"]*)">([\s\S]*?)<\/li>/g)];
  check(rows.length === 5 && count(source, /<figure class="demo-stage">/g) === 4 &&
    count(source, /<figure class="demo-stage" hidden>/g) === 1,
    `${label} How it works needs four visible demo stages and one hidden tools stage.`);
  featureCopy.forEach((f, index) => {
    const row = rows[index];
    const body = withoutJapanesePhrases(row?.[3] || "");
    const title = f[ja ? 2 : 1], description = f[ja ? 4 : 3], caption = f[ja ? 6 : 5];
    const embedUrl = `/assets/demo/app-v2.html?scene=${f[0]}&amp;embed=1&amp;loop=1`;
    const camera = body.match(/<div class="screen-camera [^"]+">([\s\S]*?)<\/div>/)?.[1] || "";
    const cursor = '<svg class="workflow-cursor" aria-hidden="true" viewBox="0 0 24 32"><circle cx="2" cy="2" r="14"/><path d="M2 2L2 26L8 20L13 30L18 28L13 18L22 18Z"/></svg>';
    check(row?.[1] === f[0] && (row?.[2] === "" || row?.[2] === embedUrl) &&
      body.includes(`<div class="feature-copy"><h3>${title}</h3><p>${description}</p></div>`) &&
      body.includes(`<figcaption class="screen-caption">${caption}</figcaption>`) &&
      body.includes(`<div class="screen${index === 4 ? " screen-placeholder" : ""}" role="img" aria-label="${caption}">`) &&
      body.includes('<div class="demo-window moving-frame">') &&
      body.includes(`<figure class="demo-stage"${index === 4 ? " hidden" : ""}>`) &&
      count(body, /<figure\b/g) === 1 &&
      (index < 4
        ? body.includes(`<img class="screen-${f[8]}" src="/assets/demo/${f[7]}" width="2880" height="1664" alt="" decoding="async" loading="lazy">`) &&
          count(body, /<img\b/g) === 1 && !/<iframe\b/.test(body)
        : body.includes('<span class="placeholder-mark" aria-hidden="true"></span>') && !/<(?:img|iframe|svg)\b/.test(body)),
      `${label} ${f[0]} needs its exact title, description, caption, named screen and single still or empty tools placeholder.`);
    check(index < 4
      ? body.includes(`<div class="screen-camera screen-${f[8]}">`) &&
        count(body, /class="screen-camera /g) === 1 && count(body, /class="workflow-cursor"/g) === 1 &&
        count(body, /<svg\b/g) === 1 && camera.includes(cursor) && /<img\b[^>]*>\s*<svg/.test(camera)
      : !/screen-camera|workflow-cursor/.test(body),
      `${label} ${f[0]} must keep one decorative arrow and click ring inside its still's transformed camera layer, with none in the hidden tools stage.`);
  });
  check(excerpt.includes('<div class="how-excerpt">') && count(excerpt, /class="how-audience"/g) === 2 &&
    count(excerpt, /class="feature-titles"/g) === 2 &&
    excerpt.includes(`class="how-audience">${ja ? "社員" : "Employees"}</h3>`) &&
    excerpt.includes(`class="how-audience">${ja ? "管理者" : "Admins"}</h3>`) &&
    JSON.stringify([...excerpt.matchAll(/<li>([^<]+)<\/li>/g)].map(m => m[1])) === JSON.stringify(featureCopy.map(f => f[ja ? 2 : 1])) &&
    !/<(?:img|figure|ol|h4)\b|harness-definition|mono-label/.test(excerpt) &&
    excerpt.includes(`>${ja ? "仕組みを見る" : "How it works"} &rarr;</a>`),
    `${label} home excerpt must contain only the heading, two stacked audience labels, five feature titles and link.`);
  const definition = ja
    ? "AI ハーネスとは、AI エージェントを役割に合わせて働かせるための、指示・スキル・記憶・接続ツールの一式です。"
    : content.product.harness_definition;
  check(source.includes(`<aside class="harness-note wrap" id="harness">\n  <p>${definition}</p>\n</aside>`) &&
    source.indexOf('id="harness"') > source.indexOf('class="closing-cta"') &&
    count(source, new RegExp(definition.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) === 1 &&
    count(source, /<script type="module" src="\/workflow.js"><\/script>/g) === 1,
    `${label} How it works must end with the single approved harness definition and shared screen controller.`);
}
for (const [source, target] of [[harness, "/how-it-works/#harness"], [japaneseHarness, "/ja/how-it-works/#harness"]]) {
  check(source.includes(`<meta http-equiv="refresh" content="0; url=${target}">`) &&
    source.includes(`<link rel="canonical" href="https://jinai.md${target}">`) &&
    source.includes('<meta name="robots" content="noindex,follow">') &&
    source.includes(`<a href="${target}">`) && !/<(?:main|header|footer|script)\b|\bhreflang=/.test(source) &&
    source.length < 700,
    "Retired harness routes must be tiny noindex compatibility redirects to the matching #harness note.");
}
for (const [file, source] of [...englishPages, ...pagePairs.map(([route, , source]) => ["ja/" + route, source]), ["agent/", agent]]) {
  check(!source.includes("resources/ai-harness/"),
    `${file} must not link or advertise hreflang to a retired harness article.`);
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
check(howPage.includes(`<h2 class="h2">${content.data_principles.headline}</h2>`) &&
  content.data_principles.items.every((item) => howPage.includes(`<li>${item}</li>`)) &&
  howPage.includes('<a class="btn btn-p" href="../#demo">Request a demo</a>'),
  "The companion page must include all data promises and the demo CTA.");
check(!/plugin-screen\.png|personal MCP|your own memory|#waitlist|Join &rarr;/.test(howPage),
  "The companion page must not publish the retired consumer copy or CTA.");
const closingBand = howPage.match(/<section class="closing-cta" aria-labelledby="closing-heading">([\s\S]*?)<\/section>/)?.[1] || "";
check(closingBand.includes('<div class="wrap">') &&
  closingBand.includes(`<h2 id="closing-heading">${closingCopy}</h2>`) &&
  count(closingBand, /<(?:a|button)\b/g) === 1 &&
  closingBand.includes('<a class="btn btn-p" href="../#demo">Request a demo</a>') &&
  count(howPage, /class="closing-cta"/g) === 1 &&
  howPage.indexOf('class="closing-cta"') > howPage.indexOf('id="data"'),
  "How it works must end with the closing band and exactly one primary demo button.");
check(howPage.includes('<a class="text-link read-more" href="../security/">Security &amp; data &rarr;</a>'),
  "The companion promise band must link to Security & data.");

const securityTitle = "Security &amp; data | Jin AI";
const securityDescription = "How Jin AI keeps each company's context separate, and what it does not do.";
check(security.includes('<html lang="en">') &&
  security.includes(`<title>${securityTitle}</title>`) &&
  count(security, /<h1\b/g) === 1 &&
  security.includes(`<h1>${content.data_principles.headline}</h1>`) &&
  security.includes('<p class="mono-label">Security</p>') &&
  security.includes('<main>'),
  "Security must have its approved title, English language, H1, label and main.");
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
  ["property", "og:image:alt", "Jin AI: Turn AI into a company asset"],
  ["name", "twitter:image:alt", "Jin AI: Turn AI into a company asset"]
]) {
  check(security.includes(`<meta ${attribute}="${name}" content="${value}">`),
    `Security must have the approved ${name}.`);
}
const securityHead = security.match(/<head>([\s\S]*?)<\/head>/)?.[1] || "";
check(count(securityHead, /\bhreflang=/g) === 3, "Security needs exactly three hreflang alternates.");
for (const alternate of ["en", "ja", "x-default"]) {
  check(securityHead.includes(`<link rel="alternate" hreflang="${alternate}" href="https://jinai.md/${alternate === "ja" ? "ja/" : ""}security/">`),
    `Security must have the ${alternate} alternate.`);
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
check(securityContact.includes(`<p>Questions about security? Email ${emailComponent()}, or request a demo.</p>`) &&
  securityContact.includes('<a class="btn btn-p" href="../#demo">Request a demo</a>') &&
  count(securityContact, /class="btn /g) === 1 && !/closing-cta/.test(security),
  "Security must use its separate wide contact band, not the How it works closing band.");

function normalizedLandmark(source, landmark, baseUrl) {
  return (source.match(new RegExp(`<${landmark}>([\\s\\S]*?)<\\/${landmark}>`))?.[1] || "")
    .replace(/<nav class="language-switch" aria-label="(?:Language|言語)">[\s\S]*?<\/nav>/g, "LANGUAGE_SWITCH")
    .replace(/ aria-current="page"| data-pending-page="D2"/g, "")
    .replace(/\b(href|src)="([^"]+)"/g, (_, attribute, url) => `${attribute}="${new URL(url, baseUrl).href}"`)
    .replace(/\s+/g, " ").trim();
}
for (const [route, source] of [
  ["how-it-works", howPage], ["security", security], ["privacy", privacy], ["accessibility", accessibility],
  ["company", company]
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
    ["Product", "product-panel", productLinks]
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
    JSON.stringify(["Product", "Security", "Company", "Contact"]) &&
    [["Security", "/security/"], ["Company", "/company/"], ["Contact", "/#demo"]].every(([label, href]) =>
      nav.includes(`<a href="${href}">${label}</a>`)),
    `/${route} needs Product, Security, Company and Contact in that order, with no Resources menu.`);
  check(!/\brole="(?:menu|menuitem)"/.test(header) && !header.includes("Draft copy"),
    `/${route} panels must be plain link lists without draft tags or ARIA menu roles.`);
  const columns = [...footer.matchAll(/<div class="footer-column"><h2>([^<]+)<\/h2>([\s\S]*?)<\/div>/g)];
  const expectedColumns = [
    ["Product", productLinks], ["Legal", resourceLinks],
    ["Company", [["Company", "/company/"], ["Contact", "/#demo"]]],
    ["Connect", [["Discord", communityUrl]]]
  ];
  check(columns.length === 4 && expectedColumns.every(([label, links], index) =>
    columns[index]?.[1] === label &&
    JSON.stringify([...columns[index][2].matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map(match => [match[2], match[1]])) ===
      JSON.stringify(links.map(([title, href]) => [title, href]))),
    `/${route} needs the complete Product, Legal, Company and Connect footer columns.`);
  check(footer.includes("Visits are counted with Cloudflare Web Analytics. No cookies.") &&
    footer.includes("&copy; 2026 Jin AI") &&
    footer.includes('<nav class="language-switch" aria-label="Language"><a href="/" lang="en" hreflang="en" aria-current="page" data-jin-lang="en">English</a> / <a href="/ja/" lang="ja" hreflang="ja" data-jin-lang="ja">日本語</a></nav>'),
    `/${route} needs the analytics, copyright and root English/Japanese footer links.`);
  check(source.includes('<script type="module" src="/nav.js"></script>'),
    `/${route} must load the shared navigation script.`);
}

const homeHead = home.match(/<head>([\s\S]*?)<\/head>/)?.[1] || "";
const languageScriptTag = '<script id="jin-language-choice">';
check(count(home, /<script id="jin-language-choice">/g) === 1 &&
  homeHead.includes(languageScriptTag) &&
  homeHead.indexOf(languageScriptTag) < homeHead.search(/<link\b[^>]*rel="stylesheet"/) &&
  homeHead.includes('if (location.pathname !== "/") return;') &&
  homeHead.includes('localStorage.getItem("jin-lang")') &&
  homeHead.includes('navigator.languages?.[0] || navigator.language') &&
  homeHead.includes('location.replace("/ja/" + location.search + location.hash)') &&
  homeHead.includes("google-inspectiontool|headless") &&
  homeHead.includes('sessionStorage.getItem("jin-lang")') &&
  homeHead.includes('query.has("jin-lang")'),
  "Only the English home must choose a first-visit language before styles, with bot and storage-failure guards.");
const languageClient = await text("language.js");
check(languageClient.includes('footer .language-switch a[data-jin-lang]') &&
  languageClient.includes('localStorage.setItem("jin-lang", language)') &&
  languageClient.includes('sessionStorage.setItem("jin-lang", language)') &&
  languageClient.includes('target.searchParams.set("jin-lang", language)'),
  "The shared footer handler must remember choices with local, session and query fallback.");
for (const [relativePath, source] of [
  ...englishPages.map(([route, source]) => [`${route}index.html`, source]),
  ...pagePairs.map(([route, , source]) => [`ja/${route}index.html`, source]),
  ["agent/index.html", agent], ["en/index.html", englishAlias], ["human/index.html", humanAlias]
]) {
  check(count(source, /<script src="\/language\.js" defer><\/script>/g) === 1,
    `${relativePath} must include the shared footer-language handler once.`);
  check(count(source, /<script src="\/copy\.js" defer><\/script>/g) === 1,
    `${relativePath} must include the shared copy-email handler once.`);
  if (relativePath !== "index.html") {
    check(!source.includes(languageScriptTag),
      `${relativePath} must not auto-select or redirect the visitor's language.`);
  }
  const footer = source.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/)?.[1] || "";
  const links = [...footer.matchAll(/<a\b[^>]*\bhreflang="(en|ja)"[^>]*>/g)];
  check(links.every(([tag, language]) => tag.includes(`data-jin-lang="${language}"`)),
    `${relativePath} footer language links must carry the shared choice handler.`);
}

const draftPages = [
  ["company/", company, "Company", "Company",
    "Our mission is to turn every company's AI into an asset it owns: secure, shared, and always up to date.",
    "Company Our mission is to turn every company's AI into an asset it owns: secure, shared, and always up to date. Where we are Jin AI is an early-stage company. We build in close contact with the teams we talk to. Contact hello@jinai.md Community: Discord Request a demo"]
];
for (const [route, source, title, heading, description, expectedCopy] of draftPages) {
  const main = source.match(/<main\b([^>]*)>([\s\S]*?)<\/main>/);
  const visible = (main?.[2] || "").replace(/<button type="button" class="copy-email"[^>]*>[^<]*<\/button>/g, "")
    .replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  check(source.includes('<html lang="en">') && source.includes(`<title>${title} | Jin AI</title>`) &&
    count(source, /<h1\b/g) === 1 && source.includes(`<h1>${heading}</h1>`) &&
    main?.[1].includes("draft-article") &&
    !(main?.[2] || "").includes('class="mono-label"'),
    `/${route} needs its English title, exact H1 and article layout.`);
  check(visible === expectedCopy && !/\d|\b(?:founder|investor|team photos)\b/i.test(visible) &&
    !/<img\b/.test(main?.[2] || ""),
    `/${route} must contain only the supplied draft copy, with no founders, numbers or photos.`);
  check(count(source, /<link\b[^>]*rel="canonical"/g) === 1 &&
    source.includes(`<link rel="canonical" href="https://jinai.md/${route}">`),
    `/${route} must have one self-canonical.`);
  const head = source.match(/<head>([\s\S]*?)<\/head>/)?.[1] || "";
  check(count(head, /\bhreflang=/g) === 3 && ["en", "ja", "x-default"].every(language =>
    head.includes(`<link rel="alternate" hreflang="${language}" href="https://jinai.md/${language === "ja" ? "ja/" : ""}${route}">`)),
    `/${route} needs en, ja and x-default alternates.`);
  for (const [attribute, name, value] of [
    ["property", "og:type", "website"], ["property", "og:site_name", "Jin AI"],
    ["property", "og:title", `${title} | Jin AI`], ["name", "twitter:title", `${title} | Jin AI`],
    ["name", "description", description], ["property", "og:description", description],
    ["name", "twitter:description", description], ["property", "og:url", `https://jinai.md/${route}`],
    ["property", "og:image", "https://jinai.md/shots/og-b2b.png"],
    ["name", "twitter:image", "https://jinai.md/shots/og-b2b.png"],
    ["property", "og:image:width", "1200"], ["property", "og:image:height", "630"],
    ["property", "og:image:alt", "Jin AI: Turn AI into a company asset"],
    ["name", "twitter:image:alt", "Jin AI: Turn AI into a company asset"],
    ["name", "twitter:card", "summary_large_image"]
  ]) {
    check(source.includes(`<meta ${attribute}="${name}" content="${value}">`),
      `/${route} must have the approved ${name}.`);
  }
  check(source.includes('<meta name="robots" content="index,follow,max-image-preview:large">'),
    `/${route} must remain indexable.`);
}
check(company.includes(emailComponent()) &&
  company.includes('<a class="btn btn-p" href="/#demo">Request a demo</a>'),
  "Company must show its copyable email and link to the home demo.");

const baseCss = await text("base.css");
const englishCss = await text("theme-en.css");
const paperCss = await text("site.css");
const copyClient = await text("copy.js");
check(copyClient.includes("navigator.clipboard.writeText(button.dataset.copy)") &&
  copyClient.includes('status.setAttribute("aria-live", "polite")') &&
  copyClient.includes('status.setAttribute("aria-atomic", "true")') &&
  copyClient.includes("clearTimeout(timer)") && copyClient.includes("currentAttempt !== attempt") &&
  copyClient.includes("1500") && copyClient.includes("range.selectNodeContents(address)") &&
  copyClient.includes("selection.addRange(range)") && copyClient.includes("Press Ctrl+C to copy") &&
  copyClient.includes('document.documentElement.classList.add("copy-ready")'),
  "Email copying must announce results, safely reset repeated-click feedback and select the address on clipboard failure.");
check(englishCss.includes(".copy-email { visibility: hidden;") &&
  englishCss.includes(".copy-ready .copy-email { visibility: visible; }") &&
  englishCss.includes(".email-address { white-space: nowrap; user-select: text; }") &&
  englishCss.includes(".copy-email:focus-visible { outline: 2px solid var(--accent-light);") &&
  englishCss.includes("min-height: 24px") && englishCss.includes(".copy-email { min-height: 44px; }") &&
  englishCss.includes(".copy-status { position: absolute;") &&
  englishCss.includes(".how-audience { font: 550 24px/1.3 var(--font-sans); letter-spacing: 0; color: var(--text-1);"),
  "Copy controls must be hidden without JS, selectable, focusable, touch-sized and layout-stable; audience labels must be 24px/550.");
const workflowClient = await text("workflow.js");
check(workflowClient.includes('matchMedia("(prefers-reduced-motion: reduce)")') &&
  workflowClient.includes("slot.visible && !document.hidden && !reduced.matches") &&
  workflowClient.includes("animation.currentTime = 0") &&
  workflowClient.includes('document.addEventListener("visibilitychange"') &&
  workflowClient.includes('rootMargin: "240px"') &&
  workflowClient.includes("slot.near && !document.hidden && !reduced.matches && !slot.frame") &&
  workflowClient.includes("frame.inert = true") && workflowClient.includes("frame.tabIndex = -1") &&
  workflowClient.includes('frame.setAttribute("aria-hidden", "true")') &&
  workflowClient.includes("event.origin !== location.origin") &&
  workflowClient.includes("slot.frame?.contentWindow === event.source") &&
  workflowClient.includes('url.pathname !== "/assets/demo/app-v2.html"') &&
  workflowClient.includes('url.searchParams.get("scene") !== slot.row.dataset.demoScene') &&
  workflowClient.includes('action: running ? "play" : "pause"') &&
  workflowClient.includes("slot.frame.remove()") && workflowClient.includes("new ResizeObserver") &&
  workflowClient.includes("slot.screen.getBoundingClientRect().width / 1440") &&
  workflowClient.includes('console.error("The workflow demo could not be loaded. Keeping the still image."'),
  "Workflow slots must lazy-create inert same-origin scene embeds, authenticate playback, pause/reset offscreen, retain stills under reduced motion and report load errors.");
function cssBlock(source, header) {
  const start = source.indexOf(header);
  if (start < 0) return "";
  const opening = source.indexOf("{", start);
  let depth = 1;
  let end = opening + 1;
  while (depth && end < source.length) {
    if (source[end] === "{") depth++;
    if (source[end] === "}") depth--;
    end++;
  }
  return depth === 0 ? source.slice(opening + 1, end - 1) : "";
}
const stageCss = cssBlock(englishCss, ".demo-stage");
const windowCss = cssBlock(englishCss, ".demo-window");
check(cssBlock(englishCss, "html {").includes("scrollbar-gutter: stable"),
  "Reserve the scrollbar gutter before first paint so the Keep introduction cannot gain a line as the remaining page parses.");
check(cssBlock(englishCss, ".feature-row {").includes("grid-template-columns: minmax(0, 1fr) minmax(0, 2fr)") &&
  cssBlock(englishCss, ".feature-row:has(> .demo-stage[hidden])").includes("grid-template-columns: 1fr") &&
  cssBlock(englishCss, "@media (max-width: 1023px)").includes(".feature-row { grid-template-columns: 1fr;") &&
  cssBlock(englishCss, ".feature-row .demo-stage").includes("width: 100%") &&
  cssBlock(englishCss, ".screen-caption").includes("font: var(--t-label)") &&
  cssBlock(englishCss, ".email-contact").includes("justify-content: flex-start") &&
  cssBlock(englishCss, ".footer-column .copy-email").includes("justify-content: flex-start") &&
  !englishCss.includes("screen-crossfade") &&
  cssBlock(englishCss, "@media (prefers-reduced-motion: reduce)").includes(".moving-frame .screen img { animation: none; transform: none;"),
  "R3 rows need responsive text-first layout, label captions, left-aligned email wrapping and independent reduced-motion stills.");
check(cssBlock(englishCss, ".screen-camera {").includes("animation-duration: 9s") &&
  cssBlock(englishCss, ".screen-camera {").includes("animation-play-state: paused") &&
  cssBlock(englishCss, ".screen-running .screen-camera").includes("animation-play-state: running") &&
  cssBlock(englishCss, ".workflow-cursor {").includes("display: none") &&
  cssBlock(englishCss, ".workflow-cursor {").includes("left: var(--cursor-x); top: var(--cursor-y)") &&
  cssBlock(englishCss, ".workflow-cursor {").includes("workflow-pointer 9s ease-in-out infinite paused") &&
  cssBlock(englishCss, ".workflow-cursor circle").includes("workflow-click 9s linear infinite paused") &&
  cssBlock(englishCss, ".screen-running .workflow-cursor {").includes("animation-play-state: running") &&
  cssBlock(englishCss, ".screen-running .workflow-cursor circle").includes("animation-play-state: running") &&
  cssBlock(englishCss, ".workflow-demo-ready .workflow-cursor").includes("display: none") &&
  ["connect", "categories", "by-role", "what-can-move"].every(scene =>
    /--cursor-x: [\d.]+%; --cursor-y: [\d.]+%/.test(cssBlock(englishCss, `.screen-camera.screen-${scene}`))) &&
  cssBlock(englishCss, "@media (prefers-reduced-motion: reduce)").includes(
    ".moving-frame .screen-camera { animation: none; transform: none; will-change: auto; }") &&
  cssBlock(englishCss, "@media (prefers-reduced-motion: reduce)").includes(
    ".moving-frame .workflow-cursor { display: none; animation: none; }") &&
  ["workflow-pointer", "workflow-pointer-connect", "workflow-click", "workflow-click-connect"].every(name =>
    englishCss.includes(`@keyframes ${name} {`)),
  "Workflow cursors must share the nine-second camera lifecycle, use still-relative targets, yield to future frames and disappear under reduced motion.");
check(cssBlock(englishCss, ".shadow-route {").includes("stroke-dasharray: 4 6") &&
  cssBlock(englishCss, '[data-state="changed"] .shadow-document').includes("animation: problem-shadow-document 3s linear both") &&
  cssBlock(englishCss, "@keyframes problem-shadow-document").includes("transform: translate(164px, 82px)") &&
  ["route", "warning", "pulse", "outline"].every(name => englishCss.includes(`@keyframes problem-shadow-${name}`)) &&
  /shadow-ai-outline \{ animation-play-state: paused; \}/.test(englishCss) &&
  /shadow-ai-outline \{ animation-play-state: running; \}/.test(englishCss) &&
  !/[^{}]*shadow[^{}]*\{[^}]*\binfinite\b/.test(englishCss) &&
  ['[data-problem="shadow"] .shadow-document { transform: translate(164px, 82px);',
    '[data-problem="shadow"] .shadow-route { opacity: .65;',
    '[data-problem="shadow"] .shadow-warning { opacity: 1;',
    '[data-problem="shadow"] .shadow-ai-outline { opacity: .6;']
    .every(rule => cssBlock(englishCss, "@media (prefers-reduced-motion: reduce)").includes(rule)),
  "Shadow AI needs a single three-second sequence, dashed path, boundary warning/pulse, faint AI outline, visibility pause and CSS reduced-motion end state.");
check(cssBlock(englishCss, ".problem-art svg").includes("aspect-ratio: 420 / 320") &&
  cssBlock(englishCss, ".owner-person").includes("stroke: var(--accent-light)") &&
  cssBlock(englishCss, ".owner-light").includes("fill: var(--accent-light)") &&
  cssBlock(englishCss, '[data-problem="dependency"] .problem-art *').includes("animation-play-state: paused") &&
  cssBlock(englishCss, '[data-problem="dependency"].problem-flow-running .problem-art *').includes("animation-play-state: running") &&
  !/infinite/.test(englishCss.slice(englishCss.indexOf(".owner-person"), englishCss.indexOf(".team-lid"))) &&
  cssBlock(englishCss, '[data-state="changed"] .handover-output').includes("1.7s both") &&
  cssBlock(englishCss, '[data-state="changed"] .handover-rebuild text').includes("2.86s + var(--step) * .5s") &&
  cssBlock(englishCss, "@media (min-width: 1024px)").includes(".problem-grid, .solution-copy { grid-template-columns: repeat(3, minmax(0, 1fr)); }") &&
  cssBlock(englishCss, ".problem-art .handover-labels text,").includes("font-size: 16px") &&
  cssBlock(englishCss, ".rebuild-outline").includes("stroke-dasharray: 4 4") &&
  cssBlock(englishCss, "@keyframes problem-draw").includes("stroke-dashoffset: 1") &&
  cssBlock(englishCss, "#problem .problem-column:focus-visible").includes("outline: 2px solid var(--accent-light)") &&
  cssBlock(englishCss, "@media (prefers-reduced-motion: reduce)").includes(
    ".problem-art * { animation: none !important; transition: none !important; }") &&
  ['[data-problem="dependency"] .owner-stop { opacity: 1;', '[data-problem="dependency"] .owner-agent { opacity: .24;',
    '[data-problem="dependency"] .rebuild-trace { stroke-dashoffset: 0;',
    '[data-problem="dependency"] .handover-rebuild,', '[data-team-art="c"] .team-workflow { opacity: 1;']
    .every(rule => cssBlock(englishCss, "@media (prefers-reduced-motion: reduce)").includes(rule)),
  "Problem figures need reserved geometry, idle accent owner/lights, real dashed-outline drawing, visible keyboard focus, paused flow and CSS reduced-motion end states.");
check(stageCss.includes("padding: var(--s-12)") && stageCss.includes("border: var(--border)") &&
  stageCss.includes("border-radius: 24px") && stageCss.includes("background: var(--surface-1)") &&
  windowCss.includes("overflow: hidden") && windowCss.includes("border-radius: var(--r-xl)") &&
  windowCss.includes("box-shadow: var(--shadow-float)") &&
  cssBlock(englishCss, "@media (max-width: 767px)").includes(
    ".demo-stage { width: calc(100% - 48px); padding: var(--s-4); }") &&
  !/product-frame|mask-image|--glow|\.demo-(?:stage|window)::(?:before|after)/.test(englishCss) &&
  cssBlock(englishCss, ".hero-screen").includes("aspect-ratio: 2880 / 1664") &&
  cssBlock(englishCss, ".screen {").includes("aspect-ratio: 2880 / 1664") &&
  heroDemoScript.includes("screen.clientWidth / 1440") &&
  heroDemoScript.includes("}).observe(screen)"),
  "Demo stages must share responsive padding, outline, surface and floating windows without a fade, glow or extra chrome; screen ratios and inner-screen scaling must remain.");
const paintScript = home.match(/<head>[\s\S]*?<script id="jin-page-paint">([\s\S]*?)<\/script>/)?.[1] || "";
check(paintScript.includes('document.documentElement.classList.add("js-nav")') &&
  /if\s*\(!matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches\)\s*document\.documentElement\.classList\.add\("js-reveal"\)/.test(paintScript),
  "Home reveal must opt in through a reduced-motion-guarded inline head script.");
const revealHeading = home.match(/<h1 class="hero-reveal">([\s\S]*?)<\/h1>/)?.[1] || "";
check(count(revealHeading, /<span style="--word:[0-5]">[^<]+<\/span>/g) === 6 &&
  !/aria-hidden|aria-label/.test(revealHeading) &&
  [...revealHeading.matchAll(/--word:(\d)/g)].map(match => match[1]).join("") === "012345" &&
  [...revealHeading.matchAll(/<span[^>]*>([^<]+)<\/span>/g)].map(match => match[1]).join(" ") === "Turn AI into a company asset",
  "Home H1 must contain six ordered readable word spans with its exact accessible name.");
const revealCss = cssBlock(englishCss, "@media (prefers-reduced-motion: no-preference)");
check(cssBlock(englishCss, ".hero-intro {").includes("max-width: 720px"),
  "The hero body must use a font-independent line measure so font swapping cannot change its line count on tablets.");
check(cssBlock(englishCss, "@media (max-width: 400px)").includes(
  "html:lang(en) .hero-reveal + .hero-intro { min-height: 3lh; }"),
  "Reserve the English phone hero's existing three-line intro height during font loading without changing Japanese or larger layouts.");
check(revealCss.includes(".js-reveal .hero-reveal > span") &&
  revealCss.includes(".js-reveal .hero-badges, .js-reveal .hero-actions") &&
  cssBlock(revealCss, ".js-reveal .hero-intro {").includes("hero-actions-in .2s var(--ease) .72s both") &&
  cssBlock(revealCss, ".js-reveal .hero-badges, .js-reveal .hero-actions").includes("hero-actions-in .25s var(--ease) .92s both") &&
  /animation:\s*hero-word-in[^;]*var\(--ease\)/.test(revealCss) &&
  /animation:\s*hero-actions-in[^;]*var\(--ease\)/.test(revealCss) &&
  /opacity:\s*\.001/.test(revealCss) && /filter:\s*blur\(8px\)/.test(revealCss) &&
  /transform:\s*translateY\(\.3em\)/.test(revealCss) &&
  cssBlock(englishCss, "@media (prefers-reduced-motion: reduce)").includes(
    ".hero-reveal > span, .hero-intro, .hero-badges, .hero-actions { animation: none; opacity: 1; filter: none; transform: none; }"),
  "Hero reveal must be JS-class and motion-media guarded, with immediate reduced-motion final states.");
for (const animation of ["hero-word-in", "hero-actions-in"]) {
  const keyframes = cssBlock(revealCss, `@keyframes ${animation}`);
  const properties = [...keyframes.matchAll(/([\w-]+)\s*:/g)].map(match => match[1]);
  check(properties.length > 0 && properties.every(property => ["opacity", "filter", "transform"].includes(property)),
    `${animation} may animate only opacity, filter and transform.`);
}
check(baseCss.includes("--t-label: 500 13px/1.4 var(--font-sans)") &&
  englishCss.includes(".btn-p { background: var(--accent); color: var(--on-accent); }") &&
  englishCss.includes(".btn-p:hover, .btn-p:active { background: var(--accent-strong); }") &&
  baseCss.includes("outline: 2px solid var(--accent-light); outline-offset: 4px") &&
  baseCss.includes(".signup button:disabled { opacity: 1; background: var(--accent-strong); color: var(--on-accent);"),
  "Labels, primary buttons, focus and readable disabled states must use the approved tokens.");
for (const [route, source] of englishPages) {
  check(source.match(/<head>([\s\S]*?)<\/head>/)?.[1].includes('document.documentElement.classList.add("js-nav")') &&
    englishCss.includes(".js-nav .nav-panel, .has-menu .nav-panel { position: absolute;") &&
    englishCss.includes(".js-nav header:not(.has-menu) .header-menu { display: none; }"),
    `/${route} must establish enhanced header layout before first paint.`);
}
for (const [filename, css] of [
  ["base.css", baseCss], ["theme-en.css", englishCss], ["site.css", paperCss],
  ["agent/index.html", agent.match(/<style>([\s\S]*?)<\/style>/)?.[1] || ""]
]) {
  for (const [, selectors, declarations] of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (/var\(--(?:font-mono|mono)\)/.test(declarations)) {
      check(selectors.split(",").every(selector => /^(?:\.workflow code|code|\.files b|\.md \.path|\.md pre)$/.test(selector.trim())),
        `${filename}: monospace is reserved for code and file names, not ${selectors.trim()}.`);
    }
    check(!/text-transform:\s*uppercase/.test(declarations),
      `${filename}: site labels must not be transformed to uppercase.`);
  }
}
for (const [route, source] of englishPages) {
  for (const [, label] of source.matchAll(/<(?:span|p|h[23])\b[^>]*class="(?:mono-label[^"]*|how-audience|mobile-group-label)"[^>]*>([^<]+)</g)) {
    check(!/[A-Z]{2}/.test(label) || (route === "" && label === "Jin AI"),
      `/${route}: label must use sentence case, except the hero product name: ${label}`);
  }
}
for (const [route, source] of [["privacy", privacy], ["accessibility", accessibility]]) {
  check(source.includes('<main class="legal-copy">'), `${route} must use the narrow article layout.`);
}
const dataSection = homeSections.find((match) => match[1].includes('id="data"'))?.[2] || "";
check(dataSection.includes(`<h2 class="h2">${content.data_principles.headline}</h2>`) &&
  content.data_principles.items.every((item) => dataSection.includes(`<li>${item}</li>`)),
  "Root must use all approved data promises.");
const demoSection = homeSections.find((match) => match[1].includes('id="demo"'))?.[2] || "";
check(demoSection.includes(`<h2>${closingCopy}</h2>`) &&
  demoSection.includes('id="waitlistForm"'), "The demo section must contain the approved heading and form.");
const demoIntro = demoSection.match(/<div class="demo-intro">([\s\S]*?)<\/div>\s*<\/div>/)?.[1] || "";
const gettingStarted = demoIntro.match(/<div class="getting-started">([\s\S]*)/)?.[1] || "";
check(gettingStarted.includes("<h3>Getting started</h3>") &&
  count(gettingStarted, /<ul>/g) === 1 &&
  JSON.stringify([...gettingStarted.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(match => match[1])) === JSON.stringify([
    "We're working through our waitlist, so thank you for your patience. If your company wants to try Jin AI, request a demo below.",
    "The fastest way in is an introduction from someone already in the Jin AI private beta."
  ]) && !demoIntro.includes("<p>We will email you to set up a demo.</p>"),
  "The closing demo intro must contain the exact two-item Getting started list and H3.");
const retiredPilotTexts = [
  "How a pilot works", "We walk through Jin AI with your team's AI harnesses.",
  "Run a paid pilot", "One team uses Jin AI with Claude Code for a set period.",
  "Decide together", "We review what the team reused and what stayed confidential, and agree on next steps.",
  "導入の流れ", "デモのお申し込み。", "チームの AI ハーネスで、Jin AI をご覧いただきます。",
  "有償のパイロット。", "1 つのチームで、Claude Code とあわせて一定期間お使いいただきます。",
  "振り返りと導入のご判断。", "何を引き継げて、何が社内にとどまったかを一緒に振り返り、次の進め方を決めます。"
];
const retiredKeepTexts = [
  "Make every employee your best AI user", "全社員のAI力を最大限引き出す",
  "AI has spread across every team. Safety, handover and sharing have not kept up.",
  "AIの活用は一気に広がりました。でも、安全性、引き継ぎ、使い方の共有は、置いてけぼりのままです。",
  "AI spread fast. Has everything else kept up?", "AIの広がりに、守りと引き継ぎは追いついていますか？",
  "When someone leaves, do their agents keep working?", "Can a successor pick up where they left off?",
  "Does your best AI practice reach every team?", "Is company work flowing into personal AI?",
  "When the person who built them leaves, their agents lose the context they ran on.",
  "The output gets handed over. The context, rules and judgment behind it do not.",
  "One team finds a workflow that works. The other teams never see it.",
  "Your heaviest AI users already run personal AI, and work context ends up there.",
  "担当者が辞めても、エージェントは動き続けますか？", "作った人が辞めると、エージェントは動くための文脈を失います。",
  "後任者は、前任者の続きから始められますか？", "引き継がれるのは成果物だけ。その裏の文脈・ルール・判断は残りません。",
  "いいAIの使い方は、社内に広がっていますか？", "あるチームがうまくいく方法を見つけても、ほかのチームには届きません。",
  "会社の仕事が、個人のAIに流れていませんか？", "AIを使いこなす人ほど個人のAIを使っていて、仕事の文脈もそこに流れています。",
  "Employees keep their context safe", "The company reuses it safely",
  "Put your personal context in securely, and take it out safely. Also usable in your personal AI.",
  "Keep confidential data in, see how each role uses AI, and hand the best harnesses to colleagues and successors.",
  "個人のコンテクストは安全に預け、", "会社は安全に取り出して再利用する。",
  "個人のコンテクストを安全に預け、安全に取り出せる。個人の AI でも使える。",
  "機密は社内にとどめ、役割ごとの AI の使い方を見える化し、優れたハーネスを同僚や後任に引き継ぐ。",
  "See what is inside your company's AI harnesses", "See it on your team's AI harnesses",
  "社内の AI ハーネスの中身を、見てみませんか。", "チームの AI ハーネスで、確かめてみませんか。"
];
const retiredHeroTexts = [
  "We keep your agent harness up to date",
  "会社のAI活用に必要な設定を、いつも最新にキープします",
  "Jin AI keeps the instructions, skills, memory and tools your company's AI agents run on: safe, inside the company, shared across teams, and always current.",
  "AIエージェントが動くための指示・スキル・記憶・ツールを、安全に、会社の中に、チームをまたいで、いつも最新の状態で保ちます。"
];
const retiredReviewTexts = [
  "Jin AI keeps it", "Jin AIが、キープします。",
  "See Jin AI keep your team's agent harness", "御社のエージェントの設定で、Jin AIを試してみませんか。",
  "Our mission is to make every employee as good with AI as your best AI users, without confidential context leaving the company.",
  "私たちの使命は、機密のコンテクストを社外に出さずに、すべての社員が、社内で一番 AI を使いこなす人と同じように AI を使えるようにすることです。",
  "phone number if you choose to give it", "電話番号（ご入力いただいた場合）", ":)"
];
for (const filename of deployedFiles.filter(filename => /\.(?:html|json|txt|css|m?js)$/.test(filename))) {
  const source = await text(filename);
  const plainText = source.replace(/<[^>]*>/g, "").replace(/\s+/g, " ");
  for (const retired of retiredReviewTexts) {
    check(!plainText.includes(retired) && !source.includes(retired),
      `${filename} must not contain replaced R8 copy: ${retired}`);
  }
  check(!/\bpilot(?:-card|-head|-heading|-steps)?\b|accent-surface-(?:from|to)/.test(source),
    `${filename} must not contain retired pilot markup, facts, styles or gradient tokens.`);
  for (const retired of retiredHeroTexts) {
    check(!plainText.includes(retired) && !source.includes(retired),
      `${filename} must not contain retired hero copy: ${retired}`);
  }
  for (const retired of retiredPilotTexts) {
    check(!plainText.includes(retired), `${filename} must not contain retired pilot copy: ${retired}`);
  }
  // R6 explicitly retains the running description's tail after replacing its opening headline.
  const keepText = source.replaceAll(content.product.description, "")
    .replaceAll(content.product.description.replaceAll("'", "&#39;"), "")
    .replace(/<[^>]*>/g, "").replace(/\s+/g, " ");
  for (const retired of retiredKeepTexts) {
    check(!keepText.includes(retired), `${filename} must not contain retired Keep copy: ${retired}`);
  }
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
  ["phone", "Phone", "tel", "tel", 40],
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
  check(/\srequired(?:\s|>)/.test(control) && control.includes('aria-required="true"') &&
    access.form.fields.find((field) => field.name === name)?.required === true,
    `${name} must be required in the facts, markup and accessibility attributes.`);
  check(control.includes(`aria-describedby="${id}-error"`) &&
    form.includes(`<p class="signup-error" id="${id}-error" hidden></p>`),
    `${name} needs a connected inline error message.`);
  check(!/\btabindex=/.test(control), `${name} must retain native tab order.`);
}
check(!/optional/i.test(form.match(/<label for="demo-phone">([^<]*)<\/label>/)?.[1] || ""),
  "The phone label must not say optional.");
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
check(access.community?.url === communityUrl && access.community.name === "Discord" &&
  access.community.label === "Discord", "The community fact must use only the approved Discord name and invite.");
check(llms.includes(`[Discord](${communityUrl})`) && count(llms, /https:\/\/discord\.gg\//g) === 1,
  "The LLM index must publish the single approved community invite.");

const japaneseSections = [...japanese.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/g)];
check(japaneseSections.length === 6 && japaneseSections[0]?.[1].includes('class="hero"') &&
  japaneseSections.slice(1).map((match) => match[1].match(/\bid="([^"]+)"/)?.[1]).join() ===
  "problem,solution,how,data,demo", "Japanese home must retain the six English home sections in order.");
const japaneseProblem = japaneseSections.find((match) => match[1].includes('id="problem"'))?.[2] || "";
const svgGeometry = source => [...source.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map(([svg]) =>
  svg.replace(/\s(?:aria-label|data-label-idle|data-label-playing|data-label-rebuilding|data-label-changed)="[^"]*"/g, "")
    .replace(/(<text\b[^>]*>)[^<]*(<\/text>)/g, "$1LAYER$2"));
check(count(japaneseProblem, /<svg\b[^>]*role="img"[^>]*aria-label="[^"]+"/g) === 3 &&
  JSON.stringify(svgGeometry(japaneseProblem)) === JSON.stringify(svgGeometry(problemSection)),
  "Japanese Problem SVGs must match English geometry, with three translated accessible descriptions.");
const japaneseProblemCopy = [
  ["shadow", "シャドーAI", "仕事の文脈が、会社の外にある個人のAIへ流れていく。"],
  ["dependency", "エージェントの属人化", "エージェント、文脈、ワークフローが、作った人の中にしかない。その人が辞めると止まり、後任は一から組み直す。"],
  ["teams", "スキルの共有不足", "うまくいくやり方が、ひとつのチームから広がらない。"]
];
const japaneseFigures = [...japaneseProblem.matchAll(/<figure class="problem-column" data-problem="([^"]+)" data-state="idle"([^>]*)>([\s\S]*?)<\/figure>/g)];
check(japaneseFigures[0]?.[2].includes('aria-label="図: 会社の仕事が個人のAIに流れていく"') &&
  japaneseFigures[0]?.[3].includes('data-status-changed="機密の書類が、会社の外の個人のAIに渡りました。"'),
  "Japanese Shadow AI must use its exact accessible name and completed live status.");
check(japaneseProblem.includes('<span class="mono-label">課題</span>') &&
  withoutJapanesePhrases(japaneseProblem).includes('<h2 class="h2">AIは全社に広がった。でも、本当に使いこなせていますか？</h2>') &&
  japaneseFigures.length === 3 && count(japaneseProblem, /<h2\b/g) === 1 &&
  count(japaneseProblem, /<h3\b/g) === 3 && count(japaneseProblem, /<p\b/g) === 6 &&
  !/data-draft|draft-tag|sa-svg|ho-svg|ed-svg/.test(japaneseProblem) &&
  japanese.includes('<script type="module" src="/problem.js"></script>'),
  "Japanese Problem must use the exact Keep heading, three problems and shared controller, without draft or legacy content.");
for (const [index, [id, heading, description]] of japaneseProblemCopy.entries()) {
  const attributes = japaneseFigures[index]?.[2] || "";
  const figure = japaneseFigures[index]?.[3] || "";
  check(japaneseFigures[index]?.[1] === id &&
    attributes.includes('tabindex="0"') && /\baria-label="[^"]*[\p{Script=Han}\p{Script=Hiragana}][^"]*"/u.test(attributes) &&
    !/図\s*0[123]|problem-action|data-action-|元に戻す/.test(figure) &&
    [...figure.matchAll(/<button\b[^>]*>/g)].every(([button]) => id === "teams" && button.includes('class="team-control"')) &&
    withoutJapanesePhrases(figure).includes(`<figcaption><h3>${heading}</h3><p>${description}</p></figcaption>`) &&
    new RegExp(`<p class="problem-status" id="problem-${id}-status" aria-live="polite" aria-atomic="true" data-status-idle="[^"]+"`).test(figure) &&
    /<p class="problem-status"[^>]*aria-live="polite"[^>]*>[^<]*[\p{Script=Han}\p{Script=Hiragana}][^<]*<\/p>/u.test(figure),
    `Japanese figure ${index + 1} needs approved copy, a focusable name, no number/action/reset and translated live status.`);
  for (const [, value] of figure.matchAll(/\b(?:aria-label|data-label(?:-idle|-playing|-rebuilding|-changed)?|data-status(?:-idle|-playing|-rebuilding|-changed)?)="([^"]*)"/g)) {
    check(/[\p{Script=Han}\p{Script=Hiragana}]/u.test(value), `Japanese ${id} has an untranslated state description.`);
  }
  const problemMarkup = source => withoutJapanesePhrases(source)
    .replace(/\b(?:aria-label|data-label(?:-idle|-playing|-rebuilding|-changed)?|data-status(?:-idle|-playing|-rebuilding|-changed)?)="[^"]*"/g, 'data-translated="TEXT"')
    .replace(/>[^<]+</g, "><");
  check(problemMarkup(japaneseProblem) === problemMarkup(problemSection),
    "English and Japanese Problem markup and SVG must be identical apart from text.");
}
check(["文脈", "ルール", "ツール", "例外"].every(label => japaneseProblem.includes(`>${label}</text>`)) &&
  ["A", "B", "C"].every(team => japaneseProblem.includes(`>チーム ${team} を開く</span>`)),
  "Japanese handover layers and independently accessible team controls must be translated.");

const japaneseSolution = japaneseSections.find((match) => match[1].includes('id="solution"'))?.[2] || "";
const japaneseSolutionCopy = [
  ["安全にキープ", "機密は会社の中に残し、承認したAIツールにだけつなぎます。"],
  ["会社にキープ", "エージェント、文脈、ワークフローは、人ではなく役割に残ります。後任は、前任者の続きから始められます。"],
  ["みんなでキープ", "いちばんいいスキルが、同じ仕事をするすべてのチームに届きます。"]
];
check(exactElement(japaneseSolution, "h2", "Jin AIが、会社のAIをキープします。") &&
  count(japaneseSolution, /<li>/g) === 3 && count(japaneseSolution, /<h3\b/g) === 3 &&
  count(japaneseSolution, /<p\b/g) === 4 &&
  japaneseSolutionCopy.every(([title, body]) => exactElement(japaneseSolution, "h3", title) && exactElement(japaneseSolution, "p", body)) &&
  exactElement(japaneseSolution, "p", "社員が使い方を磨くたびに、共有されている設定も最新に保ちます。"),
  "Japanese Solution needs the exact Keep heading, three title/body pairs and closing line, each once.");
for (const [language, source, introduction, badges] of [
  ["English", home, "Keep your AI agents, skills, and knowledge secure, reusable, and accessible across your organization.",
    ["Secure", "Company-owned", "Shared", "Up to date"]],
  ["Japanese", japanese, "AIエージェント、スキル、ナレッジを、安全に、再利用できる形で、組織全体で使えるように保ちます。",
    ["安全", "会社のもの", "共有", "いつも最新"]]
]) {
  const section = source.match(/<section class="hero">([\s\S]*?)<\/section>/)?.[1] || "";
  check(count(section, /class="mono-label hero-eyebrow"/g) === 1 &&
    /<span class="mono-label hero-eyebrow">Jin AI<\/span>\s*<!--[^>]*-->\s*<h1 class="hero-reveal"/.test(section),
    `${language} hero needs the exact Jin AI label above the H1.`);
  check(count(source, /class="hero-intro"/g) === 1 &&
    section.match(/<h1 class="hero-reveal"[^>]*>[\s\S]*?<\/h1>\s*<p class="hero-intro">([^<]*)<\/p>\s*<div class="hero-actions">/)?.[1] === introduction &&
    /<div class="hero-actions">[\s\S]*?<\/div>\s*<ul class="hero-badges"/.test(section),
    `${language} hero must use the exact R7 introduction directly after the H1.`);
  const list = section.match(/<ul class="hero-badges" role="list">([\s\S]*?)<\/ul>/)?.[1] || "";
  const items = [...list.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(match => match[1]);
  check(count(section, /class="hero-badges"/g) === 1 && items.length === 4 &&
    items.every((item, index) => /^<svg viewBox="0 0 24 24" aria-hidden="true">(?:<(?:path|circle)\b[^>]*\/>)+<\/svg><span>[^<]+<\/span>$/.test(item) &&
      item.endsWith(`<span>${badges[index]}</span>`)) &&
    !/\b(?:button|tabindex|aria-label|title|fill)=|<(?:a|button)\b/.test(list),
    `${language} hero badges must be one four-item list with exact ordered labels and decorative inline line icons, not controls.`);
}
const heroBadges = source => source.match(/<ul class="hero-badges"[^>]*>([\s\S]*?)<\/ul>/)?.[1] || "";
check(heroBadges(home).replace(/<span>[^<]*<\/span>/g, "<span>TEXT</span>") ===
  heroBadges(japanese).replace(/<span>[^<]*<\/span>/g, "<span>TEXT</span>"),
  "Hero badges must have identical English/Japanese markup and icon geometry apart from text.");
check(cssBlock(englishCss, ".hero-eyebrow {").includes("display: block") &&
  cssBlock(englishCss, ".hero-badges {").includes("display: flex") &&
  cssBlock(englishCss, ".hero-badges {").includes("flex-wrap: wrap") &&
  cssBlock(englishCss, ".hero-badges {").includes("color: var(--text-3)") &&
  cssBlock(englishCss, ".hero-badges svg {").includes("fill: none") &&
  cssBlock(englishCss, ".hero-badges svg {").includes("stroke: currentColor") &&
  cssBlock(englishCss, ".hero-badges svg {").includes("stroke-width: 1.25"),
  "Hero label and muted, wrapping, unfilled thin-line badges must use the shared theme.");
check(content.product.headline === "Turn AI into a company asset" &&
  content.product.description === "Turn AI into a company asset. Keep confidential data in, see how each role uses AI, and hand the best harnesses to colleagues and successors." &&
  content.direct_answers.find(answer => answer.id === "what-is-jin-ai")?.answer === content.product.description &&
  content.product.availability === "The workspace beta is live. Company features are being built, starting with Claude Code." &&
  content.direct_answers.find(answer => answer.id === "is-jin-ai-available")?.answer === content.product.availability,
  "R7 facts must use the new headline and preserve the description tail and availability without a pilot sentence.");

const bodyStructure = source => {
  const body = source.match(/<body\b[^>]*>([\s\S]*?)<\/body>/)?.[1] || "";
  return [...withoutJapanesePhrases(body).replace(/<!-- GENERATED:CTA_FINAL:START -->[\s\S]*?<!-- GENERATED:CTA_FINAL:END -->/g, "")
    .replace(/<h1 class="hero-reveal"[^>]*>[\s\S]*?<\/h1>/g, '<h1 class="hero-reveal"></h1>')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>|<!--[\s\S]*?-->/g, "")
    .matchAll(/<(?!\/)([a-z][\w-]*)\b([^>]*)>/g)].map(([, tag, attributes]) =>
    [tag, attributes.match(/\bclass="([^"]*)"/)?.[1] || "", attributes.match(/\bid="([^"]*)"/)?.[1] || ""]);
};
const japaneseNavigation = [
  ["つながる", "Connect"], ["コピー", "Copy"],
  ["製品", "Product"], ["概要", "Overview"], ["仕組み", "How it works"],
  ["社員向け", "For employees"], ["管理者向け", "For admins"],
  ["セキュリティ", "Security"], ["規約・方針", "Legal"], ["会社情報", "Company"],
  ["会社", "Company"], ["お問い合わせ", "Contact"], ["デモを申し込む", "Request a demo"],
  ["AI ハーネスとは", "What is an AI harness"], ["プライバシーポリシー", "Privacy"],
  ["アクセシビリティ", "Accessibility"],
  ["Jin AI が会社にもたらすこと。", "What Jin AI does for your company."],
  ["つなぐ、整理する、役割ごとに見る、持ち出せるものを決める。", "Connect, sort, see by role, decide what can move."],
  ["個人のコンテクストを安全に預け、取り出せる。", "Bring your context in and out safely."],
  ["役割ごとの AI の使い方が見える。", "See how each role uses AI."],
  ["AI エージェントを役割に合わせて働かせる部品。", "The parts that make an AI agent work for a role."],
  ["お預かりする情報と、その使い方。", "What we collect and why."],
  ["目標と、問題のご報告先。", "Our goal and how to report a problem."],
  ["アクセスは Cloudflare Web Analytics で数えています。Cookie は使っていません。", "Visits are counted with Cloudflare Web Analytics. No cookies."]
];
const scripts = (source, route) => [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
  .filter(([, attributes]) => !/id="jin-language-choice"|type="application\/ld\+json"/.test(attributes))
  .map(([, attributes, script]) => [
    attributes.replace(/\bsrc="([^"]+)"/g, (_, url) => `src="${new URL(url, `https://jinai.md/${route}`).href}"`), script
  ]);
for (const [route, english, translated] of pagePairs) {
  let expectedNavigation = english.replace('aria-label="Main navigation"', 'aria-label="メインナビゲーション"')
    .replace('aria-label="Menu"', 'aria-label="メニュー"');
  for (const [japaneseText, englishText] of japaneseNavigation) {
    if (japaneseText !== "会社") {
      expectedNavigation = expectedNavigation.replaceAll(`>${englishText}<`, `>${japaneseText}<`);
    }
  }
  expectedNavigation = expectedNavigation.replace('<div class="footer-column"><h2>会社情報</h2>',
    '<div class="footer-column"><h2>会社</h2>');
  for (const landmark of ["header", "footer"]) {
    check(normalizedLandmark(translated, landmark, `https://jinai.md/ja/${route}`)
      .replaceAll("https://jinai.md/ja/", "https://jinai.md/") ===
      normalizedLandmark(expectedNavigation, landmark, `https://jinai.md/${route}`),
      `/ja/${route} ${landmark} must have the complete translated navigation, descriptions, footer columns and matching links.`);
  }
  check(JSON.stringify(bodyStructure(english)) === JSON.stringify(bodyStructure(translated)),
    `/ja/${route} must match its English twin's complete element, section ID and component-class structure, except form order and H1 typesetting.`);
  check(JSON.stringify(scripts(english, route)) === JSON.stringify(scripts(translated, `ja/${route}`)),
    `/ja/${route} must retain all English scripts, except the English-only language choice and fact graph.`);
  const stylesheets = [...translated.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)]
    .map(([, url]) => new URL(url, `https://jinai.md/ja/${route}`).pathname);
  check(JSON.stringify(stylesheets) === '["/base.css","/theme-en.css","/theme-ja.css"]' &&
    translated.includes("family=Inter:wght@400..700") && translated.includes("family=Noto+Sans+JP:wght@400..700") &&
    !/Source\+Serif|Noto\+Serif|site\.css/.test(translated),
    `/ja/${route} must load the English dark theme followed only by Japanese sans-serif typesetting.`);
  check(translated.match(/<head>([\s\S]*?)<\/head>/)?.[1].includes('document.documentElement.classList.add("js-nav")'),
    `/ja/${route} must establish the same pre-paint navigation geometry.`);
  const markup = translated.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");
  for (const [, href, attributes] of markup.matchAll(/<a\b[^>]*href="([^"]+)"([^>]*)>/g)) {
    if (/^(?:https?:|mailto:|#)/.test(href) || attributes.includes('data-jin-lang="en"')) continue;
    check(new URL(href, `https://jinai.md/ja/${route}`).pathname.startsWith("/ja/"),
      `/ja/${route} must keep internal links in Japanese, except its explicit English language link.`);
  }
}
const japaneseReveal = japanese.match(/<h1 class="hero-reveal"[^>]*>([\s\S]*?)<\/h1>/)?.[1] || "";
check(count(japaneseReveal, /<span style="--word:[0-1]">[^<]+<\/span>/g) === 2 &&
  [...japaneseReveal.matchAll(/--word:(\d)/g)].map(match => match[1]).join("") === "01" &&
  japaneseReveal.replace(/<[^>]+>/g, "") === "AIを、会社の資産に。" &&
  japanese.includes('aria-label="AIを、会社の資産に。"') &&
  japanese.match(/<script id="jin-page-paint">([\s\S]*?)<\/script>/)?.[1] === paintScript,
  "Japanese hero must preserve its two-phrase reveal, exact R7 text, accessible name and motion opt-in.");
for (const [page, source, phrases] of [
  ["/ja/", japanese, ["AIは全社に広がった。", "でも、本当に", "使いこなせていますか？", "エージェントの", "属人化", "シャドーAI", "スキルの共有不足", "Jin AIが、", "会社のAIを", "キープします。", "安全にキープ", "会社にキープ", "みんなでキープ", "御社のAIを、", "会社の資産に。"]],
  ["/ja/how-it-works/", japaneseHow, ["コンテクストは、", "御社のAIを、", "会社の資産に。"]],
  ["/ja/security/", japaneseSecurity, ["コンテクストは、", "会社のもの。"]],
  ["/ja/privacy/", japanesePrivacy, ["プライバシー", "ポリシー", "取り扱いを", "委託している", "事業者"]]
]) {
  check(phrases.every(phrase => source.includes(`<span class="ja-phrase">${phrase}</span>`)),
    `${page} must protect the approved heading phrase boundaries from internal breaks.`);
}
check(count(japanese, /class="demo-stage"/g) === 1 && count(japanese, /<img\b[^>]*src="\/assets\/demo\//g) === 1 &&
  japanese.includes('src="/assets/demo/demo-2-categories.webp" width="2880" height="1664" alt="Jin AI の社員向けの画面。ハーネスの部品が種類ごとに並び、それぞれに Can move か Confidential の表示がある。" decoding="async" loading="eager" fetchpriority="high" elementtiming="hero-still"') &&
  japanese.includes('src="/assets/demo/app.html?embed=hero"') &&
  japanese.match(/<script id="jin-hero-demo">([\s\S]*?)<\/script>/)?.[1] === heroDemoScript,
  "Japanese home must retain the English live hero, exact Japanese alt, eager fallback and unchanged lifecycle.");
const japaneseCss = await text("theme-ja.css");
const typesettingProperties = new Set([
  "--font-sans", "font-family", "font-size", "font-weight", "line-height", "line-break",
  "word-break", "overflow-wrap", "letter-spacing", "text-wrap", "text-autospace", "white-space"
]);
for (const [, selector, declarations] of japaneseCss.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  for (const [, property] of declarations.matchAll(/([\w-]+)\s*:[^;]+;/g)) {
    check(typesettingProperties.has(property) ||
      (property === "display" && selector.trim() === ".ja-phrase, .hero-reveal > span" &&
        declarations.includes("white-space: nowrap") && declarations.includes("display: inline-block")),
      `theme-ja.css must change only typesetting, not ${property}.`);
  }
}
check(japaneseCss.includes('--font-sans: "Yu Gothic", "YuGothic", "Yu Gothic UI", "Hiragino Sans", "Noto Sans JP", sans-serif') &&
  japaneseCss.includes("body { font-weight: 500;") &&
  japaneseCss.includes("word-break: keep-all") && japaneseCss.includes("white-space: nowrap") &&
  japaneseCss.includes("@supports (word-break: auto-phrase)") && japaneseCss.includes("word-break: auto-phrase") &&
  japaneseCss.includes("line-break: strict") && japaneseCss.includes("word-break: normal") &&
  japaneseCss.includes("overflow-wrap: anywhere") && japaneseCss.includes("text-wrap: balance") &&
  japaneseCss.includes("@supports (text-autospace: normal)"),
  "Japanese typesetting must use Yu Gothic, medium body text, protected phrases, auto-phrase enhancement and progressive autospace.");
for (const [page, translated] of [["home", japanese], ["How it works", japaneseHow]]) {
  check(!/\bclass="[^"]*\b(?:st|harness-status)\b/.test(translated) &&
    !/\b(?:Building|Next)\b/.test(translated.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "")),
  `Japanese ${page} must not show delivery status labels.`);
}
check(count(japaneseHow, /<img\b[^>]*class="screen-/g) === 4 &&
  japaneseHow.includes('href="/ja/#demo">デモを申し込む</a>') &&
  japaneseHow.includes('href="/ja/security/">データとセキュリティ &rarr;</a>'),
"Japanese How it works must retain its four original stills, security link and demo CTA.");

const japaneseForm = japanese.match(/<form\b[^>]*\bid="waitlistForm"[^>]*>[\s\S]*?<\/form>/)?.[0] || "";
const japaneseControls = [...japaneseForm.matchAll(/<(input|select)\b[^>]*>/g)].map(([tag]) => tag);
const japaneseLabels = {
  email: "会社のメールアドレス", lastName: "姓", firstName: "名", jobTitle: "役職",
  phone: "電話番号", company: "会社名", industry: "業種", companySize: "従業員数", country: "国"
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
  japanese.includes('src="/waitlist.mjs"') && !/waitlistSurvey|signup-survey|type="radio"/.test(japanese),
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
      '<a href="/ja/" lang="ja" hreflang="ja" data-jin-lang="ja">日本語</a>';
    const englishOnly = allowedLink ? source.replace(allowedLink, "") : source;
    check(!cjk.test(englishOnly), `${relativePath} contains CJK outside its Japanese footer language link.`);
  }
  check(!/[\u2013\u2014\u2018\u2019\u201c\u201d]/u.test(source),
    `${relativePath} contains em dashes, en dashes or curly quotes.`);
  check(!/\bsetup\b/i.test(source), `${relativePath} contains the retired word setup.`);
  if (!relativePath.endsWith(".html") && !["agent/content.json", "llms.txt"].includes(relativePath)) {
    check(!/\bDiscord\b|discord\.gg/i.test(source), `${relativePath} contains an out-of-scope community mention.`);
  }
  check(!/mailto:hello@jinai\.md/i.test(source), `${relativePath} must not link the contact email with mailto.`);
}

const htmlFiles = deployedFiles.filter((file) => file.endsWith(".html"));
const deployedFileSet = new Set(deployedFiles);
const htmlCache = new Map();
for (const relativePath of htmlFiles) htmlCache.set(relativePath, await text(relativePath));

for (const [relativePath, source] of htmlCache) {
  if (!["resources/ai-harness/index.html", "ja/resources/ai-harness/index.html"].includes(relativePath)) {
    check(!/resources\/ai-harness\//.test(source),
      `${relativePath} must not reference a retired AI harness article.`);
  }
  const japanesePage = relativePath.startsWith("ja/");
  const component = emailComponent(japanesePage);
  const markup = source.replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, "");
  const components = [...markup.matchAll(/<span class="email-contact">[\s\S]*?<\/button><\/span>/g)];
  check(components.every(([match]) => match === component) &&
    !markup.replaceAll(component, "").replace(/<[^>]*>/g, "").includes("hello@jinai.md") &&
    count(markup, /class="copy-email"/g) === components.length,
    `${relativePath} must pair every visible contact email with the exact selectable copy component and its language label.`);
  const footer = source.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/)?.[0] || "";
  const connect = `<div class="${relativePath === "agent/index.html" ? "shell " : ""}footer-column"><h2>${japanesePage ? "つながる" : "Connect"}</h2>${communityLink}</div>`;
  if (footer && !relativePath.startsWith("assets/")) check(footer.includes(connect) && count(footer, /https:\/\/discord\.gg\//g) === 1,
    `${relativePath} footer must contain one Connect column with only the approved Discord link.`);
  let elsewhere = relativePath.startsWith("assets/") ? source : source.replace(footer, "");
  if (["company/index.html", "ja/company/index.html"].includes(relativePath)) {
    const contact = source.match(/<section aria-labelledby="contact-heading">[\s\S]*?<\/section>/)?.[0] || "";
    check(contact.includes(`<p class="community-contact">${japanesePage ? "コミュニティ" : "Community"}: ${communityLink}</p>`) &&
      contact.includes(component) && count(contact, /https:\/\/discord\.gg\//g) === 1,
      `${relativePath} Contact must show the approved Community line under the copyable email.`);
    elsewhere = elsewhere.replace(contact, "");
  }
  check(!/\bDiscord\b|discord\.gg/i.test(elsewhere),
    `${relativePath} must not show Discord outside its footer or Company Contact (including header, hero and menus).`);
}

for (const [relativePath, source] of htmlCache) {
  const publicPath = relativePath.replace(/index\.html$/, "");
  const baseUrl = new URL(publicPath, "https://jinai.md/");
  const markup = source.replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/g, "$1</script>");
  const references = [...markup.matchAll(/\b(?:href|src)="([^"]+)"/g)];

  if (!relativePath.startsWith("assets/")) {
    check(!/\bproduct-frame\b/.test(markup), `${relativePath} must use demo-stage, not product-frame.`);
    const duplicateLabels = [...markup.matchAll(/<(?:span|p)\b[^>]*class="mono-label"[^>]*>([^<]+)<\/(?:span|p)>\s*<h2\b[^>]*>([^<]+)<\/h2>/g)];
    check(!duplicateLabels.some(match => match[1] === match[2]),
      `${relativePath} must not repeat an H2 verbatim in its section label.`);
    // Track nesting, including inert template contents, without adding a parser dependency.
    const stack = [];
    const stages = [];
    const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
    const hasClass = (node, name) => node?.classes.includes(name);
    const clean = markup.replace(/<!--[\s\S]*?-->|<style\b[^>]*>[\s\S]*?<\/style>/g, "");
    for (const [tag, name] of clean.matchAll(/<\/?([a-z][\w:-]*)\b[^>]*>/gi)) {
      const tagName = name.toLowerCase();
      if (tag.startsWith("</")) {
        const index = stack.findLastIndex(node => node.name === tagName);
        if (index >= 0) stack.length = index;
        continue;
      }
      const parent = stack.at(-1);
      const node = { name: tagName, classes: tag.match(/\bclass="([^"]*)"/)?.[1].split(/\s+/) || [], children: [] };
      parent?.children.push(node);
      if (hasClass(node, "demo-stage")) stages.push(node);
      if (["img", "iframe"].includes(tagName) && /\bsrc="[^"]*\bassets\/demo\//.test(tag)) {
        const screen = stack.findLastIndex(ancestor => hasClass(ancestor, "hero-screen") || hasClass(ancestor, "screen"));
        check(screen >= 2 && hasClass(stack[screen - 1], "demo-window") &&
          hasClass(stack[screen - 2], "demo-stage"),
          `${relativePath}: every demo image and iframe must be inside demo-stage > demo-window > screen.`);
      }
      if (!voidTags.has(tagName)) stack.push(node);
    }
    for (const stage of stages) {
      const caption = stage.children[0]?.name === "figcaption" ? stage.children[0] : null;
      const window = stage.children[caption ? 1 : 0];
      const screen = window?.children[0];
      check(stage.name === "figure" && stage.children.length === (caption ? 2 : 1) &&
        (!caption || hasClass(caption, "screen-caption")) &&
        window?.name === "div" && hasClass(window, "demo-window") && window.children.length === 1 &&
        screen?.name === "div" && (hasClass(screen, "hero-screen") || hasClass(screen, "screen")) &&
        screen.children.length > 0 && screen.children.every(child =>
          child.name === "img" || child.name === "iframe" ||
          (child.name === "div" && hasClass(child, "screen-camera") && child.children.length === 2 &&
            child.children[0].name === "img" && child.children[1].name === "svg" &&
            hasClass(child.children[1], "workflow-cursor")) ||
          (hasClass(screen, "screen-placeholder") && child.name === "span" && hasClass(child, "placeholder-mark")) ||
          (child.name === "template" && child.children.length === 1 && child.children[0].name === "iframe")),
        `${relativePath}: demo-stage must contain only an optional caption and one demo-window/screen, with no added title bar.`);
    }
  }

  for (const match of references) {
    const reference = match[1];
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
