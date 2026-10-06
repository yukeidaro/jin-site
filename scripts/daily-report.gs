var REPORT_TO = 'yukeiasano@gmail.com';
var REPORT_INTERNAL_EMAILS = ['yukeiasano@gmail.com'];
var REPORT_JST_MS = 9 * 60 * 60 * 1000;
var REPORT_DAY_MS = 24 * 60 * 60 * 1000;
var REPORT_CLOUDFLARE_URL = 'https://api.cloudflare.com/client/v4/graphql';

function reportDate_(ms) {
  return new Date(ms + REPORT_JST_MS).toISOString().slice(0, 10);
}

function reportWindow_(nowMs) {
  if (!Number.isFinite(nowMs)) throw new Error('invalid_report_time');
  var today = new Date(nowMs + REPORT_JST_MS);
  var dayEndMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) -
    REPORT_JST_MS;
  var dayStartMs = dayEndMs - REPORT_DAY_MS;
  return {
    dayStartMs: dayStartMs,
    dayEndMs: dayEndMs,
    label: reportDate_(dayStartMs),
    weekStartMs: dayStartMs - 6 * REPORT_DAY_MS
  };
}

function reportSafeText_(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '[メールアドレス省略]')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
}

function reportEmailKey_(email) {
  return String(email === null || email === undefined ? '' : email).trim().toLowerCase();
}

function isInternalEmail_(email) {
  var key = reportEmailKey_(email);
  var at = key.lastIndexOf('@');
  if (at < 1) return false;
  var withoutTag = key.slice(0, at).split('+')[0] + key.slice(at);
  return REPORT_INTERNAL_EMAILS.indexOf(withoutTag) !== -1;
}

function isInternalSignup_(record) {
  return isInternalEmail_(record.email) || /test/i.test(String(record.role || ''));
}

function reportTimestamp_(value, field) {
  var ms = typeof value === 'string' ? Date.parse(value) : NaN;
  if (!Number.isFinite(ms)) throw new Error('invalid_' + field);
  return ms;
}

function summarizeWaitlist_(rows, window) {
  var newRows = [];
  var attention = [];
  var yesterdayEmails = Object.create(null);
  var allEmails = Object.create(null);
  rows.forEach(function (record) {
    if (isInternalSignup_(record)) return;
    var createdAt = reportTimestamp_(record.createdAt, 'waitlist_timestamp');
    var email = reportEmailKey_(record.email);
    if (!email) throw new Error('invalid_waitlist_email');
    allEmails[email] = true;
    if (createdAt >= window.dayStartMs && createdAt < window.dayEndMs) {
      yesterdayEmails[email] = true;
      newRows.push({
        createdAtMs: createdAt,
        time: new Date(createdAt + REPORT_JST_MS).toISOString().slice(11, 16),
        name: reportSafeText_(record.name),
        role: reportSafeText_(record.role),
        welcome: reportSafeText_(record.welcome)
      });
    }
    var status = String(record.welcome || '').trim().toLowerCase();
    if (['pending', 'failed', 'unknown', 'sending'].indexOf(status) !== -1) {
      attention.push({ name: reportSafeText_(record.name), status: status });
    }
  });
  newRows.sort(function (a, b) { return a.createdAtMs - b.createdAtMs; });
  return {
    newCount: newRows.length,
    newUniqueCount: Object.keys(yesterdayEmails).length,
    cumulativeUniqueCount: Object.keys(allEmails).length,
    newRows: newRows,
    attentionCount: attention.length,
    attention: attention
  };
}

function summarizeSurvey_(rows, window) {
  var counts = { A: 0, B: 0, C: 0, D: 0 };
  var newCount = 0;
  rows.forEach(function (record) {
    if (record.surveyId === SURVEY_ID && !reportEmailKey_(record.email)) {
      throw new Error('invalid_survey_email');
    }
    if (record.surveyId !== SURVEY_ID || isInternalEmail_(record.email)) return;
    var answeredAt = reportTimestamp_(record.answeredAt, 'survey_timestamp');
    if (!Object.prototype.hasOwnProperty.call(counts, record.answer)) {
      throw new Error('invalid_survey_answer');
    }
    counts[record.answer]++;
    if (answeredAt >= window.dayStartMs && answeredAt < window.dayEndMs) newCount++;
  });
  return {
    newCount: newCount,
    breakdown: Object.keys(SURVEY_OPTIONS).map(function (answer) {
      return { answer: answer, label: SURVEY_OPTIONS[answer], count: counts[answer] };
    })
  };
}

