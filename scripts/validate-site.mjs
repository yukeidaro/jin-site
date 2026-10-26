import { readFile, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { CONSENT_VERSION, isAppsScriptEndpoint } from "../waitlist.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = path.join(root, "_site");
const errors = [];
const approvedCompanySolution = "Context, instructions, tools, and workflows stay with the company, not with one person. Even when someone leaves, the setup keeps working and the next person can continue from there.";

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
  "assets/figures/problem-tools.webp",
  "assets/figures/problem-busy.webp",
  "assets/figures/problem-how.webp",
  "assets/figures/today.webp",
  "assets/figures/with-jin.webp",
  "assets/figures/control.webp",
  "assets/figures/how-it-works-wide.webp",
  "assets/figures/how-it-works-tall.webp",
  "assets/figures/why-jin.webp",
  "assets/figures/team-learning.webp",
  "base.css",
  "brand/jin-mark.svg",
  "brand/jin-mark-white.svg",
  "brand/jin-mark-email.png",
  "company/index.html",
  "copy.js",
  "en/index.html",
  "favicon.ico",
  "favicon.svg",
  "googled8075da2e5b1406b.html",
  "human/index.html",
  "index.html",
  "inbox-demo.js",
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
  "site-page.css",
  "theme-en.css",
  "theme-ja.css",
  "sitemap.xml",
  "waitlist.mjs",
  "workflow.js"
].sort();

const deployedFiles = await listFiles(site);
check(JSON.stringify(deployedFiles) === JSON.stringify(expectedFiles), `Unexpected Pages artifact: ${deployedFiles.join(", ")}`);

const emailLogo = await readFile(path.join(site, "brand", "jin-mark-email.png"));
check(emailLogo.length < 20 * 1024 &&
  emailLogo.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
  emailLogo.toString("ascii", 12, 16) === "IHDR" &&
  emailLogo.readUInt32BE(16) === 272 && emailLogo.readUInt32BE(20) === 80,
  "The email logo must be a 272 x 80 PNG (2x its 136 x 40 email size) below 20 KB.");

const favicon = await readFile(path.join(site, "favicon.ico"));
check(favicon.length >= 62 &&
  favicon.readUInt16LE(0) === 0 && favicon.readUInt16LE(2) === 1 && favicon.readUInt16LE(4) === 1 &&
  favicon[6] === 48 && favicon[7] === 48 &&
  favicon.readUInt16LE(10) === 1 && favicon.readUInt16LE(12) === 32 &&
  favicon.readUInt32LE(14) === favicon.length - 22 && favicon.readUInt32LE(18) === 22 &&
  favicon.subarray(22, 30).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
  favicon.toString("ascii", 34, 38) === "IHDR" &&
  favicon.readUInt32BE(38) === 48 && favicon.readUInt32BE(42) === 48,
  "The favicon must be a valid ICO container with a 48 x 48, 32-bit PNG image.");

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

const bingVerificationTag = '<meta name="msvalidate.01" content="7BF9C14D3232C5E464C8A6578E107EC5">';
check(home.split(bingVerificationTag).length === 2 &&
  home.match(/<head>([\s\S]*?)<\/head>/)?.[1].includes(bingVerificationTag),
  "index.html must contain the exact Bing Webmaster Tools verification meta tag once, inside <head>.");

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
  ["", home, japanese, "もし、仕事がもう終わっていたら？", "Jin AI | もし、仕事がもう終わっていたら",
    "Jinは、繰り返しの仕事を見つけて準備し、チームのフィードバックから学びます。"],
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
    const imageAlt = "Jin AI";
    check(source.includes(`<meta ${attribute}="${name}" content="${imageAlt}">`),
      `${page} must use the approved ${name}.`);
  }
}
const shareImage = await readFile(path.join(site, "shots", "og-b2b.png"));
check(shareImage.length >= 24 && shareImage.length < 60000 &&
  shareImage.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
  shareImage.toString("ascii", 12, 16) === "IHDR" &&
  shareImage.readUInt32BE(16) === 1200 && shareImage.readUInt32BE(20) === 630,
  "The logo share image must be a 1200 x 630 PNG below 60 KB.");
check(home.includes("<main>") && home.includes("</main>"), "Root must have a main landmark.");
const homeSections = [...home.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/g)];
const homeSectionOrder = "problem,solution,data,how,why,team,demo";
check(homeSections.length === 8 && homeSections[0]?.[1].includes('class="hero"') &&
  homeSections.slice(1).map((match) => match[1].match(/\bid="([^"]+)"/)?.[1]).join() === homeSectionOrder,
  "Root must contain only hero, problem, solution, data, how, why, team and demo sections, in order.");
check(count(home, /<h1\b/g) === 1 &&
  home.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]*>/g, "") === "What if the work was already done?",
  "Root must use the approved H1 once.");
const homeTitle = "Jin AI | What if the work was already done?";
check(home.includes(`<title>${homeTitle}</title>`), "Root must use the approved title.");
for (const [attribute, name] of [["property", "og:title"], ["name", "twitter:title"]]) {
  check(home.includes(`<meta ${attribute}="${name}" content="${homeTitle}">`), `Root must use the approved ${name}.`);
}
const homeDescription = "Jin spots repetitive tasks, prepares the work, and learns from your team's feedback.";
for (const [attribute, name] of [["name", "description"], ["property", "og:description"], ["name", "twitter:description"]]) {
  check(home.includes(`<meta ${attribute}="${name}" content="${homeDescription}">`), `Root must use the approved ${name}.`);
}
const hero = homeSections[0]?.[2] || "";
check(count(hero, /<p\b/g) === 2 && hero.includes('<p class="hero-intro">') &&
  hero.includes('<p class="hero-note">Works with the email, calendar, and chat your team already uses.</p>') &&
  !/<img\b|<ul\b|class="(?:eyebrow|lede|waitnote|hero-badges)"/.test(hero),
  "The hero must contain only the intro and tools note, without a status tag, badges or product image.");
