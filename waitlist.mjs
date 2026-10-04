export const CONSENT_VERSION = "waitlist-product-updates-v1";
export const REQUEST_TIMEOUT_MS = 45000;
export const SURVEY_ID = "ai-friction-v1";

const registrationStates = new Set(["saved", "not_saved", "unknown"]);
const welcomeStates = new Set(["sent", "pending", "failed", "unknown", "not_attempted"]);
const validationMessages = {
  invalid_name: "Please enter your name (up to 120 characters).",
  invalid_email: "Please enter a valid email address.",
  invalid_role: "Please enter what you do (up to 160 characters).",
  invalid_consent: "Please refresh the page before registering.",
  busy: "Registration is busy right now. Please try again in a moment."
};

export function isAppsScriptEndpoint(value) {
  return typeof value === "string" &&
    /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(value);
}

export function validateResponse(value, requestId) {
  if (!value || value.version !== 1 || value.requestId !== requestId ||
      !registrationStates.has(value.registration) || !welcomeStates.has(value.welcome) ||
      (value.registration !== "saved" && value.welcome !== "not_attempted") ||
      (value.registration === "saved" && value.welcome === "not_attempted")) {
    throw new Error("The registration service returned an invalid confirmation.");
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
      heading: result.registration === "not_saved" ? "Registration was not saved." : "Registration is not confirmed.",
      registration: result.registration === "not_saved" ? "Not saved" : "Not confirmed",
      welcome: "Not sent",
      detail: validationMessages[result.code] ||
        "We could not confirm that your registration was saved. Please try again; retries will not create duplicate signups.",
      kind: "error"
    };
  }
  const messages = {
    sent: {
      welcome: "Sent",
      detail: "Your welcome email was sent from hello@jinai.md with your Discord invite. Check your inbox and spam folder.",
      kind: "success"
    },
    pending: {
      welcome: "Pending - not sent yet",
      detail: "Your registration is saved. Your welcome email is pending; you do not need to register again. You can join Discord below.",
      kind: "pending"
    },
    failed: {
      welcome: "Not sent",
      detail: "Your registration is saved, but we could not send your welcome email. You do not need to register again. You can join Discord below.",
      kind: "pending"
    },
    unknown: {
      welcome: "Not confirmed",
      detail: "Your registration is saved, but we could not confirm the email send. You do not need to register again. You can join Discord below.",
      kind: "pending"
    }
  };
  return { saved: true, heading: "You're on the waitlist.", registration: "Saved", ...messages[result.welcome] };
}

async function postJson(endpoint, payload, {
  fetchImpl = globalThis.fetch.bind(globalThis),
  timeoutMs = REQUEST_TIMEOUT_MS
} = {}, label = "Registration") {
  if (!isAppsScriptEndpoint(endpoint)) throw new Error("The registration service is not configured.");
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
  const survey = document.getElementById("waitlistSurvey");
  const surveyStatus = document.getElementById("waitlistSurveyStatus");
  if (!form || !status || !done || !survey || !surveyStatus) {
    throw new Error("The waitlist form is missing its status elements.");
  }
  if (survey.dataset.surveyId !== SURVEY_ID) throw new Error("The waitlist survey is not configured correctly.");
  const button = form.querySelector('button[type="submit"]');
  const surveyButton = survey.querySelector('button[type="submit"]');
  if (!button || !surveyButton) throw new Error("The waitlist form is missing its submit buttons.");
  const endpoint = form.dataset.endpoint;
  const originalLabel = button.textContent;
  const originalSurveyLabel = surveyButton.textContent;
  let pending = false;
  let surveyPending = false;
  let requestId = null;
  let fingerprint = null;
  let confirmedSignup = null;

  if (!isAppsScriptEndpoint(endpoint)) {
    status.textContent = "Email registration is temporarily unavailable while we finish setup. You can still join our Discord.";
    status.dataset.kind = "pending";
    status.hidden = false;
    button.disabled = true;
    return;
  }
  button.disabled = false;

  survey.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (surveyPending || survey.hidden || !confirmedSignup || !survey.reportValidity()) return;
    const answer = new FormData(survey).get("answer");
    const allowedAnswers = new Set([...survey.querySelectorAll('input[type="radio"][name="answer"]')]
      .map((radio) => radio.value));
    if (typeof answer !== "string" || !allowedAnswers.has(answer)) {
      surveyStatus.textContent = "Please choose one of the listed answers.";
      surveyStatus.dataset.kind = "error";
      surveyStatus.hidden = false;
      return;
    }
    const payload = {
      type: "survey",
      requestId: confirmedSignup.requestId,
      email: confirmedSignup.email,
      surveyId: SURVEY_ID,
      answer,
      source: "https://jinai.md"
    };
    surveyPending = true;
    surveyButton.disabled = true;
    surveyButton.textContent = "Sending...";
    survey.setAttribute("aria-busy", "true");
    surveyStatus.textContent = "Sending your answer...";
    surveyStatus.dataset.kind = "pending";
    surveyStatus.hidden = false;

    try {
      const result = await submitSurvey(endpoint, payload, dependencies);
      if (result.survey === "saved") {
        survey.hidden = true;
        surveyStatus.textContent = "Thanks. Your answer is saved.";
        surveyStatus.dataset.kind = "success";
      } else {
        surveyStatus.textContent = "Your answer was not saved. Please try again or email hello@jinai.md.";
        surveyStatus.dataset.kind = "error";
      }
    } catch (error) {
      console.error("Waitlist survey confirmation failed:", error);
      surveyStatus.textContent = "We could not confirm your answer was saved. Please try again; retries will not create duplicate answers.";
      surveyStatus.dataset.kind = "error";
    } finally {
      surveyPending = false;
      surveyButton.disabled = false;
      surveyButton.textContent = originalSurveyLabel;
      survey.removeAttribute("aria-busy");
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (pending || !form.reportValidity()) return;
    const values = new FormData(form);
    const payload = {
      name: String(values.get("name") || "").trim(),
      email: String(values.get("email") || "").trim(),
      role: String(values.get("role") || "").trim(),
      website: String(values.get("website") || ""),
      source: "https://jinai.md",
      consentVersion: CONSENT_VERSION
    };
    const nextFingerprint = JSON.stringify(payload);
    if (nextFingerprint !== fingerprint) {
      requestId = crypto.randomUUID();
      fingerprint = nextFingerprint;
    }
    payload.requestId = requestId;
    pending = true;
    button.disabled = true;
    button.textContent = "Saving your registration...";
    form.setAttribute("aria-busy", "true");
    status.textContent = "Saving your registration. Please keep this page open.";
    status.dataset.kind = "pending";
    status.hidden = false;
    done.hidden = true;
    confirmedSignup = null;
    survey.hidden = true;
    surveyStatus.hidden = true;

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
      if (presentation.saved) {
        confirmedSignup = { requestId: payload.requestId, email: payload.email };
        survey.hidden = false;
      }
      done.focus({ preventScroll: true });
      done.scrollIntoView({ block: "center", behavior: "smooth" });
    } catch (error) {
      console.error("Waitlist confirmation failed:", error);
      status.textContent = "We could not confirm your registration or email status. Please try again; retries will not create duplicate signups.";
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