function cloudflareQuery_(accountTag, siteTag, window) {
  var definitions = ['$accountTag: string', '$siteTag: string'];
  var variables = { accountTag: accountTag, siteTag: siteTag };
  var selections = [];
  for (var i = 0; i < 7; i++) {
    var start = 'start' + i;
    var end = 'end' + i;
    definitions.push('$' + start + ': Time', '$' + end + ': Time');
    variables[start] = new Date(window.weekStartMs + i * REPORT_DAY_MS).toISOString();
    variables[end] = new Date(window.weekStartMs + (i + 1) * REPORT_DAY_MS).toISOString();
    // No dimensions: one total per exact JST day, without relying on a UTC date dimension.
    selections.push('day' + i + ': rumPageloadEventsAdaptiveGroups(' +
      'limit: 1, filter: { siteTag: $siteTag, ' +
      'datetime_geq: $' + start + ', datetime_lt: $' + end + ' }) ' +
      '{ count sum { visits } }');
  }
  [
    ['topReferrers', 'refererHost'],
    ['topPaths', 'requestPath'],
    ['topCountries', 'countryName']
  ].forEach(function (group) {
    selections.push(group[0] + ': rumPageloadEventsAdaptiveGroups(' +
      'limit: 5, orderBy: [count_DESC], filter: { siteTag: $siteTag, ' +
      'datetime_geq: $start6, datetime_lt: $end6 }) ' +
      '{ count sum { visits } dimensions { ' + group[1] + ' } }');
  });
  return {
    query: 'query DailyReport(' + definitions.join(', ') + ') { viewer { ' +
      'accounts(filter: { accountTag: $accountTag }) { ' + selections.join(' ') + ' } } }',
    variables: variables
  };
}

function cloudflareNumber_(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+$/.test(value))) {
    throw new Error('invalid_cloudflare_metric');
  }
  var number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error('invalid_cloudflare_metric');
  return number;
}

function cloudflareDay_(groups) {
  if (!Array.isArray(groups)) throw new Error('missing_cloudflare_daily_data');
  var pageViews = 0;
  var visits = 0;
  groups.forEach(function (group) {
    if (!group || !group.sum) throw new Error('invalid_cloudflare_daily_data');
    pageViews += cloudflareNumber_(group.count);
    visits += cloudflareNumber_(group.sum.visits);
  });
  if (!Number.isSafeInteger(pageViews) || !Number.isSafeInteger(visits)) {
    throw new Error('invalid_cloudflare_metric');
  }
  return { pageViews: pageViews, visits: visits };
}

function cloudflareTop_(groups, dimension) {
  if (!Array.isArray(groups)) throw new Error('missing_cloudflare_' + dimension);
  return groups.map(function (group) {
    if (!group || !group.dimensions ||
        !Object.prototype.hasOwnProperty.call(group.dimensions, dimension)) {
      throw new Error('invalid_cloudflare_' + dimension);
    }
    var value = group.dimensions[dimension];
    return {
      label: value === null || value === '' ? '（不明）' : reportSafeText_(value),
      pageViews: cloudflareNumber_(group.count)
    };
  });
}

function parseCloudflare_(json, window) {
  if (!json || typeof json !== 'object') throw new Error('invalid_cloudflare_response');
  if (json.errors && (!Array.isArray(json.errors) || json.errors.length)) {
    var messages = Array.isArray(json.errors) ? json.errors.map(function (error) {
      return error && error.message ? String(error.message) : 'message missing';
    }).join('; ') : 'invalid errors field';
    throw new Error('GraphQL: ' + messages);
  }
  var accounts = json.data && json.data.viewer && json.data.viewer.accounts;
  if (!Array.isArray(accounts) || accounts.length !== 1) {
    throw new Error('missing_cloudflare_account_data');
  }
  var account = accounts[0];
  if (!account || typeof account !== 'object') throw new Error('invalid_cloudflare_account_data');
  var days = [];
  for (var i = 0; i < 7; i++) {
    var daily = cloudflareDay_(account['day' + i]);
    days.push({
      date: reportDate_(window.weekStartMs + i * REPORT_DAY_MS),
      pageViews: daily.pageViews,
      visits: daily.visits
    });
  }
  return {
    days: days,
    yesterday: { pageViews: days[6].pageViews, visits: days[6].visits },
    referrers: cloudflareTop_(account.topReferrers, 'refererHost'),
    paths: cloudflareTop_(account.topPaths, 'requestPath'),
    countries: cloudflareTop_(account.topCountries, 'countryName')
  };
}

