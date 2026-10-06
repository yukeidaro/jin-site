import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

const waitlistSource = await readFile(new URL("./waitlist-mailer.gs", import.meta.url), "utf8");
const dailySource = await readFile(new URL("./daily-report.gs", import.meta.url), "utf8");
const logs = [];
const errors = [];
const backend = vm.createContext({
  console: {
    log: (message) => logs.push(message),
    error: (message) => errors.push(message),
    warn() {}
  },
  Utilities: {
    Charset: { UTF_8: "utf8" },
    base64Encode: (value) => Buffer.from(value, "utf8").toString("base64"),
    base64EncodeWebSafe: (value) => Buffer.from(value, "utf8").toString("base64url")
  }
});
vm.runInContext(waitlistSource, backend, { filename: "waitlist-mailer.gs" });
vm.runInContext(dailySource, backend, { filename: "daily-report.gs" });

const window = backend.reportWindow_(Date.parse("2026-10-06T00:30:00+09:00"));
const signup = (email, createdAt, overrides = {}) => ({
  email, createdAt, name: "Example", role: "Founder", welcome: "sent", ...overrides
});
const answer = (email, answeredAt, code, overrides = {}) => ({
  email, answeredAt, surveyId: "ai-friction-v1", answer: code, ...overrides
});
const plain = (value) => JSON.parse(JSON.stringify(value));

function cloudflareResponse() {
  const account = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`day${i}`, []]));
  account.day6 = [
    { count: 8, sum: { visits: 5 }, dimensions: { date: "2026-10-04" } },
    { count: 4, sum: { visits: 3 }, dimensions: { date: "2026-10-05" } }
  ];
  account.topReferrers = [
    { count: 6, sum: { visits: 4 }, dimensions: { refererHost: "example.org" } }
  ];
  account.topPaths = [
    { count: 9, sum: { visits: 5 }, dimensions: { requestPath: "/about" } },
    { count: 1, sum: { visits: 1 }, dimensions: { requestPath: "/people/a@example.com" } }
  ];
  account.topCountries = [
    { count: 10, sum: { visits: 6 }, dimensions: { countryName: "Japan" } }
  ];
  return { data: { viewer: { accounts: [account] } } };
}

function sampleReport(analytics = null, analyticsError = null) {
  const waitlist = backend.summarizeWaitlist_([
    signup("alice@example.com", "2026-10-05T01:12:00Z", {
      name: "<b>x</b> alice@example.com", role: "Designer"
    }),
    signup("yukeiasano+test@gmail.com", "2026-10-05T03:00:00Z", { welcome: "failed" })
  ], window);
  const survey = backend.summarizeSurvey_([
    answer("alice@example.com", "2026-10-05T02:00:00Z", "B")
  ], window);
  return backend.buildDailyReport_({
    window, waitlist, survey, analytics, analyticsError,
    sheetUrl: "https://docs.google.com/spreadsheets/d/sample-id"
  });
}

test("reports the previous JST calendar day and seven JST days, including the boundary", () => {
  assert.equal(window.label, "2026-10-05");
  assert.equal(new Date(window.dayStartMs).toISOString(), "2026-10-04T15:00:00.000Z");
  assert.equal(new Date(window.dayEndMs).toISOString(), "2026-10-05T15:00:00.000Z");
  assert.equal(new Date(window.weekStartMs).toISOString(), "2026-09-28T15:00:00.000Z");
  assert.equal(backend.reportWindow_(Date.parse("2026-10-06T00:00:00+09:00")).label,
    "2026-10-05");
  assert.equal(backend.reportWindow_(Date.parse("2027-01-01T08:00:00+09:00")).label,
    "2026-12-31");
});

test("strips plus-tags only for internal email matching and excludes test roles", () => {
  for (const record of [
    signup("yukeiasano+anything@gmail.com", "2026-10-05T01:00:00Z"),
    signup("YUKEIASANO@gmail.com", "2026-10-05T01:00:00Z"),
    signup("normal@example.com", "2026-10-05T01:00:00Z", {
      role: "Founder (internal delivery test)"
    })
  ]) assert.equal(backend.isInternalSignup_(record), true);
  for (const record of [
    signup("normal+tag@example.com", "2026-10-05T01:00:00Z"),
    signup("yukeiasano+anything@other.example", "2026-10-05T01:00:00Z")
  ]) assert.equal(backend.isInternalSignup_(record), false);
});

