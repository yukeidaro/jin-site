import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import {
  CONSENT_VERSION, SURVEY_ID, describeResult, isAppsScriptEndpoint, submitSignup, submitSurvey,
  validateResponse, validateSurveyResponse, validateDemoFields, initializeWaitlist
} from "../waitlist.mjs";

const source = await readFile(new URL("./waitlist-mailer.gs", import.meta.url), "utf8");
const backend = vm.createContext({
  console: { error() {}, warn() {}, log() {} },
  Utilities: {
    Charset: { UTF_8: "utf8" },
    base64Encode: (value) => Buffer.from(value, "utf8").toString("base64"),
    base64EncodeWebSafe: (value) => Buffer.from(value, "utf8").toString("base64url"),
    newBlob: (value) => ({ getBytes: () => Buffer.from(value, "utf8") })
  }
});
vm.runInContext(source, backend, { filename: "waitlist-mailer.gs" });

const requestId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const endpoint = "https://script.google.com/macros/s/test-deployment/exec";
const input = (overrides = {}) => ({
  requestId, name: "Example Tester", email: "example@example.com", role: "Founder",
  source: "https://jinai.md", consentVersion: backend.WAITLIST_CONSENT, website: "", ...overrides
});
const demoInput = (overrides = {}) => ({
  type: "demo", requestId, email: "example@example.com", firstName: "Alex",
  lastName: "Sample", jobTitle: "Head of IT", phone: "+1 (202) 555-0142",
  company: "Example Company", industry: "Technology", companySize: "50-199",
  country: "United States", website: "", source: "https://jinai.md",
  consentVersion: "demo-request-v1", ...overrides
});
const surveyInput = (overrides = {}) => ({
  type: "survey", requestId, email: "example@example.com", surveyId: SURVEY_ID,
  answer: "A", source: "https://jinai.md", ...overrides
});
const response = (registration = "saved", welcome = "sent", code = null) => ({
  version: 1, requestId, registration, welcome, code
});

function fixture() {
  const records = [];
  const surveyRecords = [];
  const log = [];
  let sends = 0;
  let now = Date.parse("2026-09-12T02:00:00Z");
  const deps = {
    now: () => now,
    reserveEmail: () => true,
    log: (...args) => log.push(args),
    store: {
      withLock: (work) => work(),
      find: (key, value) => {
        const record = records.find((item) => item[key] === value);
        return record ? structuredClone(record) : null;
      },
      append: (record) => {
        const saved = { ...record, row: records.length + 2 };
        records.push(structuredClone(saved));
        return saved;
      },
      update: (record) => { records[record.row - 2] = structuredClone(record); },
      pending: (dueAt) => records.filter((record) => record.welcome === "pending" &&
        (!record.nextAttemptAt || Date.parse(record.nextAttemptAt) <= dueAt))
        .map((record) => structuredClone(record))
    },
    surveyStore: {
      findBy: (email, surveyId) => {
        const record = surveyRecords.find((item) => item.email === email && item.surveyId === surveyId);
        return record ? structuredClone(record) : null;
      },
      append: (record) => {
        const saved = { ...record, row: surveyRecords.length + 2 };
        surveyRecords.push(structuredClone(saved));
        return saved;
      },
      update: (record) => { surveyRecords[record.row - 2] = structuredClone(record); }
    },
    sender: {
      assertReady() {},
      send: (record) => {
        sends++;
        const stored = records.find((item) => item.requestId === record.requestId);
        assert.equal(stored.registration, "saved");
        assert.equal(stored.welcome, "sending", "The send intent must already be persistent.");
        return "gmail-message-id";
      }
    }
  };
  return { deps, records, surveyRecords, log, sends: () => sends, advance: (ms) => { now += ms; } };
}

function sheetFixture(headers = null) {
  const rows = headers ? [headers] : [];
  const sheet = {
    frozenRows: 0,
    headerWeight: null,
    getLastRow: () => rows.length,
    getRange(start, column, height = 1, width = 1) {
      const range = {
        getValues: () => rows.slice(start - 1, start - 1 + height)
          .map((row) => row.slice(column - 1, column - 1 + width)),
        setValues(values) {
          values.forEach((cells, offset) => {
            const index = start - 1 + offset;
            const row = rows[index] || [];
            cells.forEach((cell, i) => { row[column - 1 + i] = cell; });
            rows[index] = row;
          });
          return range;
        },
        setFontWeight(weight) { sheet.headerWeight = weight; return range; },
        createTextFinder(value) {
          const matches = rows.slice(start - 1, start - 1 + height)
            .flatMap((row, i) => row[column - 1] === value ? [{ getRow: () => start + i }] : []);
          const finder = {
            matchEntireCell: () => finder,
            useRegularExpression: () => finder,
            findAll: () => matches,
            findNext: () => matches[0] || null
          };
          return finder;
        }
      };
      return range;
    },
    setFrozenRows(count) { sheet.frozenRows = count; },
    setColumnWidths() {},
    setColumnWidth() {}
  };
  return { sheet, rows };
}

test("stores before sending, records Gmail confirmation, and preserves the request ID", () => {
  const f = fixture();
  const result = backend.registerWaitlist_(input(), f.deps);
  assert.equal(result.registration, "saved");
  assert.equal(result.welcome, "sent");
  assert.equal(result.requestId, requestId);
  assert.equal(f.records[0].messageId, "gmail-message-id");
  assert.equal(f.records[0].sentAt, "2026-09-12T02:00:00.000Z");
  assert.equal(f.sends(), 1);
});

test("duplicate requests and case-insensitive emails never duplicate storage or delivery", () => {
  const f = fixture();
  backend.registerWaitlist_(input(), f.deps);
  backend.registerWaitlist_(input(), f.deps);
  const nextId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const result = backend.registerWaitlist_(input({ requestId: nextId, email: "EXAMPLE@example.com" }), f.deps);
  assert.equal(result.requestId, nextId);
  assert.equal(result.welcome, "sent");
  assert.equal(f.records.length, 1);
  assert.equal(f.sends(), 1);
});

test("a reused request ID cannot change the registered email", () => {
  const f = fixture();
  backend.registerWaitlist_(input(), f.deps);
  const result = backend.registerWaitlist_(input({ email: "different@example.com" }), f.deps);
  assert.equal(result.registration, "not_saved");
  assert.equal(result.code, "request_conflict");
  assert.equal(f.records.length, 1);
});

