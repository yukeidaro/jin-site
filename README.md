# Jin AI website

Public product site for **Jin AI** at <https://jinai.md/>.

The site has one fixed English product narrative with two audience-specific formats:

| Route | Purpose |
| --- | --- |
| `/` | Entry point; immediately opens `/human/` without an audience chooser |
| `/human/` | Normal visual landing page for prospective users |
| `/agent/` | Semantic, low-interaction product reference for machine readers |
| `/agent/content.json` | Structured product facts used as a machine-readable companion |
| `/llms.txt` | Short agent index with canonical resource links and evidence constraints |
| `/en/` | English-language alias; immediately opens `/human/` |

There is no language toggle and no public Paper, Magazine, Screen or design-direction navigation.

## Content rules

- Product name: **Jin AI**
- Headline: **Structured for AI. Simple for people.**
- Markdown remains the spine of the product story.
- The solution is always explained as **See → Fix → Undo**.
- Structural decisions are written to files agents already read:
  `CLAUDE.md`, `AGENTS.md` and `copilot-instructions.md`.
- Evidence from one founder's laptop must retain its caveat:
  3,950 Markdown files in one week, 89% not reopened within a week and
  283 named `README.md`; this is one machine, not market-wide evidence.
- Customer-facing pages are English-only.

## Human page

`human/index.html` is the canonical landing page. It includes the product story,
screenshots, interactive file-grouping demonstration, roadmap, team and waitlist.
The **For humans / For agents** switch links to the matching fixed route.

Product screenshots live in `shots/`. Paths from the human page are relative to
the route directory so the site works both on `jinai.md` and in local preview.

## Agent page

`agent/index.html` contains the same product facts in a structure designed for
machine extraction:

- stable section IDs and semantic headings;
- explicit metadata and caveat fields;
- JSON-LD for the software application;
- direct links to `agent/content.json`, `llms.txt` and the human page;
- no animation, screenshot dependency or generated copy.

Keep the HTML, JSON and `llms.txt` factually aligned when changing product copy.

## Waitlist

The human page contains two forms. Until a POST endpoint is configured, the form
opens the visitor's mail client. Configure these constants near the bottom of
`human/index.html`:

```js
const WAITLIST_ENDPOINT = "https://formspree.io/f/xxxxxxx";
const WAITLIST_EMAIL = "hello@yourdomain.com";
```

Any endpoint accepting a JSON `email` field can be used.

## Archive

Earlier design explorations and superseded pages live in `archive/`. They remain
available for history but are not linked from the public site. `ja/` is also
superseded and is not part of public navigation.

## Local preview

```powershell
python -m http.server 8777
```

Open:

- <http://127.0.0.1:8777/>
- <http://127.0.0.1:8777/human/>
- <http://127.0.0.1:8777/agent/>
- <http://127.0.0.1:8777/en/>

GitHub Pages deploys from the repository root. Keep the root `CNAME` file with
`jinai.md`.
