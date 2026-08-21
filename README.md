# Jin AI — website

Two design directions for the Jin AI product site. Same story, two tones.

**Live:** https://yukeidaro.github.io/Jin AI-site/

| | Page | Character |
| --- | --- | --- |
| A | [`a-paper.html`](a-paper.html) | Warm paper, serif headings, cobalt accent. Calm and broad. Recommended. |
| C | [`c-screen.html`](c-screen.html) | Magazine-scale Playfair Display, vermilion accent, numbered chapters. Bolder. |

Each page is a single self-contained HTML file. The only external dependency is Google Fonts.

## The story both pages tell

Positioning follows the SkyDeck / F6S application for Jin AI, so the site and the application say the same thing.

**One line: "The next Obsidian for business people."**

1. **The problem** — *Markdown file chaos.* The more agents you run, the more Markdown lands in your folders. Every agent files by its own logic, and much of what it writes (instructions, memory, logs, intermediate output) was never meant for a person
2. **The method** — two structures kept in sync: how you want to understand and organise your work, and how agents create and store files. Your decisions about boundaries, categories, visibility and relationships become the rule applied to whatever lands next
3. **The product** — one workspace, three views (Notebook, Focus, Project), plus a visual Markdown editor: edit, reorganise, duplicate and connect, written back as plain Markdown
4. **vs Obsidian** — excellent for technical users, but it shows agent-facing files like any other note and expects you to maintain the vault yourself
5. **Who it's for** — CEOs, non-engineer vibe coders and BD managers today; Microsoft 365 organisations next
6. **How we ship** — free and open source for individuals; paid for organisations needing shared storage, access control, governance and collaboration
7. **Team** — Yu Asano and Tomoya Kato, with LinkedIn links
8. **Upcoming**, then the **waitlist**

Nothing on these pages claims a measurement from a specific machine. The raw/organised demo is an illustrative
example project, not a report about the visitor.

## Turning the waitlist on

Both pages ship with a working form. Until an endpoint is set it falls back to opening the visitor's mail client,
so the button is never dead. To collect properly, set two constants near the bottom of either file:

```js
const WAITLIST_ENDPOINT = "https://formspree.io/f/xxxxxxx";  // any POST endpoint taking { email }
const WAITLIST_EMAIL    = "hello@yourdomain.com";            // mail fallback address
```

Formspree, Tally and Basin all work as-is. Success and failure states are already handled.

## Product screenshots

`shots/` holds the real product screens, captured from `mockup/ui-concept-v5.html`.

| View | What it shows |
| --- | --- |
| Notebook | Colour-coded groups beside a readable page |
| Focus | A page and its native files as one continuous surface |
| Project | The same colours reused as coordinates — a whole project on one screen |

Every screenshot carries intrinsic `width`/`height` plus an explicit `aspect-ratio`, so it can never be
squashed while loading or at narrow widths.

To re-capture after editing the mockup, serve the repo and screenshot the `.app` element at
`mockup/ui-concept-v5.html?mode=notebook|focus|project`.

## Folders

- `archive/` — the first round of pages, written around one person's measured folder and a 60-second install claim
- `ja/` — Japanese first drafts, not linked from the site
- `mockup/` — the UI concept the screenshots come from

## Local preview

```
python -m http.server 8777
```

Then open http://127.0.0.1:8777/
