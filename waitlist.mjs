export const CONSENT_VERSION = "demo-request-v1";
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
const fieldLimits = {
  email: 254, firstName: 80, lastName: 80, jobTitle: 120, phone: 40,
  company: 160, industry: 80, companySize: 20, country: 80
};
const fieldCodes = {
  email: "invalid_email", firstName: "invalid_first_name", lastName: "invalid_last_name",
  jobTitle: "invalid_job_title", phone: "invalid_phone", company: "invalid_company",
  industry: "invalid_industry", companySize: "invalid_company_size", country: "invalid_country"
};

export function validateDemoFields(payload, choices) {
  const errors = {};
  for (const [field, limit] of Object.entries(fieldLimits)) {
    const raw = payload[field];
    const value = typeof raw === "string" ? raw.trim() : "";
    let invalid = typeof raw !== "string" || /[\u0000-\u001f\u007f]/.test(raw) ||
      (!value && field !== "phone") || value.length > limit;
    if (field === "email" && !invalid) {
      invalid = !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(value) ||
        value.split("@")[0].length > 64 || /^\.|\.\.|\.@/.test(value);
    }
    if (field === "phone" && !/^[0-9 +().-]*$/.test(value)) invalid = true;
    if (["industry", "companySize", "country"].includes(field) &&
        !choices[field].includes(value)) invalid = true;
    if (invalid) errors[field] = validationMessages[fieldCodes[field]];
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

export function describeResult(result) {
  if (result.registration !== "saved") {
    return {
      saved: false,
      heading: result.registration === "not_saved" ? "Your request was not saved." : "Your request is not confirmed.",
      registration: result.registration === "not_saved" ? "Not saved" : "Not confirmed",
      welcome: "Not sent",
      detail: validationMessages[result.code] ||
        "We could not confirm that your request was saved. Please try again; retries will not create duplicate requests.",
      kind: "error"
    };
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
  return { saved: true, heading: "Your demo request is saved.", registration: "Saved", ...messages[result.welcome] };
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
  const form = document.getElementById("waitlistForm");
  const status = document.getElementById("waitlistStatus");
  const done = document.getElementById("waitlistDone");
  if (!form || !status || !done) {
    throw new Error("The demo form is missing its status elements.");
  }
  const button = form.querySelector('button[type="submit"]');
  if (!button) throw new Error("The demo form is missing its submit button.");
  const fields = Object.fromEntries(Object.keys(fieldLimits).map((name) => {
    const control = form.querySelector(`[name="${name}"]`);
    const error = document.getElementById(`demo-${name}-error`);
    if (!control || !error || control.getAttribute("aria-describedby") !== error.id) {
      throw new Error(`The demo form is missing the ${name} field or its error description.`);
    }
    return [name, { control, error }];
  }));
  const choices = Object.fromEntries(["industry", "companySize", "country"].map((name) =>
    [name, [...fields[name].control.options].map((option) => option.value).filter(Boolean)]));
  const endpoint = form.dataset.endpoint;
  const originalLabel = button.textContent;
  let pending = false;
  let requestId = null;
  let fingerprint = null;

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
    status.textContent = "Demo requests are temporarily unavailable. Please email hello@jinai.md.";
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
    const payload = {
      type: "demo",
      ...Object.fromEntries(Object.keys(fields).map((name) => [name, String(values.get(name) || "")])),
      website: String(values.get("website") || ""),
      source: "https://jinai.md",
      consentVersion: CONSENT_VERSION
    };
    const invalid = showFieldErrors(validateDemoFields(payload, choices));
    if (invalid) {
      done.hidden = true;
      status.textContent = "Please check the marked fields.";
      status.dataset.kind = "error";
      status.hidden = false;
      invalid.focus();
      return;
    }
    for (const name of Object.keys(fields)) payload[name] = payload[name].trim();
    const nextFingerprint = JSON.stringify(payload);
    if (nextFingerprint !== fingerprint) {
      requestId = crypto.randomUUID();
      fingerprint = nextFingerprint;
    }
    payload.requestId = requestId;
    pending = true;
    button.disabled = true;
    button.textContent = "Saving your request...";
    form.setAttribute("aria-busy", "true");
    status.textContent = "Saving your demo request. Please keep this page open.";
    status.dataset.kind = "pending";
    status.hidden = false;
    done.hidden = true;

    try {
      const result = await submitSignup(endpoint, payload, dependencies);
      const presentation = describeResult(result);
      document.getElementById("waitlistHeading").textContent = presentation.heading;
      document.getElementById("waitlistRegistration").textContent = presentation.registration;
      document.getElementById("waitlistEmail").textContent = presentation.welcome;
      document.getElementById("waitlistDetail").textContent = presentation.detail;
      done.dataset.kind = presentation.kind;
      done.hidden = false;
      status.hidden = true;
      form.hidden = presentation.saved;
      const field = !presentation.saved &&
        Object.keys(fields).find((name) => fieldCodes[name] === result.code);
      const invalid = showFieldErrors(field ? { [field]: validationMessages[result.code] } : {});
      if (invalid) {
        invalid.focus();
      } else {
        done.focus({ preventScroll: true });
        done.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    } catch (error) {
      console.error("Demo request confirmation failed:", error);
      status.textContent = "We could not confirm your request or email status. Please try again; retries will not create duplicate requests.";
      status.dataset.kind = "error";
      status.hidden = false;
      form.hidden = false;
    } finally {
      pending = false;
      button.disabled = false;
      button.textContent = originalLabel;
      form.removeAttribute("aria-busy");
    }
  });
}

if (typeof document !== "undefined") initializeWaitlist(document);