function fetchCloudflare_(properties, window) {
  var token = properties.getProperty('CF_API_TOKEN');
  var accountTag = properties.getProperty('CF_ACCOUNT_ID');
  var siteTag = properties.getProperty('CF_SITE_TAG');
  if (!token || !accountTag || !siteTag) return { analytics: null, analyticsError: null };
  try {
    var response = UrlFetchApp.fetch(REPORT_CLOUDFLARE_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify(cloudflareQuery_(accountTag, siteTag, window)),
      muteHttpExceptions: true
    });
    var status = response.getResponseCode();
    var json;
    try {
      json = JSON.parse(response.getContentText());
    } catch (error) {
      throw new Error('HTTP ' + status + ': invalid JSON');
    }
    if (status !== 200) {
      var messages = Array.isArray(json.errors) ? json.errors.map(function (error) {
        return error && error.message ? String(error.message) : 'message missing';
      }).join('; ') : '';
      throw new Error('HTTP ' + status + (messages ? ': ' + messages : ''));
    }
    return { analytics: parseCloudflare_(json, window), analyticsError: null };
  } catch (error) {
    var message = reportSafeText_(String(error.message || error).split(token).join('[redacted]'));
    console.error('dailyReport Cloudflare: ' + message);
    return { analytics: null, analyticsError: message };
  }
}

function reportSheetRecords_(spreadsheet, sheetName, columns) {
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error('storage_not_configured: ' + sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 1) throw new Error('storage_not_configured: ' + sheetName);
  var headers = sheet.getRange(1, 1, 1, columns.length).getValues()[0];
  if (JSON.stringify(headers) !== JSON.stringify(columns.map(function (column) { return column[1]; }))) {
    throw new Error('storage_schema_mismatch: ' + sheetName);
  }
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, columns.length).getValues()
    .map(function (cells) {
      var record = {};
      columns.forEach(function (column, index) {
        record[column[0]] = cells[index] instanceof Date ? cells[index].toISOString() : cells[index];
      });
      return record;
    });
}

function reportHtmlTable_(headings, rows) {
  var cells = function (values, tag) {
    return '<tr>' + values.map(function (value) {
      return '<' + tag + (tag === 'th' ? ' scope="col"' : '') +
        ' style="border-bottom:1px solid #ddd;padding:6px;text-align:left;' +
        'vertical-align:top;">' + escapeEmailHtml_(reportSafeText_(value)) + '</' + tag + '>';
    }).join('') + '</tr>';
  };
  if (!rows.length) return '<p>該当なし</p>';
  return '<table style="border-collapse:collapse;width:100%;font-size:13px;">' +
    '<thead>' + cells(headings, 'th') + '</thead><tbody>' +
    rows.map(function (row) { return cells(row, 'td'); }).join('') + '</tbody></table>';
}

