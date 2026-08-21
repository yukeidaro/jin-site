# Jin — website directions

Three design directions for the Jin product site. Same content, three tones.

**Live:** https://yukeidaro.github.io/jin-site/

| | Page | Character |
| --- | --- | --- |
| A | [`a-paper.html`](a-paper.html) | Warm paper, serif headings, cobalt accent. Closest to the reference tone. Recommended. |
| B | [`b-terminal.html`](b-terminal.html) | Dark ground, faint grid, a live terminal typing `jin scan`. For a developer audience. |
| C | [`c-screen.html`](c-screen.html) | Folding-screen metaphor made literal — nine panels you scroll sideways. Editorial and opinionated. |

Each page is a single self-contained HTML file. The only external dependency is Google Fonts.

## What the pages say

Jin gives every document on your disk a cover, folds them into groups, and keeps them traceable.

- **Cover** — a recognisable cover for every file, generated without reading it first so it appears instantly
- **Fold** — 2,650 items are never shown as 2,650 items; they fold into 9 labelled groups
- **Trace** — stable identifiers on paragraphs, slides and cell ranges, so an AI rewrite stays legible as a diff

Local-first, no account, and v1 makes no network calls.

## Notes

- Every figure on these pages is measured from a real machine, not invented.
- `ja/` holds the earlier Japanese drafts, kept for reference only. They are not linked from the site.
- Previews (`preview-*.jpg`) are regenerated from the pages themselves; re-shoot them if a page changes.

## Local preview

```
python -m http.server 8777
```

Then open http://127.0.0.1:8777/
