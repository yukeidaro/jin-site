# Jin AI website

Public product site for **Jin AI** at <https://jinai.md/>.

## Production routes

| Route | Purpose |
| --- | --- |
| `/` | Complete English Human landing page |
| `/how-it-works/` | Five feature rows: Employees, then Admins; AI harness definition |
| `/security/` | Draft English security and data page |
| `/company/` | Draft company mission and contact page |
| `/resources/ai-harness/` | `noindex` compatibility redirect to `/how-it-works/#harness` |
| `/privacy/` | Approved website privacy policy |
| `/accessibility/` | Accessibility goal, known limits and contact details |
| `/ja/` | Japanese translation of the English home, with the live demo, interactive Problem/Solution figures and the same demo form |
| `/ja/how-it-works/` | Japanese twin of the five feature rows and harness definition |
| `/ja/security/` | Draft Japanese security and data page |
| `/ja/company/` | Draft Japanese company mission and contact page |
| `/ja/resources/ai-harness/` | `noindex` compatibility redirect to `/ja/how-it-works/#harness` |
| `/ja/privacy/` | Approved Japanese website privacy policy |
| `/ja/accessibility/` | Approved Japanese accessibility statement |
| `/human/` | `noindex` compatibility alias that opens `/` |
| `/en/` | `noindex` English alias that opens `/` |
| `/agent/` | Crawlable, status-aware reference generated for machine readers |
| `/agent/content.json` | Public fact source for Human and Agent derivatives |
| `/llms.txt` | Concise LLM index generated from the fact source |
| `/robots.txt` | Search policy; model-training crawlers are blocked by default |
| `/sitemap.xml` | Contains twelve English and Japanese content page URLs, excluding redirects |

The public content pages are self-canonical, with `en`, `ja` and `x-default`
hreflang alternates. Every Japanese page has the same body structure, section
IDs, component classes, images and controllers as its English twin, except
the approved Japanese two-part Solution closing (bold line plus paragraph). The
Japanese home heading uses the approved text `AIを、会社の資産に。`
in two reveal phrases; the generated form preserves surname-first order and Japanese country
labels without changing payload values. The English-only language-choice
redirect and root fact graph are not duplicated on Japanese pages.
Headers have the Product dropdown, Security, Company,
Contact and Request a demo. Below 960px, a scroll-locking mobile panel groups
the same links. `nav.js` handles keyboard, focus, click and Escape behavior.
English footer columns are Product, Legal, Company and Connect; Japanese uses
規約・方針 for Legal. Privacy and Accessibility are footer-only navigation links.
The retired AI harness articles have no navigation, sitemap or hreflang entries;
tiny static redirects keep old links working. The small
English / Japanese footer links remember the visitor's choice in `language.js`; the English home chooses Japanese for first-time Japanese browsers, never bots, with session or query fallback when storage is blocked.
Japanese pages use the approved
Japanese copy (Yu, 2026-10-20); English pages remain English except for the
Japanese footer language link. Japanese footer language links open the matching
English twin and remember the choice using the shared handler. Each language links to its own Privacy and
Accessibility pages from the footer.
The approved legal text describes the demo request form and how its details
are used to reply about the request.

Every visible contact email uses the same selectable plain-text address and
small Copy button, including legal pages, form notes and noscript fallbacks.
`copy.js` copies with the Clipboard API, announces Copied for 1.5 seconds,
and selects the address with a Ctrl+C instruction if copying fails.
Japanese labels and announcements follow the document language. Button space
is reserved before enhancement and during feedback; without JavaScript the
button is hidden and the address remains selectable. Controls have a 24px
minimum height, or 44px on phone/coarse-pointer layouts. Footer email/button
pairs stay on one line when space permits, otherwise wrap left-aligned.

E7 approves `https://discord.gg/C5m4jGgKXD` (Yu, 2026-10-20) in footer Connect
columns, Company Contact community lines and machine-readable facts only.
`early_access.community` is the fact source; the LLM index is generated from it.
All invite links open a new tab with `rel="noopener"`. No invite appears in
headers, heroes or navigation menus.

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
- the English and Japanese hero and final demo-request CTAs, including the company-details form;
- the content and title of `agent/index.html`;
- `llms.txt`.

Do not edit content inside `GENERATED:*` markers directly. CI runs the generator
in check mode and fails when a derivative has drifted.

