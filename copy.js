(() => {
  const buttons = document.querySelectorAll(".copy-email");
  if (!buttons.length) return;
  const japanese = document.documentElement.lang.startsWith("ja");
  const copied = japanese ? "\u30b3\u30d4\u30fc\u3057\u307e\u3057\u305f" : "Copied";
  const fallback = japanese ? "Ctrl+C \u3067\u30b3\u30d4\u30fc\u3067\u304d\u307e\u3059" : "Press Ctrl+C to copy";
  const status = document.createElement("span");
  status.className = "copy-status";
  status.setAttribute("aria-live", "polite");
  status.setAttribute("aria-atomic", "true");
  document.body.append(status);
  let announcement;
  const announce = (message) => {
    clearTimeout(announcement);
    status.textContent = "";
    announcement = setTimeout(() => { status.textContent = message; }, 0);
  };
  buttons.forEach((button) => {
    const label = button.textContent;
    const address = button.previousElementSibling;
    let timer;
    let attempt = 0;
    button.addEventListener("click", async () => {
      const currentAttempt = ++attempt;
      clearTimeout(timer);
      button.textContent = label;
      try {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard API is unavailable.");
        await navigator.clipboard.writeText(button.dataset.copy);
        if (currentAttempt !== attempt) return;
        button.textContent = copied;
        announce(copied);
        timer = setTimeout(() => { button.textContent = label; }, 1500);
      } catch (error) {
        if (currentAttempt !== attempt) return;
        console.warn("Email could not be copied automatically. Select and copy the address instead.", error);
        const range = document.createRange();
        range.selectNodeContents(address);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        announce(fallback);
      }
    });
  });
  document.documentElement.classList.add("copy-ready");
})();
