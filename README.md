# JinAI — website

Two design directions for the JinAI product site. Same story, two tones.

**Live:** https://yukeidaro.github.io/JinAI-site/

| | Page | Character |
| --- | --- | --- |
| A | [`a-paper.html`](a-paper.html) | Warm paper, serif headings, cobalt accent. Calm and broad. Recommended. |
| C | [`c-screen.html`](c-screen.html) | Magazine-scale Playfair Display, vermilion accent, numbered chapters. Bolder. |

Each page is a single self-contained HTML file. The only external dependency is Google Fonts.

## The story both pages tell

1. **The gap** — business documents (folders, decks, docs, sheets) are familiar but disconnected; linked notes are connected but built for technical and power users
2. **The verdict** — *this is not a file-management problem*. Work should not be fragmented by application or file type. What's missing is an **interaction layer**: a visual workspace holding knowledge, Office documents and AI-generated work together
3. **The product** — one workspace, three ways to look at it: Notebook, Focus, Project
4. **The method** — familiar on the surface, connected underneath, curated so only the human layer shows
5. **The architecture** — JinAI sits *under* the tools, so anything that produces a document can feed it
6. **Why us** — inside Microsoft's workplace productivity ecosystem, and daily users of generative AI and connected notes
7. **Privacy** — your documents stay where they already live
8. **Upcoming** — what is being built, in what order
9. **Waitlist**

Nothing on these pages claims a measurement from a specific machine. The before/after demo is an illustrative
example workspace, not a report about the visitor.

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
