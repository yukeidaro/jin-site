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
  "brand/jin-mark.svg",
  "en/index.html",
  "googled8075da2e5b1406b.html",
  "human/index.html",
  "index.html",
  "ja/index.html",
  "ja/how-it-works/index.html",
  "how-it-works/index.html",
  "llms.txt",
  "privacy/index.html",
  "robots.txt",
  "shots/og-b2b.png",
  "site.css",
  "sitemap.xml",
  "waitlist.mjs"
].sort();

const deployedFiles = await listFiles(site);
check(JSON.stringify(deployedFiles) === JSON.stringify(expectedFiles), `Unexpected Pages artifact: ${deployedFiles.join(", ")}`);

const [home, japanese, howPage, japaneseHowAlias, agent, humanAlias, englishAlias, robots, sitemap, llms, contentJson, privacy, accessibility] = await Promise.all([
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
  text("accessibility/index.html")
]);

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
  ["privacy/index.html", privacy], ["accessibility/index.html", accessibility]
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
for (const [page, source] of [["Root", home], ["How it works", howPage], ...legalPages.map(([, source, heading]) => [heading, source])]) {
  check(!/\bhreflang=|aria-label="Language"/.test(source),
    `${page} must not publish hreflang alternates or a language switch.`);
  for (const [attribute, name] of [["property", "og:image"], ["name", "twitter:image"]]) {
    check(source.includes(`<meta ${attribute}="${name}" content="https://jinai.md/shots/og-b2b.png">`),
      `${page} must use the B2B ${name}.`);
  }
  for (const dimension of ["width", "height"]) {
    check(source.includes(`<meta property="og:image:${dimension}" content="${dimension === "width" ? 1200 : 630}">`),
      `${page} must declare the share image ${dimension}.`);
  }
  for (const [attribute, name] of [["property", "og:image:alt"], ["name", "twitter:image:alt"]]) {
    check(source.includes(`<meta ${attribute}="${name}" content="Jin AI: Keep your top performers' AI harnesses inside the company">`),
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
check(homeSections.length === 6 && homeSections[0]?.[1].includes('class="hero"') &&
  homeSections.slice(1).map((match) => match[1].match(/\bid="([^"]+)"/)?.[1]).join() ===
  "problem,solution,how,data,demo", "Root must contain only hero, problem, solution, how, data and demo sections, in order.");
check(count(home, /<h1>/g) === 1 &&
  home.includes("<h1>Keep your top performers' AI harnesses inside the company.</h1>"),
  "Root must use the approved H1 once.");
const homeTitle = "Jin AI | Keep your top performers' AI harnesses inside the company";
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
  ["human", humanAlias, "/"], ["English", englishAlias, "/"],
  ["Japanese", japanese, "/"], ["Japanese How it works", japaneseHowAlias, "/how-it-works/"]
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
  "https://jinai.md/", "https://jinai.md/accessibility/", "https://jinai.md/how-it-works/", "https://jinai.md/privacy/"
]), "Sitemap must contain exactly the English home, How it works, Privacy and Accessibility URLs.");
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
  howPage.includes('<h2 class="how-audience">Employee</h2>') &&
  howPage.includes('<h2 class="how-audience">Admin</h2>') &&
  count(howPage, /<ol class="harness-steps"/g) === 2 && howPage.includes('start="3"'),
  "The companion page must define an AI harness and separate Employee and Admin steps.");
const companionSteps = [...howPage.matchAll(/<li><h3>([^<]+)<\/h3>([\s\S]*?)<\/li>/g)];
const companionStatuses = ["Building: Claude Code first", "Building", "Next", "Next"];
check(companionSteps.length === 4 && companyCapabilities.every((capability, index) =>
  companionSteps[index]?.[1] === capability.name &&
  companionSteps[index]?.[2].includes(`<p>${capability.description}</p>`) &&
  companionSteps[index]?.[2].includes(
    `<small class="harness-status${capability.status === "next" ? " next" : ""}">${companionStatuses[index]}</small>`)),
  "The companion page must use all four approved steps with their own Building or Next status.");
for (const sentence of ["<p>Claude Code first. Other AI tools are next.</p>",
  "<p>For example: <code>CLAUDE.md</code>, skills, memory files and MCP settings.</p>",
  "<p>In pilots, the company approves by hand today.</p>"]) {
  check(howPage.includes(sentence), "The companion page must retain the approved examples and manual pilot caveat.");
}
check(howPage.includes(`<h2 class="h2">${content.data_principles.headline}</h2>`) &&
  content.data_principles.items.every((item) => howPage.includes(`<li>${item}</li>`)) &&
  howPage.includes('<a class="btn btn-p" href="../#demo">Request a demo</a>'),
  "The companion page must include all data promises and the demo CTA.");
check(!/plugin-screen\.png|personal MCP|your own memory|#waitlist|Join &rarr;/.test(howPage),
  "The companion page must not publish the retired consumer copy or CTA.");
const dataSection = homeSections.find((match) => match[1].includes('id="data"'))?.[2] || "";
check(dataSection.includes(`<h2 class="h2">${content.data_principles.headline}</h2>`) &&
  content.data_principles.items.every((item) => dataSection.includes(`<li>${item}</li>`)),
  "Root must use all approved data promises.");
const demoSection = homeSections.find((match) => match[1].includes('id="demo"'))?.[2] || "";
check(demoSection.includes("<h2>See what is inside your company's AI harnesses.</h2>") &&
  demoSection.includes('id="waitlistForm"'), "The demo section must contain the approved heading and form.");

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

const customerFacingTextFiles = deployedFiles.filter((file) => /\.(html|css|json|txt|xml|svg|mjs)$/.test(file));
for (const relativePath of customerFacingTextFiles) {
  const source = await text(relativePath);
  check(!source.includes("JinAI"), `${relativePath} contains the obsolete JinAI spelling.`);
  check(!/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u3000-\u303f]/u.test(source),
    `${relativePath} contains CJK characters.`);
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