test("missing sender alias preserves the signup and never falls back to another address", () => {
  const f = fixture();
  f.deps.sender.assertReady = () => { throw Object.assign(new Error("missing alias"), { code: "sender_not_verified" }); };
  const result = backend.registerWaitlist_(input(), f.deps);
  assert.equal(result.registration, "saved");
  assert.equal(result.welcome, "pending");
  assert.equal(f.records[0].errorCode, "sender_not_verified");
  assert.equal(f.records[0].attempts, 0);
  assert.equal(f.sends(), 0);
  f.deps.sender.assertReady = () => {};
  backend.registerWaitlist_(input(), f.deps);
  assert.equal(f.sends(), 0, "A public retry must respect the queue cooldown.");
  f.advance(15 * 60 * 1000);
  assert.equal(backend.registerWaitlist_(input(), f.deps).welcome, "sent");
});

test("the daily sending limit queues email without losing the registration", () => {
  const f = fixture();
  f.deps.reserveEmail = () => false;
  const result = backend.registerWaitlist_(input(), f.deps);
  assert.equal(result.registration, "saved");
  assert.equal(result.welcome, "pending");
  assert.equal(result.code, "daily_email_limit");
  assert.equal(f.sends(), 0);
});

test("Gmail rejection and an ambiguous transport failure are different outcomes", () => {
  for (const [message, expected] of [["Invalid recipient", "failed"], ["network timeout", "unknown"], ["Rate limit exceeded", "pending"]]) {
    const f = fixture();
    f.deps.sender.send = () => { throw new Error(message); };
    const result = backend.registerWaitlist_(input(), f.deps);
    assert.equal(result.registration, "saved");
    assert.equal(result.welcome, expected);
    assert.equal(f.records[0].welcome, expected);
  }
});

test("an ambiguous or interrupted send is never retried by another signup", () => {
  for (const state of ["unknown", "sending", "failed"]) {
    const f = fixture();
    backend.registerWaitlist_(input(), f.deps);
    f.records[0].welcome = state;
    f.records[0].messageId = "";
    const result = backend.registerWaitlist_(input(), f.deps);
    assert.equal(result.welcome, state === "sending" ? "unknown" : state);
    assert.equal(f.sends(), 1);
  }
});

test("failed or ambiguous storage never triggers email or a success claim", () => {
  const f = fixture();
  f.deps.store.append = () => { throw new Error("storage unavailable"); };
  const result = backend.registerWaitlist_(input(), f.deps);
  assert.equal(result.registration, "unknown");
  assert.equal(result.welcome, "not_attempted");
  assert.equal(f.sends(), 0);
  assert.equal(f.log.length, 1);
});

test("lock contention is explicit and cannot start a send", () => {
  const f = fixture();
  f.deps.store.withLock = () => { throw Object.assign(new Error("busy"), { code: "busy" }); };
  const result = backend.registerWaitlist_(input(), f.deps);
  assert.equal(result.registration, "not_saved");
  assert.equal(result.code, "busy");
  assert.equal(f.sends(), 0);
});

test("demo choices match the public facts and legacy survey options remain unchanged", async () => {
  const content = JSON.parse(await readFile(new URL("../agent/content.json", import.meta.url), "utf8"));
  assert.equal(backend.SURVEY_ID, SURVEY_ID);
  assert.deepEqual(Object.entries(backend.SURVEY_OPTIONS),
    [
      ["A", "Correcting small things over and over"],
      ["B", "Updating the settings that teach AI my preferences and rules (Skills and similar)"],
      ["C", "Finding the right documents and files to hand to AI"],
      ["D", "Re-explaining my requirements and background every time I switch between ChatGPT, Claude and others"]
    ]);
  const form = content.early_access.form;
  assert.equal(content.early_access.survey, undefined);
  assert.equal(form.consent_version, CONSENT_VERSION);
  assert.equal(form.consent_version, backend.DEMO_CONSENT);
  assert.deepEqual(form.fields.find((field) => field.name === "industry").options,
    Array.from(backend.DEMO_INDUSTRIES));
  assert.deepEqual(form.fields.find((field) => field.name === "companySize").options,
    Array.from(backend.DEMO_COMPANY_SIZES));
});

test("a registered signup can save and update one survey answer per email and survey", () => {
  const f = fixture();
  backend.registerWaitlist_(input(), f.deps);
  assert.equal(backend.recordSurvey_(surveyInput(), f.deps).survey, "saved");
  assert.equal(f.surveyRecords.length, 1);
  assert.equal(f.surveyRecords[0].email, "example@example.com");
  assert.equal(f.surveyRecords[0].requestId, requestId);
  assert.equal(f.surveyRecords[0].answeredAt, "2026-09-12T02:00:00.000Z");
  assert.equal(f.surveyRecords[0].answerLabel, backend.SURVEY_OPTIONS.A);

  f.advance(60000);
  const result = backend.recordSurvey_(surveyInput({ answer: "D", answerLabel: "=untrusted" }), f.deps);
  assert.equal(result.requestId, requestId);
  assert.equal(result.survey, "saved");
  assert.equal(result.code, null);
  assert.equal(f.surveyRecords.length, 1);
  assert.equal(f.surveyRecords[0].answer, "D");
  assert.equal(f.surveyRecords[0].answerLabel, backend.SURVEY_OPTIONS.D);
  assert.equal(f.surveyRecords[0].answeredAt, "2026-09-12T02:00:00.000Z");
  assert.equal(f.surveyRecords[0].updatedAt, "2026-09-12T02:01:00.000Z");
  assert.equal(f.sends(), 1);
});

test("an already-registered email can answer with its new signup request ID", () => {
  const f = fixture();
  backend.registerWaitlist_(input(), f.deps);
  const nextId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  assert.equal(backend.registerWaitlist_(input({ requestId: nextId }), f.deps).registration, "saved");
  const result = backend.recordSurvey_(surveyInput({
    requestId: nextId, email: "EXAMPLE@example.com", answer: "B", source: "https://www.jinai.md"
  }), f.deps);
  assert.equal(result.survey, "saved");
  assert.equal(result.requestId, nextId);
  assert.equal(f.surveyRecords[0].requestId, nextId);
  assert.equal(f.surveyRecords[0].email, "example@example.com");
  assert.equal(f.records.length, 1);
});

