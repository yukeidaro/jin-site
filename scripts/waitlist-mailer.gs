/**
 * Direct Apps Script web app. Google Forms and form-submit triggers are not used.
 * Deploy with scripts/appsscript.json, execute as the deploying account, and
 * allow Anyone. Run setupWaitlist first; see README.md for the remaining steps.
 */
var WAITLIST_VERSION = '2026-09-12.1';
var WAITLIST_FROM = 'hello@jinai.md';
var WAITLIST_DISCORD = 'https://discord.gg/hn8eG4d9f';
var WAITLIST_CONSENT = 'waitlist-product-updates-v1';
var WAITLIST_SHEET = 'Waitlist';
var WAITLIST_COLUMNS = [
  ['createdAt', 'Created at'],
  ['name', 'Name'],
  ['email', 'Email'],
  ['role', 'Role'],
  ['requestId', 'Request ID'],
  ['source', 'Source'],
  ['consentVersion', 'Consent version'],
  ['registration', 'Registration status'],
  ['welcome', 'Welcome email status'],
  ['attempts', 'Welcome attempts'],
  ['lastAttemptAt', 'Last attempt at'],
  ['nextAttemptAt', 'Next attempt at'],
  ['sentAt', 'Sent at'],
  ['messageId', 'Gmail message ID'],
  ['errorCode', 'Last error code']
];

function doGet() {
  return jsonOutput_({ service: 'jin-ai-waitlist', version: WAITLIST_VERSION });
}

function doPost(e) {
  var input;
  try {
    if (!e || !e.postData || typeof e.postData.contents !== 'string' ||
        e.postData.contents.length > 4096) {
      throw waitlistError_('invalid_request');
    }
    input = JSON.parse(e.postData.contents);
  } catch (error) {
    console.warn('waitlist: invalid request body');
    return jsonOutput_(result_(null, 'not_saved', 'not_attempted', 'invalid_request'));
  }
  return jsonOutput_(registerWaitlist_(input, productionDependencies_()));
}

function jsonOutput_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function result_(requestId, registration, welcome, code) {
  return {
    version: 1,
    requestId: requestId,
    registration: registration,
    welcome: welcome,
    code: code || null
  };
}

function waitlistError_(code) {
  var error = new Error(code);
  error.code = code;
  return error;
}

function validateSignup_(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw waitlistError_('invalid_input');
  }
  if (typeof input.requestId !== 'string' ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.requestId)) {
    throw waitlistError_('invalid_request_id');
  }
  var cleaned = {};
  ['name', 'email', 'role'].forEach(function (key) {
    if (typeof input[key] !== 'string' || /[\u0000-\u001f\u007f]/.test(input[key])) {
      throw waitlistError_('invalid_' + key);
    }
    cleaned[key] = input[key].trim();
  });
  if (!cleaned.name || cleaned.name.length > 120) throw waitlistError_('invalid_name');
  if (!cleaned.role || cleaned.role.length > 160) throw waitlistError_('invalid_role');
  cleaned.email = cleaned.email.toLowerCase();
  if (cleaned.email.length > 254 ||
      !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(cleaned.email) ||
      cleaned.email.split('@')[0].length > 64 ||
      /^\.|\.\.|\.@/.test(cleaned.email)) {
    throw waitlistError_('invalid_email');
  }
  if (input.website !== '' && input.website !== undefined) throw waitlistError_('invalid_input');
  if (input.source !== 'https://jinai.md' && input.source !== 'https://www.jinai.md') {
    throw waitlistError_('invalid_source');
  }
  if (input.consentVersion !== WAITLIST_CONSENT) throw waitlistError_('invalid_consent');
  cleaned.requestId = input.requestId;
  cleaned.source = input.source;
  cleaned.consentVersion = input.consentVersion;
  return cleaned;
}

