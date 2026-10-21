export const CONSENT_VERSION = "demo-request-v1";
export const WAITLIST_CONSENT_VERSION = "waitlist-product-updates-v1";
export const WAITLIST_FIELDS = ["firstName", "lastName", "email", "jobTitle", "company"];
export const REQUEST_TIMEOUT_MS = 45000;
export const SURVEY_ID = "ai-friction-v1";

const registrationStates = new Set(["saved", "not_saved", "unknown"]);
const welcomeStates = new Set(["sent", "pending", "failed", "unknown", "not_attempted"]);
const validationMessages = {
  invalid_name: "Please enter your name (up to 120 characters).",
  invalid_email: "Please enter a valid email address.",
  invalid_role: "Please enter what you do (up to 160 characters).",
  invalid_first_name: "Please enter your first name (up to 80 characters).",
  invalid_last_name: "Please enter your last name (up to 80 characters).",
  invalid_job_title: "Please enter your job title (up to 120 characters).",
  invalid_phone: "Use up to 40 characters: digits, spaces, +, -, (, ), or .",
  invalid_company: "Please enter your company (up to 160 characters).",
  invalid_industry: "Please select an industry from the list.",
  invalid_company_size: "Please select a company size from the list.",
  invalid_country: "Please select a country from the list.",
  invalid_consent: "Please refresh the page before requesting a demo.",
  invalid_input: "Your request was not accepted. Please try again or email hello@jinai.md.",
  invalid_source: "Please request a demo from jinai.md or email hello@jinai.md.",
  invalid_request_id: "Please refresh the page and try again.",
  request_conflict: "This request ID belongs to a different request. Please refresh the page and try again.",
  busy: "Demo requests are busy right now. Please try again in a moment."
};
const japaneseMessages = {
  "Please enter your name (up to 120 characters).": "\u304a\u540d\u524d\u3092 120 \u6587\u5b57\u4ee5\u5185\u3067\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
  "Please enter a valid email address.": "\u6b63\u3057\u3044\u30e1\u30fc\u30eb\u30a2\u30c9\u30ec\u30b9\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
  "Please enter what you do (up to 160 characters).": "\u304a\u4ed5\u4e8b\u306e\u5185\u5bb9\u3092 160 \u6587\u5b57\u4ee5\u5185\u3067\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
  "Please enter your first name (up to 80 characters).": "\u540d\u3092 80 \u6587\u5b57\u4ee5\u5185\u3067\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
  "Please enter your last name (up to 80 characters).": "\u59d3\u3092 80 \u6587\u5b57\u4ee5\u5185\u3067\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
  "Please enter your job title (up to 120 characters).": "\u5f79\u8077\u3092 120 \u6587\u5b57\u4ee5\u5185\u3067\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
  "Enter your phone number.": "\u96fb\u8a71\u756a\u53f7\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
  "Use up to 40 characters: digits, spaces, +, -, (, ), or .": "\u96fb\u8a71\u756a\u53f7\u306f\u6570\u5b57\u3001\u7a7a\u767d\u3001+\u3001-\u3001(\u3001)\u3001. \u3092\u4f7f\u3044\u300140 \u6587\u5b57\u4ee5\u5185\u3067\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
  "Please enter your company (up to 160 characters).": "\u4f1a\u793e\u540d\u3092 160 \u6587\u5b57\u4ee5\u5185\u3067\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
  "Please select an industry from the list.": "\u4e00\u89a7\u304b\u3089\u696d\u7a2e\u3092\u9078\u3093\u3067\u304f\u3060\u3055\u3044\u3002",
  "Please select a company size from the list.": "\u4e00\u89a7\u304b\u3089\u5f93\u696d\u54e1\u6570\u3092\u9078\u3093\u3067\u304f\u3060\u3055\u3044\u3002",
  "Please select a country from the list.": "\u4e00\u89a7\u304b\u3089\u56fd\u3092\u9078\u3093\u3067\u304f\u3060\u3055\u3044\u3002",
  "Please refresh the page before requesting a demo.": "\u30da\u30fc\u30b8\u3092\u518d\u8aad\u307f\u8fbc\u307f\u3057\u3066\u304b\u3089\u3001\u30c7\u30e2\u3092\u304a\u7533\u3057\u8fbc\u307f\u304f\u3060\u3055\u3044\u3002",
  "Your request was not accepted. Please try again or email hello@jinai.md.": "\u304a\u7533\u3057\u8fbc\u307f\u3092\u53d7\u3051\u4ed8\u3051\u3089\u308c\u307e\u305b\u3093\u3067\u3057\u305f\u3002\u3082\u3046\u4e00\u5ea6\u304a\u8a66\u3057\u3044\u305f\u3060\u304f\u304b\u3001hello@jinai.md \u307e\u3067\u3054\u9023\u7d61\u304f\u3060\u3055\u3044\u3002",
  "Please request a demo from jinai.md or email hello@jinai.md.": "jinai.md \u304b\u3089\u304a\u7533\u3057\u8fbc\u307f\u3044\u305f\u3060\u304f\u304b\u3001hello@jinai.md \u307e\u3067\u3054\u9023\u7d61\u304f\u3060\u3055\u3044\u3002",
  "Please refresh the page and try again.": "\u30da\u30fc\u30b8\u3092\u518d\u8aad\u307f\u8fbc\u307f\u3057\u3066\u3001\u3082\u3046\u4e00\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002",
  "This request ID belongs to a different request. Please refresh the page and try again.": "\u3053\u306e\u53d7\u4ed8\u756a\u53f7\u306f\u5225\u306e\u304a\u7533\u3057\u8fbc\u307f\u306b\u4f7f\u308f\u308c\u3066\u3044\u307e\u3059\u3002\u30da\u30fc\u30b8\u3092\u518d\u8aad\u307f\u8fbc\u307f\u3057\u3066\u3001\u3082\u3046\u4e00\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002",
  "Demo requests are busy right now. Please try again in a moment.": "\u305f\u3060\u3044\u307e\u304a\u7533\u3057\u8fbc\u307f\u304c\u6df7\u307f\u5408\u3063\u3066\u3044\u307e\u3059\u3002\u5c11\u3057\u5f85\u3063\u3066\u304b\u3089\u3001\u3082\u3046\u4e00\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002",
  "Your request was not saved": "\u304a\u7533\u3057\u8fbc\u307f\u3092\u4fdd\u5b58\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\u3002",
  "Your request is not confirmed": "\u304a\u7533\u3057\u8fbc\u307f\u306e\u4fdd\u5b58\u3092\u78ba\u8a8d\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\u3002",
  "Not saved": "\u672a\u4fdd\u5b58",
  "Not confirmed": "\u672a\u78ba\u8a8d",
  "Not sent": "\u672a\u9001\u4fe1",
  "We could not confirm that your request was saved. Please try again; retries will not create duplicate requests.": "\u304a\u7533\u3057\u8fbc\u307f\u306e\u4fdd\u5b58\u3092\u78ba\u8a8d\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\u3002\u3082\u3046\u4e00\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002\u540c\u3058\u5185\u5bb9\u3092\u518d\u9001\u3057\u3066\u3082\u3001\u91cd\u8907\u3057\u3066\u4fdd\u5b58\u3055\u308c\u308b\u3053\u3068\u306f\u3042\u308a\u307e\u305b\u3093\u3002",
  "Sent": "\u9001\u4fe1\u6e08\u307f",
  "Thanks. Your request is saved and a confirmation email is on its way from hello@jinai.md.": "\u3042\u308a\u304c\u3068\u3046\u3054\u3056\u3044\u307e\u3059\u3002\u304a\u7533\u3057\u8fbc\u307f\u3092\u4fdd\u5b58\u3057\u3001hello@jinai.md \u304b\u3089\u78ba\u8a8d\u30e1\u30fc\u30eb\u3092\u9001\u4fe1\u3057\u307e\u3057\u305f\u3002",
  "Pending - not sent yet": "\u9001\u4fe1\u5f85\u3061\uff08\u672a\u9001\u4fe1\uff09",
  "Your request is saved. Your confirmation email is pending, but we will still reply about your demo. You do not need to submit again.": "\u304a\u7533\u3057\u8fbc\u307f\u3092\u4fdd\u5b58\u3057\u307e\u3057\u305f\u3002\u78ba\u8a8d\u30e1\u30fc\u30eb\u306f\u9001\u4fe1\u5f85\u3061\u3067\u3059\u304c\u3001\u30c7\u30e2\u306b\u3064\u3044\u3066\u306f\u5225\u9014\u3054\u9023\u7d61\u3057\u307e\u3059\u3002\u518d\u5ea6\u306e\u304a\u7533\u3057\u8fbc\u307f\u306f\u4e0d\u8981\u3067\u3059\u3002",
  "Your request is saved, but we could not send your confirmation email. We will still reply about your demo. You do not need to submit again.": "\u304a\u7533\u3057\u8fbc\u307f\u3092\u4fdd\u5b58\u3057\u307e\u3057\u305f\u304c\u3001\u78ba\u8a8d\u30e1\u30fc\u30eb\u3092\u9001\u4fe1\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\u3002\u30c7\u30e2\u306b\u3064\u3044\u3066\u306f\u5225\u9014\u3054\u9023\u7d61\u3057\u307e\u3059\u3002\u518d\u5ea6\u306e\u304a\u7533\u3057\u8fbc\u307f\u306f\u4e0d\u8981\u3067\u3059\u3002",
  "Your request is saved, but we could not confirm the email send. We will still reply about your demo. You do not need to submit again.": "\u304a\u7533\u3057\u8fbc\u307f\u3092\u4fdd\u5b58\u3057\u307e\u3057\u305f\u304c\u3001\u78ba\u8a8d\u30e1\u30fc\u30eb\u306e\u9001\u4fe1\u3092\u78ba\u8a8d\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\u3002\u30c7\u30e2\u306b\u3064\u3044\u3066\u306f\u5225\u9014\u3054\u9023\u7d61\u3057\u307e\u3059\u3002\u518d\u5ea6\u306e\u304a\u7533\u3057\u8fbc\u307f\u306f\u4e0d\u8981\u3067\u3059\u3002",
  "Your demo request is saved": "\u30c7\u30e2\u306e\u304a\u7533\u3057\u8fbc\u307f\u3092\u4fdd\u5b58\u3057\u307e\u3057\u305f\u3002",
  "Saved": "\u4fdd\u5b58\u6e08\u307f",
  "Demo requests are temporarily unavailable. Please email hello@jinai.md.": "\u305f\u3060\u3044\u307e\u30d5\u30a9\u30fc\u30e0\u304b\u3089\u306e\u304a\u7533\u3057\u8fbc\u307f\u3092\u53d7\u3051\u4ed8\u3051\u3066\u3044\u307e\u305b\u3093\u3002hello@jinai.md \u307e\u3067\u3054\u9023\u7d61\u304f\u3060\u3055\u3044\u3002",
  "Please check the marked fields.": "\u8868\u793a\u3055\u308c\u305f\u5165\u529b\u6b04\u3092\u3054\u78ba\u8a8d\u304f\u3060\u3055\u3044\u3002",
  "Saving your request...": "\u4fdd\u5b58\u3057\u3066\u3044\u307e\u3059...",
  "Saving your demo request. Please keep this page open.": "\u30c7\u30e2\u306e\u304a\u7533\u3057\u8fbc\u307f\u3092\u4fdd\u5b58\u3057\u3066\u3044\u307e\u3059\u3002\u3053\u306e\u30da\u30fc\u30b8\u3092\u958b\u3044\u305f\u307e\u307e\u304a\u5f85\u3061\u304f\u3060\u3055\u3044\u3002",
  "Saving your waitlist signup. Please keep this page open.": "\u30a6\u30a7\u30a4\u30c8\u30ea\u30b9\u30c8\u3078\u306e\u767b\u9332\u3092\u4fdd\u5b58\u3057\u3066\u3044\u307e\u3059\u3002\u3053\u306e\u30da\u30fc\u30b8\u3092\u958b\u3044\u305f\u307e\u307e\u304a\u5f85\u3061\u304f\u3060\u3055\u3044\u3002",
  "You're on the waitlist": "\u30a6\u30a7\u30a4\u30c8\u30ea\u30b9\u30c8\u306b\u8ffd\u52a0\u3057\u307e\u3057\u305f",
  "We sent a confirmation to {email}.": "{email} \u306b\u78ba\u8a8d\u30e1\u30fc\u30eb\u3092\u304a\u9001\u308a\u3057\u307e\u3057\u305f\u3002",
  "You're on the waitlist. Your confirmation email is pending. You do not need to submit again.": "\u30a6\u30a7\u30a4\u30c8\u30ea\u30b9\u30c8\u306b\u8ffd\u52a0\u3057\u307e\u3057\u305f\u3002\u78ba\u8a8d\u30e1\u30fc\u30eb\u306f\u9001\u4fe1\u5f85\u3061\u3067\u3059\u3002\u518d\u767b\u9332\u306f\u4e0d\u8981\u3067\u3059\u3002",
  "You're on the waitlist, but we could not send your confirmation email. You do not need to submit again.": "\u30a6\u30a7\u30a4\u30c8\u30ea\u30b9\u30c8\u306b\u8ffd\u52a0\u3057\u307e\u3057\u305f\u304c\u3001\u78ba\u8a8d\u30e1\u30fc\u30eb\u3092\u9001\u4fe1\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\u3002\u518d\u767b\u9332\u306f\u4e0d\u8981\u3067\u3059\u3002",
  "You're on the waitlist, but we could not confirm the email send. You do not need to submit again.": "\u30a6\u30a7\u30a4\u30c8\u30ea\u30b9\u30c8\u306b\u8ffd\u52a0\u3057\u307e\u3057\u305f\u304c\u3001\u78ba\u8a8d\u30e1\u30fc\u30eb\u306e\u9001\u4fe1\u3092\u78ba\u8a8d\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\u3002\u518d\u767b\u9332\u306f\u4e0d\u8981\u3067\u3059\u3002",
  "We could not confirm your request or email status. Please try again; retries will not create duplicate requests.": "\u304a\u7533\u3057\u8fbc\u307f\u306e\u4fdd\u5b58\u3068\u78ba\u8a8d\u30e1\u30fc\u30eb\u306e\u72b6\u614b\u3092\u78ba\u8a8d\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\u3002\u3082\u3046\u4e00\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002\u540c\u3058\u5185\u5bb9\u3092\u518d\u9001\u3057\u3066\u3082\u3001\u91cd\u8907\u3057\u3066\u4fdd\u5b58\u3055\u308c\u308b\u3053\u3068\u306f\u3042\u308a\u307e\u305b\u3093\u3002"
};

