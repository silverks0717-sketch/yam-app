export function initPwa() {
  const standalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
  document.body.classList.toggle("is-standalone", Boolean(standalone));
  document.body.classList.toggle("is-touch", matchMedia("(pointer: coarse)").matches);

  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Ignore registration failures in unsupported contexts.
    });
  });
}