test("unregistered survey answers do not create survey rows", () => {
  const f = fixture();
  const result = backend.recordSurvey_(surveyInput(), f.deps);
  assert.equal(result.survey, "not_saved");
  assert.equal(result.code, "not_registered");
  assert.equal(f.surveyRecords.length, 0);
  assert.equal(f.log[0][0], "survey");
});

test("invalid survey fields and request ID conflicts do not write answers", () => {
  for (const [changes, code] of [
    [{ answer: "E" }, "invalid_answer"],
    [{ answer: "a" }, "invalid_answer"],
    [{ answer: "<x>" }, "invalid_answer"],
    [{ surveyId: "another-survey" }, "invalid_survey"],
    [{ source: "https://other.example" }, "invalid_source"],
    [{ requestId: "not-a-uuid" }, "invalid_request_id"],
    [{ email: "other@example.com" }, "request_conflict"],
    [{ email: "a..b@example.com" }, "invalid_email"]
  ]) {
    const f = fixture();
    backend.registerWaitlist_(input(), f.deps);
    const result = backend.recordSurvey_(surveyInput(changes), f.deps);
    assert.equal(result.survey, "not_saved", JSON.stringify(changes));
    assert.equal(result.code, code);
    assert.equal(f.surveyRecords.length, 0);
    assert.equal(f.log[0][0], "survey");
  }
});

test("a known request ID cannot claim another registered email", () => {
  const f = fixture();
  backend.registerWaitlist_(input(), f.deps);
  backend.registerWaitlist_(input({
    requestId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", email: "other@example.com"
  }), f.deps);
  const result = backend.recordSurvey_(surveyInput({ email: "other@example.com" }), f.deps);
  assert.equal(result.survey, "not_saved");
  assert.equal(result.code, "request_conflict");
  assert.equal(f.surveyRecords.length, 0);
});

test("survey storage and lock failures report not_saved and can be retried", () => {
  const f = fixture();
  backend.registerWaitlist_(input(), f.deps);
  const append = f.deps.surveyStore.append;
  f.deps.surveyStore.append = () => { throw new Error("storage down"); };
  assert.equal(backend.recordSurvey_(surveyInput(), f.deps).code, "storage_error");
  assert.equal(f.surveyRecords.length, 0);
  f.deps.surveyStore.append = append;
  const withLock = f.deps.store.withLock;
  f.deps.store.withLock = () => { throw Object.assign(new Error("busy"), { code: "busy" }); };
  assert.equal(backend.recordSurvey_(surveyInput(), f.deps).code, "busy");
  f.deps.store.withLock = withLock;
  assert.equal(backend.recordSurvey_(surveyInput(), f.deps).survey, "saved");
  assert.equal(f.surveyRecords.length, 1);
});

test("doPost routes survey answers separately and keeps the body size limit", () => {
  const f = fixture();
  const production = backend.productionDependencies_;
  backend.productionDependencies_ = () => f.deps;
  backend.ContentService = {
    MimeType: { JSON: "json" },
    createTextOutput: (body) => ({ setMimeType: () => ({ body }) })
  };
  try {
    const post = (value) => JSON.parse(backend.doPost({ postData: { contents: value } }).body);
    assert.equal(post(JSON.stringify(input())).registration, "saved");
    assert.equal(post(JSON.stringify(surveyInput())).survey, "saved");
    assert.equal(f.surveyRecords.length, 1);
    assert.equal(post("x".repeat(4097)).code, "invalid_request");
    assert.equal(post("é".repeat(2100)).code, "invalid_request");
    assert.equal(f.surveyRecords.length, 1);
  } finally {
    backend.productionDependencies_ = production;
    delete backend.ContentService;
  }
});

test("rejects invalid, excessive, injected and bot input without writing", () => {
  const cases = [
    { name: "" }, { name: "a".repeat(121) }, { role: "" }, { role: "a".repeat(161) },
    { email: "no-at-sign" }, { email: "a..b@example.com" },
    { email: "ok@example.com\r\nBcc:other@example.com" },
    { name: "Name\nInjected" }, { website: "spam.example" },
    { source: "https://unrelated.example" }, { consentVersion: "wrong" },
    { requestId: "invalid" }, { email: "a".repeat(65) + "@example.com" }
  ];
  for (const changes of cases) {
    const f = fixture();
    assert.equal(backend.registerWaitlist_(input(changes), f.deps).registration, "not_saved");
    assert.equal(f.records.length, 0);
    assert.equal(f.sends(), 0);
  }
  assert.equal(backend.validateSignup_(input({ name: "a".repeat(120), role: "b".repeat(160) })).name.length, 120);
});

test("sheet cells are escaped and HTML names cannot inject markup", () => {
  for (const value of ["=HYPERLINK(\"x\")", "+1", "-2", "@mention"]) {
    assert.equal(backend.safeCell_(value), "'" + value);
  }
  assert.equal(backend.safeCell_("Normal name"), "Normal name");
  assert.equal(backend.safeCell_(3), 3);
  const html = backend.welcomeHtml_("<img/src=x/onerror=alert(1)>");
  assert.ok(html.includes("&lt;img/src=x/onerror=alert(1)&gt;"));
  assert.ok(!html.includes("<img"));
});

test("the welcome MIME has the real From, plain text, readable HTML and exact Discord invite", () => {
  const encoded = backend.welcomeMime_(input({ name: "Yu Asano" }));
  const mime = Buffer.from(encoded, "base64url").toString("utf8");
  assert.ok(mime.startsWith("From: Jin AI <hello@jinai.md>\r\n"));
  assert.ok(mime.includes("\r\nReply-To: hello@jinai.md\r\n"));
  assert.ok(mime.includes("Content-Type: multipart/alternative;"));
  const parts = [...mime.matchAll(/Content-Transfer-Encoding: base64\r\n\r\n([\s\S]*?)\r\n--jin-waitlist-/g)];
  assert.equal(parts.length, 2);
  for (const part of parts) {
    const body = Buffer.from(part[1].replace(/\s/g, ""), "base64").toString("utf8");
    assert.ok(body.includes("https://discord.gg/hn8eG4d9f"));
    assert.ok(body.includes("Hi Yu,"));
    assert.ok(body.includes("product updates"));
    assert.ok(!body.includes("No newsletter"));
    assert.ok(body.includes("gives that context to the AI tools you use"));
    assert.ok(!/visual workspace|created by AI agents/.test(body), "The retired positioning must not reach new signups.");
  }
});