function translate(message, language) {
  if (!language.startsWith("ja")) return message;
  if (!Object.hasOwn(japaneseMessages, message)) throw new Error(`Missing Japanese message: ${message}`);
  return japaneseMessages[message];
}

function localizeResult(result, language) {
  return Object.fromEntries(Object.entries(result).map(([key, value]) =>
    [key, ["heading", "registration", "welcome", "detail"].includes(key) ? translate(value, language) : value]));
}
const fieldLimits = {
  email: 254, firstName: 80, lastName: 80, jobTitle: 120, phone: 40,
  company: 160, industry: 80, companySize: 20, country: 80
};
const fieldCodes = {
  email: "invalid_email", firstName: "invalid_first_name", lastName: "invalid_last_name",
  jobTitle: "invalid_job_title", phone: "invalid_phone", company: "invalid_company",
  industry: "invalid_industry", companySize: "invalid_company_size", country: "invalid_country"
};

export function validateDemoFields(payload, choices, language = "en") {
  return validateFields(payload, choices, Object.keys(fieldLimits), language);
}

export function validateWaitlistFields(payload, language = "en") {
  return validateFields(payload, {}, WAITLIST_FIELDS, language);
}

function validateFields(payload, choices, names, language) {
  const errors = {};
  for (const field of names) {
    const limit = fieldLimits[field];
    const raw = payload[field];
    const value = typeof raw === "string" ? raw.trim() : "";
    let invalid = typeof raw !== "string" || /[\u0000-\u001f\u007f]/.test(raw) ||
      !value || value.length > limit;
    if (field === "email" && !invalid) {
      invalid = !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(value) ||
        value.split("@")[0].length > 64 || /^\.|\.\.|\.@/.test(value);
    }
    if (field === "phone" &&
        (!/^[0-9 +().-]+$/.test(value) || value.replace(/\D/g, "").length < 6)) invalid = true;
    if (["industry", "companySize", "country"].includes(field) &&
        !choices[field].includes(value)) invalid = true;
    if (invalid) errors[field] = translate(field === "phone" && !value ?
      "Enter your phone number." : validationMessages[fieldCodes[field]], language);
  }
  return errors;
}