## English hero product demo

Every product screen uses a `figure.demo-stage` outline and lighter
inner surface around a floating `.demo-window`. Desktop padding is 48px;
phones use 16px. The window retains the demo's own title bar, with no extra
chrome, glow or bottom fade. The hero still and the moving workflow screens
keep their 2880:1664 screen ratio and existing accessible names.

The home product window keeps the eager Categories WebP as its accessible
fallback. Once the still has painted, visitors without reduced motion get
`assets/demo/app.html?embed=hero` in an inert, untabbable iframe. A template
prevents any iframe request under reduced motion. The frame keeps the still's
2880:1664 ratio and scales the demo's native 1440px layout at every width.

Hero mode shows Connect with ChatGPT for four seconds, selects Claude Code for
1.2 seconds, then holds Categories for five seconds and repeats. R9 shows the
demo's arrow moving to and clicking each tool or navigation control, with a
short accent ring. Returning to Connect includes a 650ms move to ChatGPT,
making the full cycle 10.85 seconds (previously 10.2). The existing helpers
invoke the control handlers in hero mode without unblocking user interaction;
cursor coordinates use the actual 832px stage height. It hides tour
controls and summary cards and cannot navigate to admin scenes. Same-origin,
source-checked messages pause and resume the remaining scene time when the
frame leaves the viewport or the tab is hidden. The still remains underneath;
the iframe fades in after its readiness message or 500ms after load.
Hero cursor travel uses transforms, not layout coordinates, and does not
scroll the parent page. The standalone demo retains its original scrolling
and coordinate behavior.

The demo copy uses system fonts and embedded or local images only. Its CSP
blocks external resources, connections and form submissions. Three large
inline raster assets were extracted into `assets/demo/app/`; the logo is
stored at three times its rendered resolution. The supplied original is
read-only and was not changed. Japanese pages use the same English demo and
screens, with translated accessible descriptions.
Performance measurements, screenshots and the recommendation are recorded in
`.copilot-runs/notes/e3.md`. No new runtime or build dependencies are required.

Employees and Admins audience headings are 24px, weight 550, line-height 1.3,
with `--text-1` and the existing sans-serif stack on both home excerpts and
both How it works pages. Japanese keeps its approved Yu Gothic stack.
Moving workflow screens reset to their full first frame when offscreen, the
tab is hidden or reduced motion is enabled. Reentry begins a new camera cycle,
not a frozen mid-zoom crop. The stills and intended camera keyframes are unchanged.
E7 browser evidence and screenshots are in `.copilot-runs/notes/e7.md`.

### How it works feature screens (R3)

Both companion pages stack Employees (two rows) above Admins (three rows).
Each row has its exact title and explanation. The first four have one E5 demo
stage with a translated caption chip. Desktop keeps text left and screen right; at 1023px
and below text precedes the screen. The home excerpts contain only the two
audience labels, five feature titles and companion-page link, without screens.
The approved AI harness definition is the bottom note at `#harness`.

The first four rows reuse the Connect, Categories, By role and What can move
WebP stills, with independent nine-second camera cycles. The fifth is an
intentionally blank framed placeholder, not an invented product interface.
R8 hides the fifth stage and its caption with `hidden` on the figure in both
languages. The text spans the row through the shared `:has()` layout rule.
When demo v2 arrives, remove that figure's `hidden` attribute and set its
`data-demo-src` as described below; the original stage markup is preserved.
`workflow.js` runs a camera only in view and resets it offscreen or while the
tab is hidden. Reduced motion and no JavaScript show full stills.

R9 adds one decorative SVG cursor inside each still's `.screen-camera` layer.
The existing camera animation now transforms that layer, keeping the still,
arrow and fading click ring together without changing any camera keyframe.
Targets are fractions of the original still: Connect, the Skills category
heading, Engineering in the team list, and the first movement-policy label.
The cursor arrives and clicks at the corresponding camera stop (7.5 seconds
for Connect, 2.8 seconds for the other three). Its nine-second CSS clock shares
the camera's in-view, hidden-tab and reset rules through the existing controller.
Reduced motion and no JavaScript hide cursors; the hidden tools stage has none.
No row currently uses an iframe. A future ready v2 frame hides the underlying
still cursor; that supplied embed will need its own visible cursor verified
when it is integrated. R9 screenshots and measurements are in
`.copilot-runs/notes/r9.md`.

