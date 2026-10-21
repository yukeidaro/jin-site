const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const figures = [...document.querySelectorAll("[data-problem]")];
const visible = new Set();
const controllers = new Map();

function updateFlow() {
  for (const figure of figures) {
    figure.classList.toggle("problem-flow-running",
      visible.has(figure) && !document.hidden && !reduced.matches &&
      (figure.dataset.problem === "shadow" || figure.dataset.problem === "dependency" ||
        figure.dataset.state === "idle" || figure.dataset.disconnected === "false"));
  }
}

for (const figure of figures) {
  const drawing = figure.querySelector('svg[role="img"]');
  const status = figure.querySelector('[aria-live="polite"]');
  const controls = [...figure.querySelectorAll("[data-team]")];
  const timers = new Set();
  let frame = null;
  const later = (callback, delay) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
  };
  const cancel = () => {
    timers.forEach(timer => clearTimeout(timer));
    timers.clear();
    cancelAnimationFrame(frame);
    frame = null;
    figure.dataset.busy = "false";
  };
  const describe = state => {
    drawing.setAttribute("aria-label", drawing.dataset[`label${state}`]);
    status.textContent = status.dataset[`status${state}`];
  };
  const open = control => {
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
  const reset = () => {
    cancel();
    figure.dataset.state = "idle";
    delete figure.dataset.disconnected;
    delete figure.dataset.openTeam;
    for (const control of controls) {
      control.setAttribute("aria-pressed", "false");
      figure.querySelector(`[data-team-art="${control.dataset.team}"]`).classList.remove("team-open");
    }
    describe("Idle");
    updateFlow();
  };
  const end = () => {
    cancel();
    figure.dataset.state = "changed";
    figure.dataset.disconnected = "true";
    if (controls.length) open(controls.at(-1));
    else describe("Changed");
    updateFlow();
  };
  const play = () => {
    if (reduced.matches) return end();
    if (figure.dataset.busy === "true") return;
    reset();
    figure.dataset.busy = "true";
    // Commit the idle frame so a completed CSS sequence can be replayed.
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        frame = null;
        figure.dataset.state = "changed";
        if (controls.length) {
          let index = 0;
          const next = () => {
            open(controls[index++]);
            if (index < controls.length) later(next, 1200);
            else later(cancel, 350);
          };
          next();
        } else {
          describe("Playing");
        }
        updateFlow();
      });
    });
  };
  if (figure.dataset.problem === "shadow") {
    // Animation completion keeps the status in sync when visibility pauses motion.
    figure.querySelector(".shadow-document").addEventListener("animationend", event => {
      if (event.animationName === "problem-shadow-document" && figure.dataset.busy === "true") end();
    });
  }
  if (figure.dataset.problem === "dependency") {
    drawing.addEventListener("animationend", event => {
      if (figure.dataset.busy !== "true") return;
      if (event.animationName === "problem-handover") describe("Rebuilding");
      if (event.animationName === "problem-layer-in" &&
          event.target.matches('[data-layer="exceptions"] text')) end();
    });
  }
  for (const control of controls) {
    const select = () => {
      if (reduced.matches) return end();
      cancel();
      open(control);
    };
    control.addEventListener("pointerenter", event => {
      if (event.pointerType === "mouse") select();
    });
    control.addEventListener("focus", select);
    control.addEventListener("click", select);
  }
  if (controls.length) figure.querySelector(".team-controls").hidden = false;
  figure.addEventListener("pointerenter", event => {
    if (event.pointerType === "mouse") play();
  });
  figure.addEventListener("click", event => {
    if (!event.target.closest("[data-team]")) play();
  });
  figure.addEventListener("focus", () => {
    figure.scrollIntoView({ block: "center", behavior: "instant" });
    play();
  });
  controllers.set(figure, { play, reset, end });
  if (reduced.matches) end();
  else reset();
}

const observer = new IntersectionObserver(entries => {
  for (const { target, isIntersecting, intersectionRatio } of entries) {
    const controller = controllers.get(target);
    if (!isIntersecting) {
      visible.delete(target);
      if (reduced.matches) controller.end();
      else controller.reset();
    } else if (intersectionRatio >= .5 && !visible.has(target)) {
      visible.add(target);
      controller.play();
    }
  }
  updateFlow();
}, { threshold: [0, .5] });
figures.forEach(figure => observer.observe(figure));
document.addEventListener("visibilitychange", updateFlow);
reduced.addEventListener("change", () => {
  for (const [figure, controller] of controllers) {
    if (reduced.matches) controller.end();
    else {
      controller.reset();
      if (visible.has(figure)) controller.play();
    }
  }
  updateFlow();
});
