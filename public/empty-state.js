const EMPTY_STATE_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <rect x="3.5" y="4.5" width="17" height="15" rx="4"></rect>
    <path d="M7.25 14.75v2.25"></path>
    <path d="M12 11.5V17"></path>
    <path d="M16.75 8.75V17"></path>
    <path d="m7 10.25 3.25-2.5 2.8 1.65 3.95-3.15"></path>
  </svg>
`;

export function renderEmptyStateMarkup(options = {}) {
  const title = options.title || "这里还没有数据";
  const copy = options.copy || "等第一条记录出现，这里就会亮起来。";
  const compact = options.compact ? " empty-state-compact" : "";
  const branded = options.branded ? " empty-state-branded" : "";

  return `
    <div class="empty-state${compact}${branded}">
      <span class="empty-state-icon">${EMPTY_STATE_ICON}</span>
      ${options.branded ? '<span class="empty-state-brand brand-wordmark brand-wordmark-inline">YAM</span>' : ""}
      <p class="empty-title">${escapeHtml(title)}</p>
      <p class="empty-copy">${escapeHtml(copy)}</p>
    </div>
  `;
}

export function createEmptyStateElement(options = {}) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = renderEmptyStateMarkup(options).trim();
  return wrapper.firstElementChild;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