To replace a row with Yu's v2 demo, change that row's one `data-demo-src`
attribute from `""` to the matching URL:

```html
data-demo-src="/assets/demo/app-v2.html?scene=connect&amp;embed=1&amp;loop=1"
```

Scene values are `connect`, `categories`, `departments`, `classify`, `tools`;
keep the matching `data-demo-scene` and the still/placeholder beneath the frame.
The v2 file is not supplied or deployed in R3. When it is supplied, allowlist
it and its required local assets in `scripts/build-pages.mjs` and mirror them
in the validator artifact list. The validator already accepts each exact
per-scene URL above; no controller or per-row validation change is needed.
The embed must use the existing 1440x832 native viewport and same-origin
`{type: "jin-demo", action: "ready"}` readiness message to the parent, accept
`play`/`pause` from its parent only, and begin paused. Frames are created within
240px of the viewport, inert, untabbable and hidden from assistive technology.
They pause offscreen and in hidden tabs, scale with the screen slot, and are
removed under reduced motion. A 500ms post-load fallback matches the hero;
load errors retain the underlying still and are reported to the console.

The five exact English/Japanese feature texts are recorded in
`.copilot-runs/notes/r3-new-copy.md`. The fact source retains them under
`how_it_works.features`; `solution.steps` now contains R11's three Keep answers,
retaining Building status. The capability delivery facts and
form/endpoint/consent are unchanged. R3 evidence, measurements and
decisions are in `.copilot-runs/notes/r3.md`.

The home heading reveals once, word by word (phrases in Japanese), followed
by the approved R7 body line, action row and four badges. The body uses the existing
opacity/transform reveal at 720ms, after the sixth English word finishes at
585ms; the buttons and badges follow at 920ms.
Its 720px maximum line measure does not change when Inter replaces the
system font, avoiding a tablet line-count shift before the demo still.
At English phone widths up to 400px, the intro reserves its existing
three-line loaded height while Inter loads; the final typography and layout
are unchanged. This also prevents the two-to-three-line fallback-font shift
at 390px. Japanese and larger layouts are unaffected.
The theme reserves a stable scrollbar gutter from first paint. This keeps
the Japanese intro at its final width while the rest of the page
parses, rather than adding a line when the vertical scrollbar appears.
Default HTML/CSS is fully visible; an inline head script opts into the
reveal only without reduced motion. Only opacity, blur and transform animate.
The heading retains its exact text and accessible name. English headers opt
into their enhanced layout before first paint to avoid a late menu collapse;
navigation still has its existing no-JavaScript fallback.

English primary demo buttons use white on `--accent`, with `--accent-strong`
hover/active and disabled states and the offset `--accent-light` focus ring.
Site labels use sentence-case Inter, including the Agent reference and shared
paper-theme labels. Monospace is reserved for code and file names. Japanese
pages use the same reveal and primary buttons. E4 measurements and screenshots
are in `.copilot-runs/notes/e4.md`.

### Swapping the home headline

Each language has one visible headline, the `h1.hero-reveal` immediately
after the `Hero headline` comment and small Jin AI eyebrow in `index.html` or `ja/index.html`.
Edit the text inside its reveal spans in place, keeping sequential `--word`
values starting at zero and English spaces between words. Keep Japanese
phrases unbroken and update that H1's matching accessible name. Do not copy
the headline into a second visible component or a runtime text constant.
The body is the separate `p.hero-intro` directly below the H1.

When Yu chooses a new tagline, also update `product.headline` in
`agent/content.json`, the corresponding page/social titles and image alt
text, the share-image source/render, and the exact-headline/reveal assertions
in the generator and validator. Regenerate with `node scripts\generate-aeo.mjs`;
never edit generated blocks. If the span count changes, keep the body reveal
after the last word finishes and the buttons after the body. R7 uses six
English words and two unbroken Japanese phrases. Titles and social titles
omit only the Japanese headline's final full stop.

