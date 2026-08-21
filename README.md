# Jin — website

Two design directions for the Jin product site. Same story, two tones.

**Live:** https://yukeidaro.github.io/jin-site/

| | Page | Character |
| --- | --- | --- |
| A | [`a-paper.html`](a-paper.html) | Warm paper, serif headings, cobalt accent. Calm and broad. Recommended. |
| C | [`c-screen.html`](c-screen.html) | Magazine-scale Playfair Display, vermilion accent, numbered chapters. Bolder. |

Each page is a single self-contained HTML file. The only external dependency is Google Fonts.

## The story both pages tell

1. Files pile up faster than you can keep track of them — and search only helps when you already know the word
2. **The product** — three ways to look at the same folder: Notebook, Focus, Project
3. **The method** — visualise it, break it down *your* way, surface only what a person should read
4. **The architecture** — Jin sits *under* the agents, so anything that writes a file can feed it
5. **Privacy** — your files stay on your machine
6. **Upcoming** — what is being built, in what order
7. **Waitlist**

Nothing on these pages claims a measurement from a specific machine. The before/after demo is an illustrative
example folder, not a report about the visitor.

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