test("sender verification requires the exact accepted alias", () => {
  for (const [aliases, expected] of [
    [[{ sendAsEmail: "personal@gmail.com", verificationStatus: "accepted" }], false],
    [[{ sendAsEmail: "hello@jinai.md", verificationStatus: "pending" }], false],
    [[{ sendAsEmail: "hello@jinai.md", verificationStatus: "accepted" }], true]
  ]) {
    backend.Gmail = { Users: { Settings: { SendAs: { list: () => ({ sendAs: aliases }) } } } };
    const check = () => backend.productionDependencies_().sender.assertReady();
    if (expected) assert.doesNotThrow(check);
    else assert.throws(check, /sender_not_verified/);
  }
});

test("future queue entries cannot starve due email later in the sheet", () => {
  const now = Date.parse("2026-09-12T02:00:00Z");
  const columns = Array.from(backend.WAITLIST_COLUMNS, (column) => Array.from(column));
  const headers = columns.map((column) => column[1]);
  const rows = Array.from({ length: 22 }, (_, index) => {
    const record = {
      welcome: "pending",
      requestId: String(index),
      nextAttemptAt: new Date(now + (index < 21 ? 60000 : -60000)).toISOString()
    };
    return columns.map(([key]) => record[key] || "");
  });
  let reads = 0;
  const sheet = {
    getLastRow: () => 23,
    getRange: (start) => ({ getValues: () => { reads++; return start === 1 ? [headers] : rows; } })
  };
  backend.PropertiesService = { getScriptProperties: () => ({ getProperty: () => "sheet-id" }) };
  backend.SpreadsheetApp = { openById: () => ({ getSheetByName: () => sheet }) };
  const due = backend.sheetStore_().pending(now);
  assert.equal(due.length, 1);
  assert.equal(due[0].requestId, "21");
  assert.equal(reads, 2, "Read the headers and data in bulk, not one API call per row.");
});

test("Survey sheet lookups filter by survey ID and every written cell is formula-safe", () => {
  const columns = Array.from(backend.SURVEY_COLUMNS, (column) => Array.from(column));
  const { sheet, rows } = sheetFixture(columns.map((column) => column[1]));
  backend.PropertiesService = { getScriptProperties: () => ({ getProperty: () => "sheet-id" }) };
  backend.SpreadsheetApp = {
    openById: () => ({ getSheetByName: (name) => name === "Survey" ? sheet : null }),
    flush() {}
  };
  const store = backend.sheetStore_("Survey", backend.SURVEY_COLUMNS);
  const record = store.append({
    answeredAt: "+today", email: "example@example.com", requestId: "=formula",
    surveyId: SURVEY_ID, answer: "A", answerLabel: "@formula", updatedAt: "-today"
  });
  assert.equal(rows[1][0], "'+today");
  assert.equal(rows[1][2], "'=formula");
  assert.equal(rows[1][5], "'@formula");
  assert.equal(rows[1][6], "'-today");
  store.append({ ...record, surveyId: "second-survey" });
  assert.equal(store.findBy("example@example.com", SURVEY_ID).row, 2);
  assert.equal(store.findBy("example@example.com", "second-survey").row, 3);
  assert.equal(store.findBy("someone@example.com", SURVEY_ID), null);
  record.answerLabel = "=updated";
  store.update(record);
  assert.equal(rows[1][5], "'=updated");
});

test("setupWaitlist creates Survey and Demo requests without changing existing sheets", () => {
  const waitlist = sheetFixture(Array.from(backend.WAITLIST_COLUMNS, (column) => column[1]));
  const tabs = new Map([["Waitlist", waitlist]]);
  let id = null;
  const spreadsheet = {
    getSheetByName: (name) => tabs.get(name)?.sheet || null,
    insertSheet: (name) => {
      const entry = sheetFixture();
      tabs.set(name, entry);
      return entry.sheet;
    },
    getId: () => "sheet-id",
    getUrl: () => "https://docs.google.com/spreadsheets/d/sheet-id"
  };
  backend.PropertiesService = {
    getScriptProperties: () => ({
      getProperty: () => id,
      setProperty: (_key, value) => { id = value; }
    })
  };
  backend.SpreadsheetApp = { getActiveSpreadsheet: () => spreadsheet, openById: () => spreadsheet };
  backend.setupWaitlist();
  backend.setupWaitlist();
  const survey = tabs.get("Survey");
  assert.equal(tabs.size, 3);
  assert.deepEqual(survey.rows[0], Array.from(backend.SURVEY_COLUMNS, (column) => column[1]));
  assert.equal(survey.sheet.headerWeight, "bold");
  assert.equal(survey.sheet.frozenRows, 1);
  assert.equal(waitlist.sheet.headerWeight, null);
  const demo = tabs.get("Demo requests");
  assert.deepEqual(demo.rows[0], Array.from(backend.DEMO_COLUMNS, (column) => column[1]));
  assert.equal(demo.sheet.headerWeight, "bold");
  assert.equal(demo.sheet.frozenRows, 1);
  survey.rows.push(["Existing survey response"]);
  waitlist.rows.push(["Existing waitlist registration"]);
  const before = structuredClone([waitlist.rows, survey.rows, demo.rows]);
  backend.setupWaitlist();
  assert.deepEqual([waitlist.rows, survey.rows, demo.rows], before);
});

test("the client accepts only a deployed Apps Script endpoint", () => {
  assert.ok(isAppsScriptEndpoint(endpoint));
  for (const value of [null, "", "https://docs.google.com/forms/d/e/form/formResponse", endpoint.replace("/exec", "/dev"), "http://script.google.com/macros/s/test/exec"]) {
    assert.equal(isAppsScriptEndpoint(value), false);
  }
});

test("confirmation needs the request ID and internally consistent save/send states", () => {
  assert.equal(validateResponse(response(), requestId).welcome, "sent");
  for (const value of [
    {}, { ...response(), requestId: "different" }, { ...response(), version: 2 },
    response("not_saved", "sent"), response("saved", "not_attempted"),
    response("saved", "unrecognized"), response("unknown", "pending")
  ]) assert.throws(() => validateResponse(value, requestId));
});

