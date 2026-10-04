import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import {
  CONSENT_VERSION, SURVEY_ID, describeResult, isAppsScriptEndpoint, submitSignup, submitSurvey,
  validateResponse, validateSurveyResponse
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
  source: "https://jinai.md", consentVersion: CONSENT_VERSION, website: "", ...overrides
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
      update: (record) => { records[record.row - 2] = structuredClone(record); }
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
      send: () => {
        sends++;
        assert.equal(records[0].registration, "saved");
        assert.equal(records[0].welcome, "sending", "The send intent must already be persistent.");
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

test("survey options and IDs match the public fact source", async () => {
  const content = JSON.parse(await readFile(new URL("../agent/content.json", import.meta.url), "utf8"));
  assert.equal(content.early_access.survey.id, SURVEY_ID);
  assert.equal(backend.SURVEY_ID, SURVEY_ID);
  assert.deepEqual(Object.entries(backend.SURVEY_OPTIONS),
    content.early_access.survey.options.map(({ value, label }) => [value, label]));
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

test("setupWaitlist creates and validates the Survey tab without changing Waitlist", () => {
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
  assert.equal(tabs.size, 2);
  assert.deepEqual(survey.rows[0], Array.from(backend.SURVEY_COLUMNS, (column) => column[1]));
  assert.equal(survey.sheet.headerWeight, "bold");
  assert.equal(survey.sheet.frozenRows, 1);
  assert.equal(waitlist.sheet.headerWeight, null);
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
    assert.ok(description.detail.includes("do not need to register again"));
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
