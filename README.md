# Jin AI website

Public product site for **Jin AI** at <https://jinai.md/>.

## Production routes

| Route | Purpose |
| --- | --- |
| `/` | Complete English Human landing page and sole product canonical |
| `/ja/` | Full Japanese Human landing page with its own canonical |
| `/human/` | `noindex` compatibility alias that opens `/` |
| `/en/` | `noindex` English alias that opens `/` |
| `/agent/` | Crawlable, status-aware reference generated for machine readers |
| `/agent/content.json` | Public fact source for Human and Agent derivatives |
| `/llms.txt` | Concise LLM index generated from the fact source |
| `/robots.txt` | Search policy; model-training crawlers are blocked by default |
| `/sitemap.xml` | Contains the English and Japanese canonical routes |

The footer links between the English page at `/` and the Japanese page at
`/ja/`. Both pages link their hreflang alternates.

## Content source and generation

`agent/content.json` is the status-aware fact source. It records product status,
capability delivery stages, direct answers, pricing status, founders, evidence,
sources and caveats.

Run the zero-dependency generator after changing facts:

```powershell
node scripts/generate-aeo.mjs
```

It updates:

- the root JSON-LD graph;
- the content of `agent/index.html`;
- `llms.txt`.

Do not edit content inside `GENERATED:*` markers directly. CI runs the generator
in check mode and fails when a derivative has drifted.

## Content rules

- Product name: **Jin AI**
- The Human pages (`/` and `/ja/`) contain only the hero, **After you use
  Jin AI**, **Private by design**, and the waitlist. Pricing, roadmap, founders,
  comparisons and direct answers belong in the status-aware Agent derivatives.
- Headline: **The one-click setup that makes AI know you from the start.**
  Supporting line: *Jin AI gives you the AI setup engineers have. One click,
  and every AI learns about you.* Use the approved English and Japanese copy
  in `mockup/v6/BRIEF.md` verbatim.
- The three benefits are short prompts, telling AI once across tools, and
  bringing the right local files to the right chats. Show Claude, ChatGPT and
  Copilot as text, not as a row of identical feature cards.
- **Private by design** distinguishes on-device facts from planned Cloud Sync
  for Pro. Jin AI never records your screen, learns locally in the free version,
  never moves your files, never trains on your data itself, and lets you choose
  what it reads and shares. Google Drive, Notion and PC/phone sync are planned.
- Keep **In build**, **Planned**, and **Later** distinct; do not present a
  planned integration or access control as already shipped. Prices in the
  Agent reference are proposals being tested in the beta.
- The hero uses `shots/plugin-screen.png`, a real product screen, rather
  than an illustrative memory mockup or unverified user data.
- Do not add `FAQPage` schema, active offers, ratings or reviews unless they
  become truthful and applicable.

## Waitlist and community

The English hero CTA is generated from `early_access.hero_label` and
`early_access.hero_note` in `agent/content.json`. The existing waitlist form
uses `early_access.label` and `early_access.note` and must not change as part
of the page-content update. The Japanese page uses the same endpoint, field
names and survey values with localized labels.

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

To publish the Discord invite as a second CTA, set the URL and regenerate:

```jsonc
// agent/content.json
"early_access": {
  "community": { "url": "https://discord.gg/xxxxxxx" }
}
```

```powershell
node scripts/generate-aeo.mjs
```

Use a permanent invite (Discord invite settings: *Expire after: Never*, *Max uses:
No limit*). Validation rejects anything that is not a real `discord.gg` or
`discord.com/invite` link, and the Discord button is omitted entirely while
`community.url` is `null`.

Discord conversations are not indexed by search engines: `discord.com/robots.txt`
contains `Disallow: /channels`. Treat Discord as a feedback and support surface,
not a discovery channel.

## Deployment boundary

GitHub Pages deploys through `.github/workflows/deploy-pages.yml`. The build
copies only the allowlist in `scripts/build-pages.mjs` into `_site`.

The production artifact includes `/ja/`, `shots/plugin-screen.png` and the
shared page assets. Historical source directories such as `archive/` and
`mockup/`, along with repository documentation and generation scripts, are
intentionally absent from the production artifact.

## Local validation

```powershell
node scripts/generate-aeo.mjs --check
node --test scripts/waitlist.test.mjs
node scripts/build-pages.mjs
node scripts/validate-site.mjs
python -m http.server 8777 --directory _site
```

Open <http://127.0.0.1:8777/>, <http://127.0.0.1:8777/ja/> and
<http://127.0.0.1:8777/agent/>.