test("survey confirmation requires the same ID, version, status and code", () => {
  const saved = { version: 1, requestId, survey: "saved", code: null };
  assert.equal(validateSurveyResponse(saved, requestId), saved);
  assert.equal(validateSurveyResponse({ ...saved, survey: "not_saved", code: "busy" }, requestId).code, "busy");
  for (const value of [
    null, {}, { ...saved, requestId: "different" }, { ...saved, version: 2 },
    { ...saved, survey: "unknown" }, { ...saved, code: "unexpected" },
    { ...saved, survey: "not_saved", code: null }
  ]) assert.throws(() => validateSurveyResponse(value, requestId));
});

test("client copy never conflates saving with sending", () => {
  assert.equal(describeResult(response()).welcome, "Sent");
  for (const welcome of ["pending", "failed", "unknown"]) {
    const description = describeResult(response("saved", welcome));
    assert.equal(description.saved, true);
    assert.equal(description.registration, "Saved");
    assert.notEqual(description.welcome, "Sent");
    assert.ok(description.detail.includes("do not need to submit again"));
    assert.ok(description.detail.includes("still reply"));
  }
  assert.equal(describeResult(response("not_saved", "not_attempted")).saved, false);
  assert.equal(describeResult(response("unknown", "not_attempted")).registration, "Not confirmed");
});

test("POST uses readable CORS and no cookies, never no-cors or iframe load", async () => {
  let observed;
  const result = await submitSignup(endpoint, input(), {
    fetchImpl: async (url, options) => {
      observed = { url, options };
      return { ok: true, json: async () => response() };
    }
  });
  assert.equal(result.welcome, "sent");
  assert.equal(observed.options.mode, "cors");
  assert.equal(observed.options.credentials, "omit");
  assert.equal(observed.options.headers["Content-Type"], "text/plain;charset=UTF-8");
  assert.equal(JSON.parse(observed.options.body).requestId, requestId);
});

test("survey POST uses the signup transport and sends the survey payload", async () => {
  let observed;
  const payload = surveyInput({ answer: "C" });
  const result = await submitSurvey(endpoint, payload, {
    fetchImpl: async (url, options) => {
      observed = { url, options };
      return { ok: true, json: async () => ({ version: 1, requestId, survey: "saved", code: null }) };
    }
  });
  assert.equal(result.survey, "saved");
  assert.equal(observed.url, endpoint);
  assert.equal(observed.options.method, "POST");
  assert.equal(observed.options.mode, "cors");
  assert.equal(observed.options.credentials, "omit");
  assert.equal(observed.options.headers["Content-Type"], "text/plain;charset=UTF-8");
  assert.deepEqual(JSON.parse(observed.options.body), payload);
});

test("HTTP errors, login HTML, mismatched responses and timeouts never become success", async () => {
  await assert.rejects(submitSignup(endpoint, input(), { fetchImpl: async () => ({ ok: false, status: 403 }) }));
  await assert.rejects(submitSignup(endpoint, input(), {
    fetchImpl: async () => ({ ok: true, json: async () => { throw new SyntaxError("HTML instead of JSON"); } })
  }));
  await assert.rejects(submitSignup(endpoint, input(), {
    fetchImpl: async () => ({ ok: true, json: async () => ({ ...response(), requestId: "other" }) })
  }));
  await assert.rejects(submitSignup(endpoint, input(), {
    timeoutMs: 5,
    fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    })
  }), /aborted/);
});

test("a demo saves every field before sending exactly one confirmation, including on retry", () => {
  const f = fixture();
  const payload = demoInput({ email: "EXAMPLE@example.com" });
  assert.equal(backend.registerDemo_(payload, f.deps).welcome, "sent");
  const saved = f.records[0];
  for (const field of ["firstName", "lastName", "jobTitle", "phone", "company",
    "industry", "companySize", "country", "requestId", "source", "consentVersion"]) {
    assert.equal(saved[field], payload[field], field);
  }
  assert.equal(saved.email, "example@example.com");
  assert.equal(saved.messageId, "gmail-message-id");
  assert.equal(saved.attempts, 1);
  assert.equal(saved.createdAt, "2026-09-12T02:00:00.000Z");
  assert.equal(backend.registerDemo_(payload, f.deps).welcome, "sent");
  assert.equal(f.records.length, 1);
  assert.equal(f.sends(), 1);
  assert.equal(f.surveyRecords.length, 0);
});

test("a new demo request ID preserves a later intentional request from the same buyer", () => {
  const f = fixture();
  backend.registerDemo_(demoInput(), f.deps);
  const second = backend.registerDemo_(demoInput({
    requestId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", company: "Another Example Company"
  }), f.deps);
  assert.equal(second.welcome, "sent");
  assert.equal(f.records.length, 2);
  assert.equal(f.records[1].company, "Another Example Company");
  assert.equal(f.sends(), 2);
  const conflict = backend.registerDemo_(demoInput({ email: "other@example.com" }), f.deps);
  assert.equal(conflict.code, "request_conflict");
  assert.equal(conflict.registration, "not_saved");
  assert.equal(f.records.length, 2);
  assert.equal(f.sends(), 2);
});

for (const [field, code, invalid] of [
  ["email", "invalid_email", ["", null, "a..b@example.com", "x".repeat(65) + "@example.com", "ok@example.com\r\nBcc:x@example.com"]],
  ["firstName", "invalid_first_name", ["", " ", undefined, "x".repeat(81), "Alex\nSample"]],
  ["lastName", "invalid_last_name", ["", " ", 12, "x".repeat(81), "Sample\u007f"]],
  ["jobTitle", "invalid_job_title", ["", null, "x".repeat(121), "Head\tIT"]],
  ["phone", "invalid_phone", [undefined, 123, "x".repeat(41), "+1/202", "+1\n202", "Call me", "+1\u0000202"]],
  ["company", "invalid_company", ["", false, "x".repeat(161), "Example\rCompany"]],
  ["industry", "invalid_industry", ["", null, "technology", "Unknown", "Technology\n"]],
  ["companySize", "invalid_company_size", ["", 50, "50-200", "1000+", "50-199\t"]],
  ["country", "invalid_country", ["", " ", null, "x".repeat(81), "Japan\n"]]
]) {
  test(`demo rejects invalid ${field} with ${code} and no writes or sends`, () => {
    for (const value of invalid) {
      const f = fixture();
      const result = backend.registerDemo_(demoInput({ [field]: value }), f.deps);
      assert.equal(result.code, code, String(value));
      assert.equal(result.registration, "not_saved");
      assert.equal(result.welcome, "not_attempted");
      assert.equal(f.records.length, 0);
      assert.equal(f.sends(), 0);
      assert.equal(f.log.length, 1);
    }
  });
}

