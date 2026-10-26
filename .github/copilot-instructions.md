# Instructions for coding agents working on jinai.md

This repo is the public site for Jin AI. Read `README.md` and the supersession notice in `REPOSITION-PLAN.md` before changing copy or layout. The old plan below that notice is historical, not current copy guidance.

## Positioning (proactive pitch, 2026-10-26)

Jin AI is a B2B product. It spots repetitive work, prepares it before anyone asks, and learns from the team's approvals, edits and rejections. Write for company buyers (heads of IT, CIOs, CISOs and team leads) in plain, natural English. Do not add numbers, customer names or prices.

Headline: **What if the work was already done?** / **もし、仕事がもう終わっていたら？** Page and social titles omit the Japanese question mark.

Hero: small **Jin AI** eyebrow; line **Jin spots repetitive tasks, prepares the work, and learns from your team's feedback.** / **Jinは、繰り返しの仕事を見つけて準備し、チームのフィードバックから学びます。**; tools note below the actions. No badges. Preserve the reveal and CTAs. A labelled example meeting brief (text, not a screenshot or live demo) sits directly below the hero.

Home sections, in order: Problem (**Your team has AI tools. So why are they still doing everything themselves?**), Solution (**What if AI took the first step?**, Today versus With Jin), Data (**Jin does the prep work. Your team stays in control**), How it works (four steps), Why Jin, Team learning, then the waitlist. The exact bilingual copy is pinned in `scripts/validate-site.mjs` and the facts live in `agent/content.json`.

Data (Yu, 2026-10-26): Jin reads the email, calendar, chat and files a team connects, including bodies and attachments, so it may name Gmail, Outlook, Slack and Teams. Never claim Jin does not read message bodies. The four trust promises (admin chooses, employee can disconnect; nothing sent without approval; findings go to the employee, no scoring; data kept separate, no screen recording) are provisional until Yu confirms them.

How it works, Security and Company still carry the earlier harness positioning until they are rewritten. Keep their pinned copy (see `README.md`) unchanged unless the task is that rewrite.

The old consumer and visual-workspace positioning is retired. Do not reintroduce it.

## Page scope

The home page (`index.html`) contains only the hero, the example brief, problem, solution, data, how it works, why Jin, team learning and the waitlist. Do not show pricing or founders on the home page. Founders and direct answers belong in the Agent reference.

R13e approved CTA flow (Yu, 2026-10-21): **Join the waitlist** / **ウェイトリストに登録**, then optional **Request a demo** / **デモを申し込む**. Waitlist note: **We'll email you when access is ready. You can request a demo after joining.** / **ご案内の準備ができしだい、メールでお知らせします。登録後、デモもお申し込みいただけます。** Direct `#request-demo` and the optional demo show **We'll email you to find a time.** / **日程の調整のため、こちらからメールでご連絡します。** Keep the existing fields, endpoint and each step's consent version. No post-request survey.

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
- English headings and heading-like titles have no final period, including each line separated by a `br`. Keep sentence punctuation in running descriptions, question and exclamation marks, and Japanese heading punctuation.
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
