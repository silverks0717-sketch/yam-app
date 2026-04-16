import { buildAppModel, escapeHtml, formatDateTime } from "./analytics.js";
import { avatarForGender, labelForGender } from "./avatar-utils.js";
import { renderAreaChart, renderBarChart, renderLineChart } from "./charts.js";
import { APP_VERSION } from "./generated-version.js";
import { apiFetch, getCurrentUser, logout, requireUserSession } from "./api-client.js";
import { initPwa } from "./pwa.js";
import { enforceVersionGate } from "./version-check.js";

const state = {
  sessionUser: null,
  dashboard: null,
  users: [],
  selectedUser: null,
  selectedDataset: null,
  selectedActivity: null,
  selectedActivities: [],
  selectedLastDataChangeAt: null,
};

const elements = {};

document.addEventListener("DOMContentLoaded", async () => {
  initPwa();

  const user = await requireUserSession({ next: "/admin", mode: "admin-login" });
  if (!user) return;
  if (user.role !== "ADMIN") {
    window.location.replace("/app");
    return;
  }

  state.sessionUser = user;
  cacheElements();
  bindEvents();
  renderSession();
  const versionState = await enforceVersionGate({ currentVersion: APP_VERSION });
  if (versionState.forceUpdate) {
    return;
  }
  await Promise.all([loadDashboard(), loadUsers()]);
});

function cacheElements() {
  elements.adminName = byId("admin-user-name");
  elements.adminMeta = byId("admin-user-meta");
  elements.brandAvatar = byId("admin-brand-avatar");
  elements.sessionAvatar = byId("admin-session-avatar");
  elements.message = byId("admin-message");
  elements.overview = byId("admin-overview");
  elements.trendChart = byId("admin-trend-chart");
  elements.userList = byId("admin-user-list");
  elements.recentUsers = byId("admin-recent-users");
  elements.recentActive = byId("admin-recent-active");
  elements.searchForm = byId("admin-search-form");
  elements.searchInput = byId("admin-search-input");
  elements.logoutButton = byId("admin-logout-button");
  elements.userEmpty = byId("admin-user-empty");
  elements.userDetail = byId("admin-user-detail");
  elements.detailName = byId("detail-user-name");
  elements.detailMeta = byId("detail-user-meta");
  elements.detailStatusButton = byId("detail-status-button");
  elements.detailExportButton = byId("detail-export-button");
  elements.detailStats = byId("detail-user-stats");
  elements.detailActivityChart = byId("detail-activity-chart");
  elements.detailWeightChart = byId("detail-weight-chart");
  elements.detailWaistChart = byId("detail-waist-chart");
  elements.detailTrainingChart = byId("detail-training-chart");
  elements.detailHighCalorieChart = byId("detail-high-calorie-chart");
  elements.detailSocialChart = byId("detail-social-chart");
  elements.detailReviewSummary = byId("detail-review-summary");
  elements.detailReviewReminder = byId("detail-review-reminder");
  elements.detailMeals = byId("detail-meal-list");
  elements.detailTrainings = byId("detail-training-list");
  elements.detailBody = byId("detail-body-list");
  elements.detailActivityList = byId("detail-activity-list");
}

function bindEvents() {
  elements.logoutButton.addEventListener("click", handleLogout);
  elements.searchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await loadUsers(elements.searchInput.value.trim());
  });
  elements.userList.addEventListener("click", handleUserListClick);
  elements.detailStatusButton.addEventListener("click", handleStatusToggle);
  elements.detailExportButton.addEventListener("click", handleUserExport);
}

async function loadDashboard() {
  try {
    const response = await apiFetch("/api/admin/dashboard");
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "加载后台总览失败");
    }

    state.dashboard = payload.dashboard;
    renderDashboard();
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function loadUsers(query = "") {
  try {
    const suffix = query ? `?query=${encodeURIComponent(query)}` : "";
    const response = await apiFetch(`/api/admin/users${suffix}`);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "加载用户列表失败");
    }

    state.users = payload.users || [];
    renderUsers();

    if (!state.users.length) {
      state.selectedUser = null;
      state.selectedDataset = null;
      state.selectedActivity = null;
      state.selectedActivities = [];
      state.selectedLastDataChangeAt = null;
      elements.userEmpty.hidden = false;
      elements.userDetail.hidden = true;
      return;
    }

    if (!state.selectedUser && state.users[0]) {
      await loadUserDetail(state.users[0].id);
    }
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function loadUserDetail(userId) {
  try {
    const response = await apiFetch(`/api/admin/users/${encodeURIComponent(userId)}`);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "加载用户详情失败");
    }

    state.selectedUser = payload.user;
    state.selectedDataset = payload.data;
    state.selectedActivity = payload.activity30d;
    state.selectedActivities = payload.activities || [];
    state.selectedLastDataChangeAt = payload.lastDataChangeAt || null;
    renderUsers();
    renderUserDetail();
  } catch (error) {
    showMessage(error.message, "error");
  }
}