test("counts external rows within the half-open day, unique emails and all welcome problems", () => {
  const summary = backend.summarizeWaitlist_([
    signup("alice@example.com", "2026-10-04T14:59:59Z", { name: "Earlier", welcome: "pending" }),
    signup("ALICE@example.com", "2026-10-04T15:00:00Z", { name: "First" }),
    signup("alice@example.com", "2026-10-05T14:59:59.999Z", {
      name: "Last", welcome: "failed"
    }),
    signup("bob@example.com", "2026-10-05T03:30:00Z", { name: "Bob", welcome: "unknown" }),
    signup("carol@example.com", "2026-10-05T15:00:00Z", { name: "Later", welcome: "sending" }),
    signup("yukeiasano+anything@gmail.com", "2026-10-05T03:00:00Z", { welcome: "failed" }),
    signup("real@example.com", "2026-10-05T03:00:00Z", { role: "test reviewer", welcome: "pending" })
  ], window);
  assert.equal(summary.newCount, 3);
  assert.equal(summary.newUniqueCount, 2);
  assert.equal(summary.cumulativeUniqueCount, 3);
  assert.equal(summary.attentionCount, 4);
  assert.deepEqual(Array.from(summary.newRows, (row) => row.time), ["00:00", "12:30", "23:59"]);
  assert.deepEqual(Array.from(summary.attention, (row) => row.status),
    ["pending", "failed", "unknown", "sending"]);
  assert.ok(!JSON.stringify(summary).includes("@example.com"));
});

test("counts only external answers for ai-friction-v1 and keeps original option labels", () => {
  const summary = backend.summarizeSurvey_([
    answer("alice@example.com", "2026-10-04T14:59:59Z", "A"),
    answer("bob@example.com", "2026-10-04T15:00:00Z", "B"),
    answer("carol@example.com", "2026-10-05T14:59:59Z", "D"),
    answer("dave@example.com", "2026-10-05T15:00:00Z", "D"),
    answer("yukeiasano+check@gmail.com", "2026-10-05T01:00:00Z", "C"),
    answer("YUKEIASANO@gmail.com", "2026-10-05T01:00:00Z", "C"),
    answer("bob@example.com", "2026-10-05T01:00:00Z", "A", { surveyId: "old-survey" })
  ], window);
  assert.equal(summary.newCount, 2);
  assert.deepEqual(Array.from(summary.breakdown, (row) => row.count), [1, 1, 0, 2]);
  assert.equal(summary.breakdown[1].label, backend.SURVEY_OPTIONS.B);
  assert.ok(!JSON.stringify(summary).includes("@example.com"));
  assert.throws(() => backend.summarizeSurvey_([
    answer("", "2026-10-05T02:00:00Z", "A")
  ], window), /invalid_survey_email/);
});