The exact English hero line is "Keep your AI agents, skills, and knowledge secure,
reusable, and accessible across your organization." R11's Japanese hero line is
"AIエージェントやスキル、ナレッジを安全に管理・蓄積し、組織全体で共有・活用できるようにします。"
It also supplies the Japanese home page and social descriptions. The four muted badges
are Secure, Company-owned, Shared and Up to date; Japanese uses 安全, 会社のもの,
共有 and いつも最新. They form one list with decorative shield, building, people
and circular-arrow SVGs, not buttons. Badges sit below the buttons, keeping the
intro-to-demo path direct. Both placements and the final choice,
browser metrics and screenshots are recorded in `.copilot-runs/notes/r7.md`.
R7 removes the pilot sentence from the availability fact and its direct answer,
preserving the workspace beta and company-feature delivery statuses.

The home Solution heading is "How Jin AI keeps your AI" /
"Jin AIが実現する、安心して使い続けられるAI環境" (R11, Yu, 2026-10-21).
Both home and How it works closing headings read
"Turn your team's AI into a company asset" / "御社のAIを、会社の資産に。".
Company has one top H1, no repeated label, and the approved mission:
"Our mission is to turn every company's AI into an asset it owns: secure,
shared, and always up to date." / "私たちの使命は、会社のAIを、その会社の資産にすることです。安全に、みんなで使えて、いつも最新の状態で。".
Matching Company descriptions use the same mission. The privacy policies
state that phone is collected and used only to arrange the demo, matching
the required form field. All other policy text is unchanged.

The closing home intro has a Getting started heading and two
waitlist/private-beta notes supplied by Yu for E5. They are draft copy, not
new product facts. R8 removes the trailing smiley from English item 2.
The generated form note, privacy link, payload and consent
remain unchanged. E5 component values and browser evidence are recorded in
`.copilot-runs/notes/e5.md`. Japanese pages share these components and
the supplied Japanese notes. No page displays approval tags. The complete
unapproved-copy register is `.copilot-runs/notes/e6c-unapproved-copy.md`;
removing a tag does not approve its copy.

## Interactive Problem figures

Both home pages use the approved R10 Problem heading
"Is your company in control of its AI?" / "御社のAIは、会社の管理下にありますか？"
(Yu, 2026-10-21). English copy stays R10; Japanese titles and bodies use
R11's approved text:

| Problem | English | Japanese title and body |
|---|---|---|
| Shadow AI | Confidential company information could end up in personal AI tools, outside the company's control. | シャドーAIによる情報漏洩リスク / 会社の機密情報が個人のAIツールに共有され、企業が把握・管理できない状態になっているかもしれません。 |
| Agents that depend on one person | Agents and workflows stay with the people who built them. When they leave, everything starts over. | AIエージェントの属人化 / AIエージェントやワークフローが作成者個人に依存。担当者が異動・退職すると、後任者は一から作り直さなければなりません。 |
| Skills stuck in one team | Teams build useful AI workflows, but they rarely get shared across the company. | AI活用ノウハウの共有不足 / 各チームで生まれた便利なAI活用方法やワークフローが、ほかのチームに共有されず、組織全体に広がっていません。 |

Three inline isometric SVGs share a 420:320 viewBox, in Shadow AI, dependency,
then team-sharing order. The original Shadow AI and teams drawings and
behavior are unchanged. `problem.js` manages independent states for both
Problem and Solution without dependencies.

There are no figure numbers or action/reset buttons. Each of the three
animated figures is focusable and plays once when half visible, resets after leaving view, and
replays on mouse hover, tap or keyboard focus. Replay input during a running
sequence is ignored, so transitions cannot stack.
R10's dependency drawing shows three stages from left to right: an accent
owner connected to a solid grey stack; the departing owner becoming a dashed
grey outline, an x on the dashed connection and a fading dashed stack; a new
accent owner rebuilding four dashed accent layers. Two accent arrows connect
the stages. Each stack has front labels in Context, Instructions, Tools,
Workflows order, including on Japanese pages. No stage captions or other
visible text appear inside the SVG.
The sequence lasts 4.5 seconds: departure appears at 0.85s and fades through
1.95s; the successor appears at 2.2s; layers draw from bottom to top starting
at 2.4s, spaced by 0.45s; the redo arrow turns once from 3.8s to 4.5s.
CSS clocks pause while hidden. Successor/redo animation completion updates
translated rebuilding/end descriptions and polite status without a separate
completion timer. The sequence never loops.
The Shadow AI figure shows an employee at a desk inside a company platform and
a separate personal AI block identified by a chat icon. A lock-marked document
travels out along a dashed accent path; a boundary warning pulses once and the
personal AI gains a faint accent outline. Its three-second sequence uses the
same replay/reset behavior. CSS pauses its animation clocks while hidden;
animation completion, rather than an independent timer, updates its named SVG
and polite status. Reduced motion shows the end state even before enhancement,
and the idle drawing remains readable without JavaScript.
Problem and Solution use three columns from 1024px, otherwise one column.
Drawings are capped at their native 420px width. Dependency labels use 16.5px
in SVG coordinates to stay readable in three columns. R10's report records
rendered sizes at 1024px, 1280px and 1440px.
Solution uses R11's exact copy (Yu, 2026-10-21):