function buildDailyReport_(data) {
  var window = data.window;
  var waitlist = data.waitlist;
  var survey = data.survey;
  var analytics = data.analytics;
  var newRows = waitlist.newRows.map(function (row) {
    return [row.time, row.name, row.role, row.welcome];
  });
  var attentionRows = waitlist.attention.map(function (row) {
    return [row.name, row.status];
  });
  var answerRows = survey.breakdown.map(function (option) {
    return [option.answer, option.label, option.count];
  });
  var sheetUrl = reportSafeText_(data.sheetUrl);
  var subject = '[JinAI] 日次レポート ' + window.label + '（新規 ' + waitlist.newCount +
    ' 人 / PV ' + (analytics ? analytics.yesterday.pageViews : '未計測') + '）';
  var text = [
    'ウェイトリスト',
    '昨日の新規登録（社外）: ' + waitlist.newCount + ' 人（ユニーク ' +
      waitlist.newUniqueCount + ' 件）',
    '累計（社外、ユニークなメールアドレス数）: ' + waitlist.cumulativeUniqueCount + ' 件',
    '昨日の新規一覧（JST）:',
    newRows.length ? '時刻  名前  役割  歓迎メール' : '該当なし'
  ];
  newRows.forEach(function (row) { text.push(row.map(reportSafeText_).join('  ')); });
  text.push('歓迎メールの要対応: ' + waitlist.attentionCount + ' 件');
  attentionRows.forEach(function (row) { text.push(row.map(reportSafeText_).join('  ')); });
  text.push('', 'アンケート（' + SURVEY_ID + '）',
    '昨日の回答数（社外）: ' + survey.newCount + ' 件', '累計の内訳:');
  answerRows.forEach(function (row) {
    text.push(row[0] + '  ' + reportSafeText_(row[1]) + '  ' + row[2] + ' 件');
  });
  text.push('', 'サイト訪問（Cloudflare Web Analytics）');

  var html = [
    '<!doctype html><html lang="ja"><head><meta charset="utf-8"></head>',
    '<body style="margin:0;padding:24px;color:#252525;font-family:Arial,sans-serif;line-height:1.6;">',
    '<main style="max-width:640px;margin:0 auto;">',
    '<h1 style="font-size:20px;">Jin AI 日次レポート ' + escapeEmailHtml_(window.label) + '</h1>',
    '<h2 style="font-size:17px;">ウェイトリスト</h2>',
    '<p>昨日の新規登録（社外）: ' + waitlist.newCount + ' 人（ユニーク ' +
      waitlist.newUniqueCount + ' 件）<br>累計（社外、ユニークなメールアドレス数）: ' +
      waitlist.cumulativeUniqueCount + ' 件</p>',
    '<h3 style="font-size:14px;">昨日の新規一覧（JST）</h3>',
    reportHtmlTable_(['時刻', '名前', '役割', '歓迎メール'], newRows),
    '<h3 style="font-size:14px;">歓迎メールの要対応: ' + waitlist.attentionCount + ' 件</h3>',
    reportHtmlTable_(['名前', '状態'], attentionRows),
    '<h2 style="font-size:17px;">アンケート（' + escapeEmailHtml_(SURVEY_ID) + '）</h2>',
    '<p>昨日の回答数（社外）: ' + survey.newCount + ' 件</p>',
    '<h3 style="font-size:14px;">累計の内訳</h3>',
    reportHtmlTable_(['回答', '内容', '件数'], answerRows),
    '<h2 style="font-size:17px;">サイト訪問（Cloudflare Web Analytics）</h2>'
  ];

  if (!analytics) {
    var unavailable = data.analyticsError ?
      '取得失敗: ' + reportSafeText_(data.analyticsError) :
      '未設定: Script properties に CF_API_TOKEN / CF_ACCOUNT_ID / CF_SITE_TAG を設定してください。';
    text.push(unavailable);
    html.push('<p>' + escapeEmailHtml_(unavailable) + '</p>');
  } else {
    var dayRows = analytics.days.map(function (day) {
      return [day.date, day.pageViews, day.visits];
    });
    text.push('昨日: ページビュー ' + analytics.yesterday.pageViews +
      ' / 訪問数 ' + analytics.yesterday.visits,
      '直近7日（JST）:', '日付  ページビュー  訪問数');
    dayRows.forEach(function (row) { text.push(row.join('  ')); });
    html.push('<p>昨日: ページビュー ' + analytics.yesterday.pageViews +
      ' / 訪問数 ' + analytics.yesterday.visits + '</p>',
      '<h3 style="font-size:14px;">直近7日（JST）</h3>',
      reportHtmlTable_(['日付', 'ページビュー', '訪問数'], dayRows));
    [
      ['昨日の参照元ホスト 上位5件', analytics.referrers],
      ['昨日のパス 上位5件', analytics.paths],
      ['昨日の国 上位5件', analytics.countries]
    ].forEach(function (section) {
      var rows = section[1].map(function (entry) {
        return [entry.label, entry.pageViews];
      });
      text.push(section[0] + ':');
      if (!rows.length) text.push('該当なし');
      rows.forEach(function (row) { text.push(reportSafeText_(row[0]) + '  ' + row[1]); });
      html.push('<h3 style="font-size:14px;">' + section[0] + '</h3>',
        reportHtmlTable_(['項目', 'ページビュー'], rows));
    });
  }

  text.push('', 'スプレッドシート: ' + sheetUrl,
    'Web Analytics: https://dash.cloudflare.com/',
    'このメールは Apps Script の dailyReport トリガーから自動送信');
  html.push('<p style="border-top:1px solid #ddd;padding-top:12px;font-size:12px;">' +
    'スプレッドシート: <a href="' + escapeEmailHtml_(sheetUrl) + '">' +
      escapeEmailHtml_(sheetUrl) + '</a><br>' +
    'Web Analytics: <a href="https://dash.cloudflare.com/">https://dash.cloudflare.com/</a><br>' +
    'このメールは Apps Script の dailyReport トリガーから自動送信</p>',
    '</main></body></html>');
  return { subject: subject, text: text.join('\n'), html: html.join('') };
}