check(hero.includes('href="#how">See how it works &rarr;</a>'), "The hero must link to the How it works section.");
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
const inboxClient = await text("inbox-demo.js");
const homeFigureCss = await text("site-page.css");
for (const [language, page, copy] of [
  ["English", home, [
    "Jin AI inbox demo", "Mail app", "Inbox", "Select a message",
    "Q4 pilot kickoff timing", "Northwind Billing", "Your October invoice", "Notes from Thursday", "Re: security questionnaire",
    "Hi Yu,", "Our team is ready a bit earlier than planned. Could we move the pilot kickoff to next week? 30 minutes is enough. Send me a few times that work for you.",
    "Thanks,<br>Sarah", "Nothing to prepare for this one, so Jin stays out of the way.",
    "Your reply to Sarah is ready", "I checked your calendar and picked 3 open times next week.",
    "Show", "Send", "Not now", "Undo", "Replay", "Open on your calendar", "Draft",
    "Preparing…", "Sent to Sarah", "Okay, not now", "You: Next week works well…", "Yu Asano · just now", "Sent",
    "Tue 10/28 · 10:00 AM PT", "Wed 10/29 · 2:30 PM PT", "Thu 10/30 · 9:00 AM PT",
    "Hi Sarah,\n\nNext week works well. Would {long} at {at} PT work for a 30-minute kickoff? If not, {other1} or {other2} PT are open too.\n\nBest,\nYu Asano",
    "<b>Open an email.</b> Jin drops down from the top of the screen with the work already done."
  ]],
  ["Japanese", japanese, [
    "Jin AIの受信箱デモ", "メールアプリ", "受信箱", "メールを選んでください",
    "第4四半期の試験導入キックオフの日程", "Northwind 請求担当", "10月分の請求書", "木曜日の打ち合わせメモ", "Re: セキュリティ質問票",
    "Yuさん", "チームの準備が予定より少し早く整いました。試験導入のキックオフを来週に早められますか？30分あれば十分です。ご都合のよい日時をいくつか教えてください。",
    "よろしくお願いします。<br>Sarah", "このメールで準備することはないので、Jinは何も表示しません。",
    "Sarahへの返信ができています", "カレンダーを見て、来週の空き時間を3つ選びました。",
    "表示", "送信", "今はしない", "元に戻す", "もう一度見る", "カレンダーの空き時間", "下書き",
    "準備しています…", "Sarahに送信しました", "わかりました。今はしません", "自分：来週で大丈夫です…", "Yu Asano · たった今", "送信済み",
    "10月28日（火）10:00（太平洋時間）", "10月29日（水）14:30（太平洋時間）", "10月30日（木）9:00（太平洋時間）",
    "Sarahさん\n\n来週で大丈夫です。30分のキックオフを、{long}{at}（太平洋時間）に行うのはいかがでしょうか。難しければ、{other1}か{other2}（いずれも太平洋時間）も空いています。\n\nよろしくお願いします。\nYu Asano",
    "<b>メールを開くと、</b>Jinが準備を済ませて、画面の上から降りてきます。"
  ]]
]) {
  const demo = page.match(/<div class="product-viewport">\s*(<figure class="inbox-demo"[\s\S]*?<\/figure>)\s*<\/div>/)?.[1] || "";
  check(/<\/section>\s*<div class="product-viewport">\s*<figure class="inbox-demo"[\s\S]*?<\/figure>\s*<\/div>\s*<section class="section" id="problem">/.test(page) &&
    count(page, /class="inbox-demo"/g) === 1 && !/brief-stage|jin-hero-demo|class="demo-stage"/.test(page),
    `${language} must show exactly one inbox demo directly after the hero and before Problem, replacing the retired brief.`);
  check(copy.every(value => demo.includes(value)) &&
    ["Sarah Chen", "Marcus Lee", "Priya Raman", "Yu Asano", "sarah@contoso.com"].every(name => demo.includes(name)) &&
    count(demo, /class="msg[^"]*" data-id=/g) === 4 && count(demo, /class="time" /g) === 3 &&
    /class="jin" data-state="ready"/.test(demo) &&
    /class="email-sarah">\s*<h2>/.test(demo) && /class="empty email-empty" hidden/.test(demo),
    `${language} inbox must retain Yu's mail list, email, exact localized copy, three times and static ready fallback.`);
  const labels = language === "English" ? ["Show", "Send", "Not now", "Undo", "Replay"] :
    ["表示", "送信", "今はしない", "元に戻す", "もう一度見る"];
  check(["pill show", "pill primary", "pill later", "undo", "replay"].every((className, index) =>
    new RegExp(`<button type="button" class="${className}"(?: hidden)?>${labels[index]}</button>`).test(demo)),
    `${language} inbox must retain each exact Show, Send, Not now, Undo and Replay button label.`);
  check(page.includes('<link rel="stylesheet" href="/site-page.css">') &&
    page.includes('<script src="/inbox-demo.js" defer></script>') && !/Geist/i.test(page),
    `${language} must load the shared local inbox assets without Geist.`);
  for (const [element, tag, url] of page.matchAll(/<(script|link)\b[^>]*(?:src|href)="(https?:\/\/[^"]+)"[^>]*>/g)) {
    if (tag === "link" && !/\brel="(?:stylesheet|preconnect)"/.test(element)) continue;
    check(["fonts.googleapis.com", "fonts.gstatic.com", "static.cloudflareinsights.com"].includes(new URL(url).hostname),
      `${language} must not add an external resource host: ${url}`);
  }
}
check(inboxClient.includes("new IntersectionObserver") &&
  inboxClient.includes('matchMedia("(prefers-reduced-motion: reduce)")') &&
  inboxClient.includes("visible && !started && !reduced.matches") &&
  inboxClient.includes("!visible || document.hidden || reduced.matches") &&
  inboxClient.includes("if (reduced.matches) openMail(sarah, true)") &&
  inboxClient.includes("document.hidden") && inboxClient.includes("clearTimeout(timer)") &&
  inboxClient.includes('setState("open")') && inboxClient.includes('setState("done", root.dataset.sent)') &&
  !/\b(?:fetch|XMLHttpRequest|WebSocket|import)\s*\(/.test(inboxClient),
  "Inbox playback must be viewport/motion guarded, pause hidden timers, support Show/Send/Undo and never send real requests.");
check(homeFigureCss.includes("font: 14px/1.5 var(--font-sans)") &&
  cssBlock(homeFigureCss, "@media (prefers-reduced-motion: reduce)").includes("animation: none !important; transition: none !important") &&
  !/@import|\burl\s*\(|Geist/.test(homeFigureCss),
  "Inbox must inherit existing fonts, fully disable reduced-motion animation and load no external CSS resources.");
const scopedHomeCss = homeFigureCss.replace(`@keyframes inbox-rise {${cssBlock(homeFigureCss, "@keyframes inbox-rise")}}`, "");
for (const [, selectors] of scopedHomeCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  check(selectors.split(/,(?![^(]*\))/).every(selector => /^\s*\.(?:inbox-demo|home-page)\b/.test(selector)),
    `Home-only styles must remain scoped: ${selectors.trim()}`);
}
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
check(count(home, /<img\b[^>]*src="assets\/demo\//g) === 0 &&
  !/demo-[134]-|admin console|screen-by-role|screen-what-can-move/.test(home),
  "Root must not show admin screens or any still beyond the Categories fallback.");
check(!home.includes("Turn the AI you already use into an assistant that actually knows you") &&
  !home.includes("plugin-screen.png") && !home.includes("privacy-tabs.mjs") &&
  !/<section\b[^>]*\bid="(?:what|benefits|privacy|waitlist)"/.test(home),
  "Root must not publish the old headline, product image, privacy tabs or retired sections.");
check(!/[\u2013\u2014\u2018\u2019\u201c\u201d]/u.test(home),
  "Root must not contain em dashes, en dashes or curly quotes.");
check(!/(?:\$|\bPro\b|Cloud Sync|Baby Voice|TikTok|\bsetup\b)/i.test(home.replaceAll(approvedCompanySolution, "")),
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
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: Claude-User
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Perplexity-User
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: Bingbot
Allow: /

User-agent: *
Allow: /

Sitemap: https://jinai.md/sitemap.xml
`, "robots.txt policy has drifted.");

const sitemapPageUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const sitemapUrls = [...sitemapPageUrls].sort();
check(JSON.stringify(sitemapUrls) === JSON.stringify(
  pagePairs.flatMap(([route]) => [`https://jinai.md/${route}`, `https://jinai.md/ja/${route}`]).sort()),
  "Sitemap must contain exactly the twelve English and Japanese content page URLs, without retired articles.");
check(!llms.includes(".md)"), "llms.txt must not link to Markdown mirrors.");
check(llms.startsWith("# Jin AI\n\n> "), "llms.txt must begin with an H1 and blockquote summary.");
const expectedLlmsPages = `## Pages\n\n${(await Promise.all(sitemapPageUrls.map(async (url) => {
  const page = await text(path.join(...new URL(url).pathname.split("/"), "index.html"));
  const title = page.match(/<title>([^<]+)<\/title>/)?.[1];
  const description = page.match(/<meta name="description" content="([^"]+)">/)?.[1];
  check(title && description, `${url} needs its title and meta description for the LLM page index.`);
  return `- [${title}](${url}): ${description}`;
}))).join("\n")}`;
const llmsPages = llms.match(/(?:^|\n\n)(## Pages\n\n[\s\S]*?)(?=\n\n## |$)/)?.[1];
const exactLlmsPages = llmsPages === expectedLlmsPages && count(llms, /^## Pages$/gm) === 1;
check(exactLlmsPages, "llms.txt Pages must list every sitemap URL once, in order, with its exact HTML title and meta description.");
check(!llms.includes("sole canonical product page") && !llms.includes("Canonical indexable URL."),
  "llms.txt must describe the canonical Human pages in the plural.");

const content = JSON.parse(contentJson);
check(content.product.name === "Jin AI", "Structured data product name is invalid.");
check(content.product.status === "building", "Structured data must state the Building status.");
function exactElement(source, tag, value) {
  return [...withoutJapanesePhrases(source).matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "g"))]
    .filter(([, inner]) => inner === value).length === 1;
}
const homeSection = (source, id) =>
  source.match(new RegExp(`<section\\b[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)</section>`))?.[1] || "";
const homeSteps = [
  ["Connect your tools", "Jin works with the tools your team already uses, with the permissions you choose."],
  ["Spot repetitive work", "It looks for tasks that keep coming up and chances to save time."],
  ["Get the work ready", "Jin prepares drafts and other work for your team to review."],
  ["Learn what works", "Every approval, edit, or rejection helps Jin understand what to do differently next time."]
];
const japaneseHomeSteps = [
  ["ツールをつなぐ", "チームがいつも使っているツールと、選んだ権限でつながります。"],
  ["繰り返しの仕事を見つける", "何度も出てくる作業や、時間を節約できるところを探します。"],
  ["仕事を準備する", "たたき台などを用意し、チームが確認できるようにします。"],
  ["うまくいくやり方を学ぶ", "承認、修正、却下のひとつひとつから、次にどうするかを学びます。"]
];
const pairs = (id, items) => items.flatMap(([title, body]) => [[id, "h3", title], [id, "p", body]]);
const homeCopy = [
  ["English", home, [
    ["problem", "h2", content.problem.headline],
    ["problem", "p", "Companies have invested in ChatGPT, Copilot, and other AI tools."],
    ["problem", "p", "But employees still spend hours preparing for meetings, putting together reports, and moving information between apps."],
    ["problem", "p", `<strong>${content.problem.closing}</strong>`],
    ["solution", "h2", content.solution.headline],
    ...pairs("solution", content.solution.steps.map(step => [step.name, step.description])),
    ["solution", "p", `<strong>${content.solution.closing}</strong>`],
    ["how", "h2", "Jin learns how your team works"],
    ...pairs("how", homeSteps),
    ["why", "h2", "Your team shouldn't have to build their own automations"],
    ["why", "p", "Most AI tools are useful once someone knows what to ask. Workflow builders are powerful, but someone still has to decide what to automate and set it up."],
    ["why", "p", "<strong>Jin takes a different approach.</strong> It finds chances to help, prepares the work, and suggests what could be automated next. Your employees don't need to become AI experts to benefit from AI."],
    ["team", "h2", "One person's improvement can help the whole team"],
    ["team", "p", "When someone improves a result, Jin learns what changed and why. Over time, those lessons can help others doing similar work, without everyone starting from scratch."],
    ["team", "p", "What gets shared is the way of doing the task, not anyone's emails or files. An admin reviews each improvement before it reaches other teams."],
    ["team", "p", "<strong>The more your team teaches Jin, the more useful it becomes for everyone.</strong>"]
  ]],
  ["Japanese", japanese, [
    ["problem", "h2", "AIツールはあるのに、なぜまだ全部自分でやっているのでしょう？"],
    ["problem", "p", "多くの会社が、ChatGPTやCopilotなどのAIツールに投資してきました。"],
    ["problem", "p", "それでも社員は、会議の準備、報告書づくり、アプリ間の情報の移し替えに、何時間も使っています。"],
    ["problem", "p", "<strong>AIは使える。でも、価値を引き出すには、まだ手間がかかります。</strong>"],
    ["solution", "h2", "もし、AIが先に動いてくれたら？"],
    ...pairs("solution", [
      ["いま", "社員がやることを考え、AIツールを開き、背景を伝え、結果を確かめています。"],
      ["Jinなら", "Jinが次に来る仕事に気づいてたたき台を用意し、社員は都合のよいときに確認します。"]
    ]),
    ["solution", "p", "<strong>AIに頼むところからではなく、準備ができた仕事から始められます。</strong>"],
    ["data", "h2", "下準備はJinが。決めるのは、あなたのチームです。"],
    ["data", "p", "Jinは、チームがつないだメール、カレンダー、チャット、ファイル（Gmail、Outlook、Slack、Teamsなど）を読み、正確な準備をします。読んだ内容は、その人の仕事の準備にだけ使い、AIモデルの学習には使いません。管理者は、フォルダ、チャンネル、ラベル、チームごとに対象から外せます。"],
    ["data", "li", "Jinを使えるチームとツールは、管理者が選びます。社員は自分のアカウントをつなぎ、いつでも外せます。"],
    ["data", "li", "Jinは、承認なしにメッセージを送ったり、システムを変えたりしません。"],
    ["data", "li", "Jinが見つけたことは本人に届き、上司には届きません。Jinは人を採点したり、順位を付けたりしません。"],
    ["data", "li", "データは会社ごとに分けて保管します。Jinが画面を録画することはありません。"],
    ["data", "p", "<strong>いつも役に立ち、いつもあなたの管理下に。</strong>"],
    ["how", "h2", "Jinは、チームの働き方を学びます。"],
    ...pairs("how", japaneseHomeSteps),
    ["why", "h2", "自動化を、社員が自分で作る必要はありません。"],
    ["why", "p", "多くのAIツールは、何を頼めばよいかが分かっている人にとって便利なものです。ワークフローを作るツールは強力ですが、何を自動化するかを決めて設定する人が必要です。"],
    ["why", "p", "<strong>Jinのやり方は違います。</strong> 手伝えるところを見つけ、仕事を準備し、次に自動化できそうなことを提案します。社員がAIの専門家にならなくても、AIの恩恵を受けられます。"],
    ["team", "h2", "一人の改善が、チーム全体の助けになる。"],
    ["team", "p", "誰かが結果を直すと、Jinは何がなぜ変わったのかを学びます。その学びは、似た仕事をするほかの人の助けになり、みんなが一から始めずに済みます。"],
    ["team", "p", "共有されるのは仕事のやり方で、誰かのメールやファイルではありません。ほかのチームに届く前に、管理者がひとつずつ確認します。"],
    ["team", "p", "<strong>チームがJinに教えるほど、Jinはみんなの役に立つようになります。</strong>"]
  ]]
];
for (const [language, source, entries] of homeCopy) {
  for (const [id, tag, value] of entries) {
    check(exactElement(homeSection(source, id), tag, value), `${language} home ${id} must use the approved ${tag} once: ${value}`);
  }
  check(count(homeSection(source, "how"), /<li>/g) === 4 &&
    ["problem", "solution", "data", "how", "why", "team"].every(id => !/<(?:svg|button|iframe)\b/.test(homeSection(source, id))) &&
    !/problem\.js|data-problem|data-solution/.test(source),
    `${language} home sections must retain four HTML How it works steps and no retired interactive figures or controller.`);
}
const sectionImages = [
  ["problem", "problem-tools", 1200, 309, "", ""],
  ["problem", "problem-busy", 900, 640, "", ""],
  ["problem", "problem-how", 1079, 636, "", ""],
  ["solution", "today", 1200, 750, "", ""],
  ["solution", "with-jin", 1200, 750, "", ""],
  ["data", "control", 1600, 800, "Drafts prepared by Jin are sent out only after a person approves them.", "Jinが用意した下書きは、人が承認してから外に出る"],
  ["how", "how-it-works-wide", 1600, 360, "Four steps: connect, spot, prepare, and learn.", "つなぐ、見つける、用意する、学ぶの4段階"],
  ["why", "why-jin", 1600, 800, "A comparison of automations you build yourself and automations Jin finds and offers.", "自分で組む自動化と、Jinが見つけて差し出す自動化の比較"],
  ["team", "team-learning", 1600, 800, "One person's improvement reaches others doing similar work after review.", "1人の改善が、確認を経て、似た仕事をする人たちに届く"]
];
for (const [id, name, width, height, enAlt, jaAlt] of sectionImages) {
  const bytes = await readFile(path.join(site, "assets", "figures", `${name}.webp`));
  check(bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 16) === "WEBPVP8X" &&
    bytes.readUIntLE(24, 3) + 1 === width && bytes.readUIntLE(27, 3) + 1 === height,
    `${name} must keep its original WebP pixel dimensions.`);
  for (const [language, page, alt] of [["English", home, enAlt], ["Japanese", japanese, jaAlt]]) {
    const section = homeSection(page, id);
    check(section.includes(`src="/assets/figures/${name}.webp" width="${width}" height="${height}" loading="lazy" decoding="async" alt="${alt}"`) &&
      count(section, /<img\b/g) === sectionImages.filter(image => image[0] === id).length,
      `${language} ${id} must have exactly its approved images, with intrinsic dimensions, lazy/async loading and exact alt.`);
  }
}
const tallFigure = await readFile(path.join(site, "assets", "figures", "how-it-works-tall.webp"));
check(tallFigure.toString("ascii", 8, 16) === "WEBPVP8X" &&
  tallFigure.readUIntLE(24, 3) + 1 === 750 && tallFigure.readUIntLE(27, 3) + 1 === 1440,
  "The tall How it works image must keep its 750 x 1440 dimensions.");
for (const [language, page] of [["English", home], ["Japanese", japanese]]) {
  check(/<picture class="how-figure">\s*<source media="\(max-width: 760px\)" srcset="\/assets\/figures\/how-it-works-tall.webp" width="750" height="1440">\s*<img src="\/assets\/figures\/how-it-works-wide.webp"[^>]+>\s*<\/picture>/.test(homeSection(page, "how")) &&
    /class="compare-before"[\s\S]*?src="\/assets\/figures\/today.webp"[\s\S]*?class="compare-after"[\s\S]*?src="\/assets\/figures\/with-jin.webp"/.test(homeSection(page, "solution")) &&
    count(homeSection(page, "problem"), /class="problem-scene"><p[\s\S]*?<\/p><img src="\/assets\/figures\/problem-(?:tools|busy|how).webp"/g) === 3 &&
    !/assets\/figures\/brief-/.test(page),
    `${language} must pair each Problem point and Today/With Jin column with its image, and use the responsive How picture instead of a brief image.`);
}
check(JSON.stringify(content.problem.points.map(point => point.description)) === JSON.stringify([
  "Companies have invested in ChatGPT, Copilot, and other AI tools.",
  "Employees still spend hours preparing for meetings, putting together reports, and moving information between apps."
]) && content.solution.status === "building" &&
  JSON.stringify(content.solution.steps.map(step => step.name)) === JSON.stringify(["Today", "With Jin"]),
  "Problem and Solution facts must match the approved home copy.");
const featureCopy = [
  ["connect", "Connect once", "一度つなぐだけ", "Connect your usual AI tools once, through MCP.", "MCPで、いつものAIツールに一度つなぐだけ。", "Connect in one click", "ワンクリックでつなぐ", "demo-1-connect.webp", "connect"],
  ["categories", "See every part by type", "種類ごとに見る", "Skills, prompts, memory and MCP settings, sorted by type.", "スキル・プロンプト・記憶・MCPの設定を、種類ごとに整理して見られる。", "See every part by type", "種類ごとに見る", "demo-2-categories.webp", "categories"],
  ["departments", "See what each team uses most", "部署ごとの使われ方を見る", "See which harnesses each department uses most.", "部署ごとに、何がいちばん使われているかが分かる。", "See what each team uses most", "部署ごとの使われ方", "demo-3-by-role.webp", "by-role"],
  ["classify", "Separate personal from company", "個人と会社を分ける", "Keep what came from personal AI apart from parts that hold confidential company context.", "個人のAIから持ってきたものと、会社の機密を含むものを分けて管理できる。", "Separate personal from company", "個人と会社を分ける", "demo-4-what-can-move.webp", "what-can-move"],
  ["tools", "Control approved AI tools", "承認したツールだけに", "Let people use only the tools you approve. For example: Claude Code for developers only, your company policy in Copilot, and only non-confidential parts in ChatGPT.", "承認したツールだけを使わせる。たとえば、Claude Codeは開発者だけ、Copilotには会社のポリシー、ChatGPTには機密を含まないものだけ。", "Control approved AI tools", "承認したツールだけに"]
];
check(JSON.stringify(content.how_it_works?.features) === JSON.stringify(featureCopy.map(f => ({ name: f[1], description: f[3] }))),
  "How it works facts must keep the five unchanged features.");
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
const homeClosingCopy = "Let's find one task your team never wants to do again";
const japaneseHomeClosingCopy = "もう二度とやりたくない仕事を、ひとつ見つけましょう。";
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
for (const [page, date, sections] of [
  [privacy, "Last updated: October 21, 2026", [
    ["What we collect", "When you join the waitlist, we collect your first and last name, work email, job title and company. If you also request a demo, we collect your phone number, industry, company size and country. We use your phone number only to arrange your demo. We also record when each request was made and whether its confirmation email was sent."],
    ["How we use it", "We use waitlist details to send confirmation and access updates. If you request a demo, we use your details to reply, arrange a time and follow up about that request. We do not sell your information, share it for advertising or use it to train AI models."],
    ["Who processes it for us", "We use Google (Google Apps Script, Google Sheets and Gmail) to store waitlist signups and demo requests and send confirmations, GitHub to host the site, and Cloudflare to count visits. We use Cal.com for demo booking. Opening the booking link sends Cal.com your prefilled name and email; when you book, it also receives your chosen time. These providers may process information outside your country."],
    ["Cookies and Do Not Track", "jinai.md does not use cookies. The separate booking page on cal.com may use cookies. We do not track you across other websites, so we do not respond differently to Do Not Track signals."],
    ["How long we keep it", "We keep waitlist details while we send access updates, and demo request details for as long as needed to reply and follow up. You can ask us to delete them sooner."]
  ]],
  [japanesePrivacy, "最終更新日: 2026 年 10 月 21 日", [
    ["お預かりする情報", "ウェイトリストに登録するとき、姓名、会社のメールアドレス、役職、会社名をお預かりします。デモもお申し込みいただく場合は、電話番号、業種、従業員数、国もお預かりします。電話番号は、デモの日程調整のためだけに使います。あわせて、それぞれのお申し込みの日時と、確認メールを送れたかどうかを記録します。"],
    ["利用目的", "ウェイトリストの情報は、登録確認とご案内のために使います。デモをお申し込みいただいた場合は、返信、日程調整、そのお申し込みについてのご連絡に使います。情報を販売したり、広告のために提供したり、AI モデルの学習に使ったりすることはありません。"],
    ["取り扱いを委託している事業者", "ウェイトリスト登録とデモのお申し込みの保存、確認メールの送信には Google（Google Apps Script、Google スプレッドシート、Gmail）を、サイトの公開には GitHub を、閲覧数の集計には Cloudflare を使っています。デモの予約には Cal.com を使っています。予約リンクを開くと、入力済みの姓名とメールアドレスが Cal.com に送られ、予約すると、選んだ日時も送られます。これらの事業者は、お客様のお住まいの国の外で情報を取り扱うことがあります。"],
    ["Cookie と Do Not Track", "jinai.md は Cookie を使っていません。別のサイトである cal.com の予約ページでは、Cookie が使われることがあります。ほかのサイトをまたいでお客様を追跡しないため、Do Not Track の信号によって動きを変えることはありません。"],
    ["保存する期間", "ウェイトリストの情報はご案内に必要な間、デモのお申し込みの情報は返信とその後のご連絡に必要な間だけ保存します。ご依頼があれば、それより前に削除します。"]
  ]]
]) {
  check(exactElement(page, "p", date), "Privacy must use the R13e approval date.");
  for (const [heading, paragraph] of sections) {
    check(withoutJapanesePhrases(page).includes(`<h2>${heading}</h2>\n<p>${paragraph}</p>`),
      `Privacy must put the exact waitlist/demo and booking disclosure under ${heading}.`);
  }
}
for (const [page, heading] of [[home, homeClosingCopy], [japanese, japaneseHomeClosingCopy],
  [howPage, closingCopy], [japaneseHow, japaneseClosingCopy]]) {
  const closing = page.match(/<section class="(?:demo|closing-cta)"[^>]*>([\s\S]*?)<\/section>/)?.[1] || "";
  check(exactElement(closing, "h2", heading),
    "Home and companion closing headings must match their approved copy exactly once.");
}
const removedScreenCaptionClass = ["screen", "caption"].join("-");
for (const [ja, source, homeSource] of [[false, howPage, home], [true, japaneseHow, japanese]]) {
  const label = ja ? "Japanese" : "English";
  check(!source.includes(removedScreenCaptionClass) && !/<figcaption\b/i.test(source),
    `${label} How it works must not contain screen captions or figcaption elements.`);
  const blocks = [...source.matchAll(/<section class="section workflow" id="(employee|admin)" aria-labelledby="([^"]+)">([\s\S]*?)<\/section>/g)];
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
      !body.includes(removedScreenCaptionClass) && !/<figcaption\b/i.test(body) &&
      body.includes(`<div class="screen${index === 4 ? " screen-placeholder" : ""}" role="img" aria-label="${caption}">`) &&
      body.includes('<div class="demo-window moving-frame">') &&
      body.includes(`<figure class="demo-stage"${index === 4 ? " hidden" : ""}>`) &&
      count(body, /<figure\b/g) === 1 &&
      (index < 4
        ? body.includes(`<img class="screen-${f[8]}" src="/assets/demo/${f[7]}" width="2880" height="1664" alt="" decoding="async" loading="lazy">`) &&
          count(body, /<img\b/g) === 1 && !/<iframe\b/.test(body)
        : body.includes('<span class="placeholder-mark" aria-hidden="true"></span>') && !/<(?:img|iframe|svg)\b/.test(body)),
      `${label} ${f[0]} needs its exact title, description, named screen and single still or empty tools placeholder, without a caption.`);
    check(index < 4
      ? body.includes(`<div class="screen-camera screen-${f[8]}">`) &&
        count(body, /class="screen-camera /g) === 1 && count(body, /class="workflow-cursor"/g) === 1 &&
        count(body, /<svg\b/g) === 1 && camera.includes(cursor) && /<img\b[^>]*>\s*<svg/.test(camera)
      : !/screen-camera|workflow-cursor/.test(body),
      `${label} ${f[0]} must keep one decorative arrow and click ring inside its still's transformed camera layer, with none in the hidden tools stage.`);
  });
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
    .replace(/<[^>]*>/g, " ").replaceAll("Next week works well.", "");
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
// How it works and Security keep their own data promises until they are rewritten for the proactive pitch.
const companionDataPrinciples = {
  headline: "Your company's context stays yours",
  items: ["Each company's context is kept separate.", "Jin AI never records your screen.", "Jin AI itself never trains on your data."]
};
check(howPage.includes(`<h2 class="h2">${companionDataPrinciples.headline}</h2>`) &&
  companionDataPrinciples.items.every((item) => howPage.includes(`<li>${item}</li>`)) &&
  howPage.includes('<a class="btn btn-p" href="../#demo">Join the waitlist</a>'),
  "The companion page must include all data promises and the demo CTA.");
check(!/plugin-screen\.png|personal MCP|your own memory|#waitlist|Join &rarr;/.test(howPage),
  "The companion page must not publish the retired consumer copy or CTA.");
const closingBand = howPage.match(/<section class="closing-cta" aria-labelledby="closing-heading">([\s\S]*?)<\/section>/)?.[1] || "";
check(closingBand.includes('<div class="wrap">') &&
  closingBand.includes(`<h2 id="closing-heading">${closingCopy}</h2>`) &&
  count(closingBand, /<(?:a|button)\b/g) === 1 &&
  closingBand.includes('<a class="btn btn-p" href="../#demo">Join the waitlist</a>') &&
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
  security.includes(`<h1>${companionDataPrinciples.headline}</h1>`) &&
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
  ["property", "og:image:alt", "Jin AI"],
  ["name", "twitter:image:alt", "Jin AI"]
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
check(securityContact.includes(`<p>Questions about security? Email ${emailComponent()}. You can also join the waitlist and then request a demo.</p>`) &&
  securityContact.includes('<a class="btn btn-p" href="../#demo">Join the waitlist</a>') &&
  count(securityContact, /class="btn /g) === 1 && !/closing-cta/.test(security),
  "Security must use its separate wide contact band, not the How it works closing band.");
const japaneseSecurityContact = japaneseSecurity.match(/<div class="security-contact">([\s\S]*?)<\/main>/)?.[1] || "";
check(japaneseSecurityContact.includes(`<p>セキュリティについてのご質問は、${emailComponent(true)} までご連絡ください。ウェイトリストに登録後、デモもお申し込みいただけます。</p>`) &&
  japaneseSecurityContact.includes('<a class="btn btn-p" href="/ja/#demo">ウェイトリストに登録</a>'),
  "Japanese Security must show the exact R13e contact band and waitlist action.");
for (const [ja, page] of [[false, company], [true, japaneseCompany]]) {
  const contact = page.match(/<section aria-labelledby="contact-heading">([\s\S]*?)<\/section>/)?.[1] || "";
  check(contact.trim() === `<h2 id="contact-heading">${ja ? "お問い合わせ" : "Contact"}</h2>
    <p>${emailComponent(ja)}</p>
    <p class="community-contact">${ja ? "コミュニティ" : "Community"}: ${communityLink}</p>
    <a class="btn btn-p" href="/${ja ? "ja/" : ""}#demo">${ja ? "ウェイトリストに登録" : "Join the waitlist"}</a>`,
  "Company Contact must retain only the heading, email, community line and approved waitlist button.");
}

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
  check(source.includes('<a class="btn btn-p" href="/#demo">Join the waitlist</a>'),
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
    header.includes(`<a class="btn btn-p" href="${route ? "/#demo" : "#demo"}">Join the waitlist</a>`),
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
    "Company Our mission is to turn every company's AI into an asset it owns: secure, shared, and always up to date. Where we are Jin AI is an early-stage company. We build in close contact with the teams we talk to. Contact hello@jinai.md Community: Discord Join the waitlist"]
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
    ["property", "og:image:alt", "Jin AI"],
    ["name", "twitter:image:alt", "Jin AI"],
    ["name", "twitter:card", "summary_large_image"]
  ]) {
    check(source.includes(`<meta ${attribute}="${name}" content="${value}">`),
      `/${route} must have the approved ${name}.`);
  }
  check(source.includes('<meta name="robots" content="index,follow,max-image-preview:large">'),
    `/${route} must remain indexable.`);
}
check(company.includes(emailComponent()) &&
  company.includes('<a class="btn btn-p" href="/#demo">Join the waitlist</a>'),
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
  !englishCss.includes(`.${removedScreenCaptionClass}`) &&
  cssBlock(englishCss, ".email-contact").includes("justify-content: flex-start") &&
  cssBlock(englishCss, ".footer-column .copy-email").includes("justify-content: flex-start") &&
  !englishCss.includes("screen-crossfade") &&
  cssBlock(englishCss, "@media (prefers-reduced-motion: reduce)").includes(".moving-frame .screen img { animation: none; transform: none;"),
  "R3 rows need responsive text-first layout without screen captions, left-aligned email wrapping and independent reduced-motion stills.");
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
const reducedFigureCss = cssBlock(englishCss, "@media (prefers-reduced-motion: reduce)");
check(cssBlock(englishCss, ".shadow-boundary {").includes("stroke-dasharray: 4 5") &&
  cssBlock(englishCss, ".flat-document, .harness-icon").includes("stroke: var(--text-1)") &&
  cssBlock(englishCss, ".shadow-route, .shadow-ai, .shadow-warning").includes("stroke: var(--accent-light)") &&
  cssBlock(englishCss, ".flat-route {").includes("stroke-dasharray: 1; stroke-dashoffset: 1") &&
  cssBlock(englishCss, '[data-state="changed"] .flat-intro').includes("flat-in .3s") &&
  cssBlock(englishCss, '[data-state="changed"] .shadow-route').includes("problem-draw 1s linear .4s both") &&
  cssBlock(englishCss, '[data-state="changed"] .shadow-ai').includes("flat-in .3s ease 1.6s both") &&
  cssBlock(englishCss, '[data-state="changed"] .shadow-warning').includes("flat-finish 3s linear both") &&
  cssBlock(englishCss, '[data-problem="shadow"][data-state] .problem-art *').includes("animation-play-state: paused") &&
  cssBlock(englishCss, '[data-problem="shadow"][data-state].problem-flow-running .problem-art *').includes("animation-play-state: running") &&
  reducedFigureCss.includes('[data-problem="shadow"] .shadow-ai, [data-problem="shadow"] .shadow-warning { opacity: 1;') &&
  reducedFigureCss.includes(".problem-art .flat-route { stroke-dashoffset: 0;"),
  "Shadow AI needs a dashed frame, white document, growing vermilion line, bubble then warning, one three-second completion clock, hidden pause and reduced-motion end state.");
check(stageCss.includes("padding: var(--s-12)") && stageCss.includes("border: var(--border)") &&
  stageCss.includes("border-radius: 24px") && stageCss.includes("background: var(--surface-1)") &&
  windowCss.includes("overflow: hidden") && windowCss.includes("border-radius: var(--r-xl)") &&
  windowCss.includes("box-shadow: var(--shadow-float)") &&
  cssBlock(englishCss, "@media (max-width: 767px)").includes(
    ".demo-stage { width: calc(100% - 48px); padding: var(--s-4); }") &&
  !/product-frame|mask-image|--glow|\.demo-(?:stage|window)::(?:before|after)/.test(englishCss) &&
  cssBlock(englishCss, ".screen {").includes("aspect-ratio: 2880 / 1664"),
  "Demo stages must share responsive padding, outline, surface and floating windows without a fade, glow or extra chrome; screen ratios must remain.");
const paintScript = home.match(/<head>[\s\S]*?<script id="jin-page-paint">([\s\S]*?)<\/script>/)?.[1] || "";
check(paintScript.includes('document.documentElement.classList.add("js-nav")') &&
  /if\s*\(!matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches\)\s*document\.documentElement\.classList\.add\("js-reveal"\)/.test(paintScript),
  "Home reveal must opt in through a reduced-motion-guarded inline head script.");
const revealHeading = home.match(/<h1 class="hero-reveal">([\s\S]*?)<\/h1>/)?.[1] || "";
check(count(revealHeading, /<span style="--word:[0-6]">[^<]+<\/span>/g) === 7 &&
  !/aria-hidden|aria-label/.test(revealHeading) &&
  [...revealHeading.matchAll(/--word:(\d)/g)].map(match => match[1]).join("") === "0123456" &&
  [...revealHeading.matchAll(/<span[^>]*>([^<]+)<\/span>/g)].map(match => match[1]).join(" ") === content.product.headline,
  "Home H1 must contain seven ordered readable word spans with its exact accessible name.");
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
check(exactElement(dataSection, "h2", content.data_principles.headline) &&
  dataSection.includes(`<p class="trust-intro">${content.data_principles.introduction}</p>`) &&
  count(dataSection, /<li>/g) === content.data_principles.items.length &&
  content.data_principles.items.every((item) => dataSection.includes(`<li>${item}</li>`)) &&
  dataSection.includes(`<p class="narrative-close"><strong>${content.data_principles.closing}</strong></p>`),
  "Root must use the approved data introduction, every data promise and the closing line.");
const demoSection = homeSections.find((match) => match[1].includes('id="demo"'))?.[2] || "";
check(exactElement(demoSection, "h2", homeClosingCopy) &&
  demoSection.includes('id="waitlistForm"'), "The demo section must contain the approved heading and form.");
const demoIntro = demoSection.match(/<div class="demo-intro">([\s\S]*?)<\/div>\s*<\/div>/)?.[1] || "";
const gettingStarted = demoIntro.match(/<div class="getting-started">([\s\S]*)/)?.[1] || "";
check(gettingStarted.includes("<h3>Getting started</h3>") &&
  count(gettingStarted, /<ul>/g) === 1 &&
  JSON.stringify([...gettingStarted.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(match => match[1])) === JSON.stringify([
    "We start with one team and one repetitive task, and measure together how often people use what Jin prepared, how much time it saves, how much editing it needs, and what it costs to run.",
    "We're working through our waitlist, so thank you for your patience. Join below. After signing up, you can also request a demo for your company.",
    "The fastest way in is an introduction from someone already in the Jin AI private beta."
  ]),
  "The closing demo intro must contain the exact three-item Getting started list and H3.");
const japaneseGettingStarted = japanese.match(/<div class="getting-started">([\s\S]*?)<\/ul>/)?.[1] || "";
check(JSON.stringify([...japaneseGettingStarted.matchAll(/<li>([\s\S]*?)<\/li>/g)].slice(0, 2).map(match => match[1])) === JSON.stringify([
  "まず一つのチームと一つの繰り返しの仕事から始め、Jinが準備したものがどれだけ使われたか、どれだけ時間が浮いたか、どれだけ直しが必要だったか、動かす費用はいくらかを一緒に測ります。",
  "ウェイトリストの方から順にご案内しています。下のフォームからご登録ください。登録後、ご希望の方は会社向けのデモもお申し込みいただけます。"
]),
  "Japanese Getting started must open with the pilot measure, then the exact R13e waitlist copy.");
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
  check(!/AI is everywhere now|Is it really set up to last|Work context flows into personal|Agents, context and workflows live with whoever|One team finds what works|AIは全社に広がった|でも、本当に使いこなせていますか|仕事の文脈が、会社の外にある|エージェント、文脈、ワークフローが、作った人の中にしかない|うまくいくやり方が、ひとつのチームから広がらない/.test(plainText),
    `${filename} must not contain superseded Problem headings or bodies.`);
  for (const retired of retiredReviewTexts) {
    check(!plainText.includes(retired) && !source.includes(retired),
      `${filename} must not contain replaced R8 copy: ${retired}`);
  }
  const withoutApprovedInboxPilot = source.replaceAll("Q4 pilot kickoff timing", "")
    .replaceAll("Could we move the pilot kickoff to next week?", "");
  check(!/\bpilot(?:-card|-head|-heading|-steps)?\b|accent-surface-(?:from|to)/.test(withoutApprovedInboxPilot),
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
const retiredR11Copy = /Confidential parts stay inside|Agents, context and workflows stay with the role|The best skills reach every team|As people improve their setups|Jin AIが、会社のAIを|(?:安全に|会社に|みんなで)キープ|機密は会社の中に残し|エージェント、文脈、ワークフローは、人ではなく|いちばんいいスキルが、同じ仕事|社員が使い方を磨くたびに|AIエージェント、スキル、ナレッジを、安全に|会社の機密情報が、会社の管理の外|エージェントとワークフローは、作った人|チームが役に立つAIのワークフロー/;
for (const filename of [...deployedFiles.filter(file => /\.(?:html|json|txt|css|m?js)$/.test(file)),
  "README.md", ".github/copilot-instructions.md"]) {
  const source = filename.endsWith(".md") ? await readFile(path.join(root, filename), "utf8") : await text(filename);
  check(!retiredR11Copy.test(withoutJapanesePhrases(source).replace(/<[^>]*>/g, "")),
    `${filename} must not contain superseded R11 Solution, Japanese Problem or hero copy.`);
  check(!/>\s*(?:シャドーAI|(?:エージェントの|スキルの)(?:属人化|共有不足))\s*</.test(withoutJapanesePhrases(source)),
    `${filename} must not contain a retired standalone Japanese Problem title.`);
}
for (const [language, source] of [["English", home], ["Japanese", japanese]]) {
  for (const id of ["problem", "solution"]) {
    const section = source.match(new RegExp(`<section\\b[^>]*id="${id}"[^>]*>([\\s\\S]*?)</section>`))?.[1] || "";
    check(!/\b(?:number-label|step-number|figure-number)\b/.test(section) &&
      !/>\s*\d+(?:[.)、．]|\s*<)/.test(section) &&
      [...section.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/g)].every(([, heading]) =>
        !/^\s*\d+[.)、．]\s*/.test(heading.replace(/<[^>]*>/g, ""))),
    `${language} ${id} titles must not have number labels.`);
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
  "firstName,lastName,email,jobTitle,company,phone,industry,companySize,country,website",
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
  form.includes('We use these details for waitlist updates and, if you request one, to arrange your demo. See our <a href="privacy/">Privacy Policy</a>.'),
  "The demo form must show the approved privacy notice and use accessible inline validation.");
check(home.includes('src="waitlist.mjs"'), "The demo client must be loaded.");
check(!home.includes("waitlistSink") && !home.includes("formResponse"), "Google Forms and iframe-load confirmations must not be used.");
check(!home.includes("A welcome email is on its way"), "The page must not promise email before the server confirms a send.");
check(count(home, /<form\b/g) === 1 && Boolean(form), "There must be exactly one demo form.");
check(!access.survey && !/waitlistSurvey|signup-survey|type="radio"/.test(home),
  "The demo page must not contain the post-signup survey.");
check(form.includes('data-flow="waitlist"') &&
  form.includes('type="submit" disabled>Join the waitlist</button>'),
  "The waitlist button must remain disabled until the client is ready.");
const extraFields = form.match(/<fieldset class="signup-extra" id="demoFields" disabled hidden>([\s\S]*?)<\/fieldset>/)?.[1] || "";
check([...extraFields.matchAll(/<(?:input|select)\b[^>]*name="([^"]+)"/g)].map(match => match[1]).join() ===
  "phone,industry,companySize,country" &&
  access.form.waitlist.consent_version === "waitlist-product-updates-v1" &&
  access.form.waitlist.fields.join() === "firstName,lastName,email,jobTitle,company",
  "Only the four additional demo controls start hidden and disabled; step one retains the five waitlist fields and consent.");
check(home.includes('id="waitlist"') && home.includes('id="demoOffer" hidden') &&
  home.includes('<h3 id="demoQuestion">Want a demo too?</h3>') &&
  home.includes('id="openDemo" type="button" aria-controls="waitlistForm" aria-expanded="false">Request a demo</button>'),
  "Both form anchors and the initially hidden optional demo offer must remain available.");
check([home, japanese].every(page => page.includes('<div class="demo-form" id="request-demo">')),
  "Both home pages must retain the direct-demo anchor on the shared form wrapper.");
check(hero.includes(`<a class="btn btn-p" href="#demo">${access.hero_label}</a>`),
  "The hero CTA must jump to the demo form.");
const waitlistNote = "We'll email you when access is ready. You can request a demo after joining.";
check(access.note === waitlistNote && access.hero_note === waitlistNote &&
  access.form.privacy_note === "We use these details for waitlist updates and, if you request one, to arrange your demo." &&
  agent.includes(`<p>${waitlistNote}</p>`) &&
  llms.includes(`[Join the waitlist](https://jinai.md/#waitlist). ${waitlistNote}`) &&
  llms.includes("- [Canonical Human page](https://jinai.md/): Company and employee value, how it works, data and waitlist signup, with an optional demo request."),
  "The fact source, Agent reference and LLM index must use the exact R13e waitlist copy.");
for (const [page, initial, demo, fallback, ja] of [
  [home, waitlistNote, "Then you'll pick a time for your demo.",
    "Please enable JavaScript to join the waitlist here. You can also email ", false],
  [japanese, "ご案内の準備ができしだい、メールでお知らせします。登録後、デモもお申し込みいただけます。",
    "次に、デモの日時をお選びいただけます。",
    "ウェイトリストの登録には JavaScript を有効にしてください。メールでも受け付けています: ", true]
]) {
  check(page.includes(`<p class="waitnote" id="waitlistNote">${initial}</p>`) &&
    page.includes(`<p class="waitnote" id="demoNote" hidden>${demo}</p>`) &&
    page.includes(`<noscript><p class="waitalt">${fallback}${emailComponent(ja)}${ja ? "。" : "."}</p></noscript>`),
  "Both forms must generate the exact initial, demo-only and noscript notes in their proper states.");
}
check(demoClient.includes("waitlistNote.hidden = true;") && demoClient.includes("demoNote.hidden = false;"),
  "Both direct and post-waitlist demo entry must switch the generated notes.");
check(access.form.demo_note === "Then you'll pick a time for your demo." &&
  access.form.demo_booking.url === "https://cal.com/yu-jinai/jin-ai-demo" &&
  access.form.demo_booking.note === "Pick a 20-minute time that works for you. Times show in your time zone." &&
  access.form.demo_booking.label === "Pick a time",
  "The booking facts must match the demo-booking brief.");
for (const [page, note, label] of [
  [home, access.form.demo_booking.note, access.form.demo_booking.label],
  [japanese, "ご都合のよい時間を20分でお選びください。時間はお使いの地域の時刻で表示されます。", "日時を選ぶ"]
]) {
  const booking = page.match(/<div id="demoBooking" hidden>([\s\S]*?)<\/div>/)?.[1] || "";
  check(booking.includes(`<p>${note}</p>`) &&
    booking.includes(`<a class="btn btn-p" id="demoBookingLink" href="${access.form.demo_booking.url}" target="_blank" rel="noopener">${label}</a>`),
    "Both demo results need initially hidden booking instructions and a primary link that opens a new tab.");
  check(!/<(?:script|iframe)\b[^>]*(?:src|data-src)="https:\/\/(?:[^/]+\.)?cal\.com\b/.test(page),
    "Demo booking must not load a Cal.com script or iframe on jinai.md.");
}
check(!/<a[^>]*class="btn[^"]*"[^>]*href="#?"/.test(home), "No CTA may link to an empty or placeholder target.");
check(access.community?.url === communityUrl && access.community.name === "Discord" &&
  access.community.label === "Discord", "The community fact must use only the approved Discord name and invite.");
check(llms.includes(`[Discord](${communityUrl})`) && count(llms, /https:\/\/discord\.gg\//g) === 1,
  "The LLM index must publish the single approved community invite.");

const japaneseSections = [...japanese.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/g)];
check(japaneseSections.length === 8 && japaneseSections[0]?.[1].includes('class="hero"') &&
  japaneseSections.slice(1).map((match) => match[1].match(/\bid="([^"]+)"/)?.[1]).join() === homeSectionOrder,
  "Japanese home must keep the English home sections in order.");
for (const [language, source, introduction, note] of [
  ["English", home, content.product.description, "Works with the email, calendar, and chat your team already uses."],
  ["Japanese", japanese, "Jinは、繰り返しの仕事を見つけて準備し、チームのフィードバックから学びます。",
    "チームがいつも使っているメール、カレンダー、チャットとつながります。"]
]) {
  const section = source.match(/<section class="hero">([\s\S]*?)<\/section>/)?.[1] || "";
  check(count(section, /class="mono-label hero-eyebrow"/g) === 1 &&
    /<span class="mono-label hero-eyebrow">Jin AI<\/span>\s*<!--[^>]*-->\s*<h1 class="hero-reveal"/.test(section),
    `${language} hero needs the exact Jin AI label above the H1.`);
  check(count(source, /class="hero-intro"/g) === 1 &&
    section.match(/<h1 class="hero-reveal"[^>]*>[\s\S]*?<\/h1>\s*<p class="hero-intro">([^<]*)<\/p>\s*<div class="hero-actions">/)?.[1] === introduction &&
    section.match(/<div class="hero-actions">[\s\S]*?<\/div>\s*<p class="hero-note">([^<]*)<\/p>\s*<\/div>\s*$/)?.[1] === note &&
    !/hero-badges/.test(source),
    `${language} hero must use the exact approved introduction after the H1 and the tools note after the actions, without badges.`);
}
check(cssBlock(englishCss, ".hero-eyebrow {").includes("display: block") &&
  cssBlock(englishCss, ".hero-note {").includes("color: var(--text-3)"),
  "Hero label and muted tools note must use the shared theme.");
check(content.product.headline === "What if the work was already done?" &&
  content.product.description === "Jin spots repetitive tasks, prepares the work, and learns from your team's feedback." &&
  content.direct_answers.find(answer => answer.id === "what-is-jin-ai")?.answer === content.product.description &&
  content.product.availability === "Jin AI is in private beta. We are working through the waitlist." &&
  content.direct_answers.find(answer => answer.id === "is-jin-ai-available")?.answer === content.product.availability,
  "Product facts must use the proactive headline, description and private-beta availability.");

const bodyStructure = (source, japaneseHome = false) => {
  const body = source.match(/<body\b[^>]*>([\s\S]*?)<\/body>/)?.[1] || "";
  const alignedBody = body;
  return [...withoutJapanesePhrases(alignedBody).replace(/<!-- GENERATED:CTA_FINAL:START -->[\s\S]*?<!-- GENERATED:CTA_FINAL:END -->/g, "")
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
  ["ウェイトリストに登録", "Join the waitlist"],
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
  check(JSON.stringify(bodyStructure(english)) === JSON.stringify(bodyStructure(translated, route === "")),
    `/ja/${route} must match its English twin's complete element, section ID and component-class structure, except form order, H1 typesetting and the exact Japanese home Solution closing.`);
  check(JSON.stringify(scripts(english, route)) === JSON.stringify(scripts(translated, `ja/${route}`)),
    `/ja/${route} must retain all English scripts, except the English-only language choice and fact graph.`);
  const stylesheets = [...translated.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)]
    .map(([, url]) => new URL(url, `https://jinai.md/ja/${route}`).pathname);
  check(JSON.stringify(stylesheets) === JSON.stringify(["/base.css", "/theme-en.css", "/theme-ja.css", ...(route === "" ? ["/site-page.css"] : [])]) &&
    translated.includes("family=Inter:wght@400..700") && translated.includes("family=Noto+Sans+JP:wght@400..700") &&
    !/Source\+Serif|Noto\+Serif|site\.css/.test(translated),
    `/ja/${route} must load the English dark theme and Japanese typesetting, with home-only figure/demo styles only on the home.`);
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
check(count(japaneseReveal, /<span style="--word:[0-2]">[^<]+<\/span>/g) === 3 &&
  [...japaneseReveal.matchAll(/--word:(\d)/g)].map(match => match[1]).join("") === "012" &&
  japaneseReveal.replace(/<[^>]+>/g, "") === "もし、仕事がもう終わっていたら？" &&
  japanese.includes('aria-label="もし、仕事がもう終わっていたら？"') &&
  japanese.match(/<script id="jin-page-paint">([\s\S]*?)<\/script>/)?.[1] === paintScript,
  "Japanese hero must keep its three-phrase reveal, exact text, accessible name and motion opt-in.");
for (const [page, source, phrases] of [
  ["/ja/", japanese, ["AIツールはあるのに、", "なぜまだ全部", "自分でやっているのでしょう？", "もし、AIが", "先に動いてくれたら？", "下準備はJinが。", "決めるのは、", "あなたのチームです。", "Jinは、", "チームの働き方を学びます。", "自動化を、", "社員が自分で作る", "必要はありません。", "一人の改善が、", "チーム全体の助けになる。", "もう二度とやりたくない仕事を、", "ひとつ見つけましょう。"]],
  ["/ja/how-it-works/", japaneseHow, ["コンテクストは、", "御社のAIを、", "会社の資産に。"]],
  ["/ja/security/", japaneseSecurity, ["コンテクストは、", "会社のもの。"]],
  ["/ja/privacy/", japanesePrivacy, ["プライバシー", "ポリシー", "取り扱いを", "委託している", "事業者"]]
]) {
  check(phrases.every(phrase => source.includes(`<span class="ja-phrase">${phrase}</span>`)),
    `${page} must protect the approved heading phrase boundaries from internal breaks.`);
}
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
  japaneseHow.includes('href="/ja/#demo">ウェイトリストに登録</a>') &&
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
  "lastName,firstName,email,jobTitle,company,phone,industry,companySize,country,website",
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
  japaneseForm.includes('type="submit" disabled>ウェイトリストに登録</button>') &&
  japaneseForm.includes('いただいた情報は、ウェイトリストのご案内と、ご希望の場合はデモの日程調整に使います。詳しくは<a href="privacy/">プライバシーポリシー</a>をご覧ください。') &&
  japanese.includes('src="/waitlist.mjs"') && !/waitlistSurvey|signup-survey|type="radio"/.test(japanese),
"Japanese form must retain the endpoint, submission attributes, consent flow, translated notices and shared client, without a survey.");
const formStructure = source => [...source.replace(/<select\b[^>]*>[\s\S]*?<\/select>/g,
  match => match.replace(/<option\b[^>]*>[\s\S]*?<\/option>/g, ""))
  .matchAll(/<(?!\/)([a-z][\w-]*)\b([^>]*)>/g)].map(([, tag, attributes]) =>
  [tag, attributes.replace(/demo-(?:firstName|lastName)/g, "demo-name")
    .replace(/name="(?:firstName|lastName)"/g, 'name="name"')
    .replace(/autocomplete="(?:given-name|family-name)"/g, 'autocomplete="name"')]);
check(JSON.stringify(formStructure(form)) === JSON.stringify(formStructure(japaneseForm)) &&
  japanese.includes('<h3 id="demoQuestion">デモも申し込みますか？</h3>') &&
  japanese.includes('id="openDemo" type="button" aria-controls="waitlistForm" aria-expanded="false">デモを申し込む</button>'),
  "The complete two-step forms must match structurally except labels, name order and country labels/order.");

const customerFacingTextFiles = deployedFiles.filter((file) => /\.(html|css|json|txt|xml|svg|m?js)$/.test(file));
const retiredR13Copy = [
  "We will email you to set up a demo.",
  "デモの日程を、メールでご相談します。",
  "We use these details only to reply about your demo.",
  "いただいた情報は、デモについてのご連絡にだけ使います。詳しくはプライバシーポリシーをご覧ください。",
  "Please enable JavaScript to request a demo here. You can also email hello@jinai.md.",
  "デモのお申し込みには JavaScript を有効にしてください。メールでも受け付けています: hello@jinai.md。",
  "When you request a demo, we collect the details you type into the form: your work email, first and last name, job title, phone number, company, industry, company size and country. We use your phone number only to arrange your demo. We also record the time of your request and whether our reply email was sent.",
  "デモをお申し込みいただくとき、フォームに入力された情報をお預かりします。会社のメールアドレス、姓名、役職、電話番号、会社名、業種、従業員数、国です。電話番号は、デモの日程調整のためだけに使います。あわせて、お申し込みの日時と、こちらからの返信メールを送れたかどうかを記録します。",
  "We use your demo request only to reply to you, set up a demo, and follow up about that request. We do not sell your information, share it for advertising, or use it to train AI models.",
  "デモのお申し込みの情報は、お申し込みへの返信、デモの日程の調整、そのお申し込みについてのご連絡にだけ使います。情報を販売したり、広告のために提供したり、AI モデルの学習に使ったりすることはありません。",
  "Google stores demo requests and sends our reply emails (Google Apps Script, Google Sheets and Gmail). GitHub hosts the website. Cloudflare provides visit counts. These providers may process data outside your country.",
  "デモのお申し込みの保存と返信メールの送信には Google（Google Apps Script、Google スプレッドシート、Gmail）を、サイトの公開には GitHub を、閲覧数の集計には Cloudflare を使っています。これらの事業者は、お客様のお住まいの国の外で情報を取り扱うことがあります。",
  "We keep a demo request for as long as we need it to respond and follow up, and we delete it sooner if you ask.",
  "デモのお申し込みの情報は、返信とその後のご連絡に必要な間だけ保存し、ご依頼があればそれより前に削除します。",
  "We're working through our waitlist, so thank you for your patience. If your company wants to try Jin AI, request a demo below.",
  "現在、ウェイトリストの方から順にご案内しています。お待たせしてすみません。会社で試したい方は、下のフォームからデモをお申し込みください。",
  "Questions about security? Email hello@jinai.md, or request a demo.",
  "Company and employee value, how it works, data and demo request."
];
function readableCopy(source) {
  return source.replace(/<button\b[^>]*class="copy-email"[^>]*>[\s\S]*?<\/button>/g, "")
    .replace(/<[^>]*>/g, "").replace(/hello@jinai\.md (?=[.,。])/g, "hello@jinai.md");
}
for (const filename of ["README.md", ".github/copilot-instructions.md", "scripts/generate-aeo.mjs",
  "index.html", "ja/index.html", "agent/index.html", "agent/content.json", "llms.txt"]) {
  const source = readableCopy(await readFile(path.join(root, filename), "utf8"));
  for (const retired of retiredR13Copy) {
    check(!source.includes(retired), `${filename} source contains retired R13 copy: ${retired}`);
  }
}
const cjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u3000-\u303f]/u;
for (const relativePath of customerFacingTextFiles) {
  const source = await text(relativePath);
  const readable = readableCopy(source);
  for (const retired of retiredR13Copy) {
    check(!source.includes(retired) && !readable.includes(retired),
      `${relativePath} contains retired R13 copy: ${retired}`);
  }
  check(!/Please enable JavaScript to request a demo here\.|デモのお申し込みには JavaScript を有効にしてください。/.test(readable),
    `${relativePath} contains a retired demo-only noscript fallback.`);
  check(!source.includes("JinAI"), `${relativePath} contains the obsolete JinAI spelling.`);
  if (relativePath.startsWith("ja/")) {
    check(cjk.test(source), `${relativePath} must contain Japanese text.`);
  } else {
    const englishRoute = englishPages.find(([route]) => relativePath === `${route}index.html`)?.[0];
    const allowedLink = englishRoute === undefined ? "" :
      '<a href="/ja/" lang="ja" hreflang="ja" data-jin-lang="ja">日本語</a>';
    const withoutPageIndex = relativePath === "llms.txt" && exactLlmsPages ? source.replace(llmsPages, "") : source;
    const englishOnly = allowedLink ? withoutPageIndex.replace(allowedLink, "") : withoutPageIndex;
    check(!cjk.test(englishOnly), `${relativePath} contains CJK outside its Japanese footer language link or verified LLM page index.`);
  }
  check(!/[\u2013\u2014\u2018\u2019\u201c\u201d]/u.test(source),
    `${relativePath} contains em dashes, en dashes or curly quotes.`);
  check(!/\bsetup\b/i.test(source.replaceAll(approvedCompanySolution, "")),
    `${relativePath} contains setup outside the exact R11-approved Solution body.`);
  if (!relativePath.endsWith(".html") && !["agent/content.json", "llms.txt"].includes(relativePath)) {
    check(!/\bDiscord\b|discord\.gg/i.test(source), `${relativePath} contains an out-of-scope community mention.`);
  }
  check(!/mailto:hello@jinai\.md/i.test(source), `${relativePath} must not link the contact email with mailto.`);
}

