(() => {
  const home = document.querySelector(".home-page");
  if (!home) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const desktop = matchMedia("(min-width: 761px)");
  const header = home.querySelector("header");
  const how = home.querySelector(".how-scroll");
  const stage = home.querySelector(".how-sticky");
  const steps = [...how.querySelectorAll(".steps > li")];
  const video = home.querySelector(".demo-video video");
  const sources = [...video.querySelectorAll("source")].map(element => ({
    element, src: element.getAttribute("src")
  }));
  const revealItems = [...home.querySelectorAll(
    ".section-head, #solution .h2, #solution p, .problem-images img, .steps > li, #data .h2, #data p, .section-figure, .demo-intro, .demo-form"
  )];
  const seen = new WeakSet();
  let revealObserver;
  let geometry;
  let scrollFrame;
  let measureFrame;
  let activeStep = -1;
  let visible = false;

  home.classList.add("has-scroll-motion");

  function updateScroll() {
    scrollFrame = undefined;
    header.classList.toggle("is-scrolled", scrollY > 48);
    if (!geometry) return;
    const progress = Math.max(0, Math.min(1, (scrollY - geometry.start) / geometry.travel));
    const index = Math.min(3, Math.floor(progress * 4));
    if (index === activeStep) return;
    activeStep = index;
    steps.forEach((step, number) => {
      if (number === index) step.setAttribute("aria-current", "step");
      else step.removeAttribute("aria-current");
    });
  }

  function scheduleScroll() {
    if (scrollFrame === undefined) scrollFrame = requestAnimationFrame(updateScroll);
  }

  function measure() {
    measureFrame = undefined;
    const enhance = desktop.matches && !reduced.matches;
    home.classList.toggle("how-motion", enhance);
    geometry = undefined;
    if (enhance) {
      const height = stage.offsetHeight;
      // Short windows keep every step in normal flow rather than clipping the sticky stage.
      if (height <= innerHeight - 124) {
        how.style.setProperty("--how-height", `${height}px`);
        geometry = {
          start: how.getBoundingClientRect().top + scrollY - 100,
          travel: how.offsetHeight - height
        };
      } else home.classList.remove("how-motion");
    }
    if (!geometry) {
      activeStep = -1;
      steps.forEach(step => step.removeAttribute("aria-current"));
    }
    updateScroll();
  }

  function scheduleMeasure() {
    if (measureFrame === undefined) measureFrame = requestAnimationFrame(measure);
  }

  function setupReveals() {
    revealObserver?.disconnect();
    if (reduced.matches || !("IntersectionObserver" in window)) {
      revealItems.forEach(item => {
        item.classList.remove("motion-pending");
        if (reduced.matches) seen.add(item);
      });
      return;
    }
    revealObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.remove("motion-pending");
        seen.add(entry.target);
        revealObserver.unobserve(entry.target);
      }
    }, { threshold: .05, rootMargin: "0px 0px -24px 0px" });
    revealItems.forEach((item, index) => {
      if (seen.has(item)) return;
      item.style.setProperty("--reveal-delay", `${Math.min(index % 4, 3) * 80}ms`);
      item.classList.add("motion-item", "motion-pending");
      revealObserver.observe(item);
    });
  }

  function syncVideo() {
    if (!visible || document.hidden || reduced.matches) {
      video.pause();
      return;
    }
    video.play().catch(error => {
      // A viewport/motion change can cancel an outstanding play request.
      if (error.name !== "AbortError") console.warn("Demo video could not play. Native playback controls remain available.", error);
    });
  }

  function updateMotion() {
    if (reduced.matches) {
      video.pause();
      video.removeAttribute("autoplay");
      video.controls = false;
      sources.forEach(({ element }) => element.removeAttribute("src"));
      video.load();
    } else {
      const restoreSources = sources.some(({ element }) => !element.hasAttribute("src"));
      sources.forEach(({ element, src }) => element.setAttribute("src", src));
      if (restoreSources) video.load();
      video.setAttribute("autoplay", "");
      video.controls = true;
    }
    setupReveals();
    measure();
    syncVideo();
  }

  video.pause();
  video.addEventListener("play", () => {
    if (reduced.matches || !visible || document.hidden) {
      video.pause();
    }
  });
  video.addEventListener("error", () => console.error("Demo video could not load.", video.error));
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= .15;
      syncVideo();
    }, { threshold: [0, .15] }).observe(video);
  } else visible = true;
  document.addEventListener("visibilitychange", syncVideo);
  window.addEventListener("scroll", scheduleScroll, { passive: true });
  window.addEventListener("resize", scheduleMeasure);
  window.addEventListener("pageshow", scheduleMeasure);
  reduced.addEventListener("change", updateMotion);
  desktop.addEventListener("change", scheduleMeasure);
  new ResizeObserver(scheduleMeasure).observe(stage);
  document.fonts.ready.then(scheduleMeasure);
  updateMotion();
})();
