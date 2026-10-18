# Jin AI website

Public product site for **Jin AI** at <https://jinai.md/>.

## Production routes

| Route | Purpose |
| --- | --- |
| `/` | Complete English Human landing page and sole product canonical |
| `/how-it-works/` | English companion page with four steps and their delivery status |
| `/privacy/` | Approved website privacy policy |
| `/accessibility/` | Accessibility goal, known limits and contact details |
| `/ja/` | `noindex,follow` compatibility redirect to `/` |
| `/ja/how-it-works/` | `noindex,follow` compatibility redirect to `/how-it-works/` |
| `/human/` | `noindex` compatibility alias that opens `/` |
| `/en/` | `noindex` English alias that opens `/` |
| `/agent/` | Crawlable, status-aware reference generated for machine readers |
| `/agent/content.json` | Public fact source for Human and Agent derivatives |
| `/llms.txt` | Concise LLM index generated from the fact source |
| `/robots.txt` | Search policy; model-training crawlers are blocked by default |
| `/sitemap.xml` | Contains `/`, `/how-it-works/`, `/privacy/` and `/accessibility/` |

The public pages are English-only, without language switches or hreflang
alternates. Legacy Japanese routes keep their English fallback links and use
both meta refresh and `location.replace` redirects.
The English content pages link to Privacy and Accessibility from their footers.
The approved legal text describes the demo request form and how its details
are used to reply about the request.

## Content source and generation

`agent/content.json` is the status-aware fact source. It records product status,
capability delivery stages, the AI harness definition, company and employee
value, data principles, direct answers, founders, evidence, sources and caveats.

Run the zero-dependency generator after changing facts:

```powershell
node scripts/generate-aeo.mjs
```

It updates:

- the root JSON-LD graph;
- the hero and final demo-request CTAs, including the company-details form;
- the content and title of `agent/index.html`;
- `llms.txt`.

Do not edit content inside `GENERATED:*` markers directly. CI runs the generator
in check mode and fails when a derivative has drifted.

## Content rules

- Product name: **Jin AI**. It is a B2B product for AI-forward companies.
  Write for company buyers: CEOs, heads of IT and CISOs. Do not add company size numbers.
- Headline: **Keep your top performers' AI harnesses inside the company.**
- Use **AI harness** or **harnesses**, never "setup" for this concept.
  An AI harness is the instructions, skills, memory and connected tools around
  an AI agent that make it work for a role.
- The home page contains only the hero, problem, solution, how it works, data
  and demo request. Do not show pricing or founders on the home page.
  Founders and direct answers belong in the Agent reference.
- Problem: **Your best AI skills live with people, not with the company.**
  Shadow AI is a problem label, not a claim that Jin AI blocks it.
- Solution: **Safe for every employee.** **Reusable for the company.**
  Keep both employee and company value in the story.
- Status values are `live`, `building`, `next`; labels are **Live**, **Building**,
  **Next**. Never present Building or Next as shipped. The workspace beta is
  Live. Company features are Building, starting with Claude Code.
- Data: **Your company's context stays yours.** Each company's context is kept
  separate. Jin AI never records your screen. Jin AI itself never trains on
  your data. Do not claim that Jin AI does not read conversation histories.
- CTA: **Request a demo**. Note: **We will email you to set up a demo.**
  The form uses `demo-request-v1` consent and links to the Privacy Policy.
  Keep the endpoint and the legacy backend routes working for cached pages.
- No prices anywhere on the site, including machine-readable formats.
  Do not publish currency amounts, Pro, Team or free-version offers, Cloud Sync,
  Google Drive or Notion connections, PC and phone sync, Discord, Baby Voice
  Recorder, TikTok, market size, competitor names, pilot candidate counts,
  Nov 13, know-how or DelightX. These are exclusions, not product facts.
- Write plain, specific English with short sentences. No CJK characters,
  em dashes, en dashes or curly quotes. Do not invent claims, metrics,
  testimonials, logos, ratings or user counts. Every number needs a source
  line directly under it.
- Avoid supercharge, unlock, seamless, effortless, revolutionize, game-changer,
  empower, leverage, cutting-edge and next-level. Do not repeat "No more X"
  headlines or claim nobody else does this.
- Keep the paper background, Source Serif headings, Inter body, JetBrains Mono
  labels, 4px radius and existing spacing. The only accent color is `#a84a1c`.
  No gradients, glows, new blurs or shadows, emoji, rows of identical icon
  cards, numbered circles, positioning grids or letter-spaced all-caps labels.
  Prefer prose, lists, tables and real product screenshots. Use one dominant
  visual per section. At 375px wide, there must be no horizontal scroll.