| English title and body | Japanese title and body |
|---|---|
| Keep it safe / Separate confidential information from reusable context, skills, and workflows. Share each part only with the AI tools you approve. | 機密情報を安全に管理する / 機密情報と共有可能な知識・スキル・ワークフローを自動で分類。情報に応じて適切なAIツールだけに共有することで、安全なAI活用を実現します。 |
| Keep it in the company / Context, instructions, tools, and workflows stay with the company, not with one person. Even when someone leaves, the setup keeps working and the next person can continue from there. | AIを会社の資産として残す / AIエージェントを構成する知識・ルール・ツール・ワークフローを組織に蓄積。担当者が異動・退職しても、AIエージェントをそのまま使い続けられます。 |
| Keep it shared / Useful workflows and skills can be shared across teams and recommended where they fit, so good AI practices spread instead of staying in one team. | AI活用のノウハウを組織全体に広げる / 各チームで生まれた優れたAI活用方法やワークフローを共有。ほかのチームにも最適な活用方法を自動でおすすめし、組織全体の生産性向上につなげます。 |

English closing: "As people improve the way they work with AI, Jin AI keeps those improvements available to the whole company."
Japanese closing: bold "一人ひとりのAI活用が、会社全体の資産になる。"
then a paragraph "Jin AIは、日々進化するAIの活用方法を組織に蓄積し、誰もが活用できる環境をつくります。"
Only this two-part closing differs structurally between the two Solution
sections. Both lists have no number labels. R12 puts an interactive figure
before each Solution H3, without a caption. From 1024px, Solution uses
Problem's exact column tracks, zero column gap and 16px inner padding.
A transparent divider reserves Problem's border width, matching the drawing
origins and widths exactly. Phones use one column. The home excerpt and data
promises remain unchanged. R11 evidence is in `.copilot-runs/notes/r11.md`.
Team platforms are native HTML buttons outside the SVG image role, reachable
by keyboard, mouse and touch. View entry opens them at 1.2-second intervals,
ending with the accent team. Direct selection cancels that sequence.
Repeated input cannot stack transitions. Every state updates the SVG's
accessible description and a polite live status. Display and accessible
strings stay in each page's HTML, including the Japanese state descriptions.

Light flow pauses when offscreen or when the tab is hidden. Reduced motion
removes animation and always shows the end states, including the accent team.
With JavaScript unavailable, the idle stills and explanatory copy remain,
and team controls stay hidden.
Japanese Problem figures preserve the English SVG geometry and shared
controller, translating captions, controls and live states. R10's four layer
names remain English in both languages.
The validator enforces SVG, component and controller parity on all six
page pairs; missing Japanese routes and broken alternates are failures.
E6b behavior, performance evidence and bilingual screenshots are recorded in
`.copilot-runs/notes/e6b.md`. R2's fourth-figure evidence and screenshots are in
`.copilot-runs/notes/r2.md`. R6's evidence is in `.copilot-runs/notes/r6.md`;
R10's exact-copy, preservation, browser, performance and screenshot evidence
is in `.copilot-runs/notes/r10.md`.

### Solution figures (R12)

The three original 420:320 isometric SVGs answer the Problem columns in order.
Keep it safe separates one bundle: the locked confidential part stays inside
the company platform, the reusable part follows an accent route to a checked
AI tool, and the personal AI route stops at an accent x.
Keep it in the company retains four solid layers inside the company platform.
The first person leaves as a dashed outline; the next accent person connects
to the same stack by a solid line, without rebuilding. Its only drawing text
is Context, Instructions, Tools and Workflows, top to bottom, in both languages.
Keep it shared retains one team's accent workflow and copies it along accent
routes to the other two team platforms; all three end with the same workflow.