const htmlFiles = deployedFiles.filter((file) => file.endsWith(".html"));
const deployedFileSet = new Set(deployedFiles);
const htmlCache = new Map();
for (const relativePath of htmlFiles) htmlCache.set(relativePath, await text(relativePath));

function schemaNodes(value) {
  if (Array.isArray(value)) return value.flatMap(schemaNodes);
  if (!value || typeof value !== "object") return [];
  return [value, ...schemaNodes(value["@graph"])];
}

const jsonLdByFile = new Map();
let jsonLdBlockCount = 0;
let faviconPageCount = 0;
for (const [relativePath, source] of htmlCache) {
  const head = source.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1];
  if (head !== undefined) {
    faviconPageCount++;
    check(head.includes('<link rel="icon" href="/favicon.svg" type="image/svg+xml">') &&
      head.includes('<link rel="icon" href="/favicon.ico" sizes="48x48">') &&
      count(head, /<link\b[^>]*\brel="icon"/g) === 2 &&
      !/<link\b[^>]*\brel="icon"[^>]*\bhref="data:/i.test(head),
      `${relativePath} must reference the crawlable SVG and ICO favicons, without an inline icon.`);
  } else {
    check(relativePath === "googled8075da2e5b1406b.html" &&
      source.trim() === "google-site-verification: googled8075da2e5b1406b.html",
      `${relativePath} must have a head unless it is the unchanged plain-text Google verification token.`);
  }
  const nodes = [];
  for (const [, json] of source.matchAll(/<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    jsonLdBlockCount++;
    check(!json.includes("<"), `${relativePath} JSON-LD must escape less-than characters.`);
    try {
      nodes.push(...schemaNodes(JSON.parse(json)));
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      check(false, `${relativePath} contains invalid JSON-LD: ${error.message}`);
    }
  }
  jsonLdByFile.set(relativePath, nodes);
}