- Do not add `FAQPage` schema, active offers, ratings or reviews unless they
  become truthful and applicable.

## Demo request and legacy waitlist backend

The English hero CTA is generated from `early_access.hero_label` and
`early_access.hero_note` in `agent/content.json`. The demo form uses
`early_access.label`, `early_access.note` and `early_access.form.fields`.
It asks for work email, first and last name, job title, optional phone,
company, industry, company size and country. It sends `type: "demo"` with
consent version `demo-request-v1` to the unchanged Apps Script endpoint.
Details are used only to reply about the demo; the form links to `privacy/`.
There is no post-request survey.
Legacy localized routes redirect to English and do not carry separate forms.

The custom website form submits JSON directly to an Apps Script web app.
**Google Forms, response receipts, hidden iframes, and form-submit triggers are
not part of this flow.** `waitlist.mjs` waits for a matching, server-confirmed
response and displays saved-request and confirmation-email status separately.
Field errors are connected to their inputs, and the first invalid field gets
focus. Retrying an unchanged request reuses its request ID.

The backend source is `scripts/waitlist-mailer.gs`; its manifest is
`scripts/appsscript.json`. These files are never included in the Pages artifact.
The advanced Gmail service uses send and sender-settings scopes, not inbox-read
permission. It sends only when `hello@jinai.md` is an accepted Gmail "Send mail
as" identity. There is no fallback to a personal Gmail From address.

### Apps Script deployment

1. Sign in to the Google Workspace account that manages `hello@jinai.md`.
   In Gmail settings, add and verify that address under **Send mail as**.
2. Use an Apps Script project attached to the existing response spreadsheet, or
   set its `SPREADSHEET_ID` script property to a spreadsheet the deploying account
   can edit. Copy the `.gs` source and manifest into the editor.
3. Run `setupWaitlist`, authorize the listed permissions, then run
   `inspectWaitlistSender`. Both must succeed. This creates the `Demo requests`
   tab with its own header row, plus `Waitlist` and `Survey` if missing.
   Existing tabs, columns and response history are not modified or deleted.
4. Deploy a **Web app**, **Execute as: Me**, **Who has access: Anyone**.
   Anonymous visitors must not have to sign in to Google. Use the full `/exec`
   URL, not an editor URL or a `/dev` test deployment.
5. Set `early_access.form.endpoint` in `agent/content.json` to that URL and
   `early_access.status` to `open`. Until an endpoint is configured, the form
   is explicitly unavailable and cannot pretend a request succeeded.
6. Run `installWaitlistRetry` once as the deploying account. It installs a
   15-minute retry for both demo confirmations and legacy welcome emails whose
   mail has not yet been attempted or was explicitly rejected by Gmail.
   It does not resend an already-sent or ambiguous email.
   Do not retain any old form-submit mail trigger.
7. Regenerate, test, build and publish the site. Confirm a real demo request,
   its saved row, the Gmail send result, and the received message's actual From
   address before calling confirmation-email delivery complete.

Updating an Apps Script project does not update a versioned web app deployment.
**After merging this migration, Yu must copy the updated mailer and daily report
source into the same project, run `setupWaitlist` once, and redeploy the existing
web app with Deploy > Manage deployments > Edit > New version > Deploy.**
Keep the current deployment and `/exec` URL; do not create a replacement endpoint.
Run `inspectWaitlistSender` and ensure `installWaitlistRetry` has been run.
The source version is `2026-10-19.1`. Do this before publishing the new form:
the old deployed backend cannot accept demo requests. Source changes alone do
not deploy anything or send any real request.

### Daily report

The daily report emails the previous JST calendar day's external demo requests,
legacy waitlist signups, survey answers and Cloudflare Web Analytics traffic to
Yu. For each demo it includes company, company size, industry, country and job
title, without email addresses or phone numbers. Contact information pasted
into those details is redacted. It also includes a seven-day JST traffic trend.
Legacy signup entries retain names and roles but not email addresses. The report
sends from the executing Workspace account's default Gmail address, not the
confirmation email's `hello@jinai.md` alias.

1. In the same Apps Script project (under the Workspace account), add a script
   file named `daily-report` containing `scripts/daily-report.gs`. Update the
   project's `appsscript.json` from `scripts/appsscript.json` to include the
   `script.external_request` scope. Run `setupWaitlist` first so all three sheet
   schemas, including `Demo requests`, exist.