export function isAppsScriptEndpoint(value) {
  return typeof value === "string" &&
    /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(value);
}

export function validateResponse(value, requestId) {
  if (!value || value.version !== 1 || value.requestId !== requestId ||
      !registrationStates.has(value.registration) || !welcomeStates.has(value.welcome) ||
      (value.registration !== "saved" && value.welcome !== "not_attempted") ||
      (value.registration === "saved" && value.welcome === "not_attempted")) {
    throw new Error("The demo request service returned an invalid confirmation.");
  }
  return value;
}

export function validateSurveyResponse(value, requestId) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      value.version !== 1 || value.requestId !== requestId ||
      (value.survey !== "saved" && value.survey !== "not_saved") ||
      (value.survey === "saved" ? value.code !== null :
        typeof value.code !== "string" || !value.code)) {
    throw new Error("The survey service returned an invalid confirmation.");
  }
  return value;
}

export function describeResult(result, language = "en", type = "demo", email = "") {
  if (result.registration !== "saved") {
    return localizeResult({
      saved: false,
      heading: result.registration === "not_saved" ? "Your request was not saved" : "Your request is not confirmed",
      registration: result.registration === "not_saved" ? "Not saved" : "Not confirmed",
      welcome: "Not sent",
      detail: validationMessages[result.code] ||
        "We could not confirm that your request was saved. Please try again; retries will not create duplicate requests.",
      kind: "error"
    }, language);
  }
  const messages = {
    sent: {
      welcome: "Sent",
      detail: "Thanks. Your request is saved and a confirmation email is on its way from hello@jinai.md.",
      kind: "success"
    },
    pending: {
      welcome: "Pending - not sent yet",
      detail: "Your request is saved. Your confirmation email is pending, but we will still reply about your demo. You do not need to submit again.",
      kind: "pending"
    },
    failed: {
      welcome: "Not sent",
      detail: "Your request is saved, but we could not send your confirmation email. We will still reply about your demo. You do not need to submit again.",
      kind: "pending"
    },
    unknown: {
      welcome: "Not confirmed",
      detail: "Your request is saved, but we could not confirm the email send. We will still reply about your demo. You do not need to submit again.",
      kind: "pending"
    }
  };
  if (type === "waitlist") {
    const details = {
      sent: "We sent a confirmation to {email}.",
      pending: "You're on the waitlist. Your confirmation email is pending. You do not need to submit again.",
      failed: "You're on the waitlist, but we could not send your confirmation email. You do not need to submit again.",
      unknown: "You're on the waitlist, but we could not confirm the email send. You do not need to submit again."
    };
    const presentation = localizeResult({
      saved: true, heading: "You're on the waitlist", registration: "Saved",
      ...messages[result.welcome], detail: details[result.welcome]
    }, language);
    presentation.detail = presentation.detail.replace("{email}", () => email);
    return presentation;
  }
  return localizeResult({ saved: true, heading: "Your demo request is saved", registration: "Saved", ...messages[result.welcome] }, language);
}