Each named figure is independently focusable and uses the existing shared
controller's half-visible entry, full-exit reset and hover/tap/focus replay.
The 3.6-second CSS sequences play once, ignore replay input while busy and
pause their actual clocks while the tab is hidden. One terminal animation
per figure synchronizes its translated image description and polite live
status with completion. There is no additional animation timer or controller.
Reduced motion, including without JavaScript, shows the completed still.
Without JavaScript and normal motion, the readable idle drawings remain.
The existing drawing size and 24px figure-to-heading gap match Problem.
Layer labels use 16.5px SVG type; rendered sizes, bilingual browser evidence
and screenshots are recorded in `.copilot-runs/notes/r12.md`.

## Japanese typesetting

Japanese pages load `base.css`, `theme-en.css`, then the thin `theme-ja.css`.
They keep the dark theme, layout, spacing and components. The Japanese sheet
only adjusts fonts and typesetting: Yu Gothic for both Japanese and Latin text,
with YuGothic, Yu Gothic UI, Hiragino Sans and Noto Sans JP fallbacks. Body text
uses weight 500; heading weights are unchanged. Noto Sans JP remains a web-font
fallback for systems without the preferred Japanese fonts. Japanese headings
use protected phrase spans, keep-all fallback breaks and progressive auto-phrase
breaking, balanced headings and text autospace. English fonts are unchanged. J1
source checks, browser evidence and fourteen desktop/phone screenshots are
recorded in `.copilot-runs/notes/j1.md`.

## Content rules

- Product name: **Jin AI**. It is a B2B product for AI-forward companies.
  Write for company buyers: CEOs, heads of IT and CISOs. Do not add company size numbers.
- Headline: **Turn AI into a company asset**
- Japanese home headline: **AIを、会社の資産に。**
  Its page and social titles omit the final Japanese full stop.
- English headings and heading-like titles have no final period, including each
  line separated by a `br`. Keep sentence punctuation in running descriptions,
  question and exclamation marks, and Japanese heading punctuation.
- Do not display draft tags or `data-draft` attributes. Track unapproved copy
  in the E6c register instead.
- Use **agent harness**, **AI harness** or **harnesses** for this concept.
  An AI harness is the instructions, skills, memory and connected tools around
  an AI agent that make it work for a role.
- The home page contains only the hero, problem, solution, how it works, data
  and demo request. Do not show pricing or founders on the home page.
  Founders and direct answers belong in the Agent reference.
- Problem: **Is your company in control of its AI?**
  Shadow AI is a problem label, not a claim that Jin AI blocks it.
- Solution: **How Jin AI keeps your AI**, followed by **Keep it safe**, **Keep it in
  the company**, **Keep it shared**. Keep both employee and company value.
  R6's English/Japanese copy, with R7 hero, R8 review fixes, R10 English Problem
  and R11 Solution, Japanese Problem and Japanese hero copy, is approved word for word;
  it supersedes R1's pending headline and copy choices. No draft tag appears.
- Human pages (`/`, `/how-it-works/` and their Japanese twins) do not show status labels (Yu, 2026-10-19).
  `/agent/` and `llms.txt` keep the Live/Building/Next facts from `agent/content.json`.
  Never claim a Building or Next item is available today in any copy.
- Data: **Your company's context stays yours** Each company's context is kept
  separate. Jin AI never records your screen. Jin AI itself never trains on
  your data. Do not claim that Jin AI does not read conversation histories.
- CTA: **Request a demo**. Note: **We will email you to set up a demo.**
  The form uses `demo-request-v1` consent and links to the Privacy Policy.
  Keep the endpoint and the legacy backend routes working for cached pages.
- No prices anywhere on the site, including machine-readable formats.
  Do not publish currency amounts, Pro, Team or free-version offers, Cloud Sync,
  Google Drive or Notion connections, PC and phone sync, Baby Voice
  Recorder, TikTok, market size, competitor names, pilot candidate counts,
  Nov 13, know-how or DelightX. These are exclusions, not product facts.
- E7 permits the approved Discord invite only in footer Connect columns,
  Company Contact community lines and machine-readable community facts.
  Display the contact email as plain selectable text plus Copy, never mailto.
