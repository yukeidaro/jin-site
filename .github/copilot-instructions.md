# Instructions for coding agents working on jinai.md

This repo is the public site for Jin AI. Read `README.md` and the supersession notice in `REPOSITION-PLAN.md` before changing copy or layout. The old plan below that notice is historical, not current copy guidance.

## Positioning (Yu-reviewed home copy, 2026-10-27)

Jin AI is a B2B product. It spots repetitive work, prepares it before anyone asks, and learns from the team's approvals, edits and rejections. Write for company buyers (heads of IT, CIOs, CISOs and team leads) in plain, natural English. Do not add numbers, customer names or prices.

Headline: **Providing work that's already done, for every employee.** / **仕事を先回りするAI**. Japanese page and social titles use `Jin AI | 仕事を先回りするAI`. Keep every approved English final period.

Hero: small **Jin AI** eyebrow; line **Jin spots repetitive tasks, prepares the work, and learns from your team's feedback.** / **必要な作業を見つけ、下書きを作成。社員の修正を学び、改善します。**; tools note below the actions. No badges. Preserve the reveal and CTAs. The bilingual inbox video sits directly below the hero, before Problem. This is a trial, awaiting Yu's approval. Use the matching local WebM/MP4 and WebP poster, pause offscreen and in hidden tabs, and show only the poster without playback under reduced motion. Without JavaScript, browser-native muted autoplay is allowed.

Home sections, in order after the hero and inbox demo: Problem (**AI is there. Using it is still their job.**), Solution (**Don't ask AI. Jin AI prepares it before anyone asks, right when you need it.**), How it works (**Jin learns how your team works.**, four steps), Trust and control (**Single control plane for what can be accessed.**), then the waitlist (**Let's find one task your team never wants to do again.**). The exact bilingual copy is pinned in `scripts/validate-site.mjs` and the facts live in `agent/content.json`. The Japanese translations are recorded for Yu's review in `.copilot-runs/notes/site-copy-r1.md`.

Problem contains only its heading (**AI is there. Using it is still their job.** / **AIを導入しても残る手作業**) and the three approved image/caption pairs in tools, busy, how order. Keep empty image alt and the six exact English/Japanese captions pinned in `scripts/validate-site.mjs`, with shared typography. Reveal each image and caption together; stack pairs at 760px and below. No extra body paragraphs or labels. Solution has only its heading and **One person's improvement is reviewed, then applied to the relevant people.** Do not restore Today/With Jin, Why Jin, Team learning, the four trust promises or hero badges. Do not use or deploy `today.webp`, `with-jin.webp`, `why-jin.webp`, `team-learning.webp` or `control.webp`; retain their source files. Preserve Yu's four How it works drawings (individual WebP format conversions for scroll motion); retain the original wide/tall sources.

Trust and control has no illustration (Yu, 2026-10-27). It uses only the approved access/review paragraph and **It is never used to train AI models.** The four former trust promises are removed, not approved by this rewrite. Jin reads connected information, including message bodies and attachments (Yu, 2026-10-26); never claim otherwise. MCP servers, sandbox execution and organization skills are explicitly approved in the four home steps. `how_it_works.headline` and `steps` record those steps; its existing `introduction` and `features` still describe the unchanged companion page.

How it works, Security and Company still carry the earlier harness positioning until they are rewritten. Keep their pinned copy (see `README.md`) unchanged unless the task is that rewrite.

The old consumer and visual-workspace positioning is retired. Do not reintroduce it.

## Page scope

The home page (`index.html`) contains only the hero, the inbox demo, problem, solution, how it works, trust and control (retaining `#data` / `#privacy`), and the waitlist. Do not show pricing or founders on the home page. Founders and direct answers belong in the Agent reference.

R13e approved CTA flow (Yu, 2026-10-21): **Join the waitlist** / **ウェイトリストに登録**, then optional **Request a demo** / **デモを申し込む**. Waitlist note: **We'll email you when access is ready. You can request a demo after joining.** / **ご案内の準備ができしだい、メールでお知らせします。登録後、デモもお申し込みいただけます。** Direct `#request-demo` and the optional demo show **We'll email you to find a time.** / **日程の調整のため、こちらからメールでご連絡します。** Keep the existing fields, endpoint and each step's consent version. No post-request survey.

**Jin Handover page (Yu, 2026-10-23):** Only `/handover/` and `/ja/handover/` have these exceptions: write for CTOs, technical co-founders and engineering leaders without explaining technical terms; use **Book a demo** / **デモを予約する** CTAs linking directly to the existing Cal.com URL in `early_access.form.demo_booking.url`, not the waitlist flow; allow "setup" in demo harness names **Engineering Productivity Setup** / **Platform Operations Setup** (the validator exempts only these two pages and `handover.js`). The preview is front-end only and must be labelled as illustrative demo data, not a real customer. Japanese copy is unapproved and tracked in `.copilot-runs/notes/e6c-unapproved-copy.md`.

## Facts and status