function registerWaitlist_(input, deps) {
  var signup;
  var requestId = input && typeof input.requestId === 'string' &&
    /^[a-f0-9-]{36}$/i.test(input.requestId) ? input.requestId : null;
  try {
    signup = validateSignup_(input);
  } catch (error) {
    deps.log('validation', requestId, error.code || 'invalid_input');
    return result_(requestId, 'not_saved', 'not_attempted', error.code || 'invalid_input');
  }

  var record = null;
  var saved = false;
  try {
    return deps.store.withLock(function () {
      record = deps.store.find('requestId', signup.requestId);
      if (record && record.email !== signup.email) {
        throw waitlistError_('request_conflict');
      }
      record = record || deps.store.find('email', signup.email);
      if (!record) {
        record = {
          createdAt: new Date(deps.now()).toISOString(),
          name: signup.name,
          email: signup.email,
          role: signup.role,
          requestId: signup.requestId,
          source: signup.source,
          consentVersion: signup.consentVersion,
          registration: 'saved',
          welcome: 'pending',
          attempts: 0,
          lastAttemptAt: '',
          nextAttemptAt: '',
          sentAt: '',
          messageId: '',
          errorCode: ''
        };
        record = deps.store.append(record);
      }
      saved = true;
      if (record.welcome === 'pending' &&
          (!record.nextAttemptAt || Date.parse(record.nextAttemptAt) <= deps.now())) {
        attemptWelcome_(record, deps);
      }
      var welcome = record.welcome === 'sending' ? 'unknown' : record.welcome;
      return result_(signup.requestId, 'saved', welcome, record.errorCode);
    });
  } catch (error) {
    deps.log('registration', requestId, error.code || 'storage_error');
    var registration = saved ? 'saved' :
      (error.code === 'request_conflict' || error.code === 'busy' ? 'not_saved' : 'unknown');
    var state = saved && record ? record.welcome : 'not_attempted';
    if (state === 'sending') state = 'unknown';
    return result_(requestId, registration, state, error.code || 'storage_error');
  }
}

function attemptWelcome_(record, deps) {
  try {
    deps.sender.assertReady();
    if (!deps.reserveEmail()) throw waitlistError_('daily_email_limit');
  } catch (error) {
    record.errorCode = error.code || 'sender_unavailable';
    record.nextAttemptAt = new Date(deps.now() + 15 * 60 * 1000).toISOString();
    deps.log('sender', record.requestId, record.errorCode);
    deps.store.update(record);
    return;
  }

  // Persist the attempt before calling Gmail. An interrupted send is never retried blindly.
  record.welcome = 'sending';
  record.attempts = Number(record.attempts) + 1;
  record.lastAttemptAt = new Date(deps.now()).toISOString();
  record.nextAttemptAt = '';
  record.errorCode = '';
  deps.store.update(record);

  try {
    var messageId = deps.sender.send(record);
    if (!messageId) throw waitlistError_('send_result_unknown');
    record.welcome = 'sent';
    record.messageId = messageId;
    record.sentAt = new Date(deps.now()).toISOString();
  } catch (error) {
    var rejection = String(error.message || error);
    if (/quota|rate.?limit|too many|daily.*limit|insufficient.*permission|not.*authorized/i.test(rejection)) {
      record.welcome = Number(record.attempts) < 3 ? 'pending' : 'failed';
      record.errorCode = 'send_rejected';
      record.nextAttemptAt = new Date(deps.now() + 60 * 60 * 1000).toISOString();
    } else if (/invalid.*recipient|invalid.*argument|bad request/i.test(rejection)) {
      record.welcome = 'failed';
      record.errorCode = 'send_rejected';
    } else {
      record.welcome = 'unknown';
      record.errorCode = 'send_result_unknown';
    }
    deps.log('send', record.requestId, record.errorCode);
  }
  deps.store.update(record);
}

function productionDependencies_() {
  return {
    store: sheetStore_(),
    sender: {
      assertReady: function () {
        var aliases;
        try {
          aliases = Gmail.Users.Settings.SendAs.list('me').sendAs || [];
        } catch (error) {
          console.error('waitlist sender authorization: ' + String(error.message || error));
          throw waitlistError_('sender_unavailable');
        }
        var ready = aliases.some(function (alias) {
          return String(alias.sendAsEmail).toLowerCase() === WAITLIST_FROM &&
            alias.verificationStatus === 'accepted';
        });
        if (!ready) throw waitlistError_('sender_not_verified');
      },
      send: function (record) {
        var response = Gmail.Users.Messages.send({ raw: welcomeMime_(record) }, 'me');
        return response && response.id;
      }
    },
    now: function () { return Date.now(); },
    reserveEmail: function () {
      var properties = PropertiesService.getScriptProperties();
      var today = new Date().toISOString().slice(0, 10);
      var limit = Number(properties.getProperty('DAILY_EMAIL_LIMIT') || 90);
      if (!Number.isInteger(limit) || limit < 1 || limit > 1500) {
        throw waitlistError_('invalid_daily_email_limit');
      }
      var used = properties.getProperty('EMAIL_DAY') === today ?
        Number(properties.getProperty('EMAIL_COUNT') || 0) : 0;
      if (used >= limit) return false;
      properties.setProperties({ EMAIL_DAY: today, EMAIL_COUNT: String(used + 1) });
      return true;
    },
    log: function (stage, requestId, code) {
      console.error(JSON.stringify({ stage: stage, requestId: requestId, code: code }));
    }
  };
}

