/**
 * Direct Apps Script web app. Google Forms and form-submit triggers are not used.
 * Deploy with scripts/appsscript.json, execute as the deploying account, and
 * allow Anyone. Run setupWaitlist first; see README.md for the remaining steps.
 */
var WAITLIST_VERSION = '2026-10-21.1';
var WAITLIST_FROM = 'hello@jinai.md';
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
  ['errorCode', 'Last error code'],
  ['firstName', 'First name'],
  ['lastName', 'Last name'],
  ['company', 'Company'],
  ['lang', 'Language']
];
var DEMO_SHEET = 'Demo requests';
var DEMO_CONSENT = 'demo-request-v1';
var DEMO_INDUSTRIES = [
  'Technology', 'Financial services', 'Professional services', 'Education',
  'Energy', 'Government', 'Healthcare', 'Manufacturing', 'Media', 'Nonprofit',
  'Real estate', 'Retail', 'Telecommunications', 'Transportation', 'Other'
];
var DEMO_COMPANY_SIZES = ['1-49', '50-199', '200-999', '1,000+'];
var DEMO_COLUMNS = [
  ['createdAt', 'Created at'],
  ['requestId', 'Request ID'],
  ['source', 'Source'],
  ['consentVersion', 'Consent version'],
  ['email', 'Email'],
  ['firstName', 'First name'],
  ['lastName', 'Last name'],
  ['jobTitle', 'Job title'],
  ['phone', 'Phone'],
  ['company', 'Company'],
  ['industry', 'Industry'],
  ['companySize', 'Company size'],
  ['country', 'Country'],
  ['lang', 'Language'],
  ['welcome', 'Confirmation status'],
  ['attempts', 'Attempts'],
  ['lastAttemptAt', 'Last attempt at'],
  ['nextAttemptAt', 'Next attempt at'],
  ['sentAt', 'Sent at'],
  ['messageId', 'Gmail message ID'],
  ['errorCode', 'Last error code']
];
var SURVEY_SHEET = 'Survey';
var SURVEY_ID = 'ai-friction-v1';
var SURVEY_OPTIONS = {
  A: 'Correcting small things over and over',
  B: 'Updating the settings that teach AI my preferences and rules (Skills and similar)',
  C: 'Finding the right documents and files to hand to AI',
  D: 'Re-explaining my requirements and background every time I switch between ChatGPT, Claude and others'
};
var SURVEY_COLUMNS = [
  ['answeredAt', 'Answered at'],
  ['email', 'Email'],
  ['requestId', 'Request ID'],
  ['surveyId', 'Survey ID'],
  ['answer', 'Answer'],
  ['answerLabel', 'Answer label'],
  ['updatedAt', 'Updated at']
];

function doGet() {
  return jsonOutput_({ service: 'jin-ai-waitlist', version: WAITLIST_VERSION });
}

function doPost(e) {
  var input;
  try {
    if (!e || !e.postData || typeof e.postData.contents !== 'string' ||
        e.postData.contents.length > 4096 ||
        Utilities.newBlob(e.postData.contents).getBytes().length > 4096) {
      throw waitlistError_('invalid_request');
    }
    input = JSON.parse(e.postData.contents);
  } catch (error) {
    console.warn('waitlist: invalid request body');
    return jsonOutput_(result_(null, 'not_saved', 'not_attempted', 'invalid_request'));
  }
  if (input && input.type === 'demo') {
    return jsonOutput_(registerDemo_(input, productionDependencies_('demo')));
  }
  return jsonOutput_(input && input.type === 'survey' ?
    recordSurvey_(input, productionDependencies_()) :
    registerWaitlist_(input, productionDependencies_()));
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

function surveyResult_(requestId, survey, code) {
  return { version: 1, requestId: requestId, survey: survey, code: code || null };
}

function waitlistError_(code) {
  var error = new Error(code);
  error.code = code;
  return error;
}

function validRequestId_(value) {
  return typeof value === 'string' &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
}

function cleanEmail_(value) {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(value)) {
    throw waitlistError_('invalid_email');
  }
  var email = value.trim().toLowerCase();
  if (email.length > 254 ||
      !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(email) ||
      email.split('@')[0].length > 64 ||
      /^\.|\.\.|\.@/.test(email)) {
    throw waitlistError_('invalid_email');
  }
  return email;
}

