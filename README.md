# Jin AI — website

Two design directions for the Jin AI product site. Same story, two tones.

**Live:** https://yukeidaro.github.io/Jin AI-site/

| | Page | Character | Languages |
| --- | --- | --- | --- |
| A | [`a-paper.html`](a-paper.html) | Warm paper, serif headings, cobalt accent. Calm and broad. Recommended. | English + 日本語 |
| C | [`c-screen.html`](c-screen.html) | Magazine-scale Playfair Display, vermilion accent, numbered chapters. Bolder. | English only |

Each page is a single self-contained HTML file. The only external dependency is Google Fonts.

## Languages (page A)

`a-paper.html` ships English and Japanese in the one file, with a `日本語 / EN` switch in the header.

- **Which one a visitor gets:** `?lang=ja` or `?lang=en` in the URL wins, then whatever they last picked
  (`localStorage["jinai-lang"]`), then their browser language — `ja*` gets Japanese, everyone else gets English.
- **Where the words live:** English stays in the markup and is captured into the `EN` dictionary on load, so it can
  never drift from the HTML. Japanese lives in the `JA` object at the top of the page script.
- **Editing copy:** change English in the markup as usual, then update the matching key in `JA`. Every translatable
  element carries `data-i18n="key"` (plus `data-i18n-ph` / `data-i18n-aria` for the email field). The switch also
  swaps `<title>`, the meta description, `<html lang>`, and the strings the scripts build by hand — the raw/organised
  demo and the waitlist messages.
- **Adding a third language:** add one more dictionary with the same keys and one more button in `.langsw`. There are
  180 keys; the page logs nothing if one is missing, it just falls back to English.
- **Japanese type:** headings fall back to Hiragino Mincho / Yu Mincho and body text to Hiragino Kaku Gothic / Yu
  Gothic, so no extra webfont is downloaded. Line height and letter-spacing are loosened under `html[lang="ja"]`.

## The story both pages tell

Positioning follows the external narrative for Jin AI. **One line: "Structured for AI. Simple for people."**

1. **What changed** — generative AI keeps increasing how much gets created at work, scattered across Markdown,
   presentations, documents, spreadsheets, PDFs, chat and local AI output. Markdown is easy for AI to process, but
   *managing file names, folders, links and tags was never supposed to become a business user's job*
2. **The false choice** — structures that work well for AI (connected, but you maintain the files, links and tags
   yourself) versus interfaces that work well for people (familiar, but the content is cut off from the notes,
   sources and decisions that shaped it). You shouldn't have to pick
3. **The method** — you keep the navigation; AI keeps the structure. Relationships, classification, sources and
   history are maintained underneath, and your decisions are **written back into the instruction files agents already
   read** (`CLAUDE.md`, `AGENTS.md`, `copilot-instructions.md`), so the next file lands where you'd have put it.
   No plugin, no API
4. **The product** — one workspace, two views (Notebook and Project), a visual editor, and agent-only files kept out
   of sight but still on disk for the agents
5. **The outcome** — people stop managing files and get on with the work; AI gets richer context without that same
   volume being pushed at the human
6. **How we ship** — free and open source for individuals; paid for organisations needing shared storage, access
   control, governance and collaboration
7. **Team**, **upcoming**, then the **waitlist**

Files stay in their normal formats so agents keep working — the promise is that *you never have to manage them*,
not that Markdown is absent. The raw/organised demo is an illustrative example project, not a report about the visitor.

### Deliberately not on these pages

This is a consumer landing page, so investor-facing material lives in the pitch instead of here: the Obsidian
comparison table, the segment breakdown (CEOs / vibe coders / BD managers / Microsoft 365 organisations), and the
go-to-market and customer-discovery credentials. Obsidian is still named once, in prose, as one side of the false
choice. Earlier drafts are in `archive/`.

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
| Focus | Captured but not used on the site — the two views above carry the story |
| Project | The same colours reused as coordinates — a whole project on one screen |

Every screenshot carries intrinsic `width`/`height` plus an explicit `aspect-ratio`, so it can never be
squashed while loading or at narrow widths.

To re-capture after editing the mockup, serve the repo and screenshot the `.app` element at
`mockup/ui-concept-v5.html?mode=notebook|focus|project`.

## Folders

- `archive/` — the first round of pages, written around one person's measured folder and a 60-second install claim
- `ja/` — **superseded.** Japanese first drafts from two narratives ago, never linked from the site. The live Japanese
  copy is now inside `a-paper.html`; treat this folder as archive material
- `mockup/` — the UI concept the screenshots come from

## Local preview

```
python -m http.server 8777
```

Then open http://127.0.0.1:8777/