async function postJson(endpoint, payload, {
  fetchImpl = globalThis.fetch.bind(globalThis),
  timeoutMs = REQUEST_TIMEOUT_MS
} = {}, label = "Demo") {
  if (!isAppsScriptEndpoint(endpoint)) throw new Error("The request service is not configured.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`${label} request failed (${response.status}).`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function submitSignup(endpoint, payload, dependencies = {}) {
  return validateResponse(await postJson(endpoint, payload, dependencies), payload.requestId);
}

export async function submitSurvey(endpoint, payload, dependencies = {}) {
  return validateSurveyResponse(await postJson(endpoint, payload, dependencies, "Survey"), payload.requestId);
}

export function initializeWaitlist(document, dependencies = {}) {
  const language = document.documentElement?.lang || "en";
  const message = (text) => translate(text, language);
  const form = document.getElementById("waitlistForm");
  const status = document.getElementById("waitlistStatus");
  const done = document.getElementById("waitlistDone");
  if (!form || !status || !done) {
    throw new Error("The demo form is missing its status elements.");
  }
  const button = form.querySelector('button[type="submit"]');
  if (!button) throw new Error("The demo form is missing its submit button.");
  const waitlistFlow = form.dataset.flow === "waitlist";
  const extra = document.getElementById("demoFields");
  const offer = document.getElementById("demoOffer");
  const openDemo = document.getElementById("openDemo");
  if (waitlistFlow && (!extra || !offer || !openDemo)) {
    throw new Error("The waitlist form is missing its optional demo step.");
  }
  let step = waitlistFlow ? "waitlist" : "demo";
  const fieldNames = waitlistFlow ? [...WAITLIST_FIELDS,
    ...Object.keys(fieldLimits).filter(name => !WAITLIST_FIELDS.includes(name))] : Object.keys(fieldLimits);
  if (language.startsWith("ja")) {
    const first = fieldNames.indexOf("firstName");
    const last = fieldNames.indexOf("lastName");
    [fieldNames[first], fieldNames[last]] = [fieldNames[last], fieldNames[first]];
  }
  const fields = Object.fromEntries(fieldNames.map((name) => {
    const control = form.querySelector(`[name="${name}"]`);
    const error = document.getElementById(`demo-${name}-error`);
    if (!control || !error || control.getAttribute("aria-describedby") !== error.id) {
      throw new Error(`The demo form is missing the ${name} field or its error description.`);
    }
    control.required = true;
    control.setAttribute("aria-required", "true");
    return [name, { control, error }];
  }));
  const choices = Object.fromEntries(["industry", "companySize", "country"].map((name) =>
    [name, [...fields[name].control.options].map((option) => option.value).filter(Boolean)]));
  const endpoint = form.dataset.endpoint;
  let originalLabel = button.textContent;
  let pending = false;
  let requestId = null;
  let fingerprint = null;
  let savedValues = null;

  function showDemo(values, focusName) {
    if (pending || step !== "waitlist") return;
    step = "demo";
    if (values) {
      for (const name of WAITLIST_FIELDS) fields[name].control.value = values[name];
    }
    extra.disabled = false;
    extra.hidden = false;
    done.hidden = true;
    offer.hidden = true;
    if (isAppsScriptEndpoint(endpoint)) status.hidden = true;
    form.hidden = false;
    originalLabel = openDemo.textContent;
    button.textContent = originalLabel;
    openDemo.setAttribute("aria-expanded", "true");
    showFieldErrors({});
    if (focusName) fields[focusName].control.focus();
  }

  function openDirectDemo(focus = true) {
    if (waitlistFlow && document.defaultView?.location.hash === "#request-demo") {
      showDemo(null, focus ? fieldNames[0] : null);
    }
  }

  if (waitlistFlow) {
    openDemo.addEventListener("click", () => {
      if (savedValues) showDemo(savedValues, "phone");
    });
    document.defaultView?.addEventListener("hashchange", () => openDirectDemo());
    openDirectDemo(false);
  }

  function showFieldErrors(errors) {
    let firstInvalid = null;
    for (const [name, { control, error }] of Object.entries(fields)) {
      const message = errors[name];
      error.textContent = message || "";
      error.hidden = !message;
      if (message) {
        control.setAttribute("aria-invalid", "true");
        firstInvalid ||= control;
      } else {
        control.removeAttribute("aria-invalid");
      }
    }
    return firstInvalid;
  }

  if (!isAppsScriptEndpoint(endpoint)) {
    status.textContent = message("Demo requests are temporarily unavailable. Please email hello@jinai.md.");
    status.dataset.kind = "pending";
    status.hidden = false;
    button.disabled = true;
    return;
  }
  button.disabled = false;

  form.addEventListener("input", (event) => {
    const field = fields[event.target.name];
    if (field) {
      field.control.removeAttribute("aria-invalid");
      field.error.hidden = true;
      field.error.textContent = "";
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (pending) return;
    const values = new FormData(form);
    const activeNames = step === "waitlist" ? WAITLIST_FIELDS : Object.keys(fields);
    const payload = {
      type: step,
      lang: language.startsWith("ja") ? "ja" : "en",
      ...Object.fromEntries(activeNames.map((name) => [name, String(values.get(name) || "")])),
      website: String(values.get("website") || ""),
      source: "https://jinai.md",
      consentVersion: step === "waitlist" ? WAITLIST_CONSENT_VERSION : CONSENT_VERSION
    };
    const invalid = showFieldErrors(step === "waitlist" ?
      validateWaitlistFields(payload, language) : validateDemoFields(payload, choices, language));
    if (invalid) {
      done.hidden = true;
      status.textContent = message("Please check the marked fields.");
      status.dataset.kind = "error";
      status.hidden = false;
      invalid.focus();
      return;
    }
    for (const name of activeNames) payload[name] = payload[name].trim();
    const nextFingerprint = JSON.stringify(payload);
    if (nextFingerprint !== fingerprint) {
      requestId = crypto.randomUUID();
      fingerprint = nextFingerprint;
    }
    payload.requestId = requestId;
    pending = true;
    button.disabled = true;
    button.textContent = message("Saving your request...");
    form.setAttribute("aria-busy", "true");
    status.textContent = message(step === "waitlist" ?
      "Saving your waitlist signup. Please keep this page open." :
      "Saving your demo request. Please keep this page open.");
    status.dataset.kind = "pending";
    status.hidden = false;
    done.hidden = true;

    try {
      const result = await submitSignup(endpoint, payload, dependencies);
      const presentation = describeResult(result, language, step, payload.email);
      document.getElementById("waitlistHeading").textContent = presentation.heading;
      document.getElementById("waitlistRegistration").textContent = presentation.registration;
      document.getElementById("waitlistEmail").textContent = presentation.welcome;
      document.getElementById("waitlistDetail").textContent = presentation.detail;
      done.dataset.kind = presentation.kind;
      done.hidden = false;
      status.hidden = true;
      form.hidden = presentation.saved;
      if (waitlistFlow && step === "waitlist" && presentation.saved) {
        savedValues = payload;
        offer.hidden = false;
      }
      const field = !presentation.saved &&
        Object.keys(fields).find((name) => fieldCodes[name] === result.code);
      const invalid = showFieldErrors(field ? { [field]: message(validationMessages[result.code]) } : {});
      if (invalid) {
        invalid.focus();
      } else {
        done.focus({ preventScroll: true });
        done.scrollIntoView({ block: "center", behavior: "auto" });
      }
    } catch (error) {
      console.error("Request confirmation failed:", error);
      status.textContent = message("We could not confirm your request or email status. Please try again; retries will not create duplicate requests.");
      status.dataset.kind = "error";
      status.hidden = false;
      form.hidden = false;
    } finally {
      pending = false;
      button.disabled = false;
      button.textContent = originalLabel;
      form.removeAttribute("aria-busy");
      openDirectDemo();
      if (!form.hidden && document.activeElement === document.body) button.focus();
    }
  });
}

if (typeof document !== "undefined") initializeWaitlist(document);