- `agent/content.json` is the single fact source. Change facts there, then run `node scripts/generate-aeo.mjs`. Never edit inside `GENERATED:*` markers by hand.
- AEO: Generate `llms.txt`, JSON-LD and `/agent/` from `agent/content.json` with `node scripts/generate-aeo.mjs`; never edit these derivatives by hand.
- Human pages (`/`, `/how-it-works/` and their Japanese twins) do not show status labels (Yu, 2026-10-19). `/agent/` and `llms.txt` keep the Live/Building/Next facts from `agent/content.json`. Never claim a Building or Next item is available today in any copy.
- No prices anywhere on the site, including machine-readable formats.
- Availability: **The workspace beta is live. Company features are being built, starting with Claude Code.** Do not add a pilot requirement.
- Do not publish currency amounts, Pro, Team or free-version offers, Cloud Sync, Google Drive or Notion connections, PC and phone sync, Baby Voice Recorder, TikTok, market size, competitor names, pilot candidate counts, Nov 13, know-how or DelightX. These are exclusions, not product facts.
- E7 exception (Yu, 2026-10-20): the approved Discord invite is `https://discord.gg/C5m4jGgKXD`, recorded in `early_access.community`. Show it only in footer Connect columns (Japanese: つながる), Company Contact lines and machine-readable community facts. Never add it to headers, heroes or menus.
- Display `hello@jinai.md` as selectable plain text with the shared Copy button (Japanese: コピー), never as a mailto link. Hide inactive buttons without JavaScript.
- Every number needs a source line directly under it. Do not invent metrics, testimonials, logos, ratings or user counts.

## Writing

- Plain, specific English, or the approved Japanese copy on `/ja/`, `/ja/how-it-works/`, `/ja/privacy/` and `/ja/accessibility/` (Yu, 2026-10-20). Short sentences. Concrete scenes over abstractions.
- English headings and heading-like titles have no final period, including each line separated by a `br`, except the exact Yu-reviewed home sentence headings dated 2026-10-27 (also in generated Agent content). Keep their final periods, sentence punctuation in running descriptions, question and exclamation marks, and Japanese heading punctuation.
- Do not display draft tags or `data-draft` attributes. Track unapproved copy in `.copilot-runs/notes/e6c-unapproved-copy.md` instead; removing a tag does not approve the copy.
- CJK is required on the Japanese pages and forbidden in all other deployed files except the Japanese footer language-link text on English pages and exact Japanese page titles and descriptions in the generated `llms.txt` Pages index. Shared JavaScript keeps Japanese messages as Unicode escapes. No em dashes, en dashes or curly quotes in either language.
- Keep each English/Japanese page pair structurally aligned, self-canonical, with reciprocal `en`, `ja` and `x-default` hreflang links and header/footer language switches. Generate both home-page CTA blocks from the same form facts; Japanese labels, surname-first order and country ordering must not change payload values or consent.
- Banned words: supercharge, unlock, seamless, effortless, revolutionize, game-changer, empower, leverage, cutting-edge, next-level.
- Do not repeat "No more X" headlines.
- Do not claim nobody else does this. Say where Jin AI sits.

## Design

- Keep the existing system: dark `#08090A` background, Inter headings, body and sentence-case labels (not monospace), primary buttons with white text on `#A84A1C`, existing radii and spacing. Monospace is reserved for code and file names.
- Japanese pages use `"Yu Gothic", "YuGothic", "Yu Gothic UI", "Hiragino Sans", "Noto Sans JP", sans-serif` for Japanese and Latin text, with body weight 500 and existing heading weights. Keep the Noto Sans JP web-font fallback and English fonts unchanged. Protect heading phrases with nonbreaking spans and progressively enhance with `word-break: auto-phrase`.
- One accent color only: `#a84a1c`. Do not add new colors, gradients, glows, blurs, shadows beyond what exists, or emoji.
- Inbox video trial (2026-10-27): Yu's supplied recording preserves its original styling, but the video is awaiting Yu's approval. Do not publish recording HTML/scripts or PNG posters. The former `.inbox-demo` CSS and controller are retired.
- Home illustration boxes are 260px high (180px at 760px and below), with equal Problem tracks and contained artwork. How drawings cap at 520px wide (360px on phones). Home motion uses only local CSS/JS, one-time 20px/650ms reveals, a scroll capsule header and desktop-only four-step sticky progression. Short windows, phones, reduced motion and no JavaScript retain readable normal-flow steps and drawings. Reduced motion disables all transitions/animations; JS must also pause/reset the video and remove autoplay.
- No rows of identical icon cards, numbered circles, 2x2 positioning charts or letter-spaced all-caps labels. Prefer prose, lists, tables and real product screenshots.
- Vary weight: one dominant visual per section.
- Must work at 375px wide with no horizontal scroll.

## Parallel work

Several agent sessions (Claude Code, Copilot CLI) work on this repo at the same time. Never switch branches in a checkout another session may be using, and never commit another session's changes.

- Start each task in its own worktree from the latest `main`:

  ```
  git fetch origin
  git worktree add .claude/worktrees/<task> -b <branch> origin/main
  ```

- Work, test, commit and push from that folder only. Stage files by path (`git add <paths>`), not `git add -A`.
- After the PR merges, remove it: `git worktree remove .claude/worktrees/<task>`.
- Do not use bare `git stash`; the stash is shared by every worktree.

## Before you finish

Run and report the result of:

```
node scripts/generate-aeo.mjs --check
node --test scripts/waitlist.test.mjs
node --test scripts/daily-report.test.mjs
node scripts/build-pages.mjs
node scripts/validate-site.mjs
```

Do not push to `main`; it deploys to production. Work on a branch and open a PR.