const homeNodes = jsonLdByFile.get("index.html");
const homeWebsite = homeNodes.find(node => node["@type"] === "WebSite");
check(JSON.stringify(homeWebsite?.inLanguage) === JSON.stringify(["en", "ja"]),
  "The WebSite must declare both English and Japanese.");
const homeSoftware = homeNodes.find(node => node["@type"] === "SoftwareApplication");
check(homeSoftware && !Object.hasOwn(homeSoftware, "softwareVersion"),
  "The SoftwareApplication must not use a delivery status as a software version.");
const homeWebPage = homeNodes.find(node => node["@type"] === "WebPage");
check(homeWebPage?.inLanguage === "en", "The English home WebPage must retain its English language.");
const citedSources = content.evidence.filter(item => item.source_url).map(item => item.source_url);
check(homeWebPage && (citedSources.length ?
  JSON.stringify(homeWebPage.citation) === JSON.stringify(citedSources) : !Object.hasOwn(homeWebPage, "citation")),
  "The home WebPage must cite its evidence URLs only when they are non-empty.");

const faqPages = jsonLdByFile.get("agent/index.html").filter(node => node["@type"] === "FAQPage");
check(faqPages.length === 1, "Agent must contain exactly one generated FAQPage.");
const questions = faqPages[0]?.mainEntity;
check(Array.isArray(questions) && questions.length === content.direct_answers.length &&
  questions.every((question, index) => question["@type"] === "Question" &&
    question.name === content.direct_answers[index].question &&
    question.acceptedAnswer?.["@type"] === "Answer" &&
    question.acceptedAnswer.text === content.direct_answers[index].answer),
  "Agent FAQPage questions and answers must match every direct_answers entry exactly, in order.");