- Write plain, specific English, or the approved Japanese copy on `/ja/*`,
  with short sentences. Japanese pages require CJK; every other deployed file
  forbids CJK except the Japanese footer language link on English pages.
  Shared JavaScript stores Japanese messages as Unicode escapes.
  No em dashes, en dashes or curly quotes. Do not invent claims, metrics,
  testimonials, logos, ratings or user counts. Every number needs a source
  line directly under it.
- Avoid supercharge, unlock, seamless, effortless, revolutionize, game-changer,
  empower, leverage, cutting-edge and next-level. Do not repeat "No more X"
  headlines or claim nobody else does this.
- Keep the paper background, Source Serif headings, Inter body and labels,
  JetBrains Mono code, 4px radius and existing spacing. The only accent color is `#a84a1c`.
  No gradients, glows, new blurs or shadows, emoji, rows of identical icon
  cards, numbered circles, positioning grids or letter-spaced all-caps labels.
  Prefer prose, lists, tables and real product screenshots. Use one dominant
  visual per section. At 375px wide, there must be no horizontal scroll.
  Japanese pages use Yu Gothic with Japanese system and Noto Sans JP fallbacks;
  `theme-ja.css` changes only typesetting. Keep English fonts unchanged.
- E1 draft exception (Yu, 2026-10-20): preserve the D1/D2 dark English theme
  and pill buttons. R5 removes the pilot card in both languages, its unused
  styles and gradient tokens. Data now leads directly into the demo request,
  with the existing section spacing and divider unchanged. The fact source
  has no pilot steps; R7 also removes the pilot availability requirement.
  Company copy outside the R8-approved mission remains unapproved in the E6c register; the AI harness article
  is retired in R3.
  Menu descriptions are short draft labels without tags.
- E4 exception (Yu, 2026-10-20): the English home hero may use a small,
  reduced-motion-aware reveal blur. Labels use 500-weight Inter at 13px,
  sentence case and no added tracking. English primary buttons are vermilion.
- E5 exception (Yu, 2026-10-20): English product screens use the shared rounded
  demo stage and soft window shadow described above, with no glow or fade.
- Do not add `FAQPage` schema, active offers, ratings or reviews unless they
  become truthful and applicable.

## Demo request and waitlist backend

The English hero CTA is generated from `early_access.hero_label` and
`early_access.hero_note` in `agent/content.json`. The demo form uses
`early_access.label`, `early_access.note` and `early_access.form.fields`.
All nine fields are required: work email, first and last name, job title, phone (at least six digits),
company, industry, company size and country. It sends `type: "demo"` with
consent version `demo-request-v1` to the unchanged Apps Script endpoint.
Details are used only to reply about the demo; the form links to `privacy/`.
There is no post-request survey.
The Japanese form uses the same facts, endpoint, field names, select values and
consent. It displays surname before given name, Japanese labels, and Japan
before the United States. Other country labels are generated from ISO region
codes with Node's `Intl.DisplayNames`. Client messages follow the document
language. Demo payloads include `lang` (`ja` for document languages starting with
`ja`, otherwise `en`); the backend stores it and sends Japanese confirmations
with a company and surname greeting for `ja`, or the approved English email for
`en` or missing `lang`.

R13a is backend-only: the deployed page still submits a demo request, without
a new waitlist UI. The backend now also accepts waitlist payloads with required
`firstName` (80 characters), `lastName` (80), `email` (254), `jobTitle` (120) and
`company` (160), plus `lang` (`en` or `ja`, default `en`), the existing request ID,
source, consent version and honeypot. Text is trimmed and control characters
are rejected. A waitlist payload omits `type` or uses `type: "waitlist"`; demo
requests keep `type: "demo"`. Waitlist consent stays
`waitlist-product-updates-v1`; demo consent stays `demo-request-v1`.
For one compatibility release, cached pages can still send `name` and `role`
without any of the new waitlist fields. Only this legacy shape may omit company.
The backend also writes combined `name` and job title as `role` for new signups.

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
   Existing columns and response history are never moved, cleared or deleted.
   Missing headers are appended at the end of existing tabs. For an old
   `Waitlist` tab, these are `First name`, `Last name`, `Company` and `Language`,
   after the original fifteen columns. Existing rows remain unchanged, with
   those new cells blank. All mailer reads and writes use header names;
   unmanaged columns and their formulas are preserved.
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
**After merging R13a, Yu must copy the entire updated, self-contained mailer and
the updated daily report source into the same project, run `setupWaitlist` once,
and redeploy the existing
web app with Deploy > Manage deployments > Edit > New version > Deploy.**
Keep the current deployment and `/exec` URL; do not create a replacement endpoint.
Run `inspectWaitlistSender` and ensure `installWaitlistRetry` has been run.
The source version is `2026-10-21.1` (replacing `2026-10-20.1`). Do this before
publishing the R13b waitlist form. The existing frontend, endpoint, consent
versions, manifest/scopes and retry trigger are unchanged. Publish the site
artifact containing `brand/jin-mark-email.png` before sending branded emails,
so the remote logo is available. Setup does not queue or email historical rows;
the existing retry trigger still processes only eligible pending records.
Source changes alone do not deploy anything or send any real request.