test("demo accepts boundary lengths, trims names, and allows an empty optional phone", () => {
  const payload = backend.validateDemo_(demoInput({
    firstName: "  " + "a".repeat(80) + " ", lastName: "b".repeat(80),
    jobTitle: "c".repeat(120), company: "d".repeat(160), country: "e".repeat(80), phone: ""
  }));
  assert.equal(payload.firstName.length, 80);
  assert.equal(payload.phone, "");
  assert.equal(backend.validateDemo_(demoInput({ phone: "+1 (202) 555-0142 . 0" })).phone,
    "+1 (202) 555-0142 . 0");
  for (const industry of backend.DEMO_INDUSTRIES) {
    assert.equal(backend.validateDemo_(demoInput({ industry })).industry, industry);
  }
  for (const companySize of backend.DEMO_COMPANY_SIZES) {
    assert.equal(backend.validateDemo_(demoInput({ companySize })).companySize, companySize);
  }
});

test("demo rejects a filled honeypot, stale consent, invalid source and malformed request IDs", () => {
  for (const [changes, code] of [
    [{ website: "spam.example" }, "invalid_input"],
    [{ consentVersion: "waitlist-product-updates-v1" }, "invalid_consent"],
    [{ source: "https://other.example" }, "invalid_source"],
    [{ requestId: "invalid" }, "invalid_request_id"]
  ]) {
    const f = fixture();
    const result = backend.registerDemo_(demoInput(changes), f.deps);
    assert.equal(result.code, code);
    assert.equal(result.registration, "not_saved");
    assert.equal(f.records.length, 0);
    assert.equal(f.sends(), 0);
  }
  const f = fixture();
  for (const value of [null, [], "text"]) {
    assert.equal(backend.registerDemo_(value, f.deps).code, "invalid_input");
  }
});

test("demo delivery retains honest pending, failed, unknown and interrupted states", () => {
  for (const state of ["pending", "failed", "unknown", "sending"]) {
    const f = fixture();
    if (state === "pending") {
      f.deps.sender.assertReady = () => { throw Object.assign(new Error("alias"), { code: "sender_not_verified" }); };
    } else {
      f.deps.sender.send = () => { throw new Error(state === "failed" ? "Invalid recipient" : "network timeout"); };
    }
    const result = backend.registerDemo_(demoInput(), f.deps);
    assert.equal(result.registration, "saved");
    assert.equal(result.welcome, state === "sending" ? "unknown" : state);
    if (state === "sending") f.records[0].welcome = "sending";
    const attempts = f.records[0].attempts;
    backend.registerDemo_(demoInput(), f.deps);
    assert.equal(f.records[0].attempts, attempts);
    assert.equal(f.records.length, 1);
  }
});

test("demo storage failures, lock contention and quota never claim a send", () => {
  for (const [change, expected, code] of [
    [(deps) => { deps.store.append = () => { throw new Error("offline"); }; }, "unknown", "storage_error"],
    [(deps) => { deps.store.withLock = () => { throw Object.assign(new Error("busy"), { code: "busy" }); }; }, "not_saved", "busy"],
    [(deps) => { deps.reserveEmail = () => false; }, "saved", "daily_email_limit"]
  ]) {
    const f = fixture();
    change(f.deps);
    const result = backend.registerDemo_(demoInput(), f.deps);
    assert.equal(result.registration, expected);
    assert.equal(result.code, code);
    assert.equal(f.sends(), 0);
  }
});

test("the scheduled retry processes both queues and never resends sent or ambiguous demos", () => {
  const legacy = fixture();
  const demo = fixture();
  for (const f of [legacy, demo]) f.deps.reserveEmail = () => false;
  backend.registerWaitlist_(input(), legacy.deps);
  backend.registerDemo_(demoInput(), demo.deps);
  const production = backend.productionDependencies_;
  backend.productionDependencies_ = (type) => type === "demo" ? demo.deps : legacy.deps;
  try {
    backend.retryPendingWelcomeEmails();
    assert.equal(demo.sends(), 0);
    for (const f of [legacy, demo]) {
      f.advance(15 * 60 * 1000);
      f.deps.reserveEmail = () => true;
    }
    backend.retryPendingWelcomeEmails();
    assert.equal(demo.sends(), 1);
    assert.equal(legacy.sends(), 1);
    for (const state of ["sent", "sending", "unknown", "failed"]) {
      demo.records[0].welcome = state;
      backend.retryPendingWelcomeEmails();
      assert.equal(demo.sends(), 1);
    }
  } finally {
    backend.productionDependencies_ = production;
  }
});

