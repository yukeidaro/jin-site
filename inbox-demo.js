(() => {
  const root = document.querySelector(".inbox-demo");
  if (!root) return;

  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const jin = root.querySelector(".jin");
  const screen = root.querySelector(".screen");
  const panel = root.querySelector(".panel");
  const bandText = root.querySelector(".band-text");
  const undo = root.querySelector(".undo");
  const reply = root.querySelector(".reply");
  const draft = root.querySelector(".draft");
  const rows = [...root.querySelectorAll(".msg")];
  const sarah = root.querySelector('[data-id="sarah"]');
  const subject = sarah.querySelector("span");
  const originalSubject = subject.textContent;
  const times = [...root.querySelectorAll(".time")];
  let picked = 0;
  let started = false;
  let visible = false;
  let pending = null;
  let remaining = 0;
  let due = 0;
  let timer;

  function clearTimer() {
    clearTimeout(timer);
    timer = undefined;
    pending = null;
    remaining = 0;
  }

  function resumeTimer() {
    if (!pending || !visible || document.hidden || reduced.matches) return;
    clearTimeout(timer);
    due = performance.now() + remaining;
    timer = setTimeout(() => {
      timer = undefined;
      const action = pending;
      pending = null;
      action();
    }, remaining);
  }

  function schedule(action, delay) {
    clearTimer();
    pending = action;
    remaining = delay;
    resumeTimer();
  }

  function pauseTimer() {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
    if (pending) remaining = Math.max(0, due - performance.now());
  }

  function fitPanel() {
    const open = jin.dataset.state === "open";
    const height = panel.scrollHeight;
    jin.style.height = open ? `${height}px` : "";
    screen.style.minHeight = open ? `${height + 24}px` : "";
  }

  function setState(state, text = "Jin") {
    jin.dataset.state = state;
    bandText.textContent = text;
    panel.inert = state !== "ready" && state !== "open";
    fitPanel();
  }

  function renderDraft() {
    times.forEach((button, index) => button.setAttribute("aria-pressed", String(index === picked)));
    const selected = times[picked].dataset;
    const others = times.filter((_, index) => index !== picked).map(button =>
      `${button.dataset.day} ${button.dataset.at}`);
    const values = { long: selected.long, at: selected.at, other1: others[0], other2: others[1] };
    draft.textContent = root.querySelector(".draft-template").content.textContent.trim()
      .replace(/\{(long|at|other1|other2)\}/g, (_, key) => values[key]);
    fitPanel();
  }

  function openMail(button, immediate = false) {
    clearTimer();
    undo.hidden = true;
    reply.hidden = true;
    rows.forEach(row => row.classList.toggle("on", row === button));
    root.querySelector(".email-empty").hidden = true;
    root.querySelector(".email-sarah").hidden = button !== sarah;
    root.querySelector(".email-other").hidden = button === sarah;
    if (button !== sarah) {
      root.querySelector(".other-subject").textContent = button.querySelector("span").textContent;
      root.querySelector(".other-from").textContent = button.querySelector("b").textContent;
      setState("idle");
      return;
    }
    sarah.classList.remove("unread");
    picked = 0;
    renderDraft();
    if (immediate || reduced.matches) setState("ready");
    else {
      setState("idle", root.dataset.preparing);
      schedule(() => setState("ready"), 650);
    }
  }

  function replay() {
    clearTimer();
    started = true;
    undo.hidden = true;
    reply.hidden = true;
    subject.textContent = originalSubject;
    rows.forEach(row => row.classList.remove("on"));
    sarah.classList.add("unread");
    root.querySelector(".email-empty").hidden = false;
    root.querySelector(".email-sarah").hidden = true;
    root.querySelector(".email-other").hidden = true;
    setState("idle");
    if (reduced.matches) openMail(sarah, true);
    else schedule(() => openMail(sarah), 1400);
  }

  rows.forEach(button => button.addEventListener("click", () => {
    started = true;
    openMail(button);
  }));
  times.forEach((button, index) => button.addEventListener("click", () => {
    picked = index;
    renderDraft();
  }));
  root.querySelector(".show").addEventListener("click", () => {
    setState("open");
    times[picked].focus({ preventScroll: true });
  });
  root.querySelector(".primary").addEventListener("click", () => {
    clearTimer();
    root.querySelector(".reply-text").textContent = draft.textContent;
    reply.hidden = false;
    subject.textContent = root.dataset.replySubject;
    setState("done", root.dataset.sent);
    undo.hidden = false;
    undo.focus({ preventScroll: true });
    if (!reduced.matches) schedule(() => {
      undo.hidden = true;
      setState("idle");
    }, 5000);
  });
  undo.addEventListener("click", () => {
    clearTimer();
    undo.hidden = true;
    reply.hidden = true;
    subject.textContent = originalSubject;
    setState("open");
    times[picked].focus({ preventScroll: true });
  });
  root.querySelector(".later").addEventListener("click", () => {
    clearTimer();
    setState("done", root.dataset.later);
    root.querySelector(".replay").focus({ preventScroll: true });
    if (!reduced.matches) schedule(() => setState("idle"), 1800);
  });
  root.querySelector(".replay").addEventListener("click", replay);
  root.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    clearTimer();
    undo.hidden = true;
    setState("idle");
    root.querySelector(".replay").focus({ preventScroll: true });
  });

  root.classList.add("is-enhanced");
  renderDraft();
  if (reduced.matches) openMail(sarah, true);
  else {
    root.querySelector(".email-empty").hidden = false;
    root.querySelector(".email-sarah").hidden = true;
    rows.forEach(row => row.classList.remove("on"));
    setState("idle");
  }

  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible && !started && !reduced.matches) replay();
    else if (visible) resumeTimer();
    else pauseTimer();
  });
  observer.observe(screen);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseTimer();
    else resumeTimer();
  });
  reduced.addEventListener("change", () => {
    clearTimer();
    if (reduced.matches) {
      started = true;
      subject.textContent = originalSubject;
      openMail(sarah, true);
    }
  });
  new ResizeObserver(fitPanel).observe(panel);
})();
