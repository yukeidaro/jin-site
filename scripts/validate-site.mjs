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
  "waitlist.mjs"
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
  ["company/", company], ["resources/ai-harness/", harness]
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
  ["", home, japanese, "全社員のAI力を最大限引き出す。", "Jin AI | 全社員のAI力を最大限引き出す",
    "Jin AI は、優れた社員がつくった AI ハーネスを、すべての社員にとって安全に、会社にとって再利用できる形にします。"],
  ["how-it-works/", howPage, japaneseHow, "仕組み", "仕組み | Jin AI",
    "Jin AI が AI ツールにつながり、AI ハーネスを種類ごとに整理し、持ち出せるものを会社が決める仕組みです。"],
  ["security/", security, japaneseSecurity, "会社のコンテクストは、会社のもの。", "セキュリティ | Jin AI",
    "会社ごとにコンテクストを分けて保管します。個人のコンテクストと会社のコンテクストも、分けて扱います。"],
  ["company/", company, japaneseCompany, "会社情報", "会社情報 | Jin AI",
    "私たちの使命は、機密のコンテクストを社外に出さずに、すべての社員が、社内で一番 AI を使いこなす人と同じように AI を使えるようにすることです。"],
  ["resources/ai-harness/", harness, japaneseHarness, "AI ハーネスとは", "AI ハーネスとは | Jin AI",
    "AI ハーネスとは、AI エージェントを役割に合わせて働かせるための、指示・スキル・記憶・接続ツールの一式です。"],
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
    const imageAlt = page.startsWith("/ja/") ? "Jin AI: 全社員のAI力を最大限引き出す" : "Jin AI: Make every employee your best AI user";
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
check(homeSections.length === 7 && homeSections[0]?.[1].includes('class="hero"') &&
  homeSections.slice(1).map((match) => match[1].match(/\bid="([^"]+)"/)?.[1]).join() ===
  "problem,solution,how,data,pilot,demo", "Root must contain only hero, problem, solution, how, data, draft pilot and demo sections, in order.");
check(count(home, /<h1\b/g) === 1 &&
  home.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]*>/g, "") === "Make every employee your best AI user",
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
  demoApp.includes(".hero-embed .controls,.hero-embed .progress,.hero-embed .cursor,.hero-embed .stats{display:none!important}") &&
  demoApp.includes(".hero-embed .tool-option:not(.chosen) .tool-ready{visibility:hidden}") &&
  demoApp.includes("document.body.inert = true"),
  "Demo copy needs hero-only control/stats hiding, chosen-only Ready labels and disabled interaction.");
const heroPhases = demoApp.match(/const phases = \[([\s\S]*?)\];/)?.[1] || "";
check(JSON.stringify([...heroPhases.matchAll(/scene: (\d+)/g)].map(match => Number(match[1]))) === "[0,0,1]" &&
  !/By role|What can move|go\([23]\)/.test(heroPhases) &&
  demoApp.includes("Math.min(heroEmbed?1:3,n)") &&
  demoApp.includes("const views=heroEmbed?[connectView,categoryView]:[connectView,categoryView,roleView,policyView]") &&
  demoApp.includes('const stepNames=heroEmbed?[\'Connect\',\'Categories\']') &&
  demoApp.includes('event.source !== parent || event.origin !== location.origin') &&
  demoApp.includes('event.data.action !== "pause" && event.data.action !== "play"') &&
  demoApp.includes("clearTimeout(timeout)") && demoApp.includes("animation.pause()"),
  "Hero demo must loop Connect then Categories only, prevent admin navigation, and authenticate pause/play for timers and animations.");