const japaneseSitemapUrls = sitemapUrls.filter(url => new URL(url).pathname.startsWith("/ja/"));
for (const url of japaneseSitemapUrls) {
  const filename = `${new URL(url).pathname.slice(1)}index.html`;
  const page = htmlCache.get(filename) || "";
  const title = page.match(/<title>([^<]+)<\/title>/)?.[1];
  const pages = (jsonLdByFile.get(filename) || []).filter(node => node["@type"] === "WebPage");
  check(pages.length === 1 && pages[0]["@id"] === `${url}#webpage` &&
    pages[0].url === url && pages[0].name === title && pages[0].inLanguage === "ja" &&
    pages[0].isPartOf?.["@id"] === "https://jinai.md/#website" &&
    pages[0].about?.["@id"] === "https://jinai.md/#organization" &&
    pages[0].publisher?.["@id"] === "https://jinai.md/#organization",
    `${filename} needs Japanese WebPage JSON-LD matching its canonical URL, title and shared entity IDs.`);
}

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
        (!caption || (!["how-it-works/index.html", "ja/how-it-works/index.html"].includes(relativePath) &&
          hasClass(caption, removedScreenCaptionClass))) &&
        window?.name === "div" && hasClass(window, "demo-window") && window.children.length === 1 &&
        screen?.name === "div" && (hasClass(screen, "hero-screen") || hasClass(screen, "screen")) &&
        screen.children.length > 0 && screen.children.every(child =>
          child.name === "img" || child.name === "iframe" ||
          (child.name === "div" && hasClass(child, "screen-camera") && child.children.length === 2 &&
            child.children[0].name === "img" && child.children[1].name === "svg" &&
            hasClass(child.children[1], "workflow-cursor")) ||
          (hasClass(screen, "screen-placeholder") && child.name === "span" && hasClass(child, "placeholder-mark")) ||
          (child.name === "template" && child.children.length === 1 && child.children[0].name === "iframe")),
        `${relativePath}: demo-stage must contain one demo-window/screen, with no caption on How it works and no added title bar.`);
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
  console.log(`Crawl metadata: ${faviconPageCount} HTML documents with SVG/ICO favicons; ${jsonLdBlockCount} JSON-LD blocks parsed; ${questions.length}/${content.direct_answers.length} exact FAQ answers; ${japaneseSitemapUrls.length} Japanese WebPages.`);
  console.log("Pages artifact passed canonical, AEO, crawler and content checks.");
}