function validSource_(value) {
  return value === 'https://jinai.md' || value === 'https://www.jinai.md';
}

function requiredText_(value, code, limit) {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(value)) {
    throw waitlistError_(code);
  }
  value = value.trim();
  if (!value || value.length > limit) throw waitlistError_(code);
  return value;
}

function signupLanguage_(lang) {
  if (lang !== undefined && lang !== 'en' && lang !== 'ja') {
    throw waitlistError_('invalid_input');
  }
  return lang === undefined ? 'en' : lang;
}

function validateSignup_(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw waitlistError_('invalid_input');
  }
  if (!validRequestId_(input.requestId)) {
    throw waitlistError_('invalid_request_id');
  }
  var cleaned = { email: cleanEmail_(input.email) };
  var legacy = ['firstName', 'lastName', 'jobTitle', 'company'].every(function (key) {
    return !Object.prototype.hasOwnProperty.call(input, key);
  });
  if (legacy) {
    cleaned.name = requiredText_(input.name, 'invalid_name', 120);
    cleaned.role = requiredText_(input.role, 'invalid_role', 160);
    cleaned.firstName = '';
    cleaned.lastName = '';
    cleaned.company = '';
  } else {
    cleaned.firstName = requiredText_(input.firstName, 'invalid_first_name', 80);
    cleaned.lastName = requiredText_(input.lastName, 'invalid_last_name', 80);
    cleaned.role = requiredText_(input.jobTitle, 'invalid_job_title', 120);
    cleaned.company = requiredText_(input.company, 'invalid_company', 160);
    cleaned.name = cleaned.firstName + ' ' + cleaned.lastName;
  }
  cleaned.lang = signupLanguage_(input.lang);
  if (input.website !== '' && input.website !== undefined) throw waitlistError_('invalid_input');
  if (!validSource_(input.source)) throw waitlistError_('invalid_source');
  if (input.consentVersion !== WAITLIST_CONSENT) throw waitlistError_('invalid_consent');
  cleaned.requestId = input.requestId;
  cleaned.source = input.source;
  cleaned.consentVersion = input.consentVersion;
  return cleaned;
}

function registerWaitlist_(input, deps) {
  return registerRequest_(input, deps, validateSignup_, true);
}

function validateDemo_(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw waitlistError_('invalid_input');
  }
  if (!validRequestId_(input.requestId)) throw waitlistError_('invalid_request_id');
  var cleaned = { email: cleanEmail_(input.email) };
  [
    ['firstName', 'first_name', 80], ['lastName', 'last_name', 80],
    ['jobTitle', 'job_title', 120], ['phone', 'phone', 40],
    ['company', 'company', 160], ['industry', 'industry', 80],
    ['companySize', 'company_size', 20], ['country', 'country', 80]
  ].forEach(function (field) {
    cleaned[field[0]] = requiredText_(input[field[0]], 'invalid_' + field[1], field[2]);
  });
  if (!/^[0-9 +().-]+$/.test(cleaned.phone) || cleaned.phone.replace(/\D/g, '').length < 6) {
    throw waitlistError_('invalid_phone');
  }
  if (DEMO_INDUSTRIES.indexOf(cleaned.industry) === -1) throw waitlistError_('invalid_industry');
  if (DEMO_COMPANY_SIZES.indexOf(cleaned.companySize) === -1) throw waitlistError_('invalid_company_size');
  if (input.website !== '' && input.website !== undefined) throw waitlistError_('invalid_input');
  if (!validSource_(input.source)) throw waitlistError_('invalid_source');
  if (input.consentVersion !== DEMO_CONSENT) throw waitlistError_('invalid_consent');
  cleaned.lang = signupLanguage_(input.lang);
  cleaned.requestId = input.requestId;
  cleaned.source = input.source;
  cleaned.consentVersion = input.consentVersion;
  return cleaned;
}

