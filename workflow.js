const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const slots = [...document.querySelectorAll("[data-demo-scene]")].map(row => ({
  row, screen: row.querySelector(".screen"), near: false, visible: false, frame: null, fallback: null
}));

function playback(slot) {
  const running = slot.visible && !document.hidden && !reduced.matches;
  slot.screen.classList.toggle("screen-running", running && !slot.frame);
  if (!running || slot.frame) {
    slot.screen.getAnimations({ subtree: true }).forEach(animation => { animation.currentTime = 0; });
  }
  slot.frame?.contentWindow.postMessage({ type: "jin-demo", action: running ? "play" : "pause" }, location.origin);
}

function reveal(slot, frame) {
  if (slot.frame !== frame) return;
  slot.screen.classList.add("workflow-demo-ready");
  playback(slot);
}

function update(slot) {
  if (reduced.matches && slot.frame) {
    playback(slot);
    clearTimeout(slot.fallback);
    slot.frame.remove();
    slot.frame = null;
    slot.screen.classList.remove("workflow-demo-ready");
  }
  const source = slot.row.dataset.demoSrc;
  if (source && slot.near && !document.hidden && !reduced.matches && !slot.frame) {
    const url = new URL(source, location.href);
    if (url.origin !== location.origin || url.pathname !== "/assets/demo/app-v2.html" ||
        url.searchParams.get("scene") !== slot.row.dataset.demoScene ||
        url.searchParams.get("embed") !== "1" || url.searchParams.get("loop") !== "1") {
      console.error("Invalid workflow demo source. Keeping the still image.", source);
      return;
    }
    const frame = document.createElement("iframe");
    frame.inert = true;
    frame.tabIndex = -1;
    frame.setAttribute("aria-hidden", "true");
    frame.title = slot.screen.getAttribute("aria-label");
    frame.addEventListener("load", () => {
      if (!frame.contentDocument?.body || frame.contentDocument.title === "Error response") {
        console.error("The workflow demo could not be loaded. Keeping the still image.", source);
        return;
      }
      playback(slot);
      slot.fallback = setTimeout(() => reveal(slot, frame), 500);
    }, { once: true });
    frame.addEventListener("error", () => {
      console.error("The workflow demo could not be loaded. Keeping the still image.", source);
    }, { once: true });
    frame.src = url.href;
    slot.frame = frame;
    slot.screen.appendChild(frame);
    frame.style.transform = "scale(" + slot.screen.getBoundingClientRect().width / 1440 + ")";
  }
  playback(slot);
}

const near = new IntersectionObserver(entries => {
  for (const { target, isIntersecting } of entries) {
    const slot = slots.find(slot => slot.screen === target);
    slot.near = isIntersecting;
    update(slot);
  }
}, { rootMargin: "240px" });
const visible = new IntersectionObserver(entries => {
  for (const { target, isIntersecting } of entries) {
    const slot = slots.find(slot => slot.screen === target);
    slot.visible = isIntersecting;
    update(slot);
  }
});
slots.forEach(slot => {
  near.observe(slot.screen);
  visible.observe(slot.screen);
  new ResizeObserver(([entry]) => {
    if (slot.frame) slot.frame.style.transform = "scale(" + entry.contentRect.width / 1440 + ")";
  }).observe(slot.screen);
});
addEventListener("message", event => {
  if (event.origin !== location.origin || event.data?.type !== "jin-demo" || event.data.action !== "ready") return;
  const slot = slots.find(slot => slot.frame?.contentWindow === event.source);
  if (!slot) return;
  clearTimeout(slot.fallback);
  reveal(slot, slot.frame);
});
reduced.addEventListener("change", () => slots.forEach(update));
document.addEventListener("visibilitychange", () => slots.forEach(update));