check(demoApp.includes('content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src \'self\' data:; base-uri \'none\'; form-action \'none\'"') &&
  !/<(?:script|img|link)\b[^>]*(?:src|href)=["']https?:\/\//i.test(demoApp),
  "Demo must prohibit off-site resources and network connections.");
check(count(home, /<img\b[^>]*src="assets\/demo\//g) === 1 &&
  !/demo-[134]-|admin console|screen-by-role|screen-what-can-move/.test(home),
  "Root must not show admin screens or any still beyond the Categories fallback.");
const problemMatch = homeSections.find((match) => match[1].includes('id="problem"'));
const problemSection = problemMatch?.[2] || "";
const problemCopy = [
  ["owner", "Agents stop working", "When the person who built them leaves, their agents lose the context they ran on."],
  ["handover", "Successor rebuilds from scratch", "The output gets handed over. The context, rules and judgment behind it do not."],
  ["teams", "Best practice stays hidden", "One team finds a workflow that works. The other teams never see it."]
];
const problemFigures = [...problemSection.matchAll(/<figure class="problem-column" data-problem="([^"]+)" data-state="idle"([^>]*)>([\s\S]*?)<\/figure>/g)];
check(problemSection.includes('<span class="mono-label">Problem</span>') &&
  problemSection.includes('<h2 class="h2">When your best AI users leave, you start over</h2>') &&
  !/Draft copy|\bdata-draft\b/.test((problemMatch?.[1] || "") + problemSection),
  "Problem must use the exact approved label and H2 without a Draft copy tag or data-draft.");
check(problemFigures.length === 3 && count(problemSection, /<svg\b/g) === 3,
  "Problem needs exactly three inline interactive figures.");
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
    (id === "teams" || /\bdata-status-idle="[^"]+" data-status-playing="[^"]+" data-status-changed="[^"]+"/.test(status[0])),
    `Problem figure ${index + 1} needs exact copy, a focusable named figure, no number/action/reset, shared SVG size, state descriptions and polite status.`);
}
check(!/\b(?:sa-|ho-|ed-)|class="art"|animateMotion/.test(problemSection) &&
  !/sa-svg|ho-svg|ed-svg|ed-tiles|ed-arrows|pauseAnimations/.test(home),
  "English home must not retain the old shadow AI, handover or education illustrations or controller.");