test("demo MIME is a short transactional confirmation with the verified From and safe greeting", () => {
  const mime = Buffer.from(backend.demoMime_(demoInput()), "base64url").toString("utf8");
  assert.match(mime, /^From: Jin AI <hello@jinai\.md>\r\nReply-To: hello@jinai\.md/);
  assert.match(mime, /\r\nSubject: We received your Jin AI demo request\r\n/);
  const parts = [...mime.matchAll(/Content-Transfer-Encoding: base64\r\n\r\n([\s\S]*?)\r\n--jin-demo-/g)];
  assert.equal(parts.length, 2);
  for (const part of parts) {
    const body = Buffer.from(part[1].replace(/\s/g, ""), "base64").toString("utf8");
    assert.ok(body.includes("Hi Alex,"));
    assert.ok(body.includes("We will email you to set up a time."));
    assert.ok(body.includes("reply to this email with questions"));
    assert.ok(body.includes("because you requested a demo on"));
    assert.doesNotMatch(body, /Discord|marketing|product updates|waitlist/i);
    for (const url of body.match(/https:\/\/[^"<\s]+/g) || []) {
      assert.ok(["https://jinai.md/", "https://jinai.md/privacy/"].includes(url));
    }
  }
  assert.match(backend.demoHtml_("<img src=x>"), /Hi &lt;img src=x&gt;,/);
  assert.doesNotMatch(backend.demoHtml_("<img src=x>"), /<img/);
});

test("production demo routing uses only Demo requests and the demo MIME", () => {
  const columns = Array.from(backend.DEMO_COLUMNS, (column) => Array.from(column));
  const { sheet, rows } = sheetFixture(columns.map((column) => column[1]));
  let locks = 0;
  let releases = 0;
  let sends = 0;
  const properties = {};
  backend.PropertiesService = { getScriptProperties: () => ({
    getProperty: (key) => key === "SPREADSHEET_ID" ? "sheet-id" : properties[key],
    setProperties: (values) => Object.assign(properties, values)
  }) };
  backend.LockService = { getScriptLock: () => ({
    tryLock: () => { locks++; return true; },
    releaseLock: () => { releases++; }
  }) };
  backend.SpreadsheetApp = {
    openById: () => ({ getSheetByName: (name) => {
      assert.equal(name, "Demo requests", "Demo requests must never access the legacy tabs.");
      return sheet;
    } }),
    flush() {}
  };
  backend.Gmail = { Users: {
    Settings: { SendAs: { list: () => ({ sendAs: [
      { sendAsEmail: "hello@jinai.md", verificationStatus: "accepted" }
    ] }) } },
    Messages: { send: ({ raw }) => {
      sends++;
      assert.match(Buffer.from(raw, "base64url").toString("utf8"),
        /Subject: We received your Jin AI demo request/);
      return { id: "demo-message-id" };
    } }
  } };
  backend.ContentService = {
    MimeType: { JSON: "json" },
    createTextOutput: (body) => ({ setMimeType: () => ({ body }) })
  };
  try {
    const payload = demoInput({
      firstName: "=1+1", lastName: "@Sample", jobTitle: "-Director",
      company: "+Example Company", country: "=country"
    });
    const post = () => JSON.parse(backend.doPost({ postData: { contents: JSON.stringify(payload) } }).body);
    assert.equal(post().welcome, "sent");
    assert.equal(post().welcome, "sent");
    assert.equal(rows.length, 2);
    assert.equal(sends, 1);
    assert.equal(locks, 2);
    assert.equal(releases, 2);
    for (const field of ["firstName", "lastName", "jobTitle", "phone", "company", "country"]) {
      const index = columns.findIndex(([key]) => key === field);
      assert.equal(rows[1][index], "'" + payload[field], field);
    }
    assert.equal(rows[1][columns.findIndex(([key]) => key === "welcome")], "sent");
    assert.equal(backend.WAITLIST_VERSION, "2026-10-19.1");
  } finally {
    for (const key of ["PropertiesService", "LockService", "SpreadsheetApp", "Gmail", "ContentService"]) {
      delete backend[key];
    }
  }
});

async function clientFixture(t, fetchImpl, configured = true) {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const formHtml = html.match(/<form\b[^>]*\bid="waitlistForm"[^>]*>[\s\S]*?<\/form>/)[0];
  const elements = new Map();
  const controls = new Map();
  const listeners = new Map();
  const errorLogs = [];
  const document = { getElementById: (id) => elements.get(id), activeElement: null };
  function element(id, attributes = {}) {
    const node = {
      id, hidden: false, textContent: "", dataset: {}, value: "", ...attributes,
      getAttribute: (name) => attributes[name] ?? null,
      setAttribute: (name, value) => { attributes[name] = value; },
      removeAttribute: (name) => { delete attributes[name]; },
      focus() { document.activeElement = node; },
      scrollIntoView() {}
    };
    elements.set(id, node);
    return node;
  }
  for (const match of formHtml.matchAll(/<(input|select)\b([^>]*)>/g)) {
    const attributes = Object.fromEntries([...match[2].matchAll(/([\w-]+)="([^"]*)"/g)]
      .map((attribute) => [attribute[1], attribute[2]]));
    const control = element(attributes.id, attributes);
    if (match[1] === "select") {
      const options = formHtml.match(new RegExp(`<select\\b[^>]*id="${attributes.id}"[^>]*>([\\s\\S]*?)<\\/select>`))[1];
      control.options = [...options.matchAll(/<option value="([^"]*)">/g)].map((option) => ({ value: option[1] }));
    }
    controls.set(attributes.name, control);
    if (attributes["aria-describedby"]) {
      assert.ok(formHtml.includes(`id="${attributes["aria-describedby"]}" hidden`));
      element(attributes["aria-describedby"], { hidden: true });
    }
  }
  const button = element("submit", { textContent: "Request a demo", disabled: true });
  const form = element("waitlistForm", {
    dataset: { endpoint: configured ? endpoint : "" },
    querySelector: (selector) => selector === 'button[type="submit"]' ? button :
      controls.get(selector.match(/name="([^"]+)"/)?.[1]),
    addEventListener: (name, listener) => listeners.set(name, listener)
  });
  for (const id of ["waitlistStatus", "waitlistDone", "waitlistHeading",
    "waitlistRegistration", "waitlistEmail", "waitlistDetail"]) {
    assert.ok(html.includes(`id="${id}"`));
    element(id, { hidden: id === "waitlistStatus" || id === "waitlistDone" });
  }
  t.mock.method(globalThis, "FormData", function MockFormData() {
    this.get = (name) => controls.get(name)?.value ?? null;
  });
  t.mock.method(console, "error", (...args) => errorLogs.push(args));
  initializeWaitlist(document, { fetchImpl });
  return {
    document, form, button, controls, elements, errorLogs,
    fill(overrides = {}) {
      const payload = demoInput(overrides);
      for (const [name, control] of controls) control.value = payload[name] || "";
    },
    submit: () => listeners.get("submit")({ preventDefault() {} }),
    input: (name) => listeners.get("input")({ target: controls.get(name) })
  };
}

test("client validation rejects every invalid field and accepts optional phone with listed choices", async () => {
  const content = JSON.parse(await readFile(new URL("../agent/content.json", import.meta.url), "utf8"));
  const choices = Object.fromEntries(content.early_access.form.fields
    .filter((field) => field.type === "select").map((field) => [field.name, field.options]));
  assert.deepEqual(validateDemoFields(demoInput({ phone: "" }), choices), {});
  for (const [field, value] of [
    ["email", "a..b@example.com"], ["firstName", "a".repeat(81)], ["lastName", "Sample\n"],
    ["jobTitle", ""], ["phone", "call me"], ["company", "a".repeat(161)],
    ["industry", "Unknown"], ["companySize", "1000+"], ["country", "Unknown"]
  ]) {
    assert.deepEqual(Object.keys(validateDemoFields(demoInput({ [field]: value }), choices)), [field]);
  }
});

test("empty client submission connects inline errors and focuses the first invalid field", async (t) => {
  let requests = 0;
  const f = await clientFixture(t, async () => { requests++; });
  await f.submit();
  assert.equal(requests, 0);
  assert.equal(f.document.activeElement.id, "demo-email");
  for (const [name, control] of f.controls) {
    if (name === "phone" || name === "website") continue;
    assert.equal(control.getAttribute("aria-invalid"), "true");
    const error = f.document.getElementById(control.getAttribute("aria-describedby"));
    assert.equal(error.hidden, false);
    assert.ok(error.textContent.startsWith("Please"));
  }
  assert.equal(f.document.getElementById("demo-phone-error").hidden, true);
  f.controls.get("email").value = "buyer@example.com";
  f.input("email");
  assert.equal(f.controls.get("email").getAttribute("aria-invalid"), null);
  assert.equal(f.document.getElementById("demo-email-error").hidden, true);
  await f.submit();
  assert.equal(f.document.activeElement.id, "demo-firstName");
});

for (const welcome of ["sent", "pending", "failed", "unknown"]) {
  test(`client presents saved demo and ${welcome} email honestly without a survey`, async (t) => {
    let payload;
    const f = await clientFixture(t, async (url, options) => {
      assert.equal(url, endpoint);
      payload = JSON.parse(options.body);
      return { ok: true, json: async () => ({ ...response("saved", welcome), requestId: payload.requestId }) };
    });
    f.fill({ phone: "", firstName: "  Alex  " });
    await f.submit();
    assert.equal(payload.type, "demo");
    assert.equal(payload.firstName, "Alex");
    assert.equal(payload.phone, "");
    assert.equal(payload.consentVersion, "demo-request-v1");
    assert.deepEqual(Object.keys(payload), [
      "type", "email", "firstName", "lastName", "jobTitle", "phone", "company",
      "industry", "companySize", "country", "website", "source", "consentVersion", "requestId"
    ]);
    assert.equal(f.form.hidden, true);
    assert.equal(f.elements.get("waitlistDone").hidden, false);
    assert.equal(f.elements.get("waitlistRegistration").textContent, "Saved");
    assert.equal(f.elements.get("waitlistEmail").textContent, describeResult(response("saved", welcome)).welcome);
    assert.equal(f.document.activeElement.id, "waitlistDone");
    assert.equal(f.document.getElementById("waitlistSurvey"), undefined);
    assert.equal(f.button.disabled, false);
    assert.equal(f.form.getAttribute("aria-busy"), null);
    assert.doesNotMatch(f.elements.get("waitlistDetail").textContent, /Discord|waitlist/);
  });
}

test("client marks server-rejected fields and focuses the rejected field", async (t) => {
  const f = await clientFixture(t, async (_url, options) => ({
    ok: true,
    json: async () => ({ ...response("not_saved", "not_attempted", "invalid_company"),
      requestId: JSON.parse(options.body).requestId })
  }));
  f.fill();
  await f.submit();
  assert.equal(f.form.hidden, false);
  assert.equal(f.document.activeElement.id, "demo-company");
  assert.equal(f.controls.get("company").getAttribute("aria-invalid"), "true");
  assert.match(f.elements.get("demo-company-error").textContent, /company/);
  assert.equal(f.elements.get("waitlistRegistration").textContent, "Not saved");
});

test("client transport retry reuses the same ID and reaches backend storage and delivery once", async (t) => {
  const backendFixture = fixture();
  const requests = [];
  const f = await clientFixture(t, async (_url, options) => {
    const payload = JSON.parse(options.body);
    requests.push(payload);
    const result = backend.registerDemo_(payload, backendFixture.deps);
    if (requests.length === 1) throw new Error("response lost after storage");
    return { ok: true, json: async () => result };
  });
  f.fill();
  await f.submit();
  assert.equal(f.form.hidden, false);
  assert.match(f.elements.get("waitlistStatus").textContent, /could not confirm/);
  assert.equal(f.errorLogs.length, 1);
  await f.submit();
  assert.equal(requests[0].requestId, requests[1].requestId);
  assert.equal(backendFixture.records.length, 1);
  assert.equal(backendFixture.sends(), 1);
  assert.equal(f.elements.get("waitlistEmail").textContent, "Sent");
});

test("client prevents concurrent sends and uses a new ID when unsaved request details change", async (t) => {
  const requests = [];
  let release;
  const f = await clientFixture(t, (_url, options) => {
    const payload = JSON.parse(options.body);
    requests.push(payload);
    return new Promise((resolve) => {
      release = () => resolve({
        ok: true, json: async () => ({ ...response("not_saved", "not_attempted", "busy"),
          requestId: payload.requestId })
      });
    });
  });
  f.fill();
  const first = f.submit();
  assert.equal(f.button.disabled, true);
  assert.equal(f.form.getAttribute("aria-busy"), "true");
  await f.submit();
  assert.equal(requests.length, 1);
  release();
  await first;
  f.controls.get("company").value = "Another Example Company";
  const second = f.submit();
  assert.notEqual(requests[0].requestId, requests[1].requestId);
  release();
  await second;
  assert.equal(f.form.hidden, false);
  assert.equal(f.button.disabled, false);
});

test("an unconfigured demo client disables submission and gives a contact fallback", async (t) => {
  const f = await clientFixture(t, async () => assert.fail("No request is allowed"), false);
  assert.equal(f.button.disabled, true);
  assert.equal(f.elements.get("waitlistStatus").hidden, false);
  assert.match(f.elements.get("waitlistStatus").textContent, /unavailable.*hello@jinai.md/);
});