function renderSession() {
  const user = state.sessionUser || getCurrentUser();
  elements.brandAvatar.src = avatarForGender(user?.gender);
  elements.brandAvatar.alt = `${labelForGender(user?.gender)}管理员头像`;
  elements.sessionAvatar.src = avatarForGender(user?.gender);
  elements.sessionAvatar.alt = `${labelForGender(user?.gender)}管理员头像`;
  elements.adminName.textContent = user?.username || "管理员";
  elements.adminMeta.textContent = user?.email || `${labelForGender(user?.gender)} · 后台访问已开启`;
}

function renderDashboard() {
  if (!state.dashboard) return;

  const totals = state.dashboard.totals;
  const cards = [
    ["总用户数", `${totals.totalUsers}`],
    ["7 天活跃用户", `${totals.activeUsers7d}`],
    ["今日新增记录", `${totals.todayNewRecords}`],
    ["饮食记录总数", `${totals.mealCount}`],
    ["训练记录总数", `${totals.trainingCount}`],
    ["身体记录总数", `${totals.bodyMetricCount}`],
  ];

  elements.overview.innerHTML = cards
    .map(
      ([label, value]) => `
        <article class="review-stat overview-stat">
          <span class="record-meta">${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </article>
      `
    )
    .join("");

  renderBarChart(elements.trendChart, state.dashboard.weeklyTrend, {
    barColor: "#f4d6bd",
    accentColor: "#8d5872",
  });

  elements.recentUsers.innerHTML = renderMiniUsers(
    state.dashboard.recentUsers,
    "还没有新注册用户",
    (user) => formatDateTime(user.createdAt)
  );
  elements.recentActive.innerHTML = renderMiniUsers(
    state.dashboard.recentActiveUsers,
    "还没有活跃用户",
    (user) => (user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "暂未登录")
  );
}

function renderUsers() {
  elements.userList.innerHTML = state.users.length
    ? state.users.map(renderUserCard).join("")
    : `<div class="record-card"><p class="record-meta">暂时没有匹配的用户。</p></div>`;
}

function renderUserCard(user) {
  const selected = state.selectedUser?.id === user.id;
  const counts = user.counts || {};
  return `
    <article class="record-card user-card ${selected ? "selected" : ""}" data-user-id="${escapeHtml(user.id)}">
      <div class="record-card-top">
        <div>
          <h3 class="record-title">${escapeHtml(user.username)}</h3>
          <p class="record-meta">${escapeHtml(user.email)} · ${escapeHtml(user.status === "FROZEN" ? "已冻结" : "正常")}</p>
        </div>
      </div>
      <div class="tag-row">
        <span class="tag">${counts.meals || 0} 餐</span>
        <span class="tag alt">${counts.trainings || 0} 练</span>
        <span class="tag warn">${counts.bodyMetrics || 0} 次身体记录</span>
      </div>
      <div class="user-card-meta">
        <p class="record-meta">注册：${escapeHtml(formatDateTime(user.createdAt))}</p>
        <p class="record-meta">最近登录：${escapeHtml(user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "还没有登录过")}</p>
        <p class="record-meta">最近改动：${escapeHtml(user.lastDataChangeAt ? formatDateTime(user.lastDataChangeAt) : "还没有数据修改")}</p>
        <p class="record-meta">最近行为：${escapeHtml(readLatestActivity(user))}</p>
      </div>
    </article>
  `;
}

