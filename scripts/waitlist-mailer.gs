/**
 * Jin AI waitlist auto-responder (Google Apps Script).
 *
 * This file is the source of truth for the script that runs in Apps Script.
 * It does not run in this repository. Paste it into the project below.
 *
 *   https://script.google.com/home/projects/1T82k5UtwjagfdLxzhGG_td0_sYk9R3wDLAsmdeG7STKhBmoAgUcK7XQE/edit
 *
 * Setup, once:
 *   1. Open the responses spreadsheet:
 *      https://docs.google.com/spreadsheets/d/19R5d9rULpYrBYYXRPiwLbRUj1nmW4j_OCWSW6AM1Rog/edit
 *   2. In Apps Script, add a trigger: onWaitlistSubmit / From spreadsheet / On form submit.
 *   3. Run sendPreview once and confirm the From address on the mail you receive.
 *
 * Sending as hello@jinai.md:
 *   hello@jinai.md is an alias of yuasano@babyvoicerecorder.com in Google Workspace,
 *   so it already receives mail. To send as it, Gmail also needs it under
 *   Settings > Accounts and Import > "Send mail as". Until that exists,
 *   GmailApp rejects the from option, so this script checks getAliases() first and
 *   falls back to the account address with hello@jinai.md as Reply-To. The email
 *   still goes out; it upgrades itself the moment the alias is registered.
 */

var FROM_ALIAS = 'hello@jinai.md';
var SENDER_NAME = 'Jin AI';
var DISCORD_URL = 'https://discord.gg/hn8eG4d9f';
var SITE_URL = 'https://jinai.md/';

function onWaitlistSubmit(e) {
  var values = e && e.namedValues ? e.namedValues : {};
  var first = function (key) {
    var v = values[key];
    return v && v.length ? String(v[0]).trim() : '';
  };

  var email = first('Email');
  if (!email || email.indexOf('@') < 1) return;

  var name = first('Name');
  var firstName = name ? name.split(/\s+/)[0] : '';
  var greeting = firstName ? 'Hi ' + firstName + ',' : 'Hi,';

  sendWelcome(email, greeting);
}

function sendWelcome(to, greeting) {
  var options = {
    name: SENDER_NAME,
    replyTo: FROM_ALIAS,
    htmlBody: htmlBody(greeting)
  };

  // Only pass "from" when Gmail actually knows the alias, otherwise it throws.
  if (canSendAsAlias()) options.from = FROM_ALIAS;

  GmailApp.sendEmail(to, subject(), plainBody(greeting), options);
}

function canSendAsAlias() {
  try {
    return GmailApp.getAliases().indexOf(FROM_ALIAS) !== -1;
  } catch (error) {
    return false;
  }
}

function subject() {
  return 'You are on the Jin AI waitlist';
}

function plainBody(greeting) {
  return [
    greeting,
    '',
    'Thanks for joining the Jin AI waitlist.',
    '',
    'Jin AI is a visual workspace for the files your AI agents write on your own',
    'computer. You see what they created, put it where it belongs, and undo an',
    "agent's change without touching your own.",
    '',
    'Come see it being built:',
    DISCORD_URL,
    '',
    'That is where early testers watch the build, ask questions and report bugs.',
    'It is also the fastest way to reach us.',
    '',
    'WHAT HAPPENS NEXT',
    '',
    'We are opening early access in small batches. You will get an email from',
    'this address when it is your turn.',
    '',
    'If you have five minutes, just reply to this email and tell us which agents',
    'you use and what your folders look like right now. It genuinely shapes what',
    'we build.',
    '',
    'Yu Asano',
    'Co-founder, Jin AI',
    SITE_URL
  ].join('\n');
}

function htmlBody(greeting) {
  var ink = '#252525';
  var muted = '#5d5d5d';
  var line = '#dddad5';
  var p = 'margin:0 0 18px;font-size:15px;line-height:1.7;color:' + ink + ';';
  var font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

  return [
    '<div style="background:#f5f3ef;padding:32px 16px;">',
    '<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid ' + line + ';border-radius:6px;padding:36px 32px;font-family:' + font + ';">',

    '<div style="font-size:18px;font-weight:700;letter-spacing:-0.02em;color:' + ink + ';margin-bottom:28px;">Jin AI</div>',

    '<p style="' + p + '">' + greeting + '</p>',
    '<p style="' + p + '">Thanks for joining the Jin AI waitlist.</p>',
    '<p style="' + p + '">Jin AI is a visual workspace for the files your AI agents write on your own computer. You see what they created, put it where it belongs, and undo an agent&rsquo;s change without touching your own.</p>',

    '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0;"><tr><td style="background:' + ink + ';border-radius:5px;">',
    '<a href="' + DISCORD_URL + '" style="display:inline-block;padding:13px 26px;color:#f5f3ef;font-size:15px;font-weight:600;text-decoration:none;">Join the Discord</a>',
    '</td></tr></table>',

    '<p style="' + p + '">That is where early testers watch the build, ask questions and report bugs. It is also the fastest way to reach us.</p>',

    '<div style="border-top:1px solid ' + line + ';margin:28px 0;"></div>',

    '<p style="margin:0 0 8px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:' + muted + ';">What happens next</p>',
    '<p style="' + p + '">We are opening early access in small batches. You will get an email from this address when it is your turn.</p>',
    '<p style="' + p + '">If you have five minutes, just reply to this email and tell us which agents you use and what your folders look like right now. It genuinely shapes what we build.</p>',

    '<div style="border-top:1px solid ' + line + ';margin:28px 0 20px;"></div>',

    '<p style="margin:0;font-size:14px;line-height:1.7;color:' + ink + ';">Yu Asano<br>',
    '<span style="color:' + muted + ';">Co-founder, Jin AI</span><br>',
    '<a href="' + SITE_URL + '" style="color:#1659e9;text-decoration:none;">jinai.md</a></p>',

    '</div></div>'
  ].join('');
}

/** Send yourself a copy, then check the From address on what arrives. */
function sendPreview() {
  sendWelcome(Session.getActiveUser().getEmail(), 'Hi Yu,');
  Logger.log('sent as alias: ' + canSendAsAlias());
  Logger.log('aliases available: ' + JSON.stringify(GmailApp.getAliases()));
}

/** Prints the account and the aliases Gmail will accept as a From address. */
function listAliases() {
  Logger.log('account: ' + Session.getActiveUser().getEmail());
  Logger.log('aliases: ' + JSON.stringify(GmailApp.getAliases()));
}
