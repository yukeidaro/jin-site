# Instructions for coding agents working on jinai.md

This repo is the public site for Jin AI. Read `README.md` and `REPOSITION-PLAN.md` before changing copy or layout.

## Positioning (October 2026)

Jin AI learns how you work from your files and AI chat history, and gives that context to every AI you use (Claude Code, ChatGPT, Codex, Copilot), so you stop re-prompting. Memory is plain Markdown the user can read and fix. It never records the screen.

The older "visual workspace for files your agents create / See -> Fix -> Undo" positioning is retired. Do not reintroduce it.

## Page scope

The Human page (`index.html`) contains only the hero, the problem, the solution and the waitlist. Do not add pricing, team, roadmap, comparison or FAQ sections to it; those facts belong in `agent/content.json`.

## Facts and status

- `agent/content.json` is the single fact source. Change facts there, then run `node scripts/generate-aeo.mjs`. Never edit inside `GENERATED:*` markers by hand.
- Keep status words literal: Beta, Planned, Later. Never present a planned capability as shipped. Instruction-file sync (`CLAUDE.md`, `AGENTS.md`, `copilot-instructions.md`) stays "Planned" until it ships.
- Pricing is a proposal being tested in the beta. Say so wherever a price appears.
- Every number needs a source line directly under it. Do not invent metrics, testimonials, logos, ratings or user counts.

## Writing

- English, plain, specific. Short sentences. Concrete scenes over abstractions.
- Banned words: supercharge, unlock, seamless, effortless, revolutionize, game-changer, empower, leverage, cutting-edge, next-level.
- Do not repeat "No more X" headlines. Do not stack em dashes.
- Do not claim nobody else does this. Say where Jin AI sits.

## Design

- Keep the existing system: paper background, Source Serif headings, Inter body, JetBrains Mono labels, 4px radius, existing spacing.
- One accent colour only. Do not add new colours, gradients, glows, blurs, shadows beyond what exists, or emoji.
- No rows of equal icon cards, no numbered circles, no 2x2 positioning charts. Prefer prose, lists, tables and real product screenshots.
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
node scripts/build-pages.mjs
node scripts/validate-site.mjs
```

Do not push to `main`; it deploys to production. Work on a branch and open a PR.
