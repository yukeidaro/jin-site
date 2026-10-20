document.addEventListener("click", (event) => {
  const link = event.target.closest("footer .language-switch a[data-jin-lang]");
  if (!link) return;
  const language = link.dataset.jinLang;
  if (language !== "en" && language !== "ja") return;
  try {
    localStorage.setItem("jin-lang", language);
  } catch (error) {
    console.warn("Language preference could not be saved locally.", error);
    try {
      sessionStorage.setItem("jin-lang", language);
    } catch (error) {
      console.warn("Language preference could not be saved for this session.", error);
      const target = new URL(link.href);
      target.searchParams.set("jin-lang", language);
      link.href = target.href;
    }
  }
});