test("the report has Japanese sections, an explicit unconfigured line and no sheet email addresses", () => {
  const report = sampleReport();
  assert.equal(report.subject, "[JinAI] 日次レポート 2026-10-05（新規 1 人 / PV 未計測）");
  for (const heading of ["ウェイトリスト", "アンケート（ai-friction-v1）",
    "サイト訪問（Cloudflare Web Analytics）"]) {
    assert.ok(report.text.includes(heading));
    assert.ok(report.html.includes(heading));
  }
  assert.match(report.text, /CF_API_TOKEN \/ CF_ACCOUNT_ID \/ CF_SITE_TAG/);
  assert.equal(report.text.match(/未設定:/g)?.length, 1);
  assert.ok(report.html.includes("&lt;b&gt;x&lt;/b&gt;"));
  assert.ok(!report.html.includes("<b>x</b>"));
  for (const body of [report.subject, report.text, report.html]) {
    assert.ok(!body.includes("alice@example.com"));
    assert.ok(!body.includes("yukeiasano+test@gmail.com"));
    assert.ok(!body.includes("yukeiasano@gmail.com"));
  }
  assert.match(report.text, /https:\/\/dash\.cloudflare\.com\//);
  assert.match(report.text, /dailyReport トリガーから自動送信/);
  assert.doesNotMatch(report.text, /\*\*|^# /m, "The text alternative is plain text.");
});

test("successful analytics drives the subject, seven-day table and all top-five sections", () => {
  const analytics = backend.parseCloudflare_(cloudflareResponse(), window);
  const report = sampleReport(analytics);
  assert.equal(report.subject, "[JinAI] 日次レポート 2026-10-05（新規 1 人 / PV 12）");
  assert.match(report.text, /昨日: ページビュー 12 \/ 訪問数 8/);
  assert.match(report.text, /2026-09-29  0  0/);
  assert.match(report.text, /2026-10-05  12  8/);
  assert.match(report.text, /昨日の参照元ホスト 上位5件:/);
  assert.match(report.text, /example\.org  6/);
  assert.match(report.html, /<table/);
  assert.match(report.html, /<th scope="col"/);
  assert.match(report.html, /Japan/);
  assert.ok(!report.text.includes("a@example.com"));
  assert.ok(!report.html.includes("a@example.com"));
  assert.equal(sampleReport(null, "HTTP 403: Access denied").subject,
    "[JinAI] 日次レポート 2026-10-05（新規 1 人 / PV 未計測）");
  assert.match(sampleReport(null, "HTTP 403: Access denied").text, /取得失敗: HTTP 403/);
});

test("one Cloudflare request contains seven exact JST windows plus three top lists", () => {
  const request = backend.cloudflareQuery_("account-id", "site-tag", window);
  assert.equal(request.variables.accountTag, "account-id");
  assert.equal(request.variables.siteTag, "site-tag");
  assert.equal(request.variables.start0, "2026-09-28T15:00:00.000Z");
  assert.equal(request.variables.end0, "2026-09-29T15:00:00.000Z");
  assert.equal(request.variables.start6, "2026-10-04T15:00:00.000Z");
  assert.equal(request.variables.end6, "2026-10-05T15:00:00.000Z");
  assert.equal((request.query.match(/rumPageloadEventsAdaptiveGroups/g) || []).length, 10);
  assert.equal((request.query.match(/day\d: rumPageloadEventsAdaptiveGroups\(limit: 1, filter: [^)]*\) \{ count sum \{ visits \} \}/g) || []).length, 7);
  assert.doesNotMatch(request.query, /dimensions \{ date \}/);
  assert.match(request.query, /topReferrers:.*dimensions \{ refererHost \}/);
  assert.match(request.query, /topPaths:.*dimensions \{ requestPath \}/);
  assert.match(request.query, /topCountries:.*dimensions \{ countryName \}/);
  assert.match(request.query, /sum \{ visits \}/);
  assert.match(request.query, /orderBy: \[count_DESC\]/);
  assert.match(request.query, /accounts\(filter: \{ accountTag: \$accountTag \}\)/);
  assert.ok(!request.query.includes("account-id"), "Tags belong in variables, not query text.");
});

test("Cloudflare parsing adds both UTC dates for a JST day, zero-fills empty days and rejects errors", () => {
  const parsed = backend.parseCloudflare_(cloudflareResponse(), window);
  assert.equal(parsed.days.length, 7);
  assert.deepEqual(plain(parsed.days[0]), { date: "2026-09-29", pageViews: 0, visits: 0 });
  assert.deepEqual(plain(parsed.days[6]), { date: "2026-10-05", pageViews: 12, visits: 8 });
  assert.deepEqual(plain(parsed.referrers), [{ label: "example.org", pageViews: 6 }]);
  assert.deepEqual(plain(parsed.countries), [{ label: "Japan", pageViews: 10 }]);
  assert.equal(parsed.paths[1].label, "[メールアドレス省略]");
  assert.throws(() => backend.parseCloudflare_({
    errors: [{ message: "Permission denied" }]
  }, window), /GraphQL: Permission denied/);
  assert.throws(() => backend.parseCloudflare_({
    data: { viewer: { accounts: [] } }
  }, window), /missing_cloudflare_account_data/);
  const missing = cloudflareResponse();
  delete missing.data.viewer.accounts[0].day3;
  assert.throws(() => backend.parseCloudflare_(missing, window), /missing_cloudflare_daily_data/);
});

test("API requests use the bearer token only in the header and surface safe HTTP or GraphQL errors", () => {
  const properties = { getProperty: (name) => ({
    CF_API_TOKEN: "secret-token", CF_ACCOUNT_ID: "account-id", CF_SITE_TAG: "site-tag"
  })[name] };
  const initial = errors.length;
  backend.UrlFetchApp = {
    fetch(url, options) {
      assert.equal(url, "https://api.cloudflare.com/client/v4/graphql");
      assert.equal(options.method, "post");
      assert.equal(options.headers.Authorization, "Bearer secret-token");
      assert.equal(options.muteHttpExceptions, true);
      assert.ok(!options.payload.includes("secret-token"));
      return {
        getResponseCode: () => 403,
        getContentText: () => JSON.stringify({
          errors: [{ message: "Denied secret-token\nalice@example.com" }]
        })
      };
    }
  };
  const failed = backend.fetchCloudflare_(properties, window);
  assert.equal(failed.analytics, null);
  assert.match(failed.analyticsError, /HTTP 403: Denied \[redacted\]/);
  assert.ok(!failed.analyticsError.includes("secret-token"));
  assert.ok(!failed.analyticsError.includes("alice@example.com"));
  assert.ok(!errors[initial].includes("secret-token"));
  backend.UrlFetchApp.fetch = () => ({
    getResponseCode: () => 200,
    getContentText: () => JSON.stringify({ errors: [{ message: "Unknown field" }] })
  });
  assert.match(backend.fetchCloudflare_(properties, window).analyticsError, /GraphQL: Unknown field/);
  backend.UrlFetchApp.fetch = () => ({
    getResponseCode: () => 200,
    getContentText: () => JSON.stringify(cloudflareResponse())
  });
  assert.equal(backend.fetchCloudflare_(properties, window).analytics.yesterday.pageViews, 12);
  backend.UrlFetchApp.fetch = () => { throw new Error("network timeout"); };
  assert.match(backend.fetchCloudflare_(properties, window).analyticsError, /network timeout/);
  delete backend.UrlFetchApp;
  assert.deepEqual(plain(backend.fetchCloudflare_({ getProperty: () => null }, window)),
    { analytics: null, analyticsError: null });
});

test("the MIME uses one fixed To, the default sender, UTF-8 alternatives and folded RFC 2047 subject", () => {
  const report = sampleReport(backend.parseCloudflare_(cloudflareResponse(), window));
  const raw = backend.dailyReportMime_(report, "owner@workspace.example");
  const mime = Buffer.from(raw, "base64url").toString("utf8");
  assert.match(mime, /^From: owner@workspace\.example\r\nTo: yukeiasano@gmail\.com\r\nSubject: /);
  assert.ok(!mime.includes("From: hello@jinai.md"));
  assert.doesNotMatch(mime, /\r\n(?:Cc|Bcc):/i);
  const header = mime.match(/\r\nSubject: ([\s\S]*?)\r\nMIME-Version:/)?.[1];
  assert.ok(header);
  const words = [...header.matchAll(/=\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=/g)];
  assert.ok(words.length >= 2, "Long subjects must be folded into RFC 2047 words.");
  assert.ok(words.every((word) => word[0].length <= 75));
  assert.equal(words.map((word) => Buffer.from(word[1], "base64").toString("utf8")).join(""),
    report.subject);
  const parts = [...mime.matchAll(/Content-Transfer-Encoding: base64\r\n\r\n([\s\S]*?)\r\n--jin-daily-report/g)];
  assert.equal(parts.length, 2);
  assert.deepEqual(parts.map((part) =>
    Buffer.from(part[1].replace(/\s/g, ""), "base64").toString("utf8")),
  [report.text, report.html]);
  assert.throws(() => backend.dailyReportMime_(report, "hello@jinai.md"),
    /daily_report_sender_must_be_default/);
});

test("collection reads and validates both sheet schemas; only sendDailyReport sends", () => {
  const rowsFor = (columns, records) => [
    Array.from(columns, (column) => column[1]),
    ...records.map((record) => Array.from(columns, (column) => record[column[0]] || ""))
  ];
  const makeSheet = (rows) => ({
    getLastRow: () => rows.length,
    getRange(start, column, height, width) {
      return { getValues: () => rows.slice(start - 1, start - 1 + height)
        .map((row) => row.slice(column - 1, column - 1 + width)) };
    }
  });
  const sheets = {
    Waitlist: makeSheet(rowsFor(backend.WAITLIST_COLUMNS, [
      signup("alice@example.com", "2026-10-05T01:00:00Z", { name: "Alice" })
    ])),
    Survey: makeSheet(rowsFor(backend.SURVEY_COLUMNS, [
      answer("alice@example.com", "2026-10-05T02:00:00Z", "C")
    ]))
  };
  const spreadsheet = {
    getSheetByName: (name) => sheets[name],
    getUrl: () => "https://docs.google.com/spreadsheets/d/sample-id"
  };
  const collected = backend.reportWindow_;
  backend.reportWindow_ = () => window;
  backend.PropertiesService = { getScriptProperties: () => ({
    getProperty: (name) => name === "SPREADSHEET_ID" ? "spreadsheet-id" : null
  }) };
  backend.SpreadsheetApp = { openById: (id) => {
    assert.equal(id, "spreadsheet-id");
    return spreadsheet;
  } };
  let sends = 0;
  backend.Gmail = { Users: {
    Settings: { SendAs: { list: () => ({ sendAs: [
      { sendAsEmail: "hello@jinai.md", isDefault: true, isPrimary: false },
      { sendAsEmail: "owner@workspace.example", isDefault: false, isPrimary: true }
    ] }) } },
    Messages: { send: (message, account) => {
      sends++;
      assert.equal(account, "me");
      assert.match(Buffer.from(message.raw, "base64url").toString("utf8"),
        /^From: owner@workspace\.example\r\nTo: yukeiasano@gmail\.com/);
      return { id: "sent-id" };
    } }
  } };
  try {
    assert.match(backend.collectDailyReport_().text, /昨日の新規登録（社外）: 1 人/);
    const logged = logs.length;
    backend.inspectDailyReport();
    assert.equal(sends, 0);
    assert.ok(logs[logged].includes("Alice"));
    assert.ok(!logs[logged].includes("alice@example.com"));
    backend.sendDailyReport();
    assert.equal(sends, 1);
    sheets.Survey = makeSheet([["Wrong header"]]);
    assert.throws(() => backend.collectDailyReport_(), /storage_schema_mismatch: Survey/);
    // A broken report still emails Yu a failure notice, then surfaces the error.
    backend.Gmail.Users.Messages.send = (message) => {
      sends++;
      const raw = Buffer.from(message.raw, "base64url").toString("utf8");
      assert.match(raw, /^From: owner@workspace\.example\r\nTo: yukeiasano@gmail\.com/);
      return { id: "failure-id" };
    };
    assert.throws(() => backend.sendDailyReport(), /storage_schema_mismatch: Survey/);
    assert.equal(sends, 2);
    backend.Gmail.Users.Settings.SendAs.list = () => ({
      sendAs: [{ sendAsEmail: "hello@jinai.md", isDefault: true, isPrimary: false }]
    });
    assert.throws(() => backend.sendDailyReport(), /daily_report_sender_must_be_primary_account/);
    assert.equal(sends, 2);
  } finally {
    backend.reportWindow_ = collected;
    delete backend.PropertiesService;
    delete backend.SpreadsheetApp;
    delete backend.Gmail;
  }
});

test("installDailyReport creates only one approximate 08:00 JST daily trigger", () => {
  const triggers = [];
  const schedule = {};
  backend.ScriptApp = {
    getProjectTriggers: () => triggers,
    newTrigger(handler) {
      schedule.handler = handler;
      const builder = {
        timeBased() { return this; },
        atHour(value) { schedule.hour = value; return this; },
        nearMinute(value) { schedule.minute = value; return this; },
        everyDays(value) { schedule.days = value; return this; },
        inTimezone(value) { schedule.zone = value; return this; },
        create() { triggers.push({ getHandlerFunction: () => handler }); }
      };
      return builder;
    }
  };
  try {
    backend.installDailyReport();
    backend.installDailyReport();
    assert.deepEqual(schedule, {
      handler: "sendDailyReport", hour: 8, minute: 0, days: 1, zone: "Asia/Tokyo"
    });
    assert.equal(triggers.length, 1);
  } finally {
    delete backend.ScriptApp;
  }
});