### Daily report

The daily report emails the previous JST calendar day's external demo requests,
legacy waitlist signups, survey answers and Cloudflare Web Analytics traffic to
Yu. For each demo it includes company, company size, industry, country and job
title, plus language (`en` / `ja`), without email addresses or phone numbers.
Contact information pasted into those details is redacted. It also includes a
seven-day JST traffic trend.
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
`demo-request-v1` consent, all nine form fields, language, confirmation status,
attempts, last and next attempt time, sent time, Gmail message ID and last error code.
Text cells are protected against formulas. A script lock prevents simultaneous
retries from duplicating a row or confirmation. A new request ID is a separate
intentional demo request, even if the email is the same, so later company
details are not silently discarded.

R13a sends the approved 2026-10-21 copy in matching plain-text and branded HTML
alternatives. Subjects include the first name in English or surname in Japanese:
`{First}, you're on the Jin AI waitlist` and
`{First}, thanks for requesting a Jin AI demo`, or
`{Last}様、Jin AI のウェイトリストにご登録いただきました` and
`{Last}様、Jin AI のデモにお申し込みいただきありがとうございます`.
Japanese salutations put company above `{Last} 様`; English opening paragraphs
include the company. The signature is `Yu Asano` / `Founder, Jin AI`.
Every subject is RFC 2047 encoded; inserted HTML values are escaped and text
values are control-character-free.

Both emails use a white card, grey background, black logo band and localized
Privacy Policy link. Only the waitlist email has a vermilion demo button
(`/#demo` or `/ja/#demo`) and reply-to-unsubscribe line.
The demo email says we will email to find a time, not that a time is booked.
Neither contains a community invite or postal address block. No marketing
consent is requested or recorded for demos. Someone registering and then
requesting a demo receives both confirmations, each with its own queue/status.

The private `Waitlist` tab records the original registration, consent version,
request ID, welcome-mail status, attempts, timestamps, Gmail message ID and last
error code, followed by first name, last name, company and language. Names,
roles and company are validated and protected against sheet formulas.
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
Keep the approved community invite in `early_access.community`; the generator
publishes it in the LLM index, not the demo form or confirmation flow.

### Email review previews (R13a)

Run `node .copilot-runs\notes\r13-email-previews.mjs` with installed Chrome.
It uses the same VM-loaded `.gs` templates as the tests, sample
`Maya` / `Tanaka` / `Contoso`, and a dedicated headless Chrome debugging pipe.
It installs nothing, uses no port, blocks HTTP/HTTPS requests in the preview
page and does not send emails. The script renders the white source mark plus
wordmark into `brand/jin-mark-email.png` at 272 x 80 pixels, displayed at
136 x 40 in the emails, below 20 KB.

Review `.copilot-runs/notes/r13-email-{waitlist,demo}-{en,ja}.html`;
they load the logo via a relative local path before deployment.
The corresponding `-600.png` and `-390.png` files show each email at desktop
and phone widths. `r13-email-texts.md` contains all four subjects and text
alternatives; `r13-email-metrics.json` records dimensions, logo loading and
no-horizontal-overflow assertions at 600, 390 and 375 pixels. Implementation
and check results are in `.copilot-runs/notes/r13a.md`.

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
<http://127.0.0.1:8793/ja/> and
<http://127.0.0.1:8793/agent/>. Stop the server when finished.
