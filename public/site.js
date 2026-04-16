import { initPwa } from "./pwa.js";

document.addEventListener("DOMContentLoaded", () => {
  initPwa();

  window.setTimeout(() => {
    document.body.classList.add("intro-name-ready");
  }, 1400);

  window.setTimeout(() => {
    document.body.classList.add("intro-actions-ready");
  }, 1900);

  hydrateReleaseInfo();
});

async function hydrateReleaseInfo() {
  const versionNode = document.getElementById("release-version");
  if (!versionNode) return;

  try {
    const response = await fetch("/version", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("release");
    }

    const payload = await response.json();
    const version = payload.latestVersion || "1.0.0";
    const updatedAt = payload.updatedAt
      ? new Intl.DateTimeFormat("zh-CN", {
          month: "short",
          day: "numeric",
        }).format(new Date(payload.updatedAt))
      : "刚刚";

    versionNode.textContent = `v${version} · ${updatedAt}`;
  } catch {
    versionNode.textContent = "可注册 · 可安装 · 可同步";
  }
}
