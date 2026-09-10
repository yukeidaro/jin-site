import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");
const dataPath = path.join(root, "agent", "content.json");
const data = JSON.parse(await readFile(dataPath, "utf8"));

const allowedStatuses = new Set(["in_build", "planned", "later"]);
const statusLabels = {
  in_build: "In build",
  planned: "Planned",
  later: "Later"
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validate(source) {
  assert(source.product?.name === "Jin AI", "Product name must be Jin AI.");
  assert(source.canonical_url === "https://jinai.md/", "Canonical URL must be the root URL.");
  assert(/^\d{4}-\d{2}-\d{2}$/.test(source.last_updated), "last_updated must use YYYY-MM-DD.");
  assert(allowedStatuses.has(source.product.status), "Product status is invalid.");
  assert(source.direct_answers?.length >= 7, "At least seven direct answers are required.");
  assert(source.identity?.legal_name === "Jin AI", "Identity legal name must be Jin AI.");
  assert(Array.isArray(source.identity.same_as) && source.identity.same_as.length >= 1, "Identity must declare a sameAs list for entity disambiguation.");

  const access = source.early_access;
  assert(access?.label && access?.note, "Early access needs a label and a note.");
  assert(typeof access.url === "string" && access.url.startsWith("https://"), "Early access must point at a live https destination.");
  const community = access.community;
  if (community && community.url !== null && community.url !== undefined) {
    assert(
      /^https:\/\/(discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]+$/.test(community.url),
      "Community URL must be a real Discord invite such as https://discord.gg/xxxxxxx."
    );
    assert(community.label && community.note, "A published community link needs a label and a note.");
  }

  const ids = new Set();
  for (const answer of source.direct_answers) {
    assert(answer.id && answer.question && answer.answer, "Each direct answer needs an id, question and answer.");
    assert(!ids.has(answer.id), `Duplicate direct-answer id: ${answer.id}`);
    ids.add(answer.id);
  }

  for (const capability of source.capabilities) {
    assert(allowedStatuses.has(capability.status), `Invalid capability status: ${capability.id}`);
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

function lowerFirst(value) {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function replaceBlock(document, blockName, generated) {
  const start = `<!-- GENERATED:${blockName}:START -->`;
  const end = `<!-- GENERATED:${blockName}:END -->`;
  const startIndex = document.indexOf(start);
  const endIndex = document.indexOf(end);
  assert(startIndex >= 0 && endIndex > startIndex, `Missing generated block: ${blockName}`);
  return `${document.slice(0, startIndex)}${start}\n${generated.trim()}\n${end}${document.slice(endIndex + end.length)}`;
}

function renderCta(source, { centred }) {
  const access = source.early_access;
  const community = access.community;
  const hasCommunity = Boolean(community?.url);

  const secondary = hasCommunity
    ? `\n      <a class="btn btn-s" href="${escapeHtml(community.url)}" target="_blank" rel="noopener">${escapeHtml(community.label)}</a>`
    : "";
  const note = hasCommunity ? `${escapeHtml(access.note)} ${escapeHtml(community.note)}` : escapeHtml(access.note);

  return `<div class="wait">
      <a class="btn btn-p" href="${escapeHtml(access.url)}" target="_blank" rel="noopener">${escapeHtml(access.label)}</a>${secondary}
    </div>
    <div class="waitnote"${centred ? ' data-i18n="final.note"' : ""}>${note}</div>`;
}

function renderFaq(source) {
  const cards = source.direct_answers.map((item) => `
      <article id="faq-${escapeHtml(item.id)}">
        <h3>${escapeHtml(item.question)}</h3>
        <p>${escapeHtml(item.answer)}</p>
      </article>`).join("");

  return `<section id="faq">
  <div class="wrap">
    <div class="eyebrow">Direct answers</div>
    <h2 class="h2">The questions people ask first.</h2>
    <p class="sub">Where the product actually is today, what it will cost, and what it does not do.</p>
    <div class="faq">${cards}
    </div>
  </div>
</section>`;
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
      address: {
        "@type": "PostalAddress",
        addressLocality: source.identity.address_locality,
        addressCountry: source.identity.address_country
      },
      location: {
        "@type": "Place",
        name: source.product.location
      },
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
      operatingSystem: source.product.planned_platforms.join(", "),
      description: source.product.description,
      softwareVersion: "In build",
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
      name: `${source.product.name} — ${source.product.category}`,
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
  const solutionCards = source.solution.steps.map((step) => `
      <section class="card">
        <h3>${escapeHtml(step.name)}</h3>
        <p>${escapeHtml(step.description)}</p>
      </section>`).join("");

  const capabilities = source.capabilities.map((capability) => `
      <section class="card">
        <span class="badge" data-status="${capability.status}">${statusLabels[capability.status]}</span>
        <h3>${escapeHtml(capability.name)}</h3>
        <p>Target stage: ${escapeHtml(capability.target_stage)}.</p>
      </section>`).join("");

  const answers = source.direct_answers.map((item) => `
      <div class="card" id="${escapeHtml(item.id)}">
        <h3>${escapeHtml(item.question)}</h3>
        <p>${escapeHtml(item.answer)}</p>
      </div>`).join("");

  const evidence = source.evidence.map((item) => `<section id="${escapeHtml(item.claim_id)}">
      <h3>${escapeHtml(item.finding)}</h3>
      <p class="caveat"><strong>Scope:</strong> ${escapeHtml(item.scope)}${item.caveat ? ` <strong>Caveat:</strong> ${escapeHtml(item.caveat)}` : ""}</p>
      ${item.source_url ? `<p><a href="${escapeHtml(item.source_url)}">${escapeHtml(item.source_title)}</a> (${escapeHtml(item.published)})</p>` : `<p>Source: ${escapeHtml(item.source_type)}.</p>`}
    </section>`).join("\n    ");

  const founderList = source.founders.map((founder) => `
      <dt><a href="${escapeHtml(founder.profile_url)}">${escapeHtml(founder.name)}</a> — ${escapeHtml(founder.role)}</dt>
      <dd>${escapeHtml(founder.bio)}</dd>`).join("");

  return `<article data-content-version="${escapeHtml(source.content_version)}">
  <h1>${escapeHtml(source.product.name)} for agents</h1>
  <p class="dek">${escapeHtml(source.product.description)}</p>
  <div class="statusline">
    <span class="badge" data-status="${source.product.status}">${statusLabels[source.product.status]}</span>
    <span class="badge">Availability: ${escapeHtml(source.product.availability.replaceAll("_", " "))}</span>
    <span class="badge">Updated: ${escapeHtml(source.last_updated)}</span>
  </div>

  <h2>Direct answer</h2>
  <p class="answer"><strong>${escapeHtml(source.product.name)}</strong> is a ${escapeHtml(lowerFirst(source.product.category))}, with Markdown as the spine. It is for ${escapeHtml(lowerFirst(source.audience.primary))} and is currently <strong>${statusLabels[source.product.status].toLowerCase()}</strong>.</p>

  <h2>Problem</h2>
  <p class="answer"><strong>${escapeHtml(source.problem.headline)}.</strong> ${escapeHtml(source.problem.short_answer)}</p>
  <p>${escapeHtml(source.problem.description)}</p>

  <h2>Evidence and limits</h2>
  ${evidence}

  <h2>Planned product behavior</h2>
  <p>${escapeHtml(source.solution.headline)}. ${escapeHtml(source.solution.principle)}</p>
  <div class="steps">${solutionCards}
  </div>

  <h2>Capability status</h2>
  <p>Status vocabulary is explicit: <strong>In build</strong> means active development, <strong>Planned</strong> means intended next work, and <strong>Later</strong> is not committed for the first release.</p>
  <div class="capabilities">${capabilities}
  </div>

  <h2>Direct questions and answers</h2>
  <div class="answers">${answers}
  </div>

  <h2>Business model</h2>
  <p><strong>${escapeHtml(source.business_model.headline)}</strong> ${escapeHtml(source.business_model.individual_local)} ${escapeHtml(source.business_model.individual_collaboration)} ${escapeHtml(source.business_model.companies)}</p>
  <p class="caveat">${escapeHtml(source.business_model.company_pricing_status)}</p>

  <h2>Founders</h2>
  <dl>${founderList}
  </dl>

  <h2>Primary machine resources</h2>
  <ul>
    <li><a href="${escapeHtml(source.resources.structured_data)}">Structured fact source (JSON)</a></li>
    <li><a href="${escapeHtml(source.resources.llm_index)}">LLM index (text)</a></li>
    <li><a href="${escapeHtml(source.resources.human_page)}">Canonical Human page</a></li>
  </ul>
  <p class="meta">Generated from agent/content.json · content version ${escapeHtml(source.content_version)} · updated ${escapeHtml(source.last_updated)}</p>
</article>`;
}

function renderLlms(source) {
  const answerLinks = source.direct_answers.map((item) =>
    `- [${item.question}](${source.canonical_url}#faq-${item.id}): ${item.answer}`
  ).join("\n");

  const evidenceLinks = source.evidence.map((item) => {
    if (item.source_url) return `- [${item.source_title}](${item.source_url}): ${item.finding} Scope: ${item.scope}`;
    return `- [Structured evidence record](${source.resources.structured_data}): ${item.finding} Scope: ${item.scope}. ${item.caveat}`;
  }).join("\n");

  return `# ${source.product.name}

> ${source.product.description}

Status: ${statusLabels[source.product.status]}. Availability: ${source.product.availability.replaceAll("_", " ")}. Last updated: ${source.last_updated}.

Interpret status words literally. "In build" is not shipped, "planned" is intended next work, and "later" is not committed for the first release. The Human page at ${source.canonical_url} is the sole canonical product page. Agent-facing formats are derivatives generated from the structured JSON fact source.

## Primary resources

- [Canonical Human page](${source.resources.human_page}): Complete product narrative, evidence, roadmap, team and direct-answer FAQ.
- [Agent reference](${source.resources.agent_page}): Concise status-aware HTML for automated research.
- [Structured fact source](${source.resources.structured_data}): Public JSON used to generate agent-facing derivatives.
- [Sitemap](${source.resources.sitemap}): Canonical indexable URL.

## Direct answers

${answerLinks}

## Evidence and sources

${evidenceLinks}

## Founders

${source.founders.map((founder) => `- [${founder.name}](${founder.profile_url}): ${founder.role}. ${founder.bio}`).join("\n")}
`;
}

async function updateGeneratedFile(filePath, transforms) {
  const current = await readFile(filePath, "utf8");
  const expected = transforms.reduce((document, [name, generated]) => replaceBlock(document, name, generated), current);

  if (checkOnly) {
    assert(current === expected, `${path.relative(root, filePath)} is out of date. Run node scripts/generate-aeo.mjs.`);
    return;
  }

  if (current !== expected) await writeFile(filePath, expected, "utf8");
}

validate(data);

await updateGeneratedFile(path.join(root, "index.html"), [
  ["JSON_LD", renderJsonLd(data)],
  ["FAQ", renderFaq(data)],
  ["CTA_HERO", renderCta(data, { centred: false })],
  ["CTA_FINAL", renderCta(data, { centred: true })]
]);

await updateGeneratedFile(path.join(root, "agent", "index.html"), [
  ["AGENT_CONTENT", renderAgent(data)]
]);

const llmsPath = path.join(root, "llms.txt");
const expectedLlms = renderLlms(data);
const currentLlms = await readFile(llmsPath, "utf8");
if (checkOnly) {
  assert(currentLlms === expectedLlms, "llms.txt is out of date. Run node scripts/generate-aeo.mjs.");
} else if (currentLlms !== expectedLlms) {
  await writeFile(llmsPath, expectedLlms, "utf8");
}

console.log(checkOnly ? "AEO derivatives are current." : "Generated AEO derivatives.");
