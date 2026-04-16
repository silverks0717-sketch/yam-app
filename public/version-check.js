export async function enforceVersionGate({ currentVersion }) {
  try {
    const response = await fetch("/version", { cache: "no-store" });
    if (!response.ok) {
      return { outdated: false, forceUpdate: false };
    }

    const payload = await response.json();
    const latestVersion = payload.latestVersion || currentVersion;
    const outdated = compareVersions(currentVersion, latestVersion) < 0;

    if (!outdated) {
      return { outdated: false, forceUpdate: false, payload };
    }

    mountUpdateGate({
      currentVersion,
      latestVersion,
      forceUpdate: Boolean(payload.forceUpdate),
      downloadUrl: payload.downloadUrl || "/downloads/latest.apk",
      webUrl: payload.webUrl || "/app",
      changelog: Array.isArray(payload.changelog) ? payload.changelog : [],
    });

    return {
      outdated: true,
      forceUpdate: Boolean(payload.forceUpdate),
      payload,
    };
  } catch {
    return { outdated: false, forceUpdate: false };
  }
}

function mountUpdateGate({ currentVersion, latestVersion, forceUpdate, downloadUrl, webUrl, changelog }) {
  const existing = document.getElementById("version-gate");
  if (existing) {
    existing.remove();
  }

  document.body.classList.add("update-gate-open");
  const applePlatform = isAppleMobile();
  const actionLabel = applePlatform ? "进入最新 Web / PWA" : "立即更新";
  const nextUrl = applePlatform ? webUrl : downloadUrl;
  const gate = document.createElement("section");
  gate.id = "version-gate";
  gate.className = "version-gate";
  gate.innerHTML = `
    <div class="version-gate-motion">
      <span class="version-orb version-orb-a"></span>
      <span class="version-orb version-orb-b"></span>
      <span class="version-orb version-orb-c"></span>
    </div>
    <div class="version-card">
      <p class="kicker">版本更新</p>
      <h2>有一个更近的版本在等你。</h2>
      <div class="version-meta-grid">
        <article>
          <span>当前版本</span>
          <strong>v${escapeHtml(currentVersion)}</strong>
        </article>
        <article>
          <span>最新版本</span>
          <strong>v${escapeHtml(latestVersion)}</strong>
        </article>
      </div>
      <div class="version-log">
        ${renderChangelog(changelog)}
      </div>
      <div class="version-actions">
        <button type="button" class="button primary" data-update-action="download">${actionLabel}</button>
        ${
          forceUpdate
            ? ""
            : '<button type="button" class="button glass" data-update-action="dismiss">稍后进入</button>'
        }
      </div>
    </div>
  `;

  gate.addEventListener("click", (event) => {
    const action = event.target.closest("[data-update-action]")?.dataset.updateAction;
    if (!action) return;

    if (action === "download") {
      window.location.href = nextUrl;
      return;
    }

    if (action === "dismiss" && !forceUpdate) {
      document.body.classList.remove("update-gate-open");
      gate.remove();
    }
  });

  document.body.appendChild(gate);
}

function isAppleMobile() {
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  return /iPhone|iPad|iPod/i.test(ua) || (/Mac/i.test(platform) && "ontouchend" in document);
}

function renderChangelog(changelog) {
  if (!changelog.length) {
    return '<article class="version-log-group"><strong>提升</strong><ul><li>带来更稳定的体验和更完整的界面细节。</li></ul></article>';
  }

  return changelog
    .map((group) => {
      const type = escapeHtml(group.type || "更新");
      const items = Array.isArray(group.items) ? group.items : [];
      return `
        <article class="version-log-group">
          <strong>${type}</strong>
          <ul>
            ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </article>
      `;
    })
    .join("");
}

function compareVersions(current, latest) {
  const left = String(current || "0").split(".").map((value) => Number(value) || 0);
  const right = String(latest || "0").split(".").map((value) => Number(value) || 0);
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index] || 0;
    const rightPart = right[index] || 0;
    if (leftPart < rightPart) return -1;
    if (leftPart > rightPart) return 1;
  }

  return 0;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