function sheetStore_() {
  var sheet;
  function getSheet() {
    if (sheet) return sheet;
    var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (!id) throw waitlistError_('storage_not_configured');
    sheet = SpreadsheetApp.openById(id).getSheetByName(WAITLIST_SHEET);
    if (!sheet) throw waitlistError_('storage_not_configured');
    var headers = sheet.getRange(1, 1, 1, WAITLIST_COLUMNS.length).getValues()[0];
    if (JSON.stringify(headers) !== JSON.stringify(WAITLIST_COLUMNS.map(function (column) { return column[1]; }))) {
      throw waitlistError_('storage_schema_mismatch');
    }
    return sheet;
  }
  function values(record) {
    return WAITLIST_COLUMNS.map(function (column) {
      return safeCell_(record[column[0]]);
    });
  }
  function readRow(number, cells) {
    cells = cells || getSheet().getRange(number, 1, 1, WAITLIST_COLUMNS.length).getValues()[0];
    var record = { row: number };
    WAITLIST_COLUMNS.forEach(function (column, i) {
      record[column[0]] = cells[i] instanceof Date ? cells[i].toISOString() : cells[i];
    });
    return record;
  }
  return {
    withLock: function (work) {
      var lock = LockService.getScriptLock();
      if (!lock.tryLock(10000)) throw waitlistError_('busy');
      try { return work(); } finally { lock.releaseLock(); }
    },
    find: function (key, value) {
      var target = getSheet();
      if (target.getLastRow() < 2) return null;
      var index = WAITLIST_COLUMNS.map(function (column) { return column[0]; }).indexOf(key);
      if (index < 0) throw waitlistError_('invalid_lookup');
      var found = target.getRange(2, index + 1, target.getLastRow() - 1, 1)
        .createTextFinder(value).matchEntireCell(true).useRegularExpression(false).findNext();
      return found ? readRow(found.getRow()) : null;
    },
    append: function (record) {
      record.row = getSheet().getLastRow() + 1;
      getSheet().getRange(record.row, 1, 1, WAITLIST_COLUMNS.length).setValues([values(record)]);
      SpreadsheetApp.flush();
      return record;
    },
    update: function (record) {
      getSheet().getRange(record.row, 1, 1, WAITLIST_COLUMNS.length).setValues([values(record)]);
      SpreadsheetApp.flush();
    },
    pending: function (dueAt) {
      var target = getSheet();
      var records = [];
      if (target.getLastRow() < 2) return records;
      var rows = target.getRange(2, 1, target.getLastRow() - 1, WAITLIST_COLUMNS.length).getValues();
      for (var i = 0; i < rows.length; i++) {
        var record = readRow(i + 2, rows[i]);
        if (record.welcome === 'pending' &&
            (!record.nextAttemptAt || Date.parse(record.nextAttemptAt) <= dueAt)) {
          records.push(record);
        }
        if (records.length === 20) break;
      }
      return records;
    }
  };
}

function safeCell_(value) {
  if (typeof value === 'number') return value;
  var text = String(value === undefined || value === null ? '' : value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function setupWaitlist() {
  var properties = PropertiesService.getScriptProperties();
  var id = properties.getProperty('SPREADSHEET_ID');
  var spreadsheet = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw waitlistError_('set_SPREADSHEET_ID_first');
  properties.setProperty('SPREADSHEET_ID', spreadsheet.getId());
  var sheet = spreadsheet.getSheetByName(WAITLIST_SHEET);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(WAITLIST_SHEET);
    sheet.getRange(1, 1, 1, WAITLIST_COLUMNS.length)
      .setValues([WAITLIST_COLUMNS.map(function (column) { return column[1]; })])
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, WAITLIST_COLUMNS.length, 170);
    sheet.setColumnWidth(3, 260);
  }
  sheetStore_().find('requestId', 'setup-check');
  console.log(JSON.stringify({ storage: 'ready', spreadsheet: spreadsheet.getUrl(), sheet: WAITLIST_SHEET }));
}

function inspectWaitlistSender() {
  productionDependencies_().sender.assertReady();
  console.log(JSON.stringify({ from: WAITLIST_FROM, sender: 'verified' }));
}

function installWaitlistRetry() {
  productionDependencies_().sender.assertReady();
  var exists = ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === 'retryPendingWelcomeEmails';
  });
  if (!exists) ScriptApp.newTrigger('retryPendingWelcomeEmails').timeBased().everyMinutes(15).create();
  console.log('Waitlist retry trigger is installed.');
}