function registerDemo_(input, deps) {
  return registerRequest_(input, deps, validateDemo_, false);
}

function registerRequest_(input, deps, validate, deduplicateEmail) {
  var signup;
  var requestId = input && typeof input.requestId === 'string' &&
    /^[a-f0-9-]{36}$/i.test(input.requestId) ? input.requestId : null;
  try {
    signup = validate(input);
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
      if (!record && deduplicateEmail) record = deps.store.find('email', signup.email);
      if (!record) {
        record = Object.assign({}, signup, {
          createdAt: new Date(deps.now()).toISOString(),
          registration: 'saved',
          welcome: 'pending',
          attempts: 0,
          lastAttemptAt: '',
          nextAttemptAt: '',
          sentAt: '',
          messageId: '',
          errorCode: ''
        });
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

function validateSurvey_(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw waitlistError_('invalid_input');
  }
  if (!validRequestId_(input.requestId)) throw waitlistError_('invalid_request_id');
  var email = cleanEmail_(input.email);
  if (input.surveyId !== SURVEY_ID) throw waitlistError_('invalid_survey');
  if (typeof input.answer !== 'string' ||
      !Object.prototype.hasOwnProperty.call(SURVEY_OPTIONS, input.answer)) {
    throw waitlistError_('invalid_answer');
  }
  if (!validSource_(input.source)) throw waitlistError_('invalid_source');
  return {
    requestId: input.requestId,
    email: email,
    surveyId: input.surveyId,
    answer: input.answer
  };
}

function recordSurvey_(input, deps) {
  var requestId = input && typeof input.requestId === 'string' &&
    /^[a-f0-9-]{36}$/i.test(input.requestId) ? input.requestId : null;
  var survey;
  try {
    survey = validateSurvey_(input);
  } catch (error) {
    deps.log('survey', requestId, error.code || 'invalid_input');
    return surveyResult_(requestId, 'not_saved', error.code || 'invalid_input');
  }

  try {
    return deps.store.withLock(function () {
      var registration = deps.store.find('requestId', survey.requestId);
      if (registration && registration.email !== survey.email) {
        throw waitlistError_('request_conflict');
      }
      registration = registration || deps.store.find('email', survey.email);
      if (!registration || registration.registration !== 'saved') {
        throw waitlistError_('not_registered');
      }
      var record = deps.surveyStore.findBy(survey.email, survey.surveyId);
      var now = new Date(deps.now()).toISOString();
      if (record) {
        record.answer = survey.answer;
        record.answerLabel = SURVEY_OPTIONS[survey.answer];
        record.updatedAt = now;
        deps.surveyStore.update(record);
      } else {
        deps.surveyStore.append({
          answeredAt: now,
          email: survey.email,
          requestId: survey.requestId,
          surveyId: survey.surveyId,
          answer: survey.answer,
          answerLabel: SURVEY_OPTIONS[survey.answer],
          updatedAt: now
        });
      }
      return surveyResult_(survey.requestId, 'saved', null);
    });
  } catch (error) {
    deps.log('survey', survey.requestId, error.code || 'storage_error');
    return surveyResult_(survey.requestId, 'not_saved', error.code || 'storage_error');
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

function productionDependencies_(type) {
  var demo = type === 'demo';
  return {
    store: demo ? sheetStore_(DEMO_SHEET, DEMO_COLUMNS) : sheetStore_(),
    surveyStore: sheetStore_(SURVEY_SHEET, SURVEY_COLUMNS),
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
        var response = Gmail.Users.Messages.send({
          raw: demo ? demoMime_(record) : welcomeMime_(record)
        }, 'me');
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

function sheetColumnIndexes_(headers, columns, code) {
  return columns.map(function (column) {
    var index = headers.indexOf(column[1]);
    if (index < 0 || headers.lastIndexOf(column[1]) !== index) {
      throw waitlistError_(code || 'storage_schema_mismatch');
    }
    return index;
  });
}

function sheetStore_(sheetName, columns) {
  sheetName = sheetName || WAITLIST_SHEET;
  columns = columns || WAITLIST_COLUMNS;
  var sheet;
  var indexes;
  var width;
  var writeGroups;
  function getSheet() {
    if (sheet) return sheet;
    var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (!id) throw waitlistError_('storage_not_configured');
    var target = SpreadsheetApp.openById(id).getSheetByName(sheetName);
    if (!target) throw waitlistError_('storage_not_configured');
    width = target.getLastColumn();
    if (!width) throw waitlistError_('storage_schema_mismatch');
    var headers = target.getRange(1, 1, 1, width).getValues()[0];
    indexes = sheetColumnIndexes_(headers, columns);
    writeGroups = [];
    columns.map(function (column, i) { return { key: column[0], index: indexes[i] }; })
      .sort(function (a, b) { return a.index - b.index; })
      .forEach(function (column) {
        var group = writeGroups[writeGroups.length - 1];
        if (!group || group[group.length - 1].index + 1 !== column.index) {
          group = [];
          writeGroups.push(group);
        }
        group.push(column);
      });
    sheet = target;
    return sheet;
  }
  function write(record) {
    var target = getSheet();
    // Write only managed columns, leaving any extra cells and formulas untouched.
    writeGroups.forEach(function (group) {
      target.getRange(record.row, group[0].index + 1, 1, group.length)
        .setValues([group.map(function (column) { return safeCell_(record[column.key]); })]);
    });
    SpreadsheetApp.flush();
  }
  function readRow(number, cells) {
    cells = cells || getSheet().getRange(number, 1, 1, width).getValues()[0];
    var record = { row: number };
    columns.forEach(function (column, i) {
      var value = cells[indexes[i]];
      // Sheets can coerce text such as 1688 and TRUE into numbers and booleans.
      record[column[0]] = column[0] === 'attempts' || /At$/.test(column[0]) ?
        (value instanceof Date ? value.toISOString() : value) :
        String(value === undefined || value === null ? '' : value);
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
      var index = columns.map(function (column) { return column[0]; }).indexOf(key);
      if (index < 0) throw waitlistError_('invalid_lookup');
      var found = target.getRange(2, indexes[index] + 1, target.getLastRow() - 1, 1)
        .createTextFinder(value).matchEntireCell(true).useRegularExpression(false).findNext();
      return found ? readRow(found.getRow()) : null;
    },
    findBy: function (email, surveyId) {
      var target = getSheet();
      if (target.getLastRow() < 2) return null;
      var keys = columns.map(function (column) { return column[0]; });
      var emailIndex = keys.indexOf('email');
      if (emailIndex < 0 || keys.indexOf('surveyId') < 0) throw waitlistError_('invalid_lookup');
      var matches = target.getRange(2, indexes[emailIndex] + 1, target.getLastRow() - 1, 1)
        .createTextFinder(email).matchEntireCell(true).useRegularExpression(false).findAll();
      for (var i = 0; i < matches.length; i++) {
        var record = readRow(matches[i].getRow());
        if (record.email === email && record.surveyId === surveyId) return record;
      }
      return null;
    },
    append: function (record) {
      record.row = getSheet().getLastRow() + 1;
      write(record);
      return record;
    },
    update: function (record) {
      write(record);
    },
    pending: function (dueAt) {
      var target = getSheet();
      var records = [];
      if (target.getLastRow() < 2) return records;
      var rows = target.getRange(2, 1, target.getLastRow() - 1, width).getValues();
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
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw waitlistError_('busy');
  try {
    setupWaitlistSheets_();
  } finally {
    lock.releaseLock();
  }
}

function setupWaitlistSheets_() {
  var properties = PropertiesService.getScriptProperties();
  var id = properties.getProperty('SPREADSHEET_ID');
  var spreadsheet = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw waitlistError_('set_SPREADSHEET_ID_first');
  properties.setProperty('SPREADSHEET_ID', spreadsheet.getId());
  [
    [WAITLIST_SHEET, WAITLIST_COLUMNS], [SURVEY_SHEET, SURVEY_COLUMNS],
    [DEMO_SHEET, DEMO_COLUMNS]
  ].forEach(function (definition) {
    var name = definition[0];
    var columns = definition[1];
    var sheet = spreadsheet.getSheetByName(name);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(name);
      sheet.getRange(1, 1, 1, columns.length)
        .setValues([columns.map(function (column) { return column[1]; })])
        .setFontWeight('bold');
      sheet.setFrozenRows(1);
      sheet.setColumnWidths(1, columns.length, 170);
      sheet.setColumnWidth(columns.map(function (column) { return column[0]; }).indexOf('email') + 1, 260);
    } else {
      var width = sheet.getLastColumn();
      var headers = width ? sheet.getRange(1, 1, 1, width).getValues()[0] : [];
      var missing = columns.filter(function (column) {
        var index = headers.indexOf(column[1]);
        if (index !== headers.lastIndexOf(column[1])) throw waitlistError_('storage_schema_mismatch');
        return index < 0;
      }).map(function (column) { return column[1]; });
      if (missing.length) {
        var extra = width + missing.length - sheet.getMaxColumns();
        if (extra > 0) sheet.insertColumnsAfter(sheet.getMaxColumns(), extra);
        sheet.getRange(1, width + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
      }
    }
    sheetStore_(name, columns).find('requestId', 'setup-check');
  });
  console.log(JSON.stringify({
    storage: 'ready', spreadsheet: spreadsheet.getUrl(), sheet: WAITLIST_SHEET,
    surveySheet: SURVEY_SHEET, demoSheet: DEMO_SHEET
  }));
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
  retryPendingEmails_(deps);
  retryPendingEmails_(productionDependencies_('demo'));
}

function retryPendingEmails_(deps) {
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

function emailValue_(value) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(value)) {
    throw waitlistError_('invalid_email_content');
  }
  return value;
}

function requestEmail_(record, type) {
  var ja = record.lang === 'ja';
  var demo = type === 'demo';
  var legacyName = emailValue_(record.name);
  var first = emailValue_(record.firstName) || legacyName.split(/\s+/)[0];
  var last = emailValue_(record.lastName) || legacyName;
  var company = emailValue_(record.company);
  var home = 'https://jinai.md/' + (ja ? 'ja/' : '');
  var heading = ja ? (demo ? ['お話しできるのを', '楽しみにしております'] :
    ['ウェイトリストへの', 'ご登録', 'ありがとうございます！']) :
    [demo ? "We're looking forward to meeting you" : "You're on the waitlist!"];
  return {
    lang: ja ? 'ja' : 'en',
    subject: ja ? last + (demo ? '様、Jin AI のデモにお申し込みいただきありがとうございます' :
      '様、Jin AI のウェイトリストにご登録いただきました') :
      first + (demo ? ', thanks for requesting a Jin AI demo' : ", you're on the Jin AI waitlist"),
    heading: heading.join(''),
    headingPhrases: heading,
    salutation: ja ? (company ? [company, last + '様'] : [last + '様']) : ['Hi ' + first + ','],
    paragraphs: ja ? (demo ? [
      'Jin AI のデモにお申し込みいただき、ありがとうございます。',
      '日程の調整のため、こちらからメールでご連絡します。デモで特に見たいことがあれば、このメールにそのまま返信してください。'
    ] : [
      'Jin AI にご関心をお寄せいただき、ありがとうございます。',
      'Jin AIは、企業の大切な情報を守りながら、AIエージェントの知識やスキルを組織全体で共有・活用できるようにするプラットフォームです。',
      '現在、サービスの公開に向けて準備を進めています。',
      '先行利用のご案内や最新情報は、ご登録いただいたメールアドレスにお届けします。',
      'また、' + last + '様のご利用環境に合わせたデモもご案内しています。ご興味がございましたら、ぜひお気軽にお申し込みください。'
    ]) : (demo ? [
      'Thanks for requesting a Jin AI demo for ' + company + '.',
      "We'll email you to find a time. If there's anything you'd like us to cover, just reply to this email."
    ] : [
      'Thanks for your interest in Jin AI!' + (company ? " We've added " + company + ' to our waitlist.' : ''),
      'Jin AI helps companies keep their AI agents, skills, and knowledge secure, shared across teams, and always up to date.',
      "We're getting ready to launch and will email you when early access becomes available.",
      "In the meantime, we'd love to show you how Jin AI could work for your team. If you're interested, feel free to book a demo."
    ]),
    button: demo ? '' : (ja ? 'デモを申し込む' : 'Request a demo'),
    closing: demo ? '' : (ja ? last + '様にJin AIをお試しいただける日を楽しみにしております。' :
      'We look forward to having you try Jin AI, ' + first + '!'),
    demoUrl: home + '#request-demo',
    home: home,
    privacy: ja ? 'プライバシーポリシー' : 'Privacy Policy',
    privacyUrl: home + 'privacy/',
    unsubscribe: demo ? '' : (ja ? '配信停止をご希望の場合は、「unsubscribe」と返信してください。' :
      "To stop receiving emails, reply with 'unsubscribe'.")
  };
}

function requestEmailText_(email) {
  var blocks = [email.heading, email.salutation.join('\r\n')].concat(email.paragraphs);
  if (email.button) blocks.push(email.button + '\r\n' + email.demoUrl);
  if (email.closing) blocks.push(email.closing);
  blocks.push('Yu Asano\r\nFounder, Jin AI');
  blocks.push('jinai.md: ' + email.home + '\r\n' + email.privacy + ': ' + email.privacyUrl);
  if (email.unsubscribe) blocks.push(email.unsubscribe);
  return blocks.join('\r\n\r\n');
}

function requestEmailHtml_(email) {
  // Tables and inline styles work without external fonts, scripts or tracking pixels.
  var paragraph = 'margin:0 0 20px;font-size:16px;line-height:1.8;';
  return [
    '<!doctype html><html lang="' + email.lang + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>',
    '<body style="margin:0;padding:0;background:#f2f2f2;color:#252525;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;"><tr><td align="center" style="padding:24px 16px;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Yu Gothic,Meiryo,Arial,sans-serif;overflow-wrap:anywhere;">',
    '<tr><td style="padding:24px 28px;background:#000000;"><img src="https://jinai.md/brand/jin-mark-email.png" width="136" height="40" alt="Jin AI" style="display:block;border:0;color:#ffffff;"></td></tr>',
    '<tr><td style="padding:32px 28px;">',
    '<h1 style="margin:0 0 28px;font-size:26px;line-height:1.5;font-weight:700;' +
      (email.lang === 'ja' ? 'word-break:keep-all;overflow-wrap:normal;">' + email.headingPhrases.map(function (phrase) {
        return '<span style="display:inline-block;white-space:nowrap;">' + escapeEmailHtml_(phrase) + '</span>';
      }).join('') : '">' + escapeEmailHtml_(email.heading)) + '</h1>',
    '<p style="' + paragraph + '">' + email.salutation.map(escapeEmailHtml_).join('<br>') + '</p>',
    email.paragraphs.map(function (text) {
      return '<p style="' + paragraph + '">' + escapeEmailHtml_(text) + '</p>';
    }).join(''),
    email.button ? '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;"><tr><td bgcolor="#A84A1C" style="border-radius:4px;background:#A84A1C;">' +
      '<a href="' + email.demoUrl + '" style="display:inline-block;padding:14px 24px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;">' +
      escapeEmailHtml_(email.button) + '</a></td></tr></table>' : '',
    email.closing ? '<p style="' + paragraph + '">' + escapeEmailHtml_(email.closing) + '</p>' : '',
    '<p style="margin:28px 0 0;font-size:16px;line-height:1.8;">Yu Asano<br>Founder, Jin AI</p>',
    '</td></tr><tr><td style="padding:20px 28px;border-top:1px solid #e5e5e5;font-size:13px;line-height:1.8;color:#616161;">',
    '<a href="' + email.home + '" style="color:#616161;">jinai.md</a><br>',
    '<a href="' + email.privacyUrl + '" style="color:#616161;">' + email.privacy + '</a>',
    email.unsubscribe ? '<p style="margin:12px 0 0;">' + escapeEmailHtml_(email.unsubscribe) + '</p>' : '',
    '</td></tr></table></td></tr></table></body></html>'
  ].join('');
}

function welcomeText_(record) {
  return requestEmailText_(requestEmail_(record, 'waitlist'));
}

function welcomeHtml_(record) {
  return requestEmailHtml_(requestEmail_(record, 'waitlist'));
}

function welcomeMime_(record) {
  var email = requestEmail_(record, 'waitlist');
  return requestMime_(record, 'waitlist', email.subject, requestEmailText_(email), requestEmailHtml_(email));
}

function demoText_(record) {
  return requestEmailText_(requestEmail_(record, 'demo'));
}

function demoHtml_(record) {
  return requestEmailHtml_(requestEmail_(record, 'demo'));
}

function demoMime_(record) {
  var email = requestEmail_(record, 'demo');
  return requestMime_(record, 'demo', email.subject, requestEmailText_(email), requestEmailHtml_(email));
}

function emailMimeSubject_(subject) {
  if (typeof subject !== 'string' || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(subject)) {
    throw waitlistError_('invalid_email_subject');
  }
  var words = [];
  var chunk = '';
  for (var i = 0; i < subject.length; i++) {
    var character = subject.charAt(i);
    if (/[\uD800-\uDBFF]/.test(character) && i + 1 < subject.length) {
      character += subject.charAt(++i);
    }
    if (chunk && Utilities.base64Encode(chunk + character, Utilities.Charset.UTF_8).length + 12 > 75) {
      words.push('=?UTF-8?B?' + Utilities.base64Encode(chunk, Utilities.Charset.UTF_8) + '?=');
      chunk = character;
    } else {
      chunk += character;
    }
  }
  if (chunk) words.push('=?UTF-8?B?' + Utilities.base64Encode(chunk, Utilities.Charset.UTF_8) + '?=');
  return words.join('\r\n ');
}

function requestMime_(record, type, subject, text, html) {
  if (!validRequestId_(record.requestId)) throw waitlistError_('invalid_request_id');
  var recipient = cleanEmail_(record.email);
  var boundary = 'jin-' + type + '-' + record.requestId;
  function bodyPart(text) {
    return Utilities.base64Encode(text, Utilities.Charset.UTF_8).match(/.{1,76}/g).join('\r\n');
  }
  var message = [
    'From: Jin AI <' + WAITLIST_FROM + '>',
    'Reply-To: ' + WAITLIST_FROM,
    'To: <' + recipient + '>',
    'Subject: ' + emailMimeSubject_(subject),
    'Message-ID: <' + type + '-' + record.requestId + '@jinai.md>',
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="' + boundary + '"',
    '',
    '--' + boundary,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    bodyPart(text),
    '--' + boundary,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    bodyPart(html),
    '--' + boundary + '--',
    ''
  ].join('\r\n');
  return Utilities.base64EncodeWebSafe(message, Utilities.Charset.UTF_8).replace(/=+$/, '');
}