const ownerFigure = problemFigures[0]?.[3] || "";
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
const rebuildLayers = [...handoverFigure.matchAll(/<g class="handover-rebuild" style="--step:(\d)" transform="translate\(284 (\d+)\)" data-layer="([^"]+)">([\s\S]*?)<\/text>/g)];
check(rebuildLayers.length === 4 && rebuildLayers.every((layer, index) =>
  layer[1] === String(index) && Number(layer[2]) === 196 - index * 36 &&
  layer[3] === ["context", "rules", "tools", "exceptions"][index] &&
  layer[4].includes('class="rebuild-trace" pathLength="1"') &&
  layer[4].includes('class="rebuild-outline" mask="url(#problem-rebuild-') &&
  layer[4].includes(`<text x="56" y="7">${["Context", "Rules", "Tools", "Exceptions"][index]}`)) &&
  count(handoverFigure, /<text\b/g) === 8 && !/<text\b[^>]*transform=/.test(handoverFigure) &&
  count(handoverFigure.match(/<g class="handover-layers">([\s\S]*?)<\/g>/)?.[1] || "", /<use\b/g) === 4,
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
  problemClient.includes("new IntersectionObserver") && problemClient.includes('"visibilitychange"') &&
  problemClient.includes("!document.hidden") && problemClient.includes("visible.has(figure)") &&
  problemClient.includes('figure.dataset.busy === "true"') &&
  problemClient.includes("clearTimeout(timer)") &&
  problemClient.includes("cancelAnimationFrame(frame)") &&
  problemClient.includes('threshold: [0, .5]') && problemClient.includes("controller.reset()") &&
  problemClient.includes('figure.addEventListener("focus"') &&
  problemClient.includes('figure.addEventListener("pointerenter"') &&
  problemClient.includes('figure.addEventListener("click"') &&
  problemClient.includes("1750 : 3600") &&
  problemClient.includes('control.addEventListener("focus", select)') &&
  problemClient.includes('control.addEventListener("pointerenter"') &&
  problemClient.includes('control.addEventListener("click", select)'),
  "Problem sequences must play once at half-view, reset on exit, guard repeated focus/hover/tap input, finish within four seconds and support reduced motion and flow pause.");
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
check(JSON.stringify(sitemapUrls) === JSON.stringify(
  pagePairs.flatMap(([route]) => [`https://jinai.md/${route}`, `https://jinai.md/ja/${route}`]).sort()),
  "Sitemap must contain exactly the fourteen English and Japanese page URLs.");
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
check(!howSection.includes('<span class="mono-label">How it works</span>') &&
  howSection.includes('class="how-audience">Employee</h3>') &&
  howSection.includes('class="how-audience">Admin</h3>') &&
  howSection.includes('href="how-it-works/">How it works &rarr;</a>') &&
  !/<(?:img|figure)\b|class="screen"/.test(howSection),
  "How it works must include Employee, Admin and its text link without screens or a duplicate heading label.");
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
    check(body.includes(`<h2 class="how-audience" id="${section?.[2]}">${audience}</h2>`) &&
      body.includes('<div class="section-head split">') &&
      body.includes('<figure class="demo-stage">') &&
      body.includes('<div class="demo-window moving-frame">') &&
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
  howPage.includes('<p class="mono-label">How it works</p>') &&
  howPage.includes('<h2 class="how-audience" id="employee-heading">Employee</h2>') &&
  howPage.includes('<h2 class="how-audience" id="admin-heading">Admin</h2>') &&
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
check(closingBand.includes('<div class="wrap">') &&
  closingBand.includes('<h2 id="closing-heading">See it on your team\'s AI harnesses</h2>') &&
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
check(securityContact.includes('<p>Questions about security? Email <a href="mailto:hello@jinai.md">hello@jinai.md</a>, or request a demo.</p>') &&
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
  ["company/", company, "Company", "Company", "Company",
    "Our mission is to make every employee as good with AI as your best AI users, without confidential context leaving the company.",
    "Company Company Our mission is to make every employee as good with AI as your best AI users, without confidential context leaving the company. Where we are Jin AI is an early-stage company. We build in close contact with the teams we talk to. Contact hello@jinai.md Request a demo"],
  ["resources/ai-harness/", harness, "What is an AI harness", "What is an AI harness?", "Resources",
    content.product.harness_definition,
    `Resources What is an AI harness? ${content.product.harness_definition} Instructions: how the agent should work for this role. Skills: procedures it can repeat. Memory: what it keeps across sessions. Connected tools: the MCP servers and apps it can use. For example: CLAUDE.md, skills, memory files and MCP settings. Why it matters The harnesses that work are built by a few people, and they hold both how a team got faster and the company's confidential context. Jin AI keeps them visible, safe and reusable. How it works &rarr;`]
];
for (const [route, source, title, heading, label, description, expectedCopy] of draftPages) {
  const main = source.match(/<main\b([^>]*)>([\s\S]*?)<\/main>/);
  const visible = (main?.[2] || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  check(source.includes('<html lang="en">') && source.includes(`<title>${title} | Jin AI</title>`) &&
    count(source, /<h1\b/g) === 1 && source.includes(`<h1>${heading}</h1>`) &&
    main?.[1].includes("draft-article") &&
    (main?.[2] || "").includes(`<p class="mono-label">${label}</p>`),
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
const paperCss = await text("site.css");
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
check(cssBlock(englishCss, ".problem-art svg").includes("aspect-ratio: 420 / 320") &&
  cssBlock(englishCss, ".owner-person").includes("stroke: var(--accent-light)") &&
  cssBlock(englishCss, ".owner-light").includes("fill: var(--accent-light)") &&
  cssBlock(englishCss, ".owner-light").includes("animation-play-state: paused") &&
  cssBlock(englishCss, ".rebuild-outline").includes("stroke-dasharray: 4 4") &&
  cssBlock(englishCss, "@keyframes problem-draw").includes("stroke-dashoffset: 1") &&
  cssBlock(englishCss, "#problem .problem-column:focus-visible").includes("outline: 2px solid var(--accent-light)") &&
  cssBlock(englishCss, "@media (prefers-reduced-motion: reduce)").includes(
    ".problem-art * { animation: none !important; transition: none !important; }") &&
  ['[data-problem="owner"] .owner-stop { opacity: 1;', '[data-problem="owner"] .owner-agent { opacity: .24;',
    '[data-problem="handover"] .rebuild-trace { stroke-dashoffset: 0;',
    '[data-problem="handover"] .handover-rebuild,', '[data-team-art="c"] .team-workflow { opacity: 1;']
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
  cssBlock(englishCss, ".screen").includes("aspect-ratio: 2880 / 1664") &&
  heroDemoScript.includes("screen.clientWidth / 1440") &&
  heroDemoScript.includes("}).observe(screen)"),
  "Demo stages must share responsive padding, outline, surface and floating windows without a fade, glow or extra chrome; screen ratios and inner-screen scaling must remain.");
const paintScript = home.match(/<head>[\s\S]*?<script id="jin-page-paint">([\s\S]*?)<\/script>/)?.[1] || "";
check(paintScript.includes('document.documentElement.classList.add("js-nav")') &&
  /if\s*\(!matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches\)\s*document\.documentElement\.classList\.add\("js-reveal"\)/.test(paintScript),
  "Home reveal must opt in through a reduced-motion-guarded inline head script.");
const revealHeading = home.match(/<h1 class="hero-reveal">([\s\S]*?)<\/h1>/)?.[1] || "";
check(count(revealHeading, /<span style="--word:[0-6]">[^<]+<\/span>/g) === 7 &&
  !/aria-hidden|aria-label/.test(revealHeading) &&
  [...revealHeading.matchAll(/--word:(\d)/g)].map(match => match[1]).join("") === "0123456",
  "Home H1 must contain seven ordered, readable word spans.");
const revealCss = cssBlock(englishCss, "@media (prefers-reduced-motion: no-preference)");
check(revealCss.includes(".js-reveal .hero-reveal > span") &&
  revealCss.includes(".js-reveal .hero-reveal + .hero-actions") &&
  /animation:\s*hero-word-in[^;]*var\(--ease\)/.test(revealCss) &&
  /animation:\s*hero-actions-in[^;]*var\(--ease\)/.test(revealCss) &&
  /opacity:\s*\.001/.test(revealCss) && /filter:\s*blur\(8px\)/.test(revealCss) &&
  /transform:\s*translateY\(\.3em\)/.test(revealCss) &&
  cssBlock(englishCss, "@media (prefers-reduced-motion: reduce)").includes(
    ".hero-reveal > span, .hero-reveal + .hero-actions { animation: none; opacity: 1; filter: none; transform: none; }"),
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
  englishCss.includes(".pilot-card .btn-p { background: var(--on-accent); color: var(--accent); }") &&
  baseCss.includes("outline: 2px solid var(--accent-light); outline-offset: 4px") &&
  baseCss.includes(".signup button:disabled { opacity: 1; background: var(--accent-strong); color: var(--on-accent);"),
  "Labels, primary/inverted buttons, focus and readable disabled states must use the approved tokens.");
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
    check(!/[A-Z]{2}/.test(label), `/${route}: label must use sentence case: ${label}`);
  }
}
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
check(demoSection.includes("<h2>See what is inside your company's AI harnesses</h2>") &&
  demoSection.includes('id="waitlistForm"'), "The demo section must contain the approved heading and form.");
const demoIntro = demoSection.match(/<div class="demo-intro">([\s\S]*?)<\/div>\s*<\/div>/)?.[1] || "";
const gettingStarted = demoIntro.match(/<div class="getting-started">([\s\S]*)/)?.[1] || "";
check(gettingStarted.includes("<h3>Getting started</h3>") &&
  count(gettingStarted, /<ul>/g) === 1 &&
  JSON.stringify([...gettingStarted.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(match => match[1])) === JSON.stringify([
    "We're working through our waitlist, so thank you for your patience. If your company wants to try Jin AI, request a demo below.",
    "The fastest way in is an introduction from someone already in the Jin AI private beta. :)"
  ]) && !demoIntro.includes("<p>We will email you to set up a demo.</p>"),
  "The closing demo intro must contain the exact two-item Getting started list and H3.");
const pilotSection = homeSections.find((match) => match[1].includes('id="pilot"'))?.[2] || "";
check(pilotSection.includes('<div class="pilot-card">') &&
  pilotSection.includes('<h2 id="pilot-heading">How a pilot works</h2>'),
  "The pilot card must retain its supplied heading and layout.");
for (const [heading, description] of [
  ["Request a demo", "We walk through Jin AI with your team's AI harnesses."],
  ["Run a paid pilot", "One team uses Jin AI with Claude Code for a set period."],
  ["Decide together", "We review what the team reused and what stayed confidential, and agree on next steps."]
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
if (access.community?.url) {
  check(home.includes(`href="${access.community.url}"`), "Community CTA must be published once its URL is set.");
}

const japaneseSections = [...japanese.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/g)];
check(japaneseSections.length === 7 && japaneseSections[0]?.[1].includes('class="hero"') &&
  japaneseSections.slice(1).map((match) => match[1].match(/\bid="([^"]+)"/)?.[1]).join() ===
  "problem,solution,how,data,pilot,demo", "Japanese home must retain the seven English home sections in order.");
const japaneseProblem = japaneseSections.find((match) => match[1].includes('id="problem"'))?.[2] || "";
const svgGeometry = source => [...source.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map(([svg]) =>
  svg.replace(/\s(?:aria-label|data-label-idle|data-label-playing|data-label-changed)="[^"]*"/g, "")
    .replace(/(<text\b[^>]*>)[^<]*(<\/text>)/g, "$1LAYER$2"));
check(count(japaneseProblem, /<svg\b[^>]*role="img"[^>]*aria-label="[^"]+"/g) === 3 &&
  JSON.stringify(svgGeometry(japaneseProblem)) === JSON.stringify(svgGeometry(problemSection)),
  "Japanese Problem SVGs must match English geometry, with three translated accessible descriptions.");
const japaneseProblemCopy = [
  ["owner", "エージェントが止まる", "作った人が辞めると、エージェントは動くための文脈を失います。"],
  ["handover", "後任者が一から組み直す", "引き継がれるのは成果物だけ。その裏の文脈・ルール・判断は残りません。"],
  ["teams", "いいやり方が埋もれる", "あるチームがうまくいく方法を見つけても、ほかのチームには届きません。"]
];
const japaneseFigures = [...japaneseProblem.matchAll(/<figure class="problem-column" data-problem="([^"]+)" data-state="idle"([^>]*)>([\s\S]*?)<\/figure>/g)];
check(japaneseProblem.includes('<span class="mono-label">課題</span>') &&
  withoutJapanesePhrases(japaneseProblem).includes('<h2 class="h2">AI を使いこなす人が辞めると、一からやり直しになる。</h2>') &&
  !/data-draft|draft-tag|sa-svg|ho-svg|ed-svg/.test(japaneseProblem) &&
  japanese.includes('<script type="module" src="/problem.js"></script>'),
  "Japanese Problem must use the approved E6 heading and shared controller, without draft or legacy content.");
for (const [index, [id, heading, description]] of japaneseProblemCopy.entries()) {
  const attributes = japaneseFigures[index]?.[2] || "";
  const figure = japaneseFigures[index]?.[3] || "";
  check(japaneseFigures[index]?.[1] === id &&
    attributes.includes('tabindex="0"') && /\baria-label="[^"]*[\p{Script=Han}\p{Script=Hiragana}][^"]*"/u.test(attributes) &&
    !/図\s*0[123]|problem-action|data-action-|元に戻す/.test(figure) &&
    [...figure.matchAll(/<button\b[^>]*>/g)].every(([button]) => id === "teams" && button.includes('class="team-control"')) &&
    withoutJapanesePhrases(figure).includes(`<figcaption><h3>${heading}</h3><p>${description}</p></figcaption>`) &&
    /<p class="problem-status"[^>]*aria-live="polite"[^>]*>[^<]*[\p{Script=Han}\p{Script=Hiragana}][^<]*<\/p>/u.test(figure),
    `Japanese figure ${index + 1} needs approved copy, a focusable name, no number/action/reset and translated live status.`);
  for (const [, value] of figure.matchAll(/\b(?:aria-label|data-label(?:-idle|-playing|-changed)?|data-status(?:-idle|-playing|-changed)?)="([^"]*)"/g)) {
    check(/[\p{Script=Han}\p{Script=Hiragana}]/u.test(value), `Japanese ${id} has an untranslated state description.`);
  }
  const problemMarkup = source => withoutJapanesePhrases(source)
    .replace(/\b(?:aria-label|data-label(?:-idle|-playing|-changed)?|data-status(?:-idle|-playing|-changed)?)="[^"]*"/g, 'data-translated="TEXT"')
    .replace(/>[^<]+</g, "><");
  check(problemMarkup(japaneseProblem) === problemMarkup(problemSection),
    "English and Japanese Problem markup and SVG must be identical apart from text.");
}
check(["文脈", "ルール", "ツール", "例外"].every(label => japaneseProblem.includes(`>${label}</text>`)) &&
  ["A", "B", "C"].every(team => japaneseProblem.includes(`>チーム ${team} を開く</span>`)),
  "Japanese handover layers and independently accessible team controls must be translated.");

const bodyStructure = source => {
  const body = source.match(/<body\b[^>]*>([\s\S]*?)<\/body>/)?.[1] || "";
  return [...withoutJapanesePhrases(body).replace(/<!-- GENERATED:CTA_FINAL:START -->[\s\S]*?<!-- GENERATED:CTA_FINAL:END -->/g, "")
    .replace(/<h1 class="hero-reveal"[^>]*>[\s\S]*?<\/h1>/g, '<h1 class="hero-reveal"></h1>')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>|<!--[\s\S]*?-->/g, "")
    .matchAll(/<(?!\/)([a-z][\w-]*)\b([^>]*)>/g)].map(([, tag, attributes]) =>
    [tag, attributes.match(/\bclass="([^"]*)"/)?.[1] || "", attributes.match(/\bid="([^"]*)"/)?.[1] || ""]);
};
const japaneseNavigation = [
  ["製品", "Product"], ["概要", "Overview"], ["仕組み", "How it works"],
  ["社員向け", "For employees"], ["管理者向け", "For admins"],
  ["セキュリティ", "Security"], ["リソース", "Resources"], ["会社情報", "Company"],
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
check(count(japaneseReveal, /<span style="--word:[0-3]">[^<]+<\/span>/g) === 4 &&
  [...japaneseReveal.matchAll(/--word:(\d)/g)].map(match => match[1]).join("") === "0123" &&
  japaneseReveal.replace(/<[^>]+>/g, "") === "全社員のAI力を最大限引き出す。" &&
  japanese.includes('aria-label="全社員のAI力を最大限引き出す。"') &&
  japanese.match(/<script id="jin-page-paint">([\s\S]*?)<\/script>/)?.[1] === paintScript,
  "Japanese hero must preserve its four-phrase reveal, exact approved text, accessible name and motion opt-in.");
for (const [page, source, phrases] of [
  ["/ja/", japanese, ["使いこなす人が", "辞めると、", "やり直しになる。", "AI ハーネスの", "中身を、", "見てみませんか。"]],
  ["/ja/how-it-works/", japaneseHow, ["コンテクストは、", "AI ハーネスで、", "確かめて", "みませんか。"]],
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
check(count(japaneseHow, /class="screen" role="img" aria-label="[^"]+"/g) === 2 &&
  count(japaneseHow, /<img\b[^>]*class="screen-/g) === 4 &&
  demoScreens.every(([, , scenes]) => scenes.every(([className, filename]) =>
    japaneseHow.includes(`<img class="${className}" src="/assets/demo/${filename}" width="2880" height="1664" alt="" decoding="async" loading="eager">`))) &&
  japaneseHow.includes('<p class="step-note">例: <code>CLAUDE.md</code>、スキル、記憶のファイル、MCP の設定。</p>') &&
  japaneseHow.includes('<p class="step-note">パイロットでは、今は会社が手作業で承認します。</p>') &&
  japaneseHow.includes('href="/ja/#demo">デモを申し込む</a>') &&
  japaneseHow.includes('href="/ja/security/">データとセキュリティ &rarr;</a>'),
"Japanese How it works must retain its example, manual pilot caveat and demo CTA.");

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
  check(!/\bDiscord\b/i.test(source), `${relativePath} contains a retired community mention.`);
}

const htmlFiles = deployedFiles.filter((file) => file.endsWith(".html"));
const deployedFileSet = new Set(deployedFiles);
const htmlCache = new Map();
for (const relativePath of htmlFiles) htmlCache.set(relativePath, await text(relativePath));

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
      const window = stage.children[0];
      const screen = window?.children[0];
      check(stage.name === "figure" && stage.children.length === 1 &&
        window?.name === "div" && hasClass(window, "demo-window") && window.children.length === 1 &&
        screen?.name === "div" && (hasClass(screen, "hero-screen") || hasClass(screen, "screen")) &&
        screen.children.length > 0 && screen.children.every(child =>
          child.name === "img" || child.name === "iframe" ||
          (child.name === "template" && child.children.length === 1 && child.children[0].name === "iframe")),
        `${relativePath}: demo-stage must contain only one demo-window and the existing screen, with no added title bar.`);
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