function retryPendingWelcomeEmails() {
  var deps = productionDependencies_();
  deps.sender.assertReady();
  var pending = deps.store.withLock(function () { return deps.store.pending(deps.now()); });
  pending.forEach(function (snapshot) {
    deps.store.withLock(function () {
      var record = deps.store.find('requestId', snapshot.requestId);
      if (record && record.welcome === 'pending' &&
          (!record.nextAttemptAt || Date.parse(record.nextAttemptAt) <= deps.now())) {
        attemptWelcome_(record, deps);
      }
    });
  });
}

function escapeEmailHtml_(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function welcomeText_(name) {
  var greeting = 'Hi ' + name.split(/\s+/)[0] + ',';
  return [
    greeting,
    '',
    "You're on the Jin AI waitlist.",
    '',
    'Jin AI is a visual workspace for Markdown and other local files created by',
    'AI agents. See what changed, organize the files, and stay in control of the work.',
    '',
    'JOIN OUR DISCORD',
    WAITLIST_DISCORD,
    '',
    "We'll share product releases, collect feedback, answer questions, and track",
    'bug reports there. Come introduce yourself and tell us what you are working on.',
    '',
    'WHAT HAPPENS NEXT',
    "We'll email you when early access is ready, along with occasional product updates.",
    '',
    'Yu Asano',
    'Co-founder, Jin AI',
    'https://jinai.md/',
    '',
    "To stop receiving emails, reply with 'unsubscribe'."
  ].join('\r\n');
}

function welcomeHtml_(name) {
  var greeting = escapeEmailHtml_('Hi ' + name.split(/\s+/)[0] + ',');
  // Email clients need inline styles; no scripts, external fonts, or tracking pixels.
  var paragraph = 'margin:0 0 20px;font-size:16px;line-height:1.7;';
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f5f3ef;color:#252525;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:32px 16px;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dddad5;border-radius:10px;font-family:Segoe UI,Arial,sans-serif;">',
    '<tr><td style="padding:36px 28px;">',
    '<p style="margin:0 0 28px;font-size:22px;font-weight:700;">Jin AI</p>',
    '<p style="' + paragraph + '">' + greeting + '</p>',
    '<h1 style="margin:0 0 20px;font-size:26px;line-height:1.3;">You&#39;re on the waitlist.</h1>',
    '<p style="' + paragraph + '">Jin AI is a visual workspace for Markdown and other local files created by AI agents. See what changed, organize the files, and stay in control of the work.</p>',
    '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;"><tr><td style="background:#252525;border-radius:6px;">',
    '<a href="' + WAITLIST_DISCORD + '" style="display:inline-block;padding:14px 24px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;">Join our Discord</a>',
    '</td></tr></table>',
    '<p style="' + paragraph + '">We&#39;ll share product releases, collect feedback, answer questions, and track bug reports there. Come introduce yourself and tell us what you are working on.</p>',
    '<h2 style="margin:28px 0 12px;font-size:18px;">What happens next</h2>',
    '<p style="' + paragraph + '">We&#39;ll email you when early access is ready, along with occasional product updates.</p>',
    '<p style="margin:28px 0 0;font-size:15px;line-height:1.7;">Yu Asano<br>Co-founder, Jin AI<br><a href="https://jinai.md/" style="color:#252525;">jinai.md</a></p>',
    '<p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #dddad5;font-size:12px;line-height:1.7;color:#616161;">',
    'Button not working? <a href="' + WAITLIST_DISCORD + '" style="color:#616161;">' + WAITLIST_DISCORD + '</a><br>',
    'To stop receiving emails, reply with &ldquo;unsubscribe&rdquo;.</p>',
    '</td></tr></table></td></tr></table></body></html>'
  ].join('');
}

function welcomeMime_(record) {
  var boundary = 'jin-waitlist-' + record.requestId;
  function bodyPart(text) {
    return Utilities.base64Encode(text, Utilities.Charset.UTF_8).match(/.{1,76}/g).join('\r\n');
  }
  var message = [
    'From: Jin AI <' + WAITLIST_FROM + '>',
    'Reply-To: ' + WAITLIST_FROM,
    'To: <' + record.email + '>',
    'Subject: You are on the Jin AI waitlist',
    'Message-ID: <waitlist-' + record.requestId + '@jinai.md>',
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="' + boundary + '"',
    '',
    '--' + boundary,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    bodyPart(welcomeText_(record.name)),
    '--' + boundary,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    bodyPart(welcomeHtml_(record.name)),
    '--' + boundary + '--',
    ''
  ].join('\r\n');
  return Utilities.base64EncodeWebSafe(message, Utilities.Charset.UTF_8).replace(/=+$/, '');
}
