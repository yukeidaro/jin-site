const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const figures = [...document.querySelectorAll("[data-problem]")];
const visible = new Set();
const finishers = [];

function updateFlow() {
  for (const figure of figures) {
    figure.classList.toggle("problem-flow-running",
      visible.has(figure) && !document.hidden && !reduced.matches && figure.dataset.state === "idle");
  }
}

for (const figure of figures) {
  const action = figure.querySelector(".problem-action");
  const drawing = figure.querySelector('svg[role="img"]');
  const status = figure.querySelector('[aria-live="polite"]');
  let timer = null;

  const setBusy = busy => {
    figure.dataset.busy = String(busy);
    action.setAttribute("aria-disabled", String(busy));
  };
  const finish = () => {
    clearTimeout(timer);
    timer = null;
    setBusy(false);
  };

  if (figure.dataset.problem === "teams") {
    const controls = [...figure.querySelectorAll("[data-team]")];
    let exploring = false;
    const open = control => {
      if (figure.dataset.openTeam === control.dataset.team) return;
      figure.dataset.state = "changed";
      figure.dataset.openTeam = control.dataset.team;
      for (const team of controls) {
        const selected = team === control;
        team.setAttribute("aria-pressed", String(selected));
        figure.querySelector(`[data-team-art="${team.dataset.team}"]`).classList.toggle("team-open", selected);
      }
      drawing.setAttribute("aria-label", control.dataset.label);
      status.textContent = control.dataset.status;
    };
    const stop = () => {
      exploring = false;
      finish();
    };
    for (const control of controls) {
      const select = () => {
        stop();
        open(control);
      };
      control.addEventListener("pointerenter", event => {
        if (event.pointerType === "mouse") select();
      });
      control.addEventListener("focus", select);
      control.addEventListener("click", select);
    }
    action.addEventListener("click", () => {
      if (exploring) return;
      if (reduced.matches) {
        open(controls.at(-1));
        return;
      }
      exploring = true;
      setBusy(true);
      let index = 0;
      const next = () => {
        open(controls[index++]);
        if (index < controls.length) timer = setTimeout(next, 1200);
        else stop();
      };
      next();
    });
    finishers.push(() => {
      if (exploring) open(controls.at(-1));
      stop();
    });
    figure.querySelector(".team-controls").hidden = false;
  } else {
    action.addEventListener("click", () => {
      if (figure.dataset.busy === "true") return;
      const state = figure.dataset.state === "idle" ? "changed" : "idle";
      figure.dataset.state = state;
      drawing.setAttribute("aria-label", drawing.dataset[state === "idle" ? "labelIdle" : "labelChanged"]);
      status.textContent = status.dataset[state === "idle" ? "statusIdle" : "statusChanged"];
      action.querySelector("[data-action-idle]").hidden = state !== "idle";
      action.querySelector("[data-action-changed]").hidden = state !== "changed";
      updateFlow();
      if (!reduced.matches) {
        setBusy(true);
        timer = setTimeout(finish, 1200);
      }
    });
    finishers.push(finish);
  }
  setBusy(false);
  action.hidden = false;
}

const observer = new IntersectionObserver(entries => {
  for (const { target, isIntersecting } of entries) {
    if (isIntersecting) visible.add(target);
    else visible.delete(target);
  }
  updateFlow();
});
figures.forEach(figure => observer.observe(figure));
document.addEventListener("visibilitychange", updateFlow);
reduced.addEventListener("change", () => {
  if (reduced.matches) finishers.forEach(finish => finish());
  updateFlow();
});
