import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import {
  CONSENT_VERSION, WAITLIST_CONSENT_VERSION, WAITLIST_FIELDS, SURVEY_ID, describeResult, isAppsScriptEndpoint, submitSignup, submitSurvey,
  validateResponse, validateSurveyResponse, validateDemoFields, validateWaitlistFields, initializeWaitlist
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
const waitlistInput = (overrides = {}) => ({
  requestId, firstName: "Maya", lastName: "Tanaka", email: "example@example.com",
  jobTitle: "Head of IT", company: "Contoso", source: "https://jinai.md",
  consentVersion: backend.WAITLIST_CONSENT, website: "", ...overrides
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
  const writes = [];
  let maxColumns = headers?.length || 26;
  const sheet = {
    frozenRows: 0,
    headerWeight: null,
    getLastRow: () => rows.length,
    getLastColumn: () => Math.max(0, ...rows.map((row) => row.length)),
    getMaxColumns: () => maxColumns,
    insertColumnsAfter: (after, count) => {
      assert.equal(after, maxColumns);
      maxColumns += count;
    },
    getRange(start, column, height = 1, width = 1) {
      const range = {
        getValues: () => rows.slice(start - 1, start - 1 + height)
          .map((row) => Array.from({ length: width }, (_, i) => row[column - 1 + i] ?? "")),
        setValues(values) {
          values.forEach((cells, offset) => {
            const index = start - 1 + offset;
            const row = rows[index] || [];
            cells.forEach((cell, i) => {
              writes.push({ row: index + 1, column: column + i, value: cell });
              // Model Sheets' text escape, not its locale-dependent coercion.
              row[column - 1 + i] = typeof cell === "string" && cell.startsWith("'") ? cell.slice(1) : cell;
            });
            rows[index] = row;
          });
          return range;
        },
        setFontWeight(weight) { sheet.headerWeight = weight; return range; },
        createTextFinder(value) {
          const matches = rows.slice(start - 1, start - 1 + height)
            .flatMap((row, i) => String(row[column - 1]) === value ? [{ getRow: () => start + i }] : []);
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
  return { sheet, rows, writes };
}

function decodedMime(encoded, type) {
  const mime = Buffer.from(encoded, "base64url").toString("utf8");
  const header = mime.match(/\r\nSubject: ([\s\S]*?)\r\nMessage-ID:/)?.[1];
  assert.ok(header);
  const words = [...header.matchAll(/=\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=/g)];
  assert.ok(words.length);
  assert.equal(header, words.map((word) => word[0]).join("\r\n "));
  assert.ok(words.every((word) => word[0].length <= 75));
  const subject = words.map((word) => Buffer.from(word[1], "base64").toString("utf8")).join("");
  assert.doesNotMatch(subject, /[\r\n]/);
  const parts = [...mime.matchAll(new RegExp(
    `Content-Transfer-Encoding: base64\\r\\n\\r\\n([\\s\\S]*?)\\r\\n--jin-${type}-`, "g"))];
  assert.equal(parts.length, 2);
  const [text, html] = parts.map((part) => Buffer.from(part[1].replace(/\s/g, ""), "base64").toString("utf8"));
  return { mime, subject, text, html };
}

test("the release version and consent versions are exact and the mailer contains no community invite", () => {
  assert.equal(backend.WAITLIST_VERSION, "2026-10-21.1");
  assert.equal(backend.WAITLIST_CONSENT, "waitlist-product-updates-v1");
  assert.equal(backend.DEMO_CONSENT, "demo-request-v1");
  assert.doesNotMatch(source, /discord/i);
});

test("new waitlist fields are required, trimmed and saved alongside the legacy name and role", () => {
  const f = fixture();
  const payload = waitlistInput({
    firstName: "  Maya  ", lastName: " Tanaka ", jobTitle: " Head of IT ",
    company: " Contoso ", email: " EXAMPLE@example.com ", lang: "ja"
  });
  assert.equal(backend.registerWaitlist_(payload, f.deps).welcome, "sent");
  const saved = f.records[0];
  for (const [key, value] of Object.entries({
    firstName: "Maya", lastName: "Tanaka", name: "Maya Tanaka", role: "Head of IT",
    company: "Contoso", lang: "ja", email: "example@example.com",
    requestId, source: "https://jinai.md", consentVersion: "waitlist-product-updates-v1"
  })) assert.equal(saved[key], value, key);
  assert.equal(f.sends(), 1);
  assert.equal(backend.registerWaitlist_(payload, f.deps).welcome, "sent");
  assert.equal(f.records.length, 1);
  assert.equal(f.sends(), 1);
  assert.equal(backend.validateSignup_(waitlistInput()).lang, "en");
});

for (const [field, code, limit] of [
  ["firstName", "invalid_first_name", 80], ["lastName", "invalid_last_name", 80],
  ["jobTitle", "invalid_job_title", 120], ["company", "invalid_company", 160],
  ["email", "invalid_email", 254]
]) {
  test(`new waitlist rejects invalid ${field} before storage or sending`, () => {
    for (const value of ["", " ", undefined, null, 7, false, {}, [], "x".repeat(limit + 1),
      "A\rB", "A\nB", "A\tB", "A\u0000B", "A\u007fB", "A\u0085B", "A\u2028B", "A\u2029B"]) {
      const f = fixture();
      f.deps.store.withLock = () => assert.fail("Validation must precede storage.");
      const result = backend.registerWaitlist_(waitlistInput({ [field]: value }), f.deps);
      assert.equal(result.code, code, `${field}: ${JSON.stringify(value)}`);
      assert.equal(result.registration, "not_saved");
      assert.equal(result.welcome, "not_attempted");
      assert.equal(f.records.length, 0);
      assert.equal(f.sends(), 0);
      assert.deepEqual(f.log, [["validation", requestId, code]]);
    }
  });
}

test("new waitlist accepts boundary lengths and cannot bypass company validation with legacy aliases", () => {
  const cleaned = backend.validateSignup_(waitlistInput({
    firstName: "a".repeat(80), lastName: "b".repeat(80),
    jobTitle: "c".repeat(120), company: "d".repeat(160)
  }));
  assert.equal(cleaned.name.length, 161);
  assert.equal(cleaned.role.length, 120);
  assert.equal(cleaned.company.length, 160);
  for (const payload of [
    input({ firstName: "Maya" }), input({ jobTitle: "Head of IT" }),
    input({ company: "" }), { ...waitlistInput(), name: "Legacy", role: "CEO", company: "" }
  ]) {
    const f = fixture();
    assert.equal(backend.registerWaitlist_(payload, f.deps).registration, "not_saved");
    assert.equal(f.records.length, 0);
    assert.equal(f.sends(), 0);
  }
});

test("cached legacy signups retain their original name and role, with company empty and English default", () => {
  const f = fixture();
  assert.equal(backend.registerWaitlist_(input({ name: "  Example Tester ", role: " Founder " }), f.deps).welcome, "sent");
  const saved = f.records[0];
  assert.equal(saved.name, "Example Tester");
  assert.equal(saved.role, "Founder");
  assert.equal(saved.company, "");
  assert.equal(saved.firstName, "");
  assert.equal(saved.lastName, "");
  assert.equal(saved.lang, "en");
  const email = decodedMime(backend.welcomeMime_(saved), "waitlist");
  assert.equal(email.subject, "Example, you're on the Jin AI waitlist");
  assert.match(email.text, /Hi Example,/);
  assert.match(email.text, /Thanks for your interest in Jin AI!\r\n/);
  assert.match(email.text, /We look forward to having you try Jin AI, Example!/);
  assert.doesNotMatch(email.text, /We've added|undefined|null/);
  const oldRow = { ...input(), lang: "", firstName: "", lastName: "", company: "" };
  assert.equal(backend.welcomeText_(oldRow), email.text);
});

test("waitlist rejects invalid language, stale consent, bots, sources and IDs without writes", () => {
  for (const [changes, code] of [
    ...["fr", "ja-JP", "JA", " en", "", null, false, [], {}, "en\r\nBcc:x"].map((lang) =>
      [{ lang }, "invalid_input"]),
    [{ consentVersion: "demo-request-v1" }, "invalid_consent"],
    [{ source: "https://other.example" }, "invalid_source"],
    [{ requestId: "invalid" }, "invalid_request_id"],
    [{ website: "spam.example" }, "invalid_input"]
  ]) {
    const f = fixture();
    const result = backend.registerWaitlist_(waitlistInput(changes), f.deps);
    assert.equal(result.code, code);
    assert.equal(result.registration, "not_saved");
    assert.equal(f.records.length, 0);
    assert.equal(f.sends(), 0);
  }
});

const approvedBodies = {
  waitlist: {
    en: [
      "Thanks for your interest in Jin AI! We've added Contoso to our waitlist.",
      "Jin AI helps companies keep their AI agents, skills, and knowledge secure, shared across teams, and always up to date.",
      "We're getting ready to launch and will email you when early access becomes available.",
      "In the meantime, we'd love to show you how Jin AI could work for your team. If you're interested, feel free to book a demo."
    ],
    ja: [
      "Jin AI にご関心をお寄せいただき、ありがとうございます。",
      "Jin AIは、企業の大切な情報を守りながら、AIエージェントの知識やスキルを組織全体で共有・活用できるようにするプラットフォームです。",
      "現在、サービスの公開に向けて準備を進めています。",
      "先行利用のご案内や最新情報は、ご登録いただいたメールアドレスにお届けします。",
      "また、Tanaka様のご利用環境に合わせたデモもご案内しています。ご興味がございましたら、ぜひお気軽にお申し込みください。"
    ]
  },
  demo: {
    en: [
      "Thanks for requesting a Jin AI demo for Contoso.",
      "We'll email you to find a time. If there's anything you'd like us to cover, just reply to this email."
    ],
    ja: [
      "Jin AI のデモにお申し込みいただき、ありがとうございます。",
      "日程の調整のため、こちらからメールでご連絡します。デモで特に見たいことがあれば、このメールにそのまま返信してください。"
    ]
  }
};

for (const type of ["waitlist", "demo"]) {
  for (const lang of ["en", "ja"]) {
    test(`${type}/${lang} has the exact approved copy, name subject, company, branding and matching text order`, () => {
      const record = waitlistInput({ lang });
      const email = decodedMime(type === "demo" ? backend.demoMime_(record) : backend.welcomeMime_(record), type);
      const ja = lang === "ja";
      const demo = type === "demo";
      const subject = ja ? `Tanaka様、Jin AI の${demo ? "デモにお申し込みいただきありがとうございます" : "ウェイトリストにご登録いただきました"}` :
        `Maya, ${demo ? "thanks for requesting a Jin AI demo" : "you're on the Jin AI waitlist"}`;
      const heading = ja ? (demo ? "お話しできるのを楽しみにしております" : "ウェイトリストへのご登録ありがとうございます！") :
        (demo ? "We're looking forward to meeting you" : "You're on the waitlist!");
      const salutation = ja ? "Contoso\r\nTanaka様" : "Hi Maya,";
      const home = `https://jinai.md/${ja ? "ja/" : ""}`;
      const button = ja ? "デモを申し込む" : "Request a demo";
      const privacy = ja ? "プライバシーポリシー" : "Privacy Policy";
      const unsubscribe = ja ? "配信停止をご希望の場合は、「unsubscribe」と返信してください。" :
        "To stop receiving emails, reply with 'unsubscribe'.";
      const closing = ja ? "Tanaka様にJin AIをお試しいただける日を楽しみにしております。" :
        "We look forward to having you try Jin AI, Maya!";
      const blocks = [heading, salutation, ...approvedBodies[type][lang]];
      if (!demo) blocks.push(`${button}\r\n${home}#request-demo`, closing);
      blocks.push("Yu Asano\r\nFounder, Jin AI", `jinai.md: ${home}\r\n${privacy}: ${home}privacy/`);
      if (!demo) blocks.push(unsubscribe);
      assert.equal(email.subject, subject);
      assert.equal(email.text, blocks.join("\r\n\r\n"));
      const htmlText = email.html.replace(/<\/?span\b[^>]*>/g, "").replace(/<[^>]*>/g, " ")
        .replace(/&#39;/g, "'").replace(/\s+/g, " ");
      for (const paragraph of [heading, ...approvedBodies[type][lang]]) assert.ok(htmlText.includes(paragraph), paragraph);
      const htmlBlocks = [...email.html.matchAll(/<(h1|p|a)\b[^>]*>([\s\S]*?)<\/\1>/g)]
        .map((match) => match[2].replace(/<br>/g, "\r\n").replace(/<[^>]*>/g, "").replace(/&#39;/g, "'"));
      assert.deepEqual(htmlBlocks.slice(0, 2 + approvedBodies[type][lang].length),
        [heading, salutation, ...approvedBodies[type][lang]]);
      if (!demo) assert.deepEqual(htmlBlocks.slice(2 + approvedBodies[type][lang].length,
        5 + approvedBodies[type][lang].length), [button, closing, "Yu Asano\r\nFounder, Jin AI"]);
      assert.match(email.html, new RegExp(`<html lang="${lang}">`));
      if (ja) {
        assert.ok(email.html.includes("Contoso<br>Tanaka様"));
        const headingHtml = email.html.match(/<h1\b[^>]*>(.*?)<\/h1>/)[0];
        assert.match(headingHtml, /word-break:keep-all/);
        assert.match(headingHtml, /overflow-wrap:normal/);
        const phrases = [...headingHtml.matchAll(/<span style="display:inline-block;white-space:nowrap;">([^<]+)<\/span>/g)]
          .map((match) => match[1]);
        assert.deepEqual(phrases, demo ? ["お話しできるのを", "楽しみにしております"] :
          ["ウェイトリストへの", "ご登録", "ありがとうございます！"]);
      }
      assert.match(email.html, /max-width:600px/);
      assert.match(email.html, /background:#f2f2f2/);
      assert.match(email.html, /background:#ffffff/);
      assert.match(email.html, /background:#000000/);
      assert.ok(email.html.includes('<img src="https://jinai.md/brand/jin-mark-email.png" width="136" height="40" alt="Jin AI"'));
      assert.ok(email.html.includes(`<a href="${home}privacy/"`));
      assert.equal(email.html.includes(`href="${home}#request-demo"`), !demo);
      assert.doesNotMatch(email.text + email.html, /#demo\b/);
      assert.equal(email.html.includes("background:#A84A1C"), !demo);
      assert.equal(email.text.includes("unsubscribe"), !demo);
      assert.equal(email.html.includes("unsubscribe"), !demo);
      for (const body of [email.text, email.html]) {
        assert.doesNotMatch(body, /discord|Co-founder|chat history|<script|<style|tracking|postal/i);
        assert.doesNotMatch(body, /[\u2013\u2014\u2018\u2019\u201c\u201d]/);
        assert.doesNotMatch(body, /\s様/);
        assert.doesNotMatch(body, /Thanks for joining the Jin AI waitlist|to the list\.|Jin AI keeps your company's|We're opening access in small batches|when it's your turn|Want to see it sooner|Jin AI のウェイトリストにご登録いただき、ありがとうございます。|Jin AI は、AIエージェントやスキル、ナレッジを安全に管理・蓄積し|順番にご案内を始めています|準備ができしだい/);
      }
      assert.match(email.mime, /^From: Jin AI <hello@jinai\.md>\r\nReply-To: hello@jinai\.md/);
      assert.doesNotMatch(email.mime, /\r\n(?:Bcc|Cc):/i);
    });

    test(`${type}/${lang} HTML escapes all reserved characters in inserted names and company without altering text`, () => {
      const special = '<Maya>&"\'';
      const company = '<Contoso>&"\'';
      const record = waitlistInput({ firstName: special, lastName: special, company, lang });
      const email = decodedMime(type === "demo" ? backend.demoMime_(record) : backend.welcomeMime_(record), type);
      assert.ok(email.html.includes("&lt;Maya&gt;&amp;&quot;&#39;"));
      assert.ok(email.html.includes("&lt;Contoso&gt;&amp;&quot;&#39;"));
      assert.ok(!email.html.includes(special));
      assert.ok(!email.html.includes(company));
      assert.ok(email.text.includes(special));
      assert.ok(email.text.includes(company));
      assert.ok(email.subject.startsWith(special));
      const escapedName = "&lt;Maya&gt;&amp;&quot;&#39;";
      const escapedCompany = "&lt;Contoso&gt;&amp;&quot;&#39;";
      if (lang === "ja") {
        assert.ok(email.html.includes(`${escapedCompany}<br>${escapedName}様`));
        assert.ok(email.text.includes(`${company}\r\n${special}様`));
        assert.doesNotMatch(email.html, /&#39; 様/);
        if (type === "waitlist") {
          for (const [value, name] of [[email.html, escapedName], [email.text, special]]) {
            assert.ok(value.includes(`また、${name}様のご利用環境に合わせたデモもご案内しています。ご興味がございましたら、ぜひお気軽にお申し込みください。`));
            assert.ok(value.includes(`${name}様にJin AIをお試しいただける日を楽しみにしております。`));
          }
        }
      } else {
        for (const [value, name, business, apostrophe] of [
          [email.html, escapedName, escapedCompany, "&#39;"], [email.text, special, company, "'"]
        ]) {
          assert.ok(value.includes(`Hi ${name},`));
          assert.ok(value.includes(type === "demo" ? `Thanks for requesting a Jin AI demo for ${business}.` :
            `Thanks for your interest in Jin AI! We${apostrophe}ve added ${business} to our waitlist.`));
          if (type === "waitlist") assert.ok(value.includes(`We look forward to having you try Jin AI, ${name}!`));
        }
      }
      assert.doesNotMatch(email.text, /&lt;|&gt;|&amp;|&quot;|&#39;/);
      assert.equal((email.html.match(/<img\b/g) || []).length, 1);
    });
  }
}

for (const lang of ["en", "ja"]) {
  test(`legacy ${lang} waitlist omits only the unknown company and keeps the revised wording`, () => {
    const email = decodedMime(backend.welcomeMime_(input({ lang })), "waitlist");
    const expected = lang === "ja" ? [
      "ウェイトリストへのご登録ありがとうございます！", "Example Tester様",
      ...approvedBodies.waitlist.ja.map((paragraph) => paragraph.replaceAll("Tanaka様", "Example Tester様")),
      "デモを申し込む\r\nhttps://jinai.md/ja/#request-demo",
      "Example Tester様にJin AIをお試しいただける日を楽しみにしております。",
      "Yu Asano\r\nFounder, Jin AI",
      "jinai.md: https://jinai.md/ja/\r\nプライバシーポリシー: https://jinai.md/ja/privacy/",
      "配信停止をご希望の場合は、「unsubscribe」と返信してください。"
    ] : [
      "You're on the waitlist!", "Hi Example,", "Thanks for your interest in Jin AI!",
      ...approvedBodies.waitlist.en.slice(1), "Request a demo\r\nhttps://jinai.md/#request-demo",
      "We look forward to having you try Jin AI, Example!", "Yu Asano\r\nFounder, Jin AI",
      "jinai.md: https://jinai.md/\r\nPrivacy Policy: https://jinai.md/privacy/",
      "To stop receiving emails, reply with 'unsubscribe'."
    ];
    assert.equal(email.text, expected.join("\r\n\r\n"));
    for (const body of [email.html, email.text]) {
      assert.doesNotMatch(body, /We've added|We&#39;ve added|Contoso|undefined|null|\s様/);
    }
    assert.ok(email.html.includes(lang === "ja" ? ">Example Tester様</p>" : ">Hi Example,</p>"));
  });
}

test("email copy controls retain only the R13e-approved trailing punctuation", async () => {
  for (const page of ["index.html", "how-it-works/index.html", "security/index.html", "company/index.html",
    "privacy/index.html", "accessibility/index.html"]) {
    for (const prefix of ["../", "../ja/"]) {
      const html = await readFile(new URL(prefix + page, import.meta.url), "utf8");
      const otherCopy = html.replace(/<noscript>[\s\S]*?<\/noscript>/g, "")
        .replace("</button></span>. You can also join the waitlist and then request a demo.",
          "</button></span> You can also join the waitlist and then request a demo.");
      assert.doesNotMatch(otherCopy, /class="email-contact"[\s\S]*?<\/button><\/span>\s*[.。]/,
        prefix + page);
    }
  }
});

test("subject encoding preserves long Unicode names and folds only at encoded-word boundaries", () => {
  for (const type of ["waitlist", "demo"]) {
    for (const lang of ["en", "ja"]) {
      const name = "見本😀".repeat(20);
      const record = waitlistInput({ firstName: name, lastName: name, lang });
      const email = decodedMime(type === "demo" ? backend.demoMime_(record) : backend.welcomeMime_(record), type);
      assert.ok(email.subject.startsWith(name));
      assert.doesNotMatch(email.subject, /\ufffd|[\r\n]/);
      const header = email.mime.match(/\r\nSubject: ([\s\S]*?)\r\nMessage-ID:/)[1];
      assert.ok(header.split("\r\n").every((line) => line.length <= 75));
    }
  }
});

test("CR/LF injection in either name or company is rejected by both routes and mail rendering", () => {
  for (const field of ["firstName", "lastName", "company"]) {
    for (const value of ["Value\rBcc:other@example.com", "Value\nBcc:other@example.com"]) {
      for (const lang of ["en", "ja"]) {
        for (const type of ["waitlist", "demo"]) {
          const f = fixture();
          const payload = (type === "demo" ? demoInput : waitlistInput)({ [field]: value, lang });
          const register = type === "demo" ? backend.registerDemo_ : backend.registerWaitlist_;
          assert.equal(register(payload, f.deps).registration, "not_saved");
          assert.equal(f.records.length, 0);
          assert.equal(f.sends(), 0);
          assert.throws(() => (type === "demo" ? backend.demoMime_ : backend.welcomeMime_)(payload),
            /invalid_email_content/);
        }
      }
    }
  }
  assert.throws(() => backend.emailMimeSubject_("Name\r\nBcc:other@example.com"), /invalid_email_subject/);
  assert.throws(() => backend.demoMime_(demoInput({ email: "a@example.com\r\nBcc:b@example.com" })), /invalid_email/);
  assert.throws(() => backend.welcomeMime_(input({ requestId: `${requestId}\r\nBcc:x` })), /invalid_request_id/);
});

test("setup appends the four new headers to an old sheet without moving, clearing or emailing any old row", () => {
  const oldHeaders = ["Created at", "Name", "Email", "Role", "Request ID", "Source", "Consent version",
    "Registration status", "Welcome email status", "Welcome attempts", "Last attempt at",
    "Next attempt at", "Sent at", "Gmail message ID", "Last error code"];
  assert.deepEqual(Array.from(backend.WAITLIST_COLUMNS, (column) => column[1]).slice(0, 15), oldHeaders);
  const waitlist = sheetFixture(oldHeaders.slice());
  for (const welcome of ["sent", "pending", "sending", "unknown", "failed"]) {
    const record = {
      ...input(), createdAt: "2026-09-12T02:00:00.000Z", registration: "saved", welcome,
      attempts: welcome === "pending" ? 0 : 1, messageId: welcome === "sent" ? "old-message" : ""
    };
    waitlist.rows.push(Array.from(backend.WAITLIST_COLUMNS).slice(0, 15).map(([key]) => record[key] ?? ""));
  }
  const oldData = structuredClone(waitlist.rows.slice(1));
  const tabs = new Map([["Waitlist", waitlist]]);
  const spreadsheet = {
    getSheetByName: (name) => tabs.get(name)?.sheet || null,
    insertSheet: (name) => {
      const entry = sheetFixture();
      tabs.set(name, entry);
      return entry.sheet;
    },
    getId: () => "sheet-id", getUrl: () => "https://docs.google.com/spreadsheets/d/sheet-id"
  };
  let releases = 0;
  backend.PropertiesService = { getScriptProperties: () => ({
    getProperty: () => "sheet-id", setProperty() {}
  }) };
  backend.SpreadsheetApp = { openById: () => spreadsheet, flush() {} };
  backend.LockService = { getScriptLock: () => ({
    tryLock: () => true, releaseLock: () => { releases++; }
  }) };
  backend.setupWaitlist();
  backend.setupWaitlist();
  assert.equal(releases, 2);
  assert.deepEqual(waitlist.rows[0], [...oldHeaders, "First name", "Last name", "Company", "Language"]);
  assert.deepEqual(waitlist.rows.slice(1), oldData);
  assert.equal(waitlist.sheet.getMaxColumns(), 19);
  const store = backend.sheetStore_();
  const original = store.find("requestId", requestId);
  assert.equal(original.name, "Example Tester");
  assert.equal(original.role, "Founder");
  assert.equal(original.welcome, "sent");
  assert.equal(original.company, "");
  assert.equal(store.pending(Date.now()).length, 1);
  assert.equal(store.pending(Date.now())[0].welcome, "pending");
  const email = decodedMime(backend.welcomeMime_(original), "waitlist");
  assert.equal(email.subject, "Example, you're on the Jin AI waitlist");
  const record = store.append({
    ...backend.validateSignup_(waitlistInput({ email: "new@example.com" })),
    welcome: "pending", registration: "saved"
  });
  record.welcome = "sent";
  record.messageId = "new-message";
  store.update(record);
  assert.deepEqual(waitlist.rows.slice(1, 6), oldData);
  assert.equal(waitlist.rows[6][1], "Maya Tanaka");
  assert.equal(waitlist.rows[6][3], "Head of IT");
  assert.deepEqual(waitlist.rows[6].slice(15), ["Maya", "Tanaka", "Contoso", "en"]);
  assert.equal(store.find("email", "new@example.com").messageId, "new-message");
});

test("header-based reads, writes, retries and survey lookup preserve extra columns and formulas", () => {
  for (const [name, columns] of [["Waitlist", backend.WAITLIST_COLUMNS], ["Survey", backend.SURVEY_COLUMNS]]) {
    const headers = Array.from(columns, (column) => column[1]).reverse();
    headers.splice(2, 0, "Private calculation");
    const { sheet, rows } = sheetFixture(headers);
    backend.PropertiesService = { getScriptProperties: () => ({ getProperty: () => "sheet-id" }) };
    backend.SpreadsheetApp = { openById: () => ({ getSheetByName: () => sheet }), flush() {} };
    const store = backend.sheetStore_(name, columns);
    const record = store.append({
      ...backend.validateSignup_(waitlistInput()), surveyId: SURVEY_ID, answer: "A",
      registration: "saved", welcome: "pending", attempts: 0
    });
    rows[1][2] = "=1+1";
    assert.equal(store.find("email", "example@example.com").row, 2);
    if (name === "Survey") {
      assert.equal(store.findBy("example@example.com", SURVEY_ID).answer, "A");
      record.answer = "D";
    } else {
      assert.equal(store.pending(Date.now())[0].company, "Contoso");
      record.company = "+Safe company";
      record.welcome = "sent";
    }
    store.update(record);
    assert.equal(rows[1][2], "=1+1");
    if (name === "Survey") assert.equal(store.findBy("example@example.com", SURVEY_ID).answer, "D");
    else {
      assert.equal(rows[1][headers.indexOf("Company")], "+Safe company");
      assert.equal(store.find("requestId", requestId).welcome, "sent");
      assert.equal(store.pending(Date.now()).length, 0);
    }
    assert.deepEqual(rows[0], headers);
  }
});

test("missing or duplicate required headers fail explicitly rather than writing to the wrong column", () => {
  for (const headers of [
    ["Wrong header"], [...Array.from(backend.WAITLIST_COLUMNS, (column) => column[1]), "Company"]
  ]) {
    const { sheet, rows } = sheetFixture(headers);
    const before = structuredClone(rows);
    backend.PropertiesService = { getScriptProperties: () => ({ getProperty: () => "sheet-id" }) };
    backend.SpreadsheetApp = { openById: () => ({ getSheetByName: () => sheet }) };
    const store = backend.sheetStore_();
    assert.throws(() => store.append(waitlistInput()), /storage_schema_mismatch/);
    assert.throws(() => store.append(waitlistInput()), /storage_schema_mismatch/);
    assert.deepEqual(rows, before);
  }
});

for (const [name, columns] of [
  ["Waitlist", backend.WAITLIST_COLUMNS], ["Demo requests", backend.DEMO_COLUMNS], ["Survey", backend.SURVEY_COLUMNS]
]) {
  test(`${name} reads every text column as a string, preserving dates and attempt counts`, () => {
    const headers = Array.from(columns, column => column[1]).reverse();
    headers.splice(2, 0, "Private calculation");
    const { sheet, rows } = sheetFixture(headers);
    backend.PropertiesService = { getScriptProperties: () => ({ getProperty: () => "sheet-id" }) };
    backend.SpreadsheetApp = { openById: () => ({ getSheetByName: () => sheet }), flush() {} };
    const store = backend.sheetStore_(name, columns);
    const date = vm.runInContext('new Date("2026-10-21T02:00:00Z")', backend);
    const dateKeys = ["createdAt", "answeredAt", "updatedAt", "lastAttemptAt", "nextAttemptAt", "sentAt"];
    for (const value of [1688, true, false, 0, "", null, undefined]) {
      const row = headers.map(header => {
        const key = columns.find(column => column[1] === header)?.[0];
        return dateKeys.includes(key) ? date : key === "attempts" ? 2 : value;
      });
      row[headers.indexOf("Request ID")] = "1688";
      rows[1] = row;
      const before = rows.map(cells => cells.slice());
      const record = store.find("requestId", "1688");
      for (const [key] of columns) {
        if (dateKeys.includes(key)) assert.equal(record[key], date.toISOString(), key);
        else if (key === "attempts") assert.equal(record[key], 2);
        else assert.equal(record[key], key === "requestId" ? "1688" : String(value ?? ""), key);
      }
      assert.deepEqual(rows, before, "Reading must not rewrite existing cells.");
    }
    rows[1][headers.indexOf("Request ID")] = 1688;
    assert.equal(store.find("requestId", "1688").requestId, "1688");
    rows[1][headers.indexOf("Email")] = 5551234;
    assert.equal(store.find("email", "5551234").email, "5551234");
    if (name === "Survey") {
      rows[1][headers.indexOf("Survey ID")] = 1688;
      assert.equal(store.findBy("5551234", "1688").requestId, "1688");
    }
  });
}

for (const type of ["waitlist", "demo"]) {
  for (const lang of ["en", "ja"]) {
    test(`${type}/${lang} retries coerced sheet text, composes mail and deduplicates by ID and email`, () => {
      const columns = type === "demo" ? backend.DEMO_COLUMNS : backend.WAITLIST_COLUMNS;
      const headers = Array.from(columns, column => column[1]);
      const { sheet, rows } = sheetFixture(headers);
      backend.PropertiesService = { getScriptProperties: () => ({ getProperty: () => "sheet-id" }) };
      backend.SpreadsheetApp = { openById: () => ({ getSheetByName: () => sheet }), flush() {} };
      backend.LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) };
      const f = fixture();
      f.deps.store = backend.sheetStore_(type === "demo" ? "Demo requests" : "Waitlist", columns);
      f.deps.reserveEmail = () => false;
      const payload = (type === "demo" ? demoInput : waitlistInput)({
        firstName: "1688", lastName: "0", company: "TRUE", jobTitle: "FALSE", phone: "5551234", lang
      });
      const register = type === "demo" ? backend.registerDemo_ : backend.registerWaitlist_;
      assert.equal(register(payload, f.deps).welcome, "pending");
      for (const [key, value] of [
        ["firstName", 1688], ["lastName", 0], ["company", true],
        [type === "demo" ? "jobTitle" : "role", false], ...(type === "demo" ? [["phone", 5551234]] : [])
      ]) {
        rows[1][headers.indexOf(columns.find(column => column[0] === key)[1])] = value;
      }
      assert.equal(register(payload, f.deps).welcome, "pending");
      assert.equal(rows.length, 2, "A request-ID retry must not append a duplicate.");
      if (type === "waitlist") {
        assert.equal(register({ ...payload, requestId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }, f.deps).welcome, "pending");
        assert.equal(rows.length, 2, "The same waitlist email must not append a duplicate.");
      }
      let sends = 0;
      f.deps.sender.send = record => {
        sends++;
        const email = decodedMime(type === "demo" ? backend.demoMime_(record) : backend.welcomeMime_(record), type);
        assert.ok(email.subject.startsWith(lang === "ja" ? "0様" : "1688,"));
        assert.ok(email.text.includes(lang === "ja" ? "true\r\n0様" : "Hi 1688,"));
        assert.ok(email.html.includes(lang === "ja" ? "true<br>0様" : "Hi 1688,"));
        assert.equal(record[type === "demo" ? "jobTitle" : "role"], "false");
        if (type === "demo") assert.equal(record.phone, "5551234");
        return "coerced-text-message";
      };
      f.advance(15 * 60 * 1000);
      f.deps.reserveEmail = () => true;
      backend.retryPendingEmails_(f.deps);
      assert.equal(sends, 1);
      assert.equal(register(payload, f.deps).welcome, "sent");
      backend.retryPendingEmails_(f.deps);
      assert.equal(sends, 1);
      assert.equal(rows.length, 2);
    });
  }
}

for (const [name, columns] of [
  ["Waitlist", backend.WAITLIST_COLUMNS], ["Demo requests", backend.DEMO_COLUMNS], ["Survey", backend.SURVEY_COLUMNS]
]) {
  test(`${name} escapes every text column on write without changing dates, counts or unmanaged cells`, () => {
    const headers = Array.from(columns, column => column[1]).reverse();
    headers.splice(2, 0, "Private calculation");
    const { sheet, rows, writes } = sheetFixture(headers);
    backend.PropertiesService = { getScriptProperties: () => ({ getProperty: () => "sheet-id" }) };
    backend.SpreadsheetApp = { openById: () => ({ getSheetByName: () => sheet }), flush() {} };
    const store = backend.sheetStore_(name, columns);
    const historical = headers.map(() => "Historical value");
    rows.push(historical.slice());
    for (const value of ["09012345678", "007", "10-4", "3/4", "TRUE", "=1+1", "+123456", "-1", "@name", "'literal", "", 7, false]) {
      const record = Object.fromEntries(Array.from(columns, ([key]) => [
        key, key === "attempts" ? 2 : /At$/.test(key) ? "2026-10-21T02:00:00.000Z" : value
      ]));
      record.requestId = requestId;
      store.append(record);
      rows[record.row - 1][2] = "=1+1";
      writes.length = 0;
      store.update(record);
      const saved = store.find("requestId", requestId);
      for (const [key, header] of columns) {
        const written = writes.find(cell => cell.column === headers.indexOf(header) + 1);
        const text = key !== "attempts" && !/At$/.test(key);
        assert.equal(written.value, text ? "'" + String(record[key]) : record[key], key);
        assert.equal(saved[key], text ? String(record[key]) : record[key], key);
      }
      assert.equal(rows[record.row - 1][2], "=1+1");
      assert.ok(writes.every(cell => cell.column !== 3 && cell.row === record.row));
      assert.deepEqual(rows[1], historical, "No historical row may be rewritten.");
      rows.pop();
    }
  });
}

for (const type of ["waitlist", "demo"]) {
  for (const lang of ["en", "ja"]) {
    test(`${type}/${lang} reads exact text back for retries and both email alternatives and subject`, () => {
      const columns = type === "demo" ? backend.DEMO_COLUMNS : backend.WAITLIST_COLUMNS;
      const headers = Array.from(columns, column => column[1]);
      const { sheet, rows, writes } = sheetFixture(headers);
      backend.PropertiesService = { getScriptProperties: () => ({ getProperty: () => "sheet-id" }) };
      backend.SpreadsheetApp = { openById: () => ({ getSheetByName: () => sheet }), flush() {} };
      backend.LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) };
      const f = fixture();
      f.deps.store = backend.sheetStore_(type === "demo" ? "Demo requests" : "Waitlist", columns);
      const register = type === "demo" ? backend.registerDemo_ : backend.registerWaitlist_;
      for (const company of ["007", "TRUE", "<007 & TRUE>", "'literal", "=1+1"]) {
        rows.splice(1);
        writes.length = 0;
        f.deps.reserveEmail = () => false;
        const payload = (type === "demo" ? demoInput : waitlistInput)({
          firstName: "10-4", lastName: "3/4", company, phone: "09012345678", lang
        });
        assert.equal(register(payload, f.deps).welcome, "pending");
        const saved = f.deps.store.find("requestId", requestId);
        for (const key of ["firstName", "lastName", "company", ...(type === "demo" ? ["phone"] : [])]) {
          const column = columns.findIndex(([name]) => name === key) + 1;
          assert.equal(writes.find(cell => cell.column === column).value, "'" + payload[key], key);
          assert.equal(saved[key], payload[key], key);
        }
        let sends = 0;
        f.deps.sender.send = record => {
          sends++;
          if (type === "demo") assert.equal(record.phone, "09012345678");
          const mail = decodedMime(type === "demo" ? backend.demoMime_(record) : backend.welcomeMime_(record), type);
          assert.equal(mail.subject, lang === "ja" ?
            "3/4" + (type === "demo" ? "様、Jin AI のデモにお申し込みいただきありがとうございます" :
              "様、Jin AI のウェイトリストにご登録いただきました") :
            "10-4" + (type === "demo" ? ", thanks for requesting a Jin AI demo" : ", you're on the Jin AI waitlist"));
          for (const [content, escaped] of [[mail.text, false], [mail.html, true]]) {
            assert.ok(content.includes(lang === "ja" ? "3/4様" : "Hi 10-4,"));
            assert.ok(content.includes(escaped ? backend.escapeEmailHtml_(company) : company));
          }
          assert.doesNotMatch(mail.html, /<007/);
          return "text-preserved-message";
        };
        f.advance(15 * 60 * 1000);
        f.deps.reserveEmail = () => true;
        backend.retryPendingEmails_(f.deps);
        assert.equal(register(payload, f.deps).welcome, "sent");
        backend.retryPendingEmails_(f.deps);
        assert.equal(sends, 1);
        assert.equal(f.deps.store.find("requestId", requestId).company, company);
      }
    });
  }
}

test("Japanese waitlist retries keep the saved company, surname, language and one-mail guarantee", () => {
  const f = fixture();
  f.deps.reserveEmail = () => false;
  assert.equal(backend.registerWaitlist_(waitlistInput({ lang: "ja" }), f.deps).welcome, "pending");
  f.advance(15 * 60 * 1000);
  f.deps.reserveEmail = () => true;
  const send = f.deps.sender.send;
  f.deps.sender.send = (record) => {
    const email = decodedMime(backend.welcomeMime_(record), "waitlist");
    assert.match(email.text, /Contoso\r\nTanaka様/);
    assert.equal(email.subject, "Tanaka様、Jin AI のウェイトリストにご登録いただきました");
    return send(record);
  };
  backend.retryPendingEmails_(f.deps);
  backend.retryPendingEmails_(f.deps);
  assert.equal(f.sends(), 1);
  assert.equal(f.records[0].welcome, "sent");
  assert.equal(f.records[0].lang, "ja");
});

test("production waitlist then demo stores separate intents and sends both branded emails exactly once", () => {
  const tabs = new Map([
    ["Waitlist", sheetFixture(Array.from(backend.WAITLIST_COLUMNS, (column) => column[1]))],
    ["Demo requests", sheetFixture(Array.from(backend.DEMO_COLUMNS, (column) => column[1]))]
  ]);
  const properties = {};
  const messages = [];
  backend.PropertiesService = { getScriptProperties: () => ({
    getProperty: (key) => key === "SPREADSHEET_ID" ? "sheet-id" : properties[key],
    setProperties: (values) => Object.assign(properties, values)
  }) };
  backend.LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) };
  backend.SpreadsheetApp = {
    openById: () => ({ getSheetByName: (name) => {
      assert.ok(tabs.has(name), "Waitlist and demo must not create survey rows.");
      return tabs.get(name).sheet;
    } }),
    flush() {}
  };
  backend.Gmail = { Users: {
    Settings: { SendAs: { list: () => ({ sendAs: [
      { sendAsEmail: "hello@jinai.md", verificationStatus: "accepted" }
    ] }) } },
    Messages: { send: ({ raw }) => {
      messages.push(raw);
      return { id: `mock-message-${messages.length}` };
    } }
  } };
  backend.ContentService = {
    MimeType: { JSON: "json" },
    createTextOutput: (body) => ({ setMimeType: () => ({ body }) })
  };
  try {
    const waitlist = waitlistInput({
      type: "waitlist", firstName: "=Maya", lastName: "+Tanaka", jobTitle: "-Head of IT",
      company: "@Contoso", lang: "ja"
    });
    const demo = demoInput({
      requestId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      firstName: "Maya", lastName: "Tanaka", company: "Contoso", lang: "ja"
    });
    const post = (payload) => JSON.parse(backend.doPost({
      postData: { contents: JSON.stringify(payload) }
    }).body);
    for (const payload of [waitlist, waitlist, demo, demo]) assert.equal(post(payload).welcome, "sent");
    assert.equal(tabs.get("Waitlist").rows.length, 2);
    assert.equal(tabs.get("Demo requests").rows.length, 2);
    assert.equal(messages.length, 2);
    assert.equal(decodedMime(messages[0], "waitlist").subject,
      "+Tanaka様、Jin AI のウェイトリストにご登録いただきました");
    assert.equal(decodedMime(messages[1], "demo").subject,
      "Tanaka様、Jin AI のデモにお申し込みいただきありがとうございます");
    assert.equal(properties.EMAIL_COUNT, "2", "Both queues share the existing attempt limit.");
    const headers = tabs.get("Waitlist").rows[0];
    const saved = tabs.get("Waitlist").rows[1];
    for (const [header, value] of [
      ["Name", "=Maya +Tanaka"], ["Role", "-Head of IT"], ["First name", "=Maya"],
      ["Last name", "+Tanaka"], ["Company", "@Contoso"], ["Language", "ja"],
      ["Welcome email status", "sent"], ["Welcome attempts", 1], ["Gmail message ID", "mock-message-1"]
    ]) assert.equal(saved[headers.indexOf(header)], value, header);
  } finally {
    for (const key of ["PropertiesService", "LockService", "SpreadsheetApp", "Gmail", "ContentService"]) {
      delete backend[key];
    }
  }
});

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
  const html = backend.welcomeHtml_(waitlistInput({ firstName: "<img/src=x/onerror=alert(1)>" }));
  assert.ok(html.includes("&lt;img/src=x/onerror=alert(1)&gt;"));
  assert.equal((html.match(/<img\b/g) || []).length, 1, "Only the fixed brand image is permitted.");
});

test("the legacy welcome MIME has the real From, approved copy and no community promotion", () => {
  const encoded = backend.welcomeMime_(input({ name: "Yu Asano" }));
  const mime = Buffer.from(encoded, "base64url").toString("utf8");
  assert.ok(mime.startsWith("From: Jin AI <hello@jinai.md>\r\n"));
  assert.ok(mime.includes("\r\nReply-To: hello@jinai.md\r\n"));
  assert.ok(mime.includes("Content-Type: multipart/alternative;"));
  const parts = [...mime.matchAll(/Content-Transfer-Encoding: base64\r\n\r\n([\s\S]*?)\r\n--jin-waitlist-/g)];
  assert.equal(parts.length, 2);
  for (const part of parts) {
    const body = Buffer.from(part[1].replace(/\s/g, ""), "base64").toString("utf8");
    assert.doesNotMatch(body, /discord/i);
    assert.ok(body.includes("Hi Yu,"));
    assert.ok(body.includes("Jin AI helps companies keep their AI agents, skills, and knowledge secure, shared across teams, and always up to date."));
    assert.ok(body.includes("We look forward to having you try Jin AI, Yu!"));
    assert.ok(!body.includes("No newsletter"));
    assert.ok(!/visual workspace|created by AI agents|chat history|Co-founder/.test(body),
      "Retired positioning and signature must not reach new signups.");
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
    getLastColumn: () => headers.length,
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
  assert.equal(rows[1][0], "+today");
  assert.equal(rows[1][2], "=formula");
  assert.equal(rows[1][5], "@formula");
  assert.equal(rows[1][6], "-today");
  store.append({ ...record, surveyId: "second-survey" });
  assert.equal(store.findBy("example@example.com", SURVEY_ID).row, 2);
  assert.equal(store.findBy("example@example.com", "second-survey").row, 3);
  assert.equal(store.findBy("someone@example.com", SURVEY_ID), null);
  record.answerLabel = "=updated";
  store.update(record);
  assert.equal(rows[1][5], "=updated");
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
  backend.LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) };
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
  assert.equal(describeResult(response()).heading, "Your demo request is saved");
  for (const welcome of ["pending", "failed", "unknown"]) {
    const description = describeResult(response("saved", welcome));
    assert.equal(description.heading, "Your demo request is saved");
    assert.ok(describeResult(response("saved", welcome), "ja").heading.endsWith("\u3002"));
    assert.equal(description.saved, true);
    assert.equal(description.registration, "Saved");
    assert.notEqual(description.welcome, "Sent");
    assert.ok(description.detail.includes("do not need to submit again"));
    assert.ok(description.detail.includes("still reply"));
  }
  assert.equal(describeResult(response("not_saved", "not_attempted")).saved, false);
  assert.equal(describeResult(response("not_saved", "not_attempted")).heading, "Your request was not saved");
  assert.equal(describeResult(response("unknown", "not_attempted")).heading, "Your request is not confirmed");
  for (const state of ["not_saved", "unknown"]) {
    assert.ok(describeResult(response(state, "not_attempted"), "ja").heading.endsWith("\u3002"));
  }
  assert.equal(describeResult(response("unknown", "not_attempted")).registration, "Not confirmed");
});

for (const language of ["en", "ja"]) {
  test(`every waitlist-step error is demo-free in ${language} with approved busy and refresh wording`, () => {
    const codes = [
      "invalid_name", "invalid_email", "invalid_role", "invalid_first_name", "invalid_last_name",
      "invalid_job_title", "invalid_phone", "invalid_company", "invalid_industry", "invalid_company_size",
      "invalid_country", "invalid_consent", "invalid_input", "invalid_source", "invalid_request",
      "invalid_request_id", "request_conflict", "busy", "storage_error", "storage_not_configured",
      "storage_schema_mismatch", null, "unexpected_code"
    ];
    for (const code of codes) {
      for (const state of ["not_saved", "unknown"]) {
        const result = describeResult(response(state, "not_attempted", code), language, "waitlist");
        assert.equal(result.saved, false);
        for (const value of Object.values(result)) {
          if (typeof value === "string") assert.doesNotMatch(value, /demo|デモ/i, String(code));
        }
        if (["busy", "storage_error", "storage_not_configured", "storage_schema_mismatch"].includes(code)) {
          assert.equal(result.detail, language === "ja" ?
            "ただいまご登録を保存できませんでした。少し待ってから、もう一度お試しください。" :
            "We couldn't save your signup right now. Please try again in a moment.");
        }
        if (["invalid_consent", "invalid_source", "invalid_request", "invalid_request_id", "request_conflict"].includes(code)) {
          assert.equal(result.detail, language === "ja" ?
            "ページを再読み込みして、もう一度お試しください。" : "Please refresh the page and try again.");
        }
      }
    }
  });
}

test("demo-step busy, consent and source errors keep their original bilingual wording", () => {
  for (const [code, english, japanese] of [
    ["busy", "Demo requests are busy right now. Please try again in a moment.",
      "ただいまお申し込みが混み合っています。少し待ってから、もう一度お試しください。"],
    ["invalid_consent", "Please refresh the page before requesting a demo.",
      "ページを再読み込みしてから、デモをお申し込みください。"],
    ["invalid_source", "Please request a demo from jinai.md or email hello@jinai.md.",
      "jinai.md からお申し込みいただくか、hello@jinai.md までご連絡ください。"]
  ]) {
    assert.equal(describeResult(response("not_saved", "not_attempted", code)).detail, english);
    assert.equal(describeResult(response("not_saved", "not_attempted", code), "ja").detail, japanese);
  }
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

test("a Japanese demo stores ja and sends one UTF-8 email with an encoded subject and surname greeting", () => {
  const f = fixture();
  const payload = demoInput({ lang: "ja", firstName: "Aoi", lastName: "見本" });
  const send = f.deps.sender.send;
  let mime;
  f.deps.sender.send = (record) => {
    mime = Buffer.from(backend.demoMime_(record), "base64url").toString("utf8");
    return send(record);
  };
  assert.equal(backend.registerDemo_(payload, f.deps).welcome, "sent");
  assert.equal(f.records[0].lang, "ja");
  assert.equal(backend.registerDemo_(payload, f.deps).welcome, "sent");
  assert.equal(f.records.length, 1);
  assert.equal(f.sends(), 1);
  assert.equal(f.surveyRecords.length, 0);
  assert.match(mime, /^From: Jin AI <hello@jinai\.md>\r\nReply-To: hello@jinai\.md/);
  const subject = mime.match(/\r\nSubject: ([\s\S]*?)\r\nMessage-ID:/)?.[1];
  assert.ok(subject);
  assert.match(subject, /^=\?UTF-8\?B\?/);
  const words = [...subject.matchAll(/=\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=/g)];
  assert.ok(words.length >= 2, "The Japanese subject needs folded RFC 2047 words.");
  assert.ok(words.every((word) => word[0].length <= 75));
  assert.equal(subject, words.map((word) => word[0]).join("\r\n "));
  assert.equal(words.map((word) => Buffer.from(word[1], "base64").toString("utf8")).join(""),
    "見本様、Jin AI のデモにお申し込みいただきありがとうございます");
  assert.equal((mime.match(/Content-Type: text\/(?:plain|html); charset=UTF-8/g) || []).length, 2);
  const parts = [...mime.matchAll(/Content-Transfer-Encoding: base64\r\n\r\n([\s\S]*?)\r\n--jin-demo-/g)];
  assert.equal(parts.length, 2);
  const [text, html] = parts.map((part) =>
    Buffer.from(part[1].replace(/\s/g, ""), "base64").toString("utf8"));
  assert.equal(text, [
    "お話しできるのを楽しみにしております", "",
    "Example Company", "見本様", "",
    "Jin AI のデモにお申し込みいただき、ありがとうございます。",
    "",
    "日程の調整のため、こちらからメールでご連絡します。デモで特に見たいことがあれば、このメールにそのまま返信してください。",
    "", "Yu Asano", "Founder, Jin AI", "",
    "jinai.md: https://jinai.md/ja/",
    "プライバシーポリシー: https://jinai.md/ja/privacy/"
  ].join("\r\n"));
  assert.match(html, /<html lang="ja">/);
  for (const line of text.split("\r\n").filter((line) => line && !line.includes("https://"))) {
    assert.ok(html.replace(/<[^>]+>/g, "").includes(line), line);
  }
  for (const url of ["https://jinai.md/ja/", "https://jinai.md/ja/privacy/"]) {
    assert.ok(html.includes(`<a href="${url}"`));
  }
  for (const body of [text, html]) assert.doesNotMatch(body, /Aoi|Hi |Discord|marketing|waitlist/i);
  const escaped = backend.demoHtml_(demoInput({ lastName: '<img src=x> & "\'Sample', lang: "ja" }));
  assert.ok(escaped.includes("&lt;img src=x&gt; &amp; &quot;&#39;Sample様"));
  assert.equal((escaped.match(/<img\b/g) || []).length, 1);
});

for (const lang of ["en", undefined]) {
  test(`a demo with ${lang === undefined ? "missing" : "en"} lang stores en and sends the approved English email`, () => {
    const f = fixture();
    const payload = demoInput(lang === undefined ? {} : { lang });
    const send = f.deps.sender.send;
    let mime;
    f.deps.sender.send = (record) => {
      mime = backend.demoMime_(record);
      return send(record);
    };
    assert.equal(backend.registerDemo_(payload, f.deps).welcome, "sent");
    assert.equal(f.records[0].lang, "en");
    assert.equal(f.sends(), 1);
    assert.equal(mime, backend.demoMime_(demoInput()));
    assert.equal(decodedMime(mime, "demo").subject, "Alex, thanks for requesting a Jin AI demo");
  });
}

test("invalid demo languages are rejected before storage or sending", () => {
  for (const lang of ["fr", "ja-JP", "JA", " en", "ja ", "", null, 0, true, [], {}]) {
    const f = fixture();
    f.deps.store.withLock = () => assert.fail("Invalid language must not reach storage.");
    const result = backend.registerDemo_(demoInput({ lang }), f.deps);
    assert.equal(result.code, "invalid_input", JSON.stringify(lang));
    assert.equal(result.registration, "not_saved");
    assert.equal(result.welcome, "not_attempted");
    assert.equal(f.records.length, 0);
    assert.equal(f.surveyRecords.length, 0);
    assert.equal(f.sends(), 0);
    assert.deepEqual(f.log, [["validation", requestId, "invalid_input"]]);
  }
});

test("scheduled demo retries use the stored Japanese language", () => {
  const f = fixture();
  f.deps.reserveEmail = () => false;
  assert.equal(backend.registerDemo_(demoInput({ lang: "ja" }), f.deps).welcome, "pending");
  assert.equal(f.records[0].lang, "ja");
  assert.equal(f.sends(), 0);
  const send = f.deps.sender.send;
  let mime;
  f.deps.sender.send = (record) => {
    mime = Buffer.from(backend.demoMime_(record), "base64url").toString("utf8");
    return send(record);
  };
  f.advance(15 * 60 * 1000);
  f.deps.reserveEmail = () => true;
  backend.retryPendingEmails_(f.deps);
  assert.equal(f.records[0].welcome, "sent");
  assert.equal(f.records[0].lang, "ja");
  assert.match(mime, /\r\nSubject: =\?UTF-8\?B\?/);
  assert.equal(f.sends(), 1);
  backend.retryPendingEmails_(f.deps);
  assert.equal(f.sends(), 1);
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
  ["phone", "invalid_phone", ["", "   ", undefined, 123, "x".repeat(41), "+1/202", "+1\n202", "Call me", "+1\u0000202", "12345", "+ ( ) . -"]],
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

test("demo accepts boundary lengths, trims names, and rejects an empty phone", () => {
  assert.throws(() => backend.validateDemo_(demoInput({ phone: "" })), { code: "invalid_phone" });
  const payload = backend.validateDemo_(demoInput({
    firstName: "  " + "a".repeat(80) + " ", lastName: "b".repeat(80),
    jobTitle: "c".repeat(120), company: "d".repeat(160), country: "e".repeat(80), phone: "1".repeat(40)
  }));
  assert.equal(payload.firstName.length, 80);
  assert.equal(payload.phone.length, 40);
  assert.equal(backend.validateDemo_(demoInput({ phone: "  123456  " })).phone, "123456");
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
  assert.equal(decodedMime(backend.demoMime_(demoInput()), "demo").subject,
    "Alex, thanks for requesting a Jin AI demo");
  const parts = [...mime.matchAll(/Content-Transfer-Encoding: base64\r\n\r\n([\s\S]*?)\r\n--jin-demo-/g)];
  assert.equal(parts.length, 2);
  for (const part of parts) {
    const body = Buffer.from(part[1].replace(/\s/g, ""), "base64").toString("utf8");
    assert.ok(body.includes("Hi Alex,"));
    assert.ok(body.includes("Thanks for requesting a Jin AI demo for Example Company."));
    assert.ok(body.includes("email you to find a time."));
    assert.ok(body.includes("just reply to this email."));
    assert.doesNotMatch(body, /Discord|marketing|product updates|waitlist/i);
    for (const url of body.match(/https:\/\/[^"<\s]+/g) || []) {
      assert.ok(["https://jinai.md/", "https://jinai.md/privacy/",
        "https://jinai.md/brand/jin-mark-email.png"].includes(url));
    }
  }
  const escaped = backend.demoHtml_(demoInput({ firstName: "<img src=x>" }));
  assert.match(escaped, /Hi &lt;img src=x&gt;,/);
  assert.equal((escaped.match(/<img\b/g) || []).length, 1);
});

test("production demo routing uses only Demo requests and the demo MIME", () => {
  const columns = Array.from(backend.DEMO_COLUMNS, (column) => Array.from(column));
  const { sheet, rows } = sheetFixture(columns.map((column) => column[1]));
  let locks = 0;
  let releases = 0;
  let sends = 0;
  const messages = [];
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
      messages.push(Buffer.from(raw, "base64url").toString("utf8"));
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
    assert.equal(decodedMime(backend.demoMime_(payload), "demo").subject,
      "=1+1, thanks for requesting a Jin AI demo");
    for (const field of ["firstName", "lastName", "jobTitle", "phone", "company", "country"]) {
      const index = columns.findIndex(([key]) => key === field);
      assert.equal(rows[1][index], payload[field], field);
    }
    assert.equal(rows[1][columns.findIndex(([key]) => key === "welcome")], "sent");
    const languageIndex = columns.findIndex(([key]) => key === "lang");
    assert.equal(languageIndex, columns.findIndex(([key]) => key === "country") + 1);
    assert.equal(columns[languageIndex][1], "Language");
    assert.equal(rows[1][languageIndex], "en");
    const japanesePayload = demoInput({
      requestId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      lang: "ja", firstName: "Aoi", lastName: "見本", country: "Japan"
    });
    const japanesePost = () => JSON.parse(backend.doPost({
      postData: { contents: JSON.stringify(japanesePayload) }
    }).body);
    assert.equal(japanesePost().welcome, "sent");
    assert.equal(japanesePost().welcome, "sent");
    assert.equal(rows.length, 3);
    assert.equal(rows[2][languageIndex], "ja");
    assert.equal(rows[2][columns.findIndex(([key]) => key === "lastName")], "見本");
    assert.equal(rows[2][columns.findIndex(([key]) => key === "welcome")], "sent");
    assert.equal(sends, 2);
    assert.equal(locks, 4);
    assert.equal(releases, 4);
    assert.equal(messages[1], Buffer.from(backend.demoMime_(japanesePayload), "base64url").toString("utf8"));
    assert.equal(backend.WAITLIST_VERSION, "2026-10-21.1");
  } finally {
    for (const key of ["PropertiesService", "LockService", "SpreadsheetApp", "Gmail", "ContentService"]) {
      delete backend[key];
    }
  }
});

async function clientFixture(t, fetchImpl, configured = true, language, flow = "demo", hash = "") {
  const html = await readFile(new URL(
    language?.startsWith("ja") ? "../ja/index.html" : "../index.html", import.meta.url), "utf8");
  const formHtml = html.match(/<form\b[^>]*\bid="waitlistForm"[^>]*>[\s\S]*?<\/form>/)[0];
  const elements = new Map();
  const controls = new Map();
  const listeners = new Map();
  const errorLogs = [];
  const document = {
    documentElement: { lang: language },
    defaultView: {
      location: { hash },
      addEventListener: (name, listener) => listeners.set(`window:${name}`, listener)
    },
    getElementById: (id) => elements.get(id), activeElement: null
  };
  function element(id, attributes = {}) {
    const node = {
      id, hidden: false, textContent: "", dataset: {}, value: "", ...attributes,
      getAttribute: (name) => attributes[name] ?? null,
      setAttribute: (name, value) => { attributes[name] = value; },
      removeAttribute: (name) => { delete attributes[name]; },
      addEventListener: (name, listener) => listeners.set(id === "waitlistForm" ? name : `${id}:${name}`, listener),
      focus() { document.activeElement = node; },
      scrollIntoView() {}
    };
    elements.set(id, node);
    return node;
  }
  document.body = element("body");
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
  const button = element("submit", {
    textContent: flow === "waitlist" ? (language === "ja" ? "ウェイトリストに登録" : "Join the waitlist") :
      (language === "ja" ? "デモを申し込む" : "Request a demo"), disabled: true
  });
  const form = element("waitlistForm", {
    dataset: { endpoint: configured ? endpoint : "", flow },
    querySelector: (selector) => selector === 'button[type="submit"]' ? button :
      controls.get(selector.match(/name="([^"]+)"/)?.[1]),
    addEventListener: (name, listener) => listeners.set(name, listener)
  });
  for (const id of ["waitlistStatus", "waitlistDone", "waitlistHeading",
    "waitlistRegistration", "waitlistEmail", "waitlistDetail"]) {
    assert.ok(html.includes(`id="${id}"`));
    element(id, { hidden: id === "waitlistStatus" || id === "waitlistDone" });
  }
  element("demoFields", { hidden: flow === "waitlist", disabled: flow === "waitlist" });
  element("demoOffer", { hidden: true });
  element("openDemo", { textContent: language === "ja" ? "デモを申し込む" : "Request a demo" });
  for (const id of ["waitlistNote", "demoNote"]) {
    const note = formHtml.match(new RegExp(`<p class="waitnote" id="${id}"( hidden)?>([^<]+)<\\/p>`));
    assert.ok(note, `Missing generated ${id}.`);
    element(id, { hidden: Boolean(note[1]), textContent: note[2] });
  }
  t.mock.method(globalThis, "FormData", function MockFormData() {
    this.get = (name) => elements.get("demoFields").disabled &&
      ["phone", "industry", "companySize", "country"].includes(name) ? null : controls.get(name)?.value ?? null;
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
    openDemo: () => listeners.get("openDemo:click")(),
    setHash(value) {
      document.defaultView.location.hash = value;
      listeners.get("window:hashchange")?.();
    },
    input: (name) => listeners.get("input")({ target: controls.get(name) })
  };
}

for (const language of ["en", "ja"]) {
  for (const entry of ["initial", "hashchange", "after-signup"]) {
    test(`${entry} demo in ${language} replaces the waitlist note and retains it through validation and transport failure`, async (t) => {
      let rejectDemo = true;
      const f = await clientFixture(t, async (_url, options) => {
        const payload = JSON.parse(options.body);
        if (payload.type === "demo" && rejectDemo) throw new Error("Local transport failure");
        return { ok: true, json: async () => ({ ...response(), requestId: payload.requestId }) };
      }, true, language, "waitlist", entry === "initial" ? "#request-demo" : "#waitlist");
      const waitlistNote = f.elements.get("waitlistNote");
      const demoNote = f.elements.get("demoNote");
      assert.equal(waitlistNote.textContent, language === "ja" ?
        "ご案内の準備ができしだい、メールでお知らせします。登録後、デモもお申し込みいただけます。" :
        "We'll email you when access is ready. You can request a demo after joining.");
      assert.equal(demoNote.textContent, language === "ja" ?
        "日程の調整のため、こちらからメールでご連絡します。" : "We'll email you to find a time.");
      if (entry !== "initial") {
        assert.equal(waitlistNote.hidden, false);
        assert.equal(demoNote.hidden, true);
        await f.submit();
        assert.equal(waitlistNote.hidden, false, "Waitlist validation keeps the access-update note.");
        if (entry === "after-signup") {
          f.fill();
          await f.submit();
          assert.equal(f.form.hidden, true);
          f.openDemo();
        } else f.setHash("#request-demo");
      }
      assert.equal(waitlistNote.hidden, true);
      assert.equal(demoNote.hidden, false);
      f.controls.get("phone").value = "";
      await f.submit();
      assert.equal(f.controls.get("phone").getAttribute("aria-invalid"), "true");
      assert.equal(demoNote.hidden, false);
      f.fill();
      await f.submit();
      assert.equal(f.form.hidden, false);
      assert.equal(f.elements.get("waitlistStatus").dataset.kind, "error");
      assert.equal(waitlistNote.hidden, true);
      assert.equal(demoNote.hidden, false);
      rejectDemo = false;
      await f.submit();
      assert.equal(f.form.hidden, true, "Demo success hides both notes with the form.");
    });
  }
  for (const entry of ["initial", "hashchange"]) {
    test(`direct demo ${entry} in ${language} shows all fields and sends only one validated demo and confirmation`, async (t) => {
      const fBackend = fixture();
      let requests = 0;
      const f = await clientFixture(t, async (_url, options) => {
        const payload = JSON.parse(options.body);
        requests++;
        assert.equal(payload.type, "demo");
        assert.equal(payload.lang, language);
        assert.equal(payload.consentVersion, CONSENT_VERSION);
        assert.equal(Object.keys(backend.validateDemo_(payload)).length, 13);
        return { ok: true, json: async () => backend.registerDemo_(payload, fBackend.deps) };
      }, true, language, "waitlist", entry === "initial" ? "#request-demo" : "#demo");
      if (entry === "hashchange") {
        assert.equal(f.elements.get("demoFields").hidden, true);
        f.controls.get("company").value = "Already entered";
        f.setHash("#request-demo");
        assert.equal(f.controls.get("company").value, "Already entered");
        f.controls.get("company").value = "";
      }
      assert.equal(f.elements.get("demoFields").hidden, false);
      assert.equal(f.elements.get("demoFields").disabled, false);
      assert.equal(f.elements.get("demoOffer").hidden, true);
      assert.equal(f.button.textContent, f.elements.get("openDemo").textContent);
      if (entry === "hashchange") {
        assert.equal(f.document.activeElement.id, language === "ja" ? "demo-lastName" : "demo-firstName");
      } else assert.equal(f.document.activeElement, null, "Initial navigation retains native fragment focus.");
      await f.submit();
      assert.equal(requests, 0);
      for (const [name, control] of f.controls) {
        if (name !== "website") assert.equal(control.getAttribute("aria-invalid"), "true", name);
      }
      f.fill();
      await f.submit();
      assert.equal(requests, 1);
      assert.equal(fBackend.records.length, 1);
      assert.equal(fBackend.sends(), 1);
      assert.equal(f.form.hidden, true);
      assert.equal(f.elements.get("demoOffer").hidden, true);
      assert.equal(f.elements.get("waitlistHeading").textContent, describeResult(response(), language).heading);
      assert.equal(f.document.activeElement.id, "waitlistDone");
      f.setHash("#demo");
      f.setHash("#request-demo");
      assert.equal(f.form.hidden, true, "Hash navigation must not reopen a completed demo.");
      assert.equal(requests, 1);
    });
  }
}

for (const hash of ["", "#demo", "#waitlist"]) {
  test(`${JSON.stringify(hash)} still enters the waitlist step`, async (t) => {
    const f = await clientFixture(t, async (_url, options) => {
      const payload = JSON.parse(options.body);
      assert.equal(payload.type, "waitlist");
      assert.equal(payload.consentVersion, WAITLIST_CONSENT_VERSION);
      return { ok: true, json: async () => ({ ...response(), requestId: payload.requestId }) };
    }, true, "en", "waitlist", hash);
    assert.equal(f.elements.get("demoFields").disabled, true);
    assert.equal(f.elements.get("demoFields").hidden, true);
    f.fill();
    await f.submit();
    assert.equal(f.elements.get("demoOffer").hidden, false);
  });
}

for (const language of ["en", "ja"]) {
  for (const hash of ["#demo", "#waitlist"]) {
    test(`unsaved direct demo returns to ${hash} in ${language}, preserves values and reopens as a demo`, async (t) => {
      const requests = [];
      const f = await clientFixture(t, async (_url, options) => {
        const payload = JSON.parse(options.body);
        requests.push(payload);
        return { ok: true, json: async () => ({ ...response(), requestId: payload.requestId }) };
      }, true, language, "waitlist", "#request-demo");
      f.fill();
      f.controls.get("phone").value = "";
      await f.submit();
      assert.equal(f.controls.get("phone").getAttribute("aria-invalid"), "true");
      f.setHash(hash);
      assert.equal(f.elements.get("demoFields").hidden, true);
      assert.equal(f.elements.get("demoFields").disabled, true);
      assert.equal(f.elements.get("waitlistNote").hidden, false);
      assert.equal(f.elements.get("demoNote").hidden, true);
      assert.equal(f.elements.get("waitlistDone").hidden, true);
      assert.equal(f.elements.get("waitlistStatus").hidden, true);
      assert.equal(f.controls.get("phone").getAttribute("aria-invalid"), null);
      assert.equal(f.button.textContent, language === "ja" ? "ウェイトリストに登録" : "Join the waitlist");
      for (const name of WAITLIST_FIELDS) assert.equal(f.controls.get(name).value, demoInput()[name]);
      f.setHash("#request-demo");
      assert.equal(f.elements.get("demoFields").disabled, false);
      assert.equal(f.elements.get("demoNote").hidden, false);
      f.setHash(hash);
      await f.submit();
      assert.equal(requests.length, 1);
      assert.equal(requests[0].type, "waitlist");
      assert.equal(requests[0].consentVersion, WAITLIST_CONSENT_VERSION);
      const heading = f.elements.get("waitlistHeading").textContent;
      f.setHash(hash === "#demo" ? "#waitlist" : "#demo");
      assert.equal(f.form.hidden, true);
      assert.equal(f.elements.get("waitlistHeading").textContent, heading);
    });
  }
  for (const type of ["waitlist", "demo"]) {
    test(`a saved ${type} result survives waitlist anchors in ${language}`, async (t) => {
      const f = await clientFixture(t, async (_url, options) => ({
        ok: true, json: async () => ({ ...response(), requestId: JSON.parse(options.body).requestId })
      }), true, language, "waitlist", type === "demo" ? "#request-demo" : "#waitlist");
      f.fill();
      await f.submit();
      const heading = f.elements.get("waitlistHeading").textContent;
      for (const hash of ["#demo", "#waitlist", ...(type === "demo" ? ["#request-demo"] : [])]) {
        f.setHash(hash);
        assert.equal(f.form.hidden, true);
        assert.equal(f.elements.get("waitlistDone").hidden, false);
        assert.equal(f.elements.get("waitlistHeading").textContent, heading);
      }
    });
  }
  test(`an unavailable waitlist uses the approved signup notice when switching steps in ${language}`, async (t) => {
    const f = await clientFixture(t, async () => assert.fail("No live request"), false, language, "waitlist");
    const notice = language === "ja" ?
      "ただいまフォームからのご登録を受け付けていません。hello@jinai.md までご連絡ください。" :
      "Signups are temporarily unavailable. Please email hello@jinai.md.";
    assert.equal(f.elements.get("waitlistStatus").textContent, notice);
    f.setHash("#request-demo");
    assert.equal(f.elements.get("waitlistStatus").textContent, language === "ja" ?
      "ただいまフォームからのお申し込みを受け付けていません。hello@jinai.md までご連絡ください。" :
      "Demo requests are temporarily unavailable. Please email hello@jinai.md.");
    f.setHash("#waitlist");
    assert.equal(f.elements.get("waitlistStatus").textContent, notice);
    assert.equal(f.button.disabled, true);
    assert.equal(f.elements.get("waitlistStatus").hidden, false);
  });
}

test("a direct-demo hash change waits for an in-flight waitlist request before switching steps", async (t) => {
  let resolve;
  const f = await clientFixture(t, (_url, options) => new Promise(done => {
    const payload = JSON.parse(options.body);
    assert.equal(payload.type, "waitlist");
    resolve = () => done({ ok: true, json: async () => ({ ...response(), requestId: payload.requestId }) });
  }), true, "en", "waitlist");
  f.fill();
  const submission = f.submit();
  f.setHash("#request-demo");
  assert.equal(f.elements.get("demoFields").hidden, true);
  assert.equal(f.button.disabled, true);
  resolve();
  await submission;
  assert.equal(f.elements.get("demoFields").hidden, false);
  assert.equal(f.elements.get("demoOffer").hidden, true);
  assert.equal(f.form.hidden, false);
  assert.equal(f.controls.get("company").value, "Example Company");
  assert.equal(f.button.textContent, "Request a demo");
  assert.equal(f.document.activeElement.id, "demo-firstName");
});

for (const entry of ["initial", "hashchange"]) {
  test(`direct demo ${entry} keeps an unconfigured endpoint explicitly unavailable`, async (t) => {
    const f = await clientFixture(t, async () => assert.fail("Unavailable forms must not submit"),
      false, "en", "waitlist", entry === "initial" ? "#request-demo" : "#demo");
    if (entry === "hashchange") f.setHash("#request-demo");
    assert.equal(f.elements.get("demoFields").hidden, false);
    assert.equal(f.button.disabled, true);
    assert.equal(f.elements.get("waitlistStatus").hidden, false);
    assert.equal(f.elements.get("waitlistStatus").textContent,
      "Demo requests are temporarily unavailable. Please email hello@jinai.md.");
  });
}

for (const failure of ["not_saved", "unknown", "transport", "mismatched"]) {
  test(`direct demo ${failure} retains data, honest status and the request ID on retry`, async (t) => {
    const payloads = [];
    const f = await clientFixture(t, async (_url, options) => {
      const payload = JSON.parse(options.body);
      payloads.push(payload);
      if (payloads.length === 1) {
        if (failure === "transport") throw new Error("Offline");
        return { ok: true, json: async () => ({
          ...response(failure === "not_saved" ? "not_saved" : "unknown", "not_attempted", "busy"),
          requestId: failure === "mismatched" ? "wrong" : payload.requestId
        }) };
      }
      return { ok: true, json: async () => ({ ...response(), requestId: payload.requestId }) };
    }, true, "en", "waitlist", "#request-demo");
    f.fill();
    await f.submit();
    assert.equal(f.form.hidden, false);
    assert.equal(f.elements.get("demoFields").disabled, false);
    assert.equal(f.elements.get("demoOffer").hidden, true);
    assert.equal(f.controls.get("company").value, "Example Company");
    if (!f.elements.get("waitlistDone").hidden) {
      assert.notEqual(f.elements.get("waitlistRegistration").textContent, "Saved");
    } else assert.equal(f.elements.get("waitlistStatus").dataset.kind, "error");
    await f.submit();
    assert.equal(payloads[0].type, "demo");
    assert.equal(payloads[1].requestId, payloads[0].requestId);
    assert.equal(f.form.hidden, true);
  });
}

test("client validation rejects every invalid field and accepts a valid phone with listed choices", async () => {
  const content = JSON.parse(await readFile(new URL("../agent/content.json", import.meta.url), "utf8"));
  const choices = Object.fromEntries(content.early_access.form.fields
    .filter((field) => field.type === "select").map((field) => [field.name, field.options]));
  assert.deepEqual(validateDemoFields(demoInput(), choices), {});
  assert.deepEqual(validateDemoFields(demoInput({ phone: "  123456  " }), choices), {});
  for (const [field, value] of [
    ["email", "a..b@example.com"], ["firstName", "a".repeat(81)], ["lastName", "Sample\n"],
    ["jobTitle", ""], ["phone", ""], ["phone", "call me"], ["phone", "12345"],
    ["phone", "+ ( ) . -"], ["company", "a".repeat(161)],
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
    if (name === "website") continue;
    assert.equal(control.getAttribute("aria-invalid"), "true");
    const error = f.document.getElementById(control.getAttribute("aria-describedby"));
    assert.equal(error.hidden, false);
    assert.ok(error.textContent.startsWith(name === "phone" ? "Enter" : "Please"));
  }
  assert.equal(f.document.getElementById("demo-phone-error").textContent, "Enter your phone number.");
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
    f.fill({ phone: "  +1 (202) 555-0142  ", firstName: "  Alex  " });
    await f.submit();
    assert.equal(payload.type, "demo");
    assert.equal(payload.lang, "en");
    assert.equal(payload.firstName, "Alex");
    assert.equal(payload.phone, "+1 (202) 555-0142");
    assert.equal(payload.consentVersion, "demo-request-v1");
    assert.deepEqual(Object.keys(payload), [
      "type", "lang", "email", "firstName", "lastName", "jobTitle", "phone", "company",
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

for (const language of ["ja", "ja-JP", "en", "en-US", "fr", "", undefined]) {
  test(`client sends the demo language from document lang ${JSON.stringify(language)}`, async (t) => {
    let payload;
    const f = await clientFixture(t, async (_url, options) => {
      payload = JSON.parse(options.body);
      return { ok: true, json: async () => ({ ...response(), requestId: payload.requestId }) };
    }, true, language);
    f.fill();
    await f.submit();
    assert.equal(payload.lang, language?.startsWith("ja") ? "ja" : "en");
    assert.equal(payload.consentVersion, "demo-request-v1");
    assert.equal(payload.source, "https://jinai.md");
    assert.equal(payload.lastName, "Sample");
    assert.equal(payload.country, "United States");
    assert.equal(f.errorLogs.length, 0);
    assert.equal(f.form.hidden, true);
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

test("waitlist client validation requires only the five common fields", () => {
  assert.deepEqual(validateWaitlistFields(waitlistInput()), {});
  for (const name of WAITLIST_FIELDS) {
    assert.deepEqual(Object.keys(validateWaitlistFields(waitlistInput({ [name]: "" }))), [name]);
    assert.deepEqual(Object.keys(validateWaitlistFields(waitlistInput({ [name]: "bad\nvalue" }))), [name]);
  }
  assert.deepEqual(Object.keys(validateWaitlistFields(waitlistInput({ email: "a..b@example.com" }))), ["email"]);
  assert.equal(WAITLIST_CONSENT_VERSION, backend.WAITLIST_CONSENT);
});

for (const language of ["en", "ja"]) {
  test(`waitlist then demo sends distinct payloads and carries editable common values in ${language}`, async (t) => {
    const requests = [];
    const f = await clientFixture(t, async (url, options) => {
      assert.equal(url, endpoint);
      const payload = JSON.parse(options.body);
      requests.push(payload);
      return { ok: true, json: async () => ({ ...response(), requestId: payload.requestId }) };
    }, true, language, "waitlist");
    assert.equal(f.elements.get("demoFields").hidden, true);
    assert.equal(f.elements.get("demoFields").disabled, true);
    f.openDemo();
    assert.equal(f.form.hidden, false);
    assert.equal(f.elements.get("demoFields").hidden, true);
    f.fill({ firstName: "  Alex  ", phone: "", industry: "", companySize: "", country: "" });
    await f.submit();
    const signup = requests[0];
    assert.deepEqual(Object.keys(signup), [
      "type", "lang", "firstName", "lastName", "email", "jobTitle", "company",
      "website", "source", "consentVersion", "requestId"
    ]);
    assert.equal(signup.type, "waitlist");
    assert.equal(signup.lang, language);
    assert.equal(signup.firstName, "Alex");
    assert.equal(signup.consentVersion, WAITLIST_CONSENT_VERSION);
    assert.equal(signup.source, "https://jinai.md");
    assert.equal(f.form.hidden, true);
    assert.equal(f.elements.get("demoOffer").hidden, false);
    assert.equal(f.elements.get("waitlistHeading").textContent,
      language === "ja" ? "ウェイトリストに追加しました" : "You're on the waitlist");
    assert.equal(f.elements.get("waitlistDetail").textContent, language === "ja" ?
      `${signup.email} に確認メールをお送りしました。` : `We sent a confirmation to ${signup.email}.`);
    assert.equal(f.document.activeElement.id, "waitlistDone");
    f.openDemo();
    assert.equal(f.form.hidden, false);
    assert.equal(f.elements.get("demoFields").hidden, false);
    assert.equal(f.elements.get("demoFields").disabled, false);
    assert.equal(f.elements.get("demoOffer").hidden, true);
    assert.equal(f.elements.get("waitlistDone").hidden, true);
    assert.equal(f.document.activeElement.id, "demo-phone");
    assert.equal(f.elements.get("openDemo").getAttribute("aria-expanded"), "true");
    for (const name of WAITLIST_FIELDS) assert.equal(f.controls.get(name).value, signup[name], name);
    f.controls.get("company").value = "Updated Company";
    f.controls.get("phone").value = "+81 90 1234 5678";
    f.controls.get("industry").value = "Technology";
    f.controls.get("companySize").value = "50-199";
    f.controls.get("country").value = "Japan";
    await f.submit();
    const demo = requests[1];
    assert.equal(demo.type, "demo");
    assert.equal(demo.consentVersion, CONSENT_VERSION);
    assert.equal(demo.lang, language);
    assert.notEqual(demo.requestId, signup.requestId);
    for (const name of WAITLIST_FIELDS.filter(name => name !== "company")) assert.equal(demo[name], signup[name]);
    assert.equal(demo.company, "Updated Company");
    assert.equal(demo.phone, "+81 90 1234 5678");
    assert.equal(demo.country, "Japan");
    assert.equal(f.form.hidden, true);
    assert.equal(f.elements.get("demoOffer").hidden, true);
    assert.equal(f.document.activeElement.id, "waitlistDone");
    assert.equal(f.elements.get("waitlistHeading").textContent, describeResult(response(), language).heading);
    assert.equal(f.errorLogs.length, 0);
  });

  test(`empty waitlist validates only visible fields in native name order in ${language}`, async (t) => {
    const f = await clientFixture(t, async () => assert.fail("Invalid form must not submit"), true, language, "waitlist");
    await f.submit();
    assert.equal(f.document.activeElement.id, language === "ja" ? "demo-lastName" : "demo-firstName");
    for (const name of WAITLIST_FIELDS) assert.equal(f.controls.get(name).getAttribute("aria-invalid"), "true");
    for (const name of ["phone", "industry", "companySize", "country"]) {
      assert.equal(f.controls.get(name).getAttribute("aria-invalid"), null);
      assert.equal(f.elements.get(`demo-${name}-error`).hidden, true);
    }
    assert.equal(f.elements.get("demoOffer").hidden, true);
  });

  for (const welcome of ["pending", "failed", "unknown"]) {
    test(`saved waitlist with ${welcome} email is honest and still offers demo in ${language}`, async (t) => {
      const f = await clientFixture(t, async (_url, options) => ({
        ok: true, json: async () => ({ ...response("saved", welcome), requestId: JSON.parse(options.body).requestId })
      }), true, language, "waitlist");
      f.fill();
      await f.submit();
      assert.equal(f.form.hidden, true);
      assert.equal(f.elements.get("demoOffer").hidden, false);
      assert.equal(f.elements.get("waitlistDone").dataset.kind, "pending");
      assert.equal(f.elements.get("waitlistDetail").textContent,
        describeResult(response("saved", welcome), language, "waitlist").detail);
      assert.doesNotMatch(f.elements.get("waitlistDetail").textContent, /We sent|お送りしました/);
    });
  }
}

for (const step of ["waitlist", "demo"]) {
  for (const failure of ["not_saved", "unknown", "transport", "mismatched"]) {
    test(`${step} ${failure} does not claim success or discard fields; retry keeps its request ID`, async (t) => {
      const requests = [];
      let fail = true;
      const f = await clientFixture(t, async (_url, options) => {
        const payload = JSON.parse(options.body);
        requests.push(payload);
        if (fail && payload.type === step) {
          if (failure === "transport") throw new Error("Offline");
          return { ok: true, json: async () => ({
            ...response(failure === "not_saved" ? "not_saved" : "unknown", "not_attempted", "busy"),
            requestId: failure === "mismatched" ? "wrong" : payload.requestId
          }) };
        }
        return { ok: true, json: async () => ({ ...response(), requestId: payload.requestId }) };
      }, true, "en", "waitlist");
      f.fill();
      if (step === "demo") {
        await f.submit();
        f.openDemo();
      }
      const before = Object.fromEntries([...f.controls].map(([name, control]) => [name, control.value]));
      await f.submit();
      const first = requests.at(-1);
      assert.equal(f.form.hidden, false);
      assert.equal(f.elements.get("demoOffer").hidden, true);
      if (!f.elements.get("waitlistDone").hidden) {
        assert.notEqual(f.elements.get("waitlistRegistration").textContent, "Saved");
      }
      assert.deepEqual(Object.fromEntries([...f.controls].map(([name, control]) => [name, control.value])), before);
      assert.equal(f.button.disabled, false);
      fail = false;
      await f.submit();
      assert.equal(requests.at(-1).requestId, first.requestId);
      assert.equal(f.form.hidden, true);
    });
  }
}

for (const language of ["en", "ja"]) {
  test(`both client steps reach their backend stores and send once despite lost responses in ${language}`, async (t) => {
    const stores = { waitlist: fixture(), demo: fixture() };
    const requests = { waitlist: [], demo: [] };
    const f = await clientFixture(t, async (_url, options) => {
      const payload = JSON.parse(options.body);
      requests[payload.type].push(payload);
      const register = payload.type === "waitlist" ? backend.registerWaitlist_ : backend.registerDemo_;
      const result = register(payload, stores[payload.type].deps);
      if (requests[payload.type].length === 1) throw new Error("Response lost after saving");
      return { ok: true, json: async () => result };
    }, true, language, "waitlist");
    f.fill();
    await f.submit();
    assert.equal(f.form.hidden, false);
    assert.equal(f.elements.get("demoOffer").hidden, true);
    await f.submit();
    assert.equal(f.form.hidden, true);
    assert.equal(f.elements.get("demoOffer").hidden, false);
    f.openDemo();
    await f.submit();
    assert.equal(f.form.hidden, false);
    await f.submit();
    assert.equal(f.form.hidden, true);
    for (const type of ["waitlist", "demo"]) {
      assert.equal(requests[type][0].requestId, requests[type][1].requestId);
      assert.equal(stores[type].records.length, 1);
      assert.equal(stores[type].sends(), 1);
      assert.equal(stores[type].records[0].lang, language);
      assert.equal(stores[type].records[0].company, "Example Company");
    }
    assert.notEqual(requests.waitlist[0].requestId, requests.demo[0].requestId);
    assert.equal(f.errorLogs.length, 2);
  });
}

for (const flow of ["waitlist", "demo"]) {
  for (const editing of [false, true]) {
    test(`${flow} transport failure restores a blurred submit button without stealing editing focus (${editing})`, async (t) => {
      const f = await clientFixture(t, async () => {
        f.document.activeElement = editing ? f.controls.get("company") : f.document.body;
        throw new Error("Offline");
      }, true, "en", flow);
      f.fill();
      await f.submit();
      assert.equal(f.form.hidden, false);
      assert.equal(f.button.disabled, false);
      assert.equal(f.document.activeElement, editing ? f.controls.get("company") : f.button);
      assert.equal(f.elements.get("waitlistStatus").dataset.kind, "error");
    });
  }
}

test("waitlist email interpolation remains literal text, including HTML and replacement metacharacters", () => {
  const email = "<img>$&@example.com";
  assert.equal(describeResult(response(), "en", "waitlist", email).detail, `We sent a confirmation to ${email}.`);
  assert.equal(describeResult(response(), "ja", "waitlist", email).detail, `${email} に確認メールをお送りしました。`);
});

test("all nine demo fields are required in facts and both generated forms", async () => {
  const content = JSON.parse(await readFile(new URL("../agent/content.json", import.meta.url), "utf8"));
  assert.equal(content.early_access.form.fields.length, 9);
  assert.ok(content.early_access.form.fields.every((field) => field.required === true));
  for (const page of ["../index.html", "../ja/index.html"]) {
    const html = await readFile(new URL(page, import.meta.url), "utf8");
    for (const field of content.early_access.form.fields) {
      const control = html.match(new RegExp(`<(?:input|select)\\b[^>]*\\bname="${field.name}"[^>]*>`))?.[0];
      assert.ok(control, `${page}: ${field.name}`);
      assert.match(control, /\srequired(?:\s|>)/);
      assert.match(control, /\saria-required="true"/);
    }
    assert.doesNotMatch(html, /Phone \(optional\)|\u96fb\u8a71\u756a\u53f7\uff08\u4efb\u610f\uff09/);
  }
});

for (const language of ["en", "ja"]) {
  test(`client marks every field required and rejects an empty phone inline in ${language}`, async (t) => {
    let requests = 0;
    const f = await clientFixture(t, async () => { requests++; }, true, language);
    for (const [name, control] of f.controls) {
      if (name === "website") continue;
      assert.equal(control.required, true, name);
      assert.equal(control.getAttribute("aria-required"), "true", name);
    }
    for (const phone of ["", "   "]) {
      f.fill({ phone });
      await f.submit();
      assert.equal(requests, 0);
      assert.equal(f.form.hidden, false);
      assert.equal(f.document.activeElement.id, "demo-phone");
      assert.equal(f.controls.get("phone").getAttribute("aria-invalid"), "true");
      assert.equal(f.elements.get("demo-phone-error").hidden, false);
      assert.equal(f.elements.get("demo-phone-error").textContent, language === "ja" ?
        "\u96fb\u8a71\u756a\u53f7\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002" : "Enter your phone number.");
    }
  });
}

test("an empty demo phone is rejected before locks, sheet writes or email sends", () => {
  for (const phone of ["", "   "]) {
    const f = fixture();
    f.deps.store.withLock = () => assert.fail("Validation must finish before locking or writing.");
    f.deps.sender.assertReady = () => assert.fail("No sender access is allowed.");
    const result = backend.registerDemo_(demoInput({ phone }), f.deps);
    assert.equal(result.code, "invalid_phone");
    assert.equal(result.registration, "not_saved");
    assert.equal(result.welcome, "not_attempted");
    assert.equal(f.records.length, 0);
    assert.equal(f.surveyRecords.length, 0);
    assert.equal(f.sends(), 0);
    assert.deepEqual(f.log, [["validation", requestId, "invalid_phone"]]);
  }
});

const homeSource = await readFile(new URL("../index.html", import.meta.url), "utf8");
const languageChoiceSource = homeSource.match(/<script id="jin-language-choice">([\s\S]*?)<\/script>/)?.[1];
const footerLanguageSource = await readFile(new URL("../language.js", import.meta.url), "utf8");
function languageFixture({ languages = ["ja-JP", "en-US"], language = "en-US",
  userAgent = "Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36", pathname = "/",
  search = "?campaign=demo", hash = "#demo", localFailure = false,
  sessionFailure = false, saved = null, sessionChoice = null } = {}) {
  const local = new Map(saved ? [["jin-lang", saved]] : []);
  const session = new Map(sessionChoice ? [["jin-lang", sessionChoice]] : []);
  const redirects = [];
  const warnings = [];
  let click;
  const storage = (values, fails) => ({
    getItem(key) { if (fails) throw new Error("Storage blocked"); return values.get(key) || null; },
    setItem(key, value) { if (fails) throw new Error("Storage blocked"); values.set(key, value); }
  });
  const context = vm.createContext({
    navigator: { languages, language, userAgent },
    location: { pathname, search, hash, replace: (target) => redirects.push(target) },
    localStorage: storage(local, localFailure), sessionStorage: storage(session, sessionFailure),
    console: { warn: (...args) => warnings.push(args) }, URL, URLSearchParams,
    document: { addEventListener: (name, handler) => { assert.equal(name, "click"); click = handler; } }
  });
  return { local, session, redirects, warnings, context,
    run: () => vm.runInContext(languageChoiceSource, context),
    choose(language) {
      vm.runInContext(footerLanguageSource, context);
      const link = { dataset: { jinLang: language }, href: "https://jinai.md/" };
      click({ target: { closest: (selector) => {
        assert.equal(selector, "footer .language-switch a[data-jin-lang]");
        return link;
      } } });
      return link;
    }
  };
}

test("first Japanese browser redirects once, preserving query and fragment", () => {
  assert.ok(languageChoiceSource, "The home language script must exist.");
  const f = languageFixture();
  f.run();
  assert.deepEqual(f.redirects, ["/ja/?campaign=demo#demo"]);
  assert.equal(f.local.get("jin-lang"), "ja");
  f.run();
  assert.equal(f.redirects.length, 1);
});

test("only the first preferred language selects Japanese, with navigator.language fallback", () => {
  for (const options of [
    { languages: ["en-US", "ja-JP"] }, { languages: [], language: "en-US" }
  ]) {
    const f = languageFixture(options);
    f.run();
    assert.deepEqual(f.redirects, []);
    assert.equal(f.local.get("jin-lang"), "en");
  }
  for (const languages of [[], undefined]) {
    const f = languageFixture({ languages, language: "ja-JP" });
    if (languages === undefined) f.context.navigator.languages = undefined;
    f.run();
    assert.equal(f.redirects.length, 1);
  }
});

test("every specified bot and headless user agent keeps English without storing a preference", () => {
  for (const userAgent of ["Googlebot", "crawler", "spider", "slurp", "bingpreview",
    "facebookexternalhit", "embedly", "quora link preview", "showyoupage", "outbrain",
    "pinterest", "vkshare", "w3c_validator", "whatsapp", "linkedinbot", "twitterbot",
    "discordbot", "google-inspectiontool", "HeadlessChrome"]) {
    const f = languageFixture({ userAgent });
    f.run();
    assert.deepEqual(f.redirects, [], userAgent);
    assert.equal(f.local.size, 0, userAgent);
  }
});

test("any stored language is respected, and only the English root auto-selects", () => {
  for (const saved of ["en", "ja", "other"]) {
    const f = languageFixture({ saved });
    f.run();
    assert.deepEqual(f.redirects, []);
    assert.equal(f.local.get("jin-lang"), saved);
  }
  for (const pathname of ["/ja/", "/how-it-works/", "/index.html"]) {
    const f = languageFixture({ pathname });
    f.run();
    assert.deepEqual(f.redirects, []);
    assert.equal(f.local.size, 0);
  }
});

test("footer choices are saved before navigation and prevent a Japanese browser bouncing back", () => {
  const f = languageFixture();
  f.run();
  f.choose("en");
  assert.equal(f.local.get("jin-lang"), "en");
  f.run();
  assert.equal(f.redirects.length, 1);
  f.choose("ja");
  assert.equal(f.local.get("jin-lang"), "ja");
  f.run();
  assert.equal(f.redirects.length, 1);
});

test("blocked local storage uses the session for one redirect and a remembered footer choice", () => {
  const f = languageFixture({ localFailure: true });
  f.run();
  assert.equal(f.session.get("jin-lang"), "ja");
  assert.equal(f.redirects.length, 1);
  f.run();
  assert.equal(f.redirects.length, 1);
  f.choose("en");
  assert.equal(f.session.get("jin-lang"), "en");
  f.run();
  assert.equal(f.redirects.length, 1);
  assert.ok(f.warnings.length > 0);
});

test("blocked local and session storage use a query flag without looping or losing other URL data", () => {
  const f = languageFixture({ localFailure: true, sessionFailure: true });
  f.run();
  assert.deepEqual(f.redirects, ["/ja/?campaign=demo&jin-lang=ja#demo"]);
  f.context.location.search = "?campaign=demo&jin-lang=ja";
  f.run();
  assert.equal(f.redirects.length, 1);
  const link = f.choose("en");
  assert.equal(link.href, "https://jinai.md/?jin-lang=en");
  f.context.location.search = new URL(link.href).search;
  f.run();
  assert.equal(f.redirects.length, 1);
  assert.ok(f.warnings.length > 0);
});