function reportMimeSubject_(subject) {
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

function dailyReportMime_(report, from) {
  var sender = cleanEmail_(from);
  if (sender === WAITLIST_FROM) throw new Error('daily_report_sender_must_be_default');
  var boundary = 'jin-daily-report';
  function bodyPart(value) {
    return Utilities.base64Encode(value, Utilities.Charset.UTF_8).match(/.{1,76}/g).join('\r\n');
  }
  var message = [
    'From: ' + sender,
    'To: ' + REPORT_TO,
    'Subject: ' + reportMimeSubject_(report.subject),
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="' + boundary + '"',
    '',
    '--' + boundary,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    bodyPart(report.text),
    '--' + boundary,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    bodyPart(report.html),
    '--' + boundary + '--',
    ''
  ].join('\r\n');
  return Utilities.base64EncodeWebSafe(message, Utilities.Charset.UTF_8).replace(/=+$/, '');
}

function dailyReportSender_() {
  // The account's own (primary) address, whichever alias is set as default.
  var aliases = Gmail.Users.Settings.SendAs.list('me').sendAs || [];
  var primary = aliases.filter(function (alias) { return alias.isPrimary; });
  if (primary.length !== 1 || !primary[0].sendAsEmail ||
      reportEmailKey_(primary[0].sendAsEmail) === WAITLIST_FROM) {
    throw new Error('daily_report_sender_must_be_primary_account');
  }
  return cleanEmail_(primary[0].sendAsEmail);
}

function dailyReportFailure_(nowMs, error) {
  var label = reportWindow_(nowMs).label;
  var message = reportSafeText_(String(error && error.message || error));
  var body = '日次レポートを作成できませんでした。\n理由: ' + message +
    '\nApps Script の実行ログを確認してください。';
  return {
    subject: '[JinAI] 日次レポート ' + label + '（作成失敗）',
    text: body,
    html: '<!doctype html><html lang="ja"><head><meta charset="utf-8"></head><body>' +
      '<p>' + escapeEmailHtml_(body).replace(/\n/g, '<br>') + '</p></body></html>'
  };
}

function collectDailyReport_() {
  var properties = PropertiesService.getScriptProperties();
  var id = properties.getProperty('SPREADSHEET_ID');
  var spreadsheet = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('set_SPREADSHEET_ID_first');
  var window = reportWindow_(Date.now());
  var waitlist = summarizeWaitlist_(
    reportSheetRecords_(spreadsheet, WAITLIST_SHEET, WAITLIST_COLUMNS), window);
  var survey = summarizeSurvey_(
    reportSheetRecords_(spreadsheet, SURVEY_SHEET, SURVEY_COLUMNS), window);
  var traffic = fetchCloudflare_(properties, window);
  return buildDailyReport_({
    window: window,
    waitlist: waitlist,
    survey: survey,
    analytics: traffic.analytics,
    analyticsError: traffic.analyticsError,
    sheetUrl: spreadsheet.getUrl()
  });
}

function sendDailyReport() {
  var sender = dailyReportSender_();
  var report;
  var failure = null;
  try {
    report = collectDailyReport_();
  } catch (error) {
    // Still email Yu, so a broken report is noticed the same morning.
    failure = error;
    report = dailyReportFailure_(Date.now(), error);
  }
  var response = Gmail.Users.Messages.send({ raw: dailyReportMime_(report, sender) }, 'me');
  if (!response || !response.id) throw new Error('daily_report_send_unconfirmed');
  if (failure) throw failure;
}

function inspectDailyReport() {
  console.log(collectDailyReport_().text);
}

function installDailyReport() {
  var exists = ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === 'sendDailyReport';
  });
  if (!exists) {
    ScriptApp.newTrigger('sendDailyReport').timeBased().atHour(8).nearMinute(0)
      .everyDays(1).inTimezone('Asia/Tokyo').create();
  }
  console.log('Daily report trigger is installed.');
}
