# Jin AI website

Public product site for **Jin AI** at <https://jinai.md/>.

## Production routes

| Route | Purpose |
| --- | --- |
| `/` | Complete English Human landing page and sole product canonical |
| `/how-it-works/` | English companion page with four steps and their delivery status |
| `/ja/` | `noindex,follow` compatibility redirect to `/` |
| `/ja/how-it-works/` | `noindex,follow` compatibility redirect to `/how-it-works/` |
| `/human/` | `noindex` compatibility alias that opens `/` |
| `/en/` | `noindex` English alias that opens `/` |
| `/agent/` | Crawlable, status-aware reference generated for machine readers |
| `/agent/content.json` | Public fact source for Human and Agent derivatives |
| `/llms.txt` | Concise LLM index generated from the fact source |
| `/robots.txt` | Search policy; model-training crawlers are blocked by default |
| `/sitemap.xml` | Contains only `/` and `/how-it-works/` |

The public pages are English-only, without language switches or hreflang
alternates. Legacy Japanese routes keep their English fallback links and use
both meta refresh and `location.replace` redirects.

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
- the hero and final demo-request CTAs, including the existing form;
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
  Keep the existing form fields, endpoint, consent version and survey until
  the form migration.
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

## Demo request and existing waitlist backend

The English hero CTA is generated from `early_access.hero_label` and
`early_access.hero_note` in `agent/content.json`. The existing waitlist form
uses `early_access.label` and `early_access.note`. Both now request a demo.
The form fields, endpoint, consent version and survey remain unchanged.
Legacy localized routes redirect to English and do not carry separate forms.

The custom website form submits JSON directly to an Apps Script web app.
**Google Forms, response receipts, hidden iframes, and form-submit triggers are
not part of this flow.** `waitlist.mjs` waits for a matching, server-confirmed
response and displays registration and welcome-email status separately.
After a saved registration, an optional one-question survey records an answer
in a separate `Survey` tab; retrying an answer updates the same email and survey.

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
   `inspectWaitlistSender`. Both must succeed. Setup creates `Waitlist` and
   `Survey` tabs as needed; it does not modify or delete earlier form responses.
4. Deploy a **Web app**, **Execute as: Me**, **Who has access: Anyone**.
   Anonymous visitors must not have to sign in to Google. Use the full `/exec`
   URL, not an editor URL or a `/dev` test deployment.
5. Set `early_access.form.endpoint` in `agent/content.json` to that URL and
   `early_access.status` to `open`. Until an endpoint is configured, the form
   is explicitly unavailable and cannot pretend a registration succeeded.
6. Run `installWaitlistRetry` once as the deploying account. It installs a
   15-minute retry for records whose mail has not yet been attempted or was
   explicitly rejected by Gmail. Do not retain any old form-submit mail trigger.
7. Regenerate, test, build and publish the site. Confirm a real registration,
   its saved row, the Gmail send result, and the received message's actual From
   address before calling the welcome-email setup complete.

Updating an Apps Script project does not update a versioned web app deployment.
For the survey update, re-run `setupWaitlist` once to create the `Survey` tab,
then use **Deploy > Manage deployments > Edit > New version** after source changes.

### Daily report

The daily report emails the previous JST calendar day's external waitlist signups,
survey answers and Cloudflare Web Analytics traffic to Yu. It also includes a
seven-day JST traffic trend. The report contains names and roles but no signup
email addresses; it sends from the executing Workspace account's default Gmail
address, not the welcome email's `hello@jinai.md` alias.

1. In the same Apps Script project (under the Workspace account), add a script
   file named `daily-report` containing `scripts/daily-report.gs`. Update the
   project's `appsscript.json` from `scripts/appsscript.json` to include the
   `script.external_request` scope.
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

The private `Waitlist` tab records the original registration, consent version,
request ID, welcome-mail status, attempts, timestamps, Gmail message ID and last
error code. Names and roles are validated and protected against sheet formulas.
Emails are normalized and deduplicated under a script lock. Retrying a request
cannot insert another registration or resend an already-sent welcome.
The private `Survey` tab has `Answered at`, `Email`, `Request ID`, `Survey ID`,
`Answer`, `Answer label` and `Updated at` columns. Answers are accepted only for
registered emails; one row per email and survey ID is updated on retries.

| Registration | Welcome email | Meaning |
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
Registrations remain saved when that limit is reached.

The HTML welcome email has a plain-text alternative and this exact invitation:
<https://discord.gg/hn8eG4d9f>. It honestly allows future product updates, with
unsubscribe requests handled by reply to `hello@jinai.md`. Process those replies
before sending future campaigns. Existing response history is not automatically
emailed during migration.

Discord is no longer a published site CTA. Keep `early_access.community.url`
`null`; the generator omits community links. The existing backend welcome-email
invitation above is unchanged until the form and email migration.

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
