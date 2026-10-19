# Instructions for coding agents working on jinai.md

This repo is the public site for Jin AI. Read `README.md` and the supersession notice in `REPOSITION-PLAN.md` before changing copy or layout. The old plan below that notice is historical, not current copy guidance.

## Positioning (October 2026)

Jin AI is a B2B product for AI-forward companies. Write for company buyers: CEOs, heads of IT and CISOs. Do not add company size numbers.

Headline: **Keep your top performers' AI harnesses inside the company.**

Use **AI harness** or **harnesses**, never "setup" for this concept. An AI harness is the instructions, skills, memory and connected tools around an AI agent that make it work for a role.

Problem: **Your best AI skills live with people, not with the company.** Shadow AI is a problem label, not something Jin AI claims to block.

Solution: **Safe for every employee.** **Reusable for the company.** Keep both employee and company value in the story.

Data: **Your company's context stays yours.** Each company's context is kept separate. Jin AI never records your screen. Jin AI itself never trains on your data. Do not claim that Jin AI does not read conversation histories.

The old consumer and visual-workspace positioning is retired. Do not reintroduce it.

## Page scope

The home page (`index.html`) contains only the hero, problem, solution, how it works, data and demo request. Do not show pricing or founders on the home page. Founders and direct answers belong in the Agent reference.

CTA: **Request a demo**. Note: **We will email you to set up a demo.** Keep the existing form fields, endpoint, consent version and survey until the form migration.

## Facts and status

- `agent/content.json` is the single fact source. Change facts there, then run `node scripts/generate-aeo.mjs`. Never edit inside `GENERATED:*` markers by hand.
- Human pages (`/`, `/how-it-works/`) do not show status labels (Yu, 2026-10-19). `/agent/` and `llms.txt` keep the Live/Building/Next facts from `agent/content.json`. Never claim a Building or Next item is available today in any copy.
- No prices anywhere on the site, including machine-readable formats.
- Do not publish currency amounts, Pro, Team or free-version offers, Cloud Sync, Google Drive or Notion connections, PC and phone sync, Discord, Baby Voice Recorder, TikTok, market size, competitor names, pilot candidate counts, Nov 13, know-how or DelightX. These are exclusions, not product facts. Keep `early_access.community.url` null.
- Every number needs a source line directly under it. Do not invent metrics, testimonials, logos, ratings or user counts.

## Writing

- English, plain, specific. Short sentences. Concrete scenes over abstractions.
- No CJK characters, em dashes, en dashes or curly quotes.
- Banned words: supercharge, unlock, seamless, effortless, revolutionize, game-changer, empower, leverage, cutting-edge, next-level.
- Do not repeat "No more X" headlines.
- Do not claim nobody else does this. Say where Jin AI sits.

## Design

- Keep the existing system: paper background, Source Serif headings, Inter body, JetBrains Mono labels, 4px radius, existing spacing.
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
