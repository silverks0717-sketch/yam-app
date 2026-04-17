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
  bindCopyButtons();
});

async function hydrateReleaseInfo() {
  const versionNode = document.getElementById("release-version");
  const links = {
    iphoneText: document.getElementById("landing-iphone-link-text"),
    ipadText: document.getElementById("landing-ipad-link-text"),
    androidText: document.getElementById("landing-android-link-text"),
    iphoneOpen: document.getElementById("landing-iphone-open-link"),
    ipadOpen: document.getElementById("landing-ipad-open-link"),
    androidOpen: document.getElementById("landing-android-download-link"),
  };
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
    hydrateDeviceLinks(payload, links);
  } catch {
    versionNode.textContent = "可注册 · 可安装 · 可同步";
    hydrateDeviceLinks({ downloadUrl: "/install" }, links);
  }
}

function hydrateDeviceLinks(payload, links) {
  const publicOrigin = payload.publicOrigin || window.location.origin;
  const authUrl = new URL("/auth/user-login", publicOrigin).toString();
  const downloadUrl = new URL(payload.downloadUrl || "/install", publicOrigin).toString();

  if (links.iphoneText) links.iphoneText.textContent = authUrl;
  if (links.ipadText) links.ipadText.textContent = authUrl;
  if (links.androidText) links.androidText.textContent = downloadUrl;
  if (links.iphoneOpen) links.iphoneOpen.href = authUrl;
  if (links.ipadOpen) links.ipadOpen.href = authUrl;
  if (links.androidOpen) links.androidOpen.href = downloadUrl;
}

function bindCopyButtons() {
  const buttons = Array.from(document.querySelectorAll(".copy-link-button"));
  buttons.forEach((button) => {
    button.addEventListener("click", async () => {
      const target = document.getElementById(button.dataset.copyTarget || "");
      const value = target?.textContent?.trim();
      if (!value || value === "读取中…") return;
      try {
        await navigator.clipboard.writeText(value);
        button.textContent = "已复制";
        window.setTimeout(() => {
          button.textContent = "复制网址";
        }, 1400);
      } catch {
        button.textContent = "请手动复制";
      }
    });
  });
}