2. Under **Project Settings > Script properties**, set `CF_API_TOKEN` to a
   Cloudflare API token with **Account > Account Analytics > Read** permission,
   `CF_ACCOUNT_ID` to the Cloudflare account ID and `CF_SITE_TAG` to the Web
   Analytics site tag (from its beacon configuration). Keep the token out of
   source control. Without all three, the email explicitly says analytics is
   not configured.
3. Run `inspectDailyReport` once to preview the text and authorize the new
   external-request scope. Run `sendDailyReport` once to check the received
   email, then run `installDailyReport` to create the daily trigger.

The trigger runs around 08:00 **Asia/Tokyo**; Apps Script does not guarantee
an exact minute. Time-driven triggers use the latest saved project code, so a
new web app deployment is **not** needed for this report. Saving a manifest
scope change does require re-authorization.

### Storage and delivery states

The private `Demo requests` tab records created time, request ID, source,
`demo-request-v1` consent, all nine form fields, confirmation status, attempts,
last and next attempt time, sent time, Gmail message ID and last error code.
Text cells are protected against formulas. A script lock prevents simultaneous
retries from duplicating a row or confirmation. A new request ID is a separate
intentional demo request, even if the email is the same, so later company
details are not silently discarded.

The confirmation subject is **We received your Jin AI demo request**. The short
plain-text and HTML alternatives thank the buyer by first name, say we will
email to arrange a time, and invite questions by reply to `hello@jinai.md`.
They explain why the message was sent and link only to the website and Privacy
Policy. No marketing consent is requested or recorded for demos.

The private legacy `Waitlist` tab records the original registration, consent version,
request ID, welcome-mail status, attempts, timestamps, Gmail message ID and last
error code. Names and roles are validated and protected against sheet formulas.
Emails are normalized and deduplicated under a script lock. Retrying a request
cannot insert another registration or resend an already-sent welcome.
Its `waitlist-product-updates-v1` consent and old welcome-email path remain
available to cached pages; they do not write demo requests into legacy tabs.
The private `Survey` tab has `Answered at`, `Email`, `Request ID`, `Survey ID`,
`Answer`, `Answer label` and `Updated at` columns. Answers are accepted only for
registered emails; one row per email and survey ID is updated on retries.

The JSON response keeps the legacy keys `registration` and `welcome` for both
request types. For demos these mean request storage and confirmation delivery.

| Request storage | Email | Meaning |
| --- | --- | --- |
| `saved` | `sent` | Gmail returned a message ID. This is not proof of inbox delivery. |
| `saved` | `pending` | Saved; sender setup, a sending limit, or a known rejection is delaying email. |
| `saved` | `failed` | Saved; email was rejected or exhausted its permitted retries. |
| `saved` | `unknown` / `sending` | Saved; the send outcome needs manual review. Never blindly resend. |
| `not_saved` | `not_attempted` | Validation failed or the service was busy before writing. |
| `unknown` | `not_attempted` | Storage or transport did not provide a reliable confirmation. Retry safely. |

`sender_not_verified` means the deploying Gmail account lacks the accepted From
alias. `sender_unavailable` means sender authorization or Gmail service setup
must be fixed. Run `inspectWaitlistSender` after fixing the account or scopes.
The default `DAILY_EMAIL_LIMIT` is a conservative 90 attempts per UTC day;
raise that script property only within the deploying account's Gmail limits.
The limit is shared by both mail queues. Requests remain saved when it is
reached. Existing response history is not automatically emailed during migration.
Keep `early_access.community.url` `null`; the generator omits community links.

## Deployment boundary

GitHub Pages deploys through `.github/workflows/deploy-pages.yml`. The build
copies only the allowlist in `scripts/build-pages.mjs` into `_site`.

The production artifact includes the compatibility redirects, shared page assets
and `shots/og-b2b.png`, the shared 1200 x 630 social image.
Its source, `shots/og-b2b-src.html`, is not deployed. Retired screenshots and
illustrations remain in the repository but are not in the allowlist.
Historical source directories such as `archive/` and
`mockup/`, along with repository documentation and generation scripts, are
intentionally absent from the production artifact.

## Local validation

```powershell
node scripts/generate-aeo.mjs --check
node --test scripts/waitlist.test.mjs
node --test scripts/daily-report.test.mjs
node scripts/build-pages.mjs
node scripts/validate-site.mjs
python -m http.server 8793 --bind 127.0.0.1 --directory _site
```

Open <http://127.0.0.1:8793/>, <http://127.0.0.1:8793/how-it-works/>,
<http://127.0.0.1:8793/ja/> (redirects to English) and
<http://127.0.0.1:8793/agent/>. Stop the server when finished.