function renderUserDetail() {
  if (!state.selectedUser || !state.selectedDataset) return;

  const model = buildAppModel(state.selectedDataset);
  elements.userEmpty.hidden = true;
  elements.userDetail.hidden = false;
  elements.detailName.textContent = `${state.selectedUser.username} 的记录`;
  elements.detailMeta.textContent = [
    `注册于 ${formatDateTime(state.selectedUser.createdAt)}`,
    state.selectedUser.lastLoginAt ? `最近登录 ${formatDateTime(state.selectedUser.lastLoginAt)}` : "还没有登录过",
    state.selectedLastDataChangeAt ? `最近改动 ${formatDateTime(state.selectedLastDataChangeAt)}` : "还没有数据改动",
  ].join(" · ");
  elements.detailStatusButton.textContent =
    state.selectedUser.status === "FROZEN" ? "恢复账号" : "冻结账号";

  elements.detailStats.innerHTML = [
    ["饮食记录", `${state.selectedDataset.meals.length} 条`],
    ["训练记录", `${state.selectedDataset.trainings.length} 条`],
    ["身体记录", `${state.selectedDataset.bodyMetrics.length} 条`],
    ["用户性别", labelForGender(state.selectedUser.gender)],
    ["最近两周训练次数", model.review.stats[0]?.value || "0 次"],
    ["最近行为", state.selectedActivities[0]?.summary || "暂时还没有"],
    ["最近修改", state.selectedLastDataChangeAt ? formatDateTime(state.selectedLastDataChangeAt) : "暂无"],
  ]
    .map(
      ([label, value]) => `
        <div class="review-stat">
          <span class="record-meta">${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `
    )
    .join("");

  renderBarChart(
    elements.detailActivityChart,
    (state.selectedActivity || []).map((entry) => ({
      label: entry.label,
      value: (entry.meals || 0) + (entry.trainings || 0) + (entry.bodyMetrics || 0),
    })),
    { barColor: "#f0d4c3", accentColor: "#8e5a73" }
  );

  renderAreaChart(elements.detailWeightChart, model.trends.weightTrend, {
    lineColor: "#d08b63",
    dotColor: "#fef7f2",
    fillColor: "rgba(250, 221, 198, 0.62)",
    yFormatter: (value) => `${value.toFixed(1)}kg`,
  });
  renderLineChart(elements.detailWaistChart, model.trends.waistTrend, {
    lineColor: "#9d5f78",
    dotColor: "#fef7f2",
    yFormatter: (value) => `${value.toFixed(1)}cm`,
  });
  renderBarChart(elements.detailTrainingChart, model.trends.weeklyTrainingTrend, {
    barColor: "#f1d2c2",
    accentColor: "#85536d",
  });
  renderBarChart(elements.detailHighCalorieChart, model.trends.weeklyHighCalorieTrend, {
    barColor: "#f8e4be",
    accentColor: "#cf9248",
  });
  renderBarChart(elements.detailSocialChart, model.trends.weeklySocialTrend, {
    barColor: "#eed0db",
    accentColor: "#89556f",
  });

  elements.detailReviewSummary.textContent = model.review.summary;
  elements.detailReviewReminder.textContent = model.review.reminder;
  elements.detailMeals.innerHTML = renderDatasetMiniList(
    state.selectedDataset.meals.slice(0, 8),
    (entry) => ({
      title: entry.foodName || "未填写食物名称",
      meta: [entry.date, entry.time || "", entry.mealType].filter(Boolean).join(" · "),
      detail: entry.note || entry.portion || "",
    }),
    "还没有饮食记录。"
  );
  elements.detailTrainings.innerHTML = renderDatasetMiniList(
    state.selectedDataset.trainings.slice(0, 8),
    (entry) => ({
      title: entry.trainingName || "未填写训练名称",
      meta: [entry.date, entry.time || "", entry.duration ? `${entry.duration} 分钟` : ""].filter(Boolean).join(" · "),
      detail: entry.details || entry.note || "",
    }),
    "还没有训练记录。"
  );
  elements.detailBody.innerHTML = renderDatasetMiniList(
    state.selectedDataset.bodyMetrics.slice(0, 8),
    (entry) => ({
      title: entry.date,
      meta: [
        Number.isFinite(entry.weight) ? `体重 ${entry.weight}kg` : "",
        Number.isFinite(entry.waist) ? `腰围 ${entry.waist}cm` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      detail: Number.isFinite(entry.bodyFat)
        ? `体脂 ${entry.bodyFat}%`
        : Number.isFinite(entry.boneMuscle)
          ? `骨骼肌 ${entry.boneMuscle}kg`
          : "",
    }),
    "还没有身体记录。"
  );
  elements.detailActivityList.innerHTML = state.selectedActivities.length
    ? state.selectedActivities.map(renderActivityItem).join("")
    : `<div class="record-card"><p class="record-meta">这个用户暂时还没有行为记录。</p></div>`;
}

async function handleStatusToggle() {
  if (!state.selectedUser) return;

  const nextStatus = state.selectedUser.status === "FROZEN" ? "ACTIVE" : "FROZEN";
  const question =
    nextStatus === "FROZEN"
      ? `确定冻结 ${state.selectedUser.username} 吗？`
      : `确定恢复 ${state.selectedUser.username} 吗？`;

  if (!window.confirm(question)) {
    return;
  }

  try {
    const response = await apiFetch(`/api/admin/users/${encodeURIComponent(state.selectedUser.id)}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: nextStatus }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "更新状态失败");
    }

    state.selectedUser = payload.user;
    showMessage(nextStatus === "FROZEN" ? "账号已冻结" : "账号已恢复");
    await loadUsers(elements.searchInput.value.trim());
    renderUserDetail();
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function handleUserExport() {
  if (!state.selectedUser) return;

  try {
    const response = await apiFetch(`/api/admin/users/${encodeURIComponent(state.selectedUser.id)}/export`);
    if (!response.ok) {
      const payload = await response.json();
      throw new Error(payload.error || "导出失败");
    }

    const blob = await response.blob();
    const fileName = readFileName(response) || `${state.selectedUser.username}.xlsx`;
    downloadBlob(blob, fileName);
    showMessage("用户数据已导出");
  } catch (error) {
    showMessage(error.message, "error");
  }
}

function handleUserListClick(event) {
  const card = event.target.closest("[data-user-id]");
  if (!card) return;
  loadUserDetail(card.dataset.userId);
}

async function handleLogout() {
  await logout();
  window.location.href = "/auth/admin-login?switch=1";
}

function showMessage(text, tone = "success") {
  elements.message.textContent = text;
  elements.message.className = `status-banner show${tone === "error" ? " error" : ""}`;
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function readFileName(response) {
  const header = response.headers.get("Content-Disposition") || "";
  const match = header.match(/filename\*=UTF-8''([^;]+)/i);
  return match ? decodeURIComponent(match[1]) : "";
}

function byId(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`找不到元素：${id}`);
  }
  return element;
}

function renderMiniUsers(users = [], emptyLabel, formatter) {
  if (!users.length) {
    return `<div class="record-card"><p class="record-meta">${escapeHtml(emptyLabel)}</p></div>`;
  }

  return users
    .map(
      (user) => `
        <article class="mini-user-row">
          <div>
            <strong>${escapeHtml(user.username)}</strong>
            <p class="record-meta">${escapeHtml(user.email)}</p>
          </div>
          <span class="record-meta">${escapeHtml(formatter(user))}</span>
        </article>
      `
    )
    .join("");
}

function renderDatasetMiniList(items = [], mapItem, emptyLabel) {
  if (!items.length) {
    return `<div class="record-card"><p class="record-meta">${escapeHtml(emptyLabel)}</p></div>`;
  }

  return items
    .map((item) => {
      const view = mapItem(item);
      return `
        <article class="mini-user-row dataset-row">
          <div>
            <strong>${escapeHtml(view.title)}</strong>
            <p class="record-meta">${escapeHtml(view.meta || " ")}</p>
          </div>
          <span class="record-meta">${escapeHtml(view.detail || " ")}</span>
        </article>
      `;
    })
    .join("");
}

function readLatestActivity(user) {
  if (!user.latestActivity) return "还没有行为记录";
  const time = user.latestActivity.createdAt ? ` · ${formatDateTime(user.latestActivity.createdAt)}` : "";
  return `${user.latestActivity.summary}${time}`;
}

function renderActivityItem(entry) {
  const detail = formatActivityDetail(entry);
  return `
    <article class="activity-item">
      <div class="activity-badge ${escapeHtml(entry.action)}">${escapeHtml(entry.summary)}</div>
      <div class="activity-copy">
        <strong>${escapeHtml(entry.summary)}</strong>
        <p class="record-meta">${escapeHtml(formatDateTime(entry.createdAt))}</p>
        <p class="muted-text">${escapeHtml(detail)}</p>
      </div>
    </article>
  `;
}

function formatActivityDetail(entry) {
  const detail = entry.detail || {};
  const effectiveDetail = detail.after || detail;
  if (entry.entityType === "meal") {
    return [effectiveDetail.foodName, effectiveDetail.date].filter(Boolean).join(" · ") || "饮食记录变化";
  }

  if (entry.entityType === "training") {
    return [effectiveDetail.trainingName, effectiveDetail.date].filter(Boolean).join(" · ") || "训练记录变化";
  }

  if (entry.entityType === "body_metric") {
    return [effectiveDetail.date, readBodyMetricSnapshot(effectiveDetail)].filter(Boolean).join(" · ") || "身体数据变化";
  }

  if (entry.entityType === "session") {
    return detail.userAgent || "账号登录";
  }

  if (detail.after || detail.before) {
    return "记录内容发生更新";
  }

  return "记录有新的动作";
}

function readBodyMetricSnapshot(detail) {
  return [
    Number.isFinite(detail.weight) ? `${detail.weight}kg` : "",
    Number.isFinite(detail.waist) ? `${detail.waist}cm` : "",
  ]
    .filter(Boolean)
    .join(" / ");
}
