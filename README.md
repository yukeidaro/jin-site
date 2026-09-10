# Jin AI website

Public product site for **Jin AI** at <https://jinai.md/>.

## Production routes

| Route | Purpose |
| --- | --- |
| `/` | Complete English Human landing page and sole product canonical |
| `/human/` | `noindex` compatibility alias that opens `/` |
| `/en/` | `noindex` English alias that opens `/` |
| `/agent/` | Crawlable, status-aware reference generated for machine readers |
| `/agent/content.json` | Public fact source for Human and Agent derivatives |
| `/llms.txt` | Concise LLM index generated from the fact source |
| `/robots.txt` | Search policy; model-training crawlers are blocked by default |
| `/sitemap.xml` | Contains only the canonical root |

The site has no language toggle or design-direction chooser. Customer-facing
content is English-only.

## Content source and generation

`agent/content.json` is the status-aware fact source. It records product status,
capability delivery stages, direct answers, pricing status, founders, evidence,
sources and caveats.

Run the zero-dependency generator after changing facts:

```powershell
node scripts/generate-aeo.mjs
```

It updates:

- the visible FAQ in `index.html`;
- the root JSON-LD graph;
- the content of `agent/index.html`;
- `llms.txt`.

Do not edit content inside `GENERATED:*` markers directly. CI runs the generator
in check mode and fails when a derivative has drifted.

## Content rules

- Product name: **Jin AI**
- Headline: **Structured for AI. Simple for people.**
- Markdown remains the spine of the product story.
- The solution is explained as **See -> Fix -> Undo**.
- In-build, planned and later capabilities must remain distinguishable.
- Instruction-file synchronization is planned, not shipped. It will write to
  `CLAUDE.md`, `AGENTS.md` and `copilot-instructions.md`.
- The founder-laptop observation must keep its scope and caveat: 3,950 Markdown
  files in one week, 89% not reopened within the following week and 283 named
  `README.md`; this is one founder's machine, not market-wide evidence.
- Do not add `FAQPage` schema, active offers, ratings or reviews unless they
  become truthful and applicable.

## Early access

There is no public form endpoint or approved domain email yet. The current
temporary action links to Yu Asano's LinkedIn profile so the site does not expose
a broken form or invented contact address.

## Deployment boundary

GitHub Pages deploys through `.github/workflows/deploy-pages.yml`. The build
copies only the allowlist in `scripts/build-pages.mjs` into `_site`.

Historical source directories such as `archive/`, `ja/` and `mockup/`, along
with repository documentation and generation scripts, are intentionally absent
from the production artifact.

## Local validation

```powershell
node scripts/generate-aeo.mjs --check
node scripts/build-pages.mjs
node scripts/validate-site.mjs
python -m http.server 8777 --directory _site
```

Open <http://127.0.0.1:8777/> and <http://127.0.0.1:8777/agent/>.
