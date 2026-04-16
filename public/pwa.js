export function initPwa() {
  applyViewportProfile();

  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        registration.update().catch(() => {});

        if (!window.__yamControllerBound) {
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (window.__yamControllerReloading) return;
            window.__yamControllerReloading = true;
            window.location.reload();
          });
          window.__yamControllerBound = true;
        }
      })
      .catch(() => {
        // Ignore registration failures in unsupported contexts.
      });
  });
}

function applyViewportProfile() {
  const standalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
  const coarsePointer = matchMedia("(pointer: coarse)").matches;
  const width = window.innerWidth;

  let formFactor = "desktop";
  if (width <= 820) {
    formFactor = "mobile";
  } else if (width <= 1280 || coarsePointer) {
    formFactor = "tablet";
  }

  document.body.classList.toggle("is-standalone", Boolean(standalone));
  document.body.classList.toggle("is-touch", coarsePointer);
  document.body.dataset.formFactor = formFactor;
  document.body.dataset.foldState = coarsePointer && width > 820 ? "expanded" : "compact";

  if (!window.__yamViewportBound) {
    const refreshProfile = () => applyViewportProfile();
    window.addEventListener("resize", refreshProfile);
    window.addEventListener("orientationchange", refreshProfile);
    window.__yamViewportBound = true;
  }
}
