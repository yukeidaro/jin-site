import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { CONSENT_VERSION, isAppsScriptEndpoint } from "../waitlist.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");
const dataPath = path.join(root, "agent", "content.json");
const data = JSON.parse(await readFile(dataPath, "utf8"));

const allowedStatuses = new Set(["live", "building", "next"]);
const statusLabels = {
  live: "Live",
  building: "Building",
  next: "Next"
};
const statusGuidance = "Live means available now. Building means active development. Next means intended next work. Never present Building or Next as shipped.";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validate(source) {
  assert(source.product?.name === "Jin AI", "Product name must be Jin AI.");
  assert(source.canonical_url === "https://jinai.md/", "Canonical URL must be the root URL.");
  assert(/^\d{4}-\d{2}-\d{2}$/.test(source.last_updated), "last_updated must use YYYY-MM-DD.");
  assert(allowedStatuses.has(source.product.status), "Product status is invalid.");
  assert(allowedStatuses.has(source.solution?.status), "Solution status is invalid.");
  assert(Array.isArray(source.direct_answers) && source.direct_answers.length >= 5,
    "At least five direct answers are required.");
  assert(source.identity?.legal_name === "Jin AI", "Identity legal name must be Jin AI.");
  assert(Array.isArray(source.identity.same_as) && source.identity.same_as.length >= 1, "Identity must declare a sameAs list for entity disambiguation.");
  assert(typeof source.product.harness_definition === "string" && source.product.harness_definition.trim(),
    "The product needs an AI harness definition.");
  assert(typeof source.problem?.headline === "string" && source.problem.headline.trim(),
    "The problem needs a headline.");
  for (const [name, items] of [["Problem points", source.problem.points], ["Solution steps", source.solution.steps]]) {
    assert(Array.isArray(items) && items.length > 0, `${name} must not be empty.`);
    for (const item of items) {
      assert(typeof item.name === "string" && item.name.trim() &&
        typeof item.description === "string" && item.description.trim(),
      `${name} need names and descriptions.`);
    }
  }
  assert(typeof source.data_principles?.headline === "string" && source.data_principles.headline.trim(),
    "Data principles need a headline.");
  assert(Array.isArray(source.data_principles.items) && source.data_principles.items.length > 0 &&
    source.data_principles.items.every((item) => typeof item === "string" && item.trim()),
  "Data principles need non-empty facts.");

  const access = source.early_access;
  assert(access?.label && access?.note && access?.hero_label && access?.hero_note,
    "Early access needs form and hero labels and notes.");
  assert(access.form?.provider === "apps_script", "The demo form must use Apps Script directly.");
  assert(isAppsScriptEndpoint(access.form.endpoint) ||
    (access.form.endpoint === null && access.status === "setup_pending"),
  "The demo form needs a deployed Apps Script /exec endpoint, or an explicit setup_pending state.");
  assert(access.form.consent_version === CONSENT_VERSION, "The demo consent version has drifted.");
  assert(access.contact_email === "hello@jinai.md", "Demo confirmations must send from hello@jinai.md.");
  assert(access.form.privacy_url === "privacy/" && access.form.privacy_note?.trim(),
    "The demo form must explain its purpose and link to the Privacy Policy.");
  assert(!access.survey, "Demo requests must not include a survey.");
  const fields = access.form.fields;
  assert(Array.isArray(fields) && fields.map((field) => field.name).join() ===
    "email,firstName,lastName,jobTitle,phone,company,industry,companySize,country",
  "The demo form fields must follow the approved order.");
  for (const field of fields) {
    assert(typeof field.label === "string" && field.label.trim(), "Each form field needs a label.");
    assert(field.required === true, "Every demo field must be required.");
    if (field.type === "select") {
      assert(field.placeholder?.trim() && Array.isArray(field.options) && field.options.length > 0 &&
        field.options.every((option) => typeof option === "string" && option.trim()) &&
        new Set(field.options).size === field.options.length,
      `The ${field.name} select needs a placeholder and unique choices.`);
    } else {
      assert(["text", "email", "tel"].includes(field.type) && field.autocomplete?.trim() &&
        Number.isInteger(field.max_length) && field.max_length > 0,
      `The ${field.name} input needs its type, autocomplete and length limit.`);
    }
  }
  const countries = fields.find((field) => field.name === "country").options;
  assert(countries[0] === "United States" && countries[1] === "Japan" &&
    countries.length === 249 && countries.every((country) => country.length <= 80) &&
    JSON.stringify(countries.slice(2)) === JSON.stringify([...countries.slice(2)].sort()),
  "Country choices must cover ISO countries and territories, with United States and Japan first, then alphabetical English names.");
  assert(access.community?.url === null, "Community links must remain unpublished.");

  const ids = new Set();
  for (const answer of source.direct_answers) {
    assert(answer.id && answer.question && answer.answer, "Each direct answer needs an id, question and answer.");
    assert(!ids.has(answer.id), `Duplicate direct-answer id: ${answer.id}`);
    ids.add(answer.id);
  }

  assert(Array.isArray(source.capabilities) && source.capabilities.length > 0, "Capabilities must not be empty.");
  const capabilityIds = new Set();
  for (const capability of source.capabilities) {
    assert(capability.id && capability.name, "Each capability needs an id and name.");
    assert(!capabilityIds.has(capability.id), `Duplicate capability id: ${capability.id}`);
    capabilityIds.add(capability.id);
    assert(allowedStatuses.has(capability.status), `Invalid capability status: ${capability.id}`);
    assert(capability.status === "live" ||
      (typeof capability.description === "string" && capability.description.trim()),
    `A capability in development needs a description: ${capability.id}`);
  }

  const serialized = JSON.stringify(source);
  assert(!serialized.includes("JinAI"), "Customer-facing data must spell the product name Jin AI.");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function replaceBlock(document, blockName, generated) {
  const start = `<!-- GENERATED:${blockName}:START -->`;
  const end = `<!-- GENERATED:${blockName}:END -->`;
  const startIndex = document.indexOf(start);
  const endIndex = document.indexOf(end);
  assert(startIndex >= 0 && endIndex > startIndex, `Missing generated block: ${blockName}`);
  return `${document.slice(0, startIndex)}${start}\n${generated.trim()}\n${end}${document.slice(endIndex + end.length)}`;
}

const japaneseForm = {
  label: "デモを申し込む",
  note: "デモの日程を、メールでご相談します。",
  labels: {
    email: "会社のメールアドレス", lastName: "姓", firstName: "名", jobTitle: "役職",
    phone: "電話番号", company: "会社名", industry: "業種", companySize: "従業員数", country: "国"
  },
  placeholders: { industry: "業種を選んでください", companySize: "範囲を選んでください", country: "国を選んでください" },
  industries: ["テクノロジー", "金融", "専門サービス", "教育", "エネルギー", "官公庁", "医療", "製造", "メディア", "非営利", "不動産", "小売", "通信", "運輸", "その他"],
  companySizes: ["1〜49 人", "50〜199 人", "200〜999 人", "1,000 人以上"]
};

function japaneseCountries(countries) {
  const english = new Intl.DisplayNames(["en"], { type: "region" });
  const japanese = new Intl.DisplayNames(["ja"], { type: "region" });
  const normalize = (name) => name.normalize("NFD").replace(/\p{M}/gu, "")
    .replaceAll("&", "and").replaceAll("\u2019", "'");
  const codes = new Map();
  for (let first = 65; first <= 90; first++) {
    for (let second = 65; second <= 90; second++) {
      const code = String.fromCharCode(first, second);
      const name = english.of(code);
      if (name !== code) codes.set(normalize(name), code);
    }
  }
  const aliases = {
    "Bonaire, Sint Eustatius and Saba": "BQ", "Cabo Verde": "CV", "Congo": "CG",
    "Democratic Republic of the Congo": "CD", "Heard Island and McDonald Islands": "HM",
    "Hong Kong": "HK", "Macao": "MO", "Myanmar": "MM", "Palestine": "PS",
    "Saint Barthelemy": "BL", "Saint Helena, Ascension and Tristan da Cunha": "SH",
    "Saint Kitts and Nevis": "KN", "Saint Lucia": "LC", "Saint Martin": "MF",
    "Saint Pierre and Miquelon": "PM", "Saint Vincent and the Grenadines": "VC",
    "South Georgia and the South Sandwich Islands": "GS", "Turkey": "TR",
    "United States Minor Outlying Islands": "UM", "United States Virgin Islands": "VI"
  };
  return new Map(countries.map((country) => {
    const code = aliases[country] || codes.get(normalize(country));
    assert(code, `Missing ISO region code for ${country}.`);
    return [country, japanese.of(code)];
  }));
}

function renderCta(source, { centred, language = "en" }) {
  const access = source.early_access;
  const ja = language === "ja";
  const label = ja ? japaneseForm.label : access.label;

  if (!centred) {
    return `<div class="wait">
      <a class="btn btn-p" href="#demo">${escapeHtml(ja ? label : access.hero_label)}</a>
    </div>`;
  }

  const endpoint = access.form.endpoint || "";
  const action = endpoint ? ` action="${escapeHtml(endpoint)}"` : "";
  const specifications = [...access.form.fields];
  if (ja) [specifications[1], specifications[2]] = [specifications[2], specifications[1]];
  const countries = ja ? japaneseCountries(specifications.find((field) => field.name === "country").options) : null;
  const fields = specifications.map((field) => {
    const id = `demo-${field.name}`;
    const attributes = `id="${id}" name="${field.name}"` +
      (field.autocomplete ? ` autocomplete="${escapeHtml(field.autocomplete)}"` : "") +
      ` aria-describedby="${id}-error"` + (field.required ? ' required aria-required="true"' : "");
    const options = field.type === "select" ? [...field.options] : [];
    if (ja && field.name === "country") [options[0], options[1]] = [options[1], options[0]];
    const optionLabel = (option) => {
      if (!ja) return option;
      if (field.name === "country") return countries.get(option);
      return (field.name === "industry" ? japaneseForm.industries : japaneseForm.companySizes)[field.options.indexOf(option)];
    };
    const control = field.type === "select" ?
      `<select ${attributes}>
            <option value="">${escapeHtml(ja ? japaneseForm.placeholders[field.name] : field.placeholder)}</option>
${options.map((option) => `            <option value="${escapeHtml(option)}">${escapeHtml(optionLabel(option))}</option>`).join("\n")}
          </select>` :
      `<input ${attributes} type="${field.type}" maxlength="${field.max_length}">`;
    return `        <div class="signup-field">
          <label for="${id}">${escapeHtml(ja ? japaneseForm.labels[field.name] : field.label)}</label>
          ${control}
          <p class="signup-error" id="${id}-error" hidden></p>
        </div>`;
  });
  const rows = [fields.slice(0, 1), fields.slice(1, 3), fields.slice(3, 5), fields.slice(5, 7), fields.slice(7, 9)]
    .map((row) => `      <div class="signup-row">\n${row.join("\n")}\n      </div>`).join("\n");
  return `<form class="signup" id="waitlistForm"${action} data-endpoint="${escapeHtml(endpoint)}" method="post" novalidate>
${rows}
      <div class="signup-trap" aria-hidden="true">
        <label for="wl-website">${ja ? "この欄は空のままにしてください" : "Leave this field empty"}</label>
        <input id="wl-website" name="website" type="text" tabindex="-1" autocomplete="off">
      </div>
      <button class="btn btn-p" type="submit" disabled>${escapeHtml(label)}</button>
      <p class="waitnote">${escapeHtml(ja ? japaneseForm.note : access.note)}</p>
      <p class="signup-privacy">${ja ?
    `いただいた情報は、デモについてのご連絡にだけ使います。詳しくは<a href="${escapeHtml(access.form.privacy_url)}">プライバシーポリシー</a>をご覧ください。` :
    `${escapeHtml(access.form.privacy_note)} See our <a href="${escapeHtml(access.form.privacy_url)}">Privacy Policy</a>.`}</p>
    </form>
    <noscript><p class="waitalt">${ja ? "デモのお申し込みには JavaScript を有効にしてください。メールでも受け付けています: " : "Please enable JavaScript to request a demo here. You can also email "}<a href="mailto:${escapeHtml(access.contact_email)}">${escapeHtml(access.contact_email)}</a>${ja ? "。" : "."}</p></noscript>
    <p class="signup-status" id="waitlistStatus" role="status" aria-live="polite" aria-atomic="true" hidden></p>
    <div class="signup-done" id="waitlistDone" role="status" aria-live="polite" aria-atomic="true" tabindex="-1" hidden>
      <h3 id="waitlistHeading"></h3>
      <dl class="signup-results">
        <div><dt>${ja ? "お申し込み" : "Request"}</dt><dd id="waitlistRegistration"></dd></div>
        <div><dt>${ja ? "確認メール" : "Confirmation email"}</dt><dd id="waitlistEmail"></dd></div>
      </dl>
      <p id="waitlistDetail"></p>
    </div>
    <p class="waitalt">${ja ? "ご質問・ご意見: " : "Questions or feedback? "}<a href="mailto:${escapeHtml(access.contact_email)}">${escapeHtml(access.contact_email)}</a>${ja ? "。" : "."}</p>`;
}

function renderJsonLd(source) {
  const graph = [
    {
      "@type": "Organization",
      "@id": `${source.canonical_url}#organization`,
      name: source.product.name,
      legalName: source.identity.legal_name,      url: source.canonical_url,
      logo: "https://jinai.md/brand/jin-mark.svg",
      description: source.product.description,
      sameAs: source.identity.same_as,
      founder: source.founders.map((founder) => ({ "@id": `${source.canonical_url}#${founder.name === "Yu Asano" ? "yu-asano" : "tomoya-kato"}` }))
    },
    ...source.founders.map((founder) => ({
      "@type": "Person",
      "@id": `${source.canonical_url}#${founder.name === "Yu Asano" ? "yu-asano" : "tomoya-kato"}`,
      name: founder.name,
      jobTitle: founder.role,
      description: founder.bio,
      url: founder.profile_url,
      sameAs: [founder.profile_url],
      worksFor: { "@id": `${source.canonical_url}#organization` }
    })),
    {
      "@type": "WebSite",
      "@id": `${source.canonical_url}#website`,
      url: source.canonical_url,
      name: source.product.name,
      description: source.product.description,
      inLanguage: source.language,
      publisher: { "@id": `${source.canonical_url}#organization` }
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${source.canonical_url}#software`,
      name: source.product.name,
      url: source.canonical_url,
      applicationCategory: "BusinessApplication",
      applicationSubCategory: source.product.category,
      description: source.product.description,
      softwareVersion: statusLabels[source.product.status],
      audience: {
        "@type": "Audience",
        audienceType: source.audience.primary
      },
      creator: { "@id": `${source.canonical_url}#organization` }
    },
    {
      "@type": "WebPage",
      "@id": `${source.canonical_url}#webpage`,
      url: source.canonical_url,
      name: `${source.product.name} - ${source.product.category}`,
      description: source.product.description,
      dateModified: source.last_updated,
      inLanguage: source.language,
      isPartOf: { "@id": `${source.canonical_url}#website` },
      about: { "@id": `${source.canonical_url}#software` },
      mainEntity: { "@id": `${source.canonical_url}#software` },
      citation: source.evidence.filter((item) => item.source_url).map((item) => item.source_url)
    }
  ];

  return `<script type="application/ld+json">
${JSON.stringify({ "@context": "https://schema.org", "@graph": graph }, null, 2)}
</script>`;
}

function renderAgent(source) {
  const problemPoints = source.problem.points.map((point) => `
    <li><strong>${escapeHtml(point.name)}:</strong> ${escapeHtml(point.description)}</li>`).join("");

  const solutionSteps = source.solution.steps.map((step) => `
    <h3>${escapeHtml(step.name)}</h3>
    <p>${escapeHtml(step.description)}</p>`).join("");

  const capabilities = source.capabilities.map((capability) => `
      <section>
        <span class="badge" data-status="${capability.status}">${statusLabels[capability.status]}</span>
        <h3>${escapeHtml(capability.name)}</h3>${capability.description ? `
        <p>${escapeHtml(capability.description)}</p>` : ""}${capability.note ? `
        <p>${escapeHtml(capability.note)}</p>` : ""}
      </section>`).join("");

  const answers = source.direct_answers.map((item) => `
      <section id="${escapeHtml(item.id)}">
        <h3>${escapeHtml(item.question)}</h3>
        <p>${escapeHtml(item.answer)}</p>
      </section>`).join("");

  const evidence = source.evidence.map((item) => `<section id="${escapeHtml(item.claim_id)}">
      <h3>${escapeHtml(item.finding)}</h3>
      <p class="caveat"><strong>Scope:</strong> ${escapeHtml(item.scope)}${item.caveat ? ` <strong>Caveat:</strong> ${escapeHtml(item.caveat)}` : ""}</p>
      ${item.source_url ? `<p><a href="${escapeHtml(item.source_url)}">${escapeHtml(item.source_title)}</a> (${escapeHtml(item.published)})</p>` : `<p>Source: ${escapeHtml(item.source_type)}.</p>`}
    </section>`).join("\n    ");

  const founderList = source.founders.map((founder) => `
      <dt><a href="${escapeHtml(founder.profile_url)}">${escapeHtml(founder.name)}</a> - ${escapeHtml(founder.role)}</dt>
      <dd>${escapeHtml(founder.bio)}</dd>`).join("");

  const dataPrinciples = source.data_principles.items.map((item) => `
    <li>${escapeHtml(item)}</li>`).join("");

  return `<article data-content-version="${escapeHtml(source.content_version)}">
  <h1>${escapeHtml(source.product.name)} for agents</h1>
  <p class="dek">${escapeHtml(source.product.description)}</p>
  <div class="statusline">
    <span class="badge" data-status="${source.product.status}">${statusLabels[source.product.status]}</span>
    <span class="badge">Updated: ${escapeHtml(source.last_updated)}</span>
  </div>
  <p>${escapeHtml(source.product.availability)}</p>

  <h2>AI harness</h2>
  <p class="answer">${escapeHtml(source.product.harness_definition)}</p>
  <p>For ${escapeHtml(source.audience.primary)}.</p>

  <h2>Problem</h2>
  <p class="answer"><strong>${escapeHtml(source.problem.headline)}</strong></p>
  <ul>${problemPoints}
  </ul>

${source.evidence.length ? `  <h2>Evidence and limits</h2>\n  ${evidence}\n` : ""}

  <h2>Solution</h2>
  <p><span class="badge" data-status="${source.solution.status}">${statusLabels[source.solution.status]}</span></p>
${solutionSteps}

  <h2>${escapeHtml(source.data_principles.headline)}</h2>
  <ul>${dataPrinciples}
  </ul>

  <h2>How it works and status</h2>
  <p>${statusGuidance}</p>
${capabilities}

  <h2>Direct questions and answers</h2>
${answers}

  <h2>Founders</h2>
  <dl>${founderList}
  </dl>

  <h2>${escapeHtml(source.early_access.label)}</h2>
  <p>${escapeHtml(source.early_access.note)}</p>
  <p><a href="${escapeHtml(source.resources.human_page)}#waitlist">${escapeHtml(source.early_access.label)}</a></p>

  <h2>Primary machine resources</h2>
  <ul>
    <li><a href="${escapeHtml(source.resources.structured_data)}">Structured fact source (JSON)</a></li>
    <li><a href="${escapeHtml(source.resources.llm_index)}">LLM index (text)</a></li>
    <li><a href="${escapeHtml(source.resources.human_page)}">Canonical Human page</a></li>
  </ul>
  <p class="meta">Generated from agent/content.json | content version ${escapeHtml(source.content_version)} | updated ${escapeHtml(source.last_updated)}</p>
</article>`;
}

function renderLlms(source) {
  const answerLinks = source.direct_answers.map((item) =>
    `- [${item.question}](${source.resources.agent_page}#${item.id}): ${item.answer}`
  ).join("\n");

  const evidenceLinks = source.evidence.map((item) => {
    if (item.source_url) return `- [${item.source_title}](${item.source_url}): ${item.finding} Scope: ${item.scope}`;
    return `- [Structured evidence record](${source.resources.structured_data}): ${item.finding} Scope: ${item.scope}. ${item.caveat}`;
  }).join("\n");

  const problemPoints = source.problem.points.map((point) =>
    `- ${point.name}: ${point.description}`
  ).join("\n");

  const solutionSteps = source.solution.steps.map((step) =>
    `- ${step.name} ${step.description}`
  ).join("\n");

  const capabilities = source.capabilities.map((capability) =>
    `- ${capability.name} (${statusLabels[capability.status]})${capability.description ? `: ${capability.description}` : ""}${capability.note ? ` ${capability.note}.` : ""}`
  ).join("\n");

  const dataPrinciples = source.data_principles.items.map((item) =>
    `- ${item}`
  ).join("\n");

  return `# ${source.product.name}

> ${source.product.description}

Status: ${statusLabels[source.product.status]}. Last updated: ${source.last_updated}.
${source.product.availability}

${statusGuidance} The Human page at ${source.canonical_url} is the sole canonical product page. Agent-facing formats are derivatives generated from the structured JSON fact source.

For ${source.audience.primary}.

## AI harness

${source.product.harness_definition}

## Primary resources

- [Canonical Human page](${source.resources.human_page}): Company and employee value, how it works, data and demo request.
- [Agent reference](${source.resources.agent_page}): Status-aware HTML with direct answers, capabilities, data principles and founders.
- [Structured fact source](${source.resources.structured_data}): Public JSON used to generate agent-facing derivatives.
- [Sitemap](${source.resources.sitemap}): Canonical indexable URL.

## Direct answers

${answerLinks}

## Problem

${source.problem.headline}

${problemPoints}

## Solution (${statusLabels[source.solution.status]})

${solutionSteps}

## How it works and status

${capabilities}

## ${source.data_principles.headline}

${dataPrinciples}

${source.evidence.length ? `## Evidence and sources\n\n${evidenceLinks}\n\n` : ""}## Founders

${source.founders.map((founder) => `- [${founder.name}](${founder.profile_url}): ${founder.role}. ${founder.bio}`).join("\n")}

## ${source.early_access.label}

[${source.early_access.label}](${source.resources.human_page}#waitlist). ${source.early_access.note}
`;
}

// Windows checkouts (core.autocrlf) use CRLF; compare as LF and write back the file's own line endings.
async function readText(filePath) {
  const raw = await readFile(filePath, "utf8");
  return { text: raw.replace(/\r\n/g, "\n"), eol: raw.includes("\r\n") ? "\r\n" : "\n" };
}

async function writeText(filePath, text, eol) {
  await writeFile(filePath, text.replace(/\n/g, eol), "utf8");
}

async function updateGeneratedFile(filePath, transforms, title) {
  const { text: current, eol } = await readText(filePath);
  const updated = transforms.reduce((document, [name, generated]) => replaceBlock(document, name, generated), current);
  const expected = title ? updated.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`) : updated;

  if (checkOnly) {
    assert(current === expected, `${path.relative(root, filePath)} is out of date. Run node scripts/generate-aeo.mjs.`);
    return;
  }

  if (current !== expected) await writeText(filePath, expected, eol);
}

validate(data);

await updateGeneratedFile(path.join(root, "index.html"), [
  ["JSON_LD", renderJsonLd(data)],
  ["CTA_HERO", renderCta(data, { centred: false })],
  ["CTA_FINAL", renderCta(data, { centred: true })]
]);

await updateGeneratedFile(path.join(root, "ja", "index.html"), [
  ["CTA_HERO", renderCta(data, { centred: false, language: "ja" })],
  ["CTA_FINAL", renderCta(data, { centred: true, language: "ja" })]
]);

await updateGeneratedFile(path.join(root, "agent", "index.html"), [
  ["AGENT_CONTENT", renderAgent(data)]
], "Jin AI for agents | Product facts and status");

const llmsPath = path.join(root, "llms.txt");
const expectedLlms = renderLlms(data);
const { text: currentLlms, eol: llmsEol } = await readText(llmsPath);
if (checkOnly) {
  assert(currentLlms === expectedLlms, "llms.txt is out of date. Run node scripts/generate-aeo.mjs.");
} else if (currentLlms !== expectedLlms) {
  await writeText(llmsPath, expectedLlms, llmsEol);
}

console.log(checkOnly ? "AEO derivatives are current." : "Generated AEO derivatives.");
