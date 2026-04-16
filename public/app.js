import {
  buildAppModel,
  currentTimeString,
  escapeHtml,
  formatDateTime,
  formatDisplayDate,
  isFiniteNumber,
  parseOptionalNumber,
  todayString,
  weekdayLabel,
} from "./analytics.js";
import { avatarForGender, labelForGender } from "./avatar-utils.js";
import { renderAreaChart, renderBarChart, renderLineChart } from "./charts.js";
import { createEmptyData, normalizeData } from "./data-model.js";
import { APP_VERSION } from "./generated-version.js";
import { getDailyQuote } from "./quotes.js";
import { getCurrentUser, logout, requireUserSession, saveSession, updateCurrentUserProfile } from "./api-client.js";
import { initPwa } from "./pwa.js";
import { currentPlatform, exportExcelForPlatform, loadStoredData, saveStoredData } from "./storage.js";
import { enforceVersionGate } from "./version-check.js";

const PAGE_META = {
  today: {
    title: "今日",
    subtitle: "打开先看趋势，再决定今天补哪一条。",
  },
  records: {
    title: "记录",
    subtitle: "吃完就记，练完就记，不用太多判断。",
  },
  trends: {
    title: "趋势",
    subtitle: "图比说明更重要，所以这里只留关键变化。",
  },
  review: {
    title: "双周回顾",
    subtitle: "只看最近两周，不把事情讲得太长。",
  },
};

const state = {
  data: createEmptyData(),
  sessionUser: null,
  ui: {
    activeTab: "today",
    recordView: "meal",
    profileOpen: false,
    editing: {
      mealId: null,
      trainingId: null,
      bodyId: null,
    },
    selection: {
      meals: createSelectionState(),
      trainings: createSelectionState(),
      bodyMetrics: createSelectionState(),
    },
  },
};

const elements = {};

document.addEventListener("DOMContentLoaded", async () => {
  initPwa();

  const sessionUser = await requireUserSession({ next: "/app", mode: "user-login" });
  if (!sessionUser) {
    return;
  }

  state.sessionUser = sessionUser;
  cacheElements();
  bindEvents();
  resetAllForms();
  setRecordView("meal");
  setActiveTab("today");
  renderDailyQuote();
  renderSession();
  const versionState = await enforceVersionGate({ currentVersion: APP_VERSION });
  if (versionState.forceUpdate) {
    return;
  }
  loadData();
});

function cacheElements() {
  elements.pageTitle = byId("page-title");
  elements.pageSubtitle = byId("page-subtitle");
  elements.statusBanner = byId("status-banner");
  elements.brandAvatar = byId("brand-avatar");
  elements.syncIndicator = byId("sync-indicator");
  elements.syncHint = byId("sync-hint");
  elements.sessionAvatar = byId("session-avatar");
  elements.userName = byId("session-user-name");
  elements.userMeta = byId("session-user-meta");
  elements.adminLink = byId("admin-link");
  elements.logoutButton = byId("logout-button");
  elements.profile = {
    openButton: byId("profile-open-button"),
    overlay: byId("profile-overlay"),
    backdrop: byId("profile-backdrop"),
    sheet: byId("profile-sheet"),
    closeButton: byId("profile-close-button"),
    cancelButton: byId("profile-cancel-button"),
    form: byId("profile-form"),
  };
  elements.navButtons = Array.from(document.querySelectorAll(".nav-button"));
  elements.panels = Array.from(document.querySelectorAll(".panel"));
  elements.exportButtons = Array.from(document.querySelectorAll(".export-excel-button"));
  elements.quickRecordButtons = Array.from(document.querySelectorAll(".quick-record"));
  elements.recordSwitchButtons = Array.from(byId("record-switch").querySelectorAll(".segmented-button"));
  elements.recordViews = Array.from(document.querySelectorAll(".record-view"));

  elements.quoteCn = byId("daily-quote-cn");
  elements.quoteEn = byId("daily-quote-en");

  elements.today = {
    status: byId("today-status"),
    empty: byId("today-empty"),
    weightChart: byId("today-weight-chart"),
    waistChart: byId("today-waist-chart"),
    trainingChart: byId("today-training-chart"),
    highCalorieChart: byId("today-high-calorie-chart"),
    socialChart: byId("today-social-chart"),
  };

  elements.meal = {
    form: byId("meal-form"),
    formTitle: byId("meal-form-title"),
    submit: byId("meal-submit"),
    cancel: byId("meal-cancel"),
    count: byId("meal-count"),
    list: byId("meal-list"),
    selectToggle: byId("meal-select-toggle"),
    selectionBar: byId("meal-selection-bar"),
    selectionCount: byId("meal-selection-count"),
    selectAll: byId("meal-select-all"),
    deleteSelected: byId("meal-delete-selected"),
  };

  elements.training = {
    form: byId("training-form"),
    formTitle: byId("training-form-title"),
    submit: byId("training-submit"),
    cancel: byId("training-cancel"),
    count: byId("training-count"),
    list: byId("training-list"),
    selectToggle: byId("training-select-toggle"),
    selectionBar: byId("training-selection-bar"),
    selectionCount: byId("training-selection-count"),
    selectAll: byId("training-select-all"),
    deleteSelected: byId("training-delete-selected"),
  };

  elements.body = {
    form: byId("body-form"),
    formTitle: byId("body-form-title"),
    submit: byId("body-submit"),
    cancel: byId("body-cancel"),
  };

  elements.trends = {
    weightChart: byId("trend-weight-chart"),
    waistChart: byId("trend-waist-chart"),
    trainingChart: byId("trend-training-chart"),
    highCalorieChart: byId("trend-high-calorie-chart"),
    socialChart: byId("trend-social-chart"),
    boneMuscleChart: byId("trend-bone-muscle-chart"),
  };

  elements.review = {
    stats: byId("review-stats"),
    summary: byId("review-summary"),
    reminder: byId("review-reminder"),
    compareChart: byId("review-compare-chart"),
  };
}

function bindEvents() {
  elements.navButtons.forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.tab));
  });

  elements.exportButtons.forEach((button) => {
    button.addEventListener("click", exportExcel);
  });

  elements.quickRecordButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveTab("records");
      setRecordView(button.dataset.recordView);
      focusCurrentRecordForm();
    });
  });

  elements.recordSwitchButtons.forEach((button) => {
    button.addEventListener("click", () => setRecordView(button.dataset.recordView));
  });

  elements.meal.form.addEventListener("submit", handleMealSubmit);
  elements.training.form.addEventListener("submit", handleTrainingSubmit);
  elements.body.form.addEventListener("submit", handleBodySubmit);

  elements.meal.cancel.addEventListener("click", resetMealForm);
  elements.training.cancel.addEventListener("click", resetTrainingForm);
  elements.body.cancel.addEventListener("click", resetBodyForm);

  elements.meal.list.addEventListener("click", handleMealListClick);
  elements.training.list.addEventListener("click", handleTrainingListClick);

  bindSelectionControls("meals", elements.meal);
  bindSelectionControls("trainings", elements.training);
  elements.logoutButton.addEventListener("click", handleLogout);
  elements.profile.openButton.addEventListener("click", openProfileSheet);
  elements.profile.closeButton.addEventListener("click", closeProfileSheet);
  elements.profile.cancelButton.addEventListener("click", closeProfileSheet);
  elements.profile.backdrop.addEventListener("click", closeProfileSheet);
  elements.profile.form.addEventListener("submit", handleProfileSubmit);
  window.addEventListener("yam:sync-status", handleSyncStatus);
  window.addEventListener("keydown", handleGlobalKeydown);
}

function bindSelectionControls(key, group) {
  if (!group.selectToggle || !group.selectAll || !group.deleteSelected) {
    return;
  }

  group.selectToggle.addEventListener("click", () => toggleSelectionMode(key));
  group.selectAll.addEventListener("click", () => toggleSelectAll(key));
  group.deleteSelected.addEventListener("click", () => deleteSelectedRecords(key));
}

async function loadData() {
  try {
    state.data = normalizeData(await loadStoredData());
    renderAll();
    showMessage(currentPlatform() === "android" ? "已加载当前账号数据" : "已加载云端数据", "success");
  } catch (error) {
    console.error(error);
    showMessage(`加载失败：${error.message}`, "error", true);
  }
}

async function persistData(message) {
  try {
    state.data = normalizeData(await saveStoredData(state.data));
    renderAll();
    showMessage(message, "success");
  } catch (error) {
    console.error(error);
    showMessage(`保存失败：${error.message}`, "error", true);
  }
}

async function exportExcel() {
  try {
    const review = buildAppModel(state.data).review;
    const result = await exportExcelForPlatform(state.data, review);
    showMessage(result.message || `已导出：${result.path}`, "success");
  } catch (error) {
    console.error(error);
    showMessage(`导出失败：${error.message}`, "error", true);
  }
}

function renderAll() {
  const model = buildAppModel(state.data);
  updateTopbar();
  renderToday(model);
  renderTrends(model.trends);
  renderReview(model.review);
  renderRecordLists(model.records);
}

function updateTopbar() {
  const meta = PAGE_META[state.ui.activeTab];
  elements.pageTitle.textContent = meta.title;
  elements.pageSubtitle.textContent = `${meta.subtitle}${state.data.meta.updatedAt ? ` 上次保存 ${formatDateTime(state.data.meta.updatedAt)}` : ""}`;

  elements.navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === state.ui.activeTab);
  });

  elements.panels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === state.ui.activeTab);
  });
}

function renderSession() {
  const user = state.sessionUser || getCurrentUser();
  if (!user) return;

  elements.brandAvatar.src = avatarForGender(user.gender);
  elements.brandAvatar.alt = `${labelForGender(user.gender)}用户头像`;
  elements.sessionAvatar.src = avatarForGender(user.gender);
  elements.sessionAvatar.alt = `${labelForGender(user.gender)}用户头像`;
  elements.userName.textContent = user.username || user.email || "已登录";
  elements.userMeta.textContent =
    user.role === "ADMIN"
      ? `${labelForGender(user.gender)} · 管理员`
      : state.data.profile?.subtitle || `${labelForGender(user.gender)} · 云端同步已开启`;
  elements.adminLink.hidden = user.role !== "ADMIN";
  hydrateProfileForm();
}

function renderDailyQuote() {
  const quote = getDailyQuote(new Date());
  elements.quoteCn.textContent = quote.cn;
  elements.quoteEn.textContent = quote.en;
}

function renderToday(model) {
  elements.today.status.innerHTML = model.today.statusCards
    .map(
      (item) => `
        <article class="status-card">
          <span class="status-pill ${item.tone}">${escapeHtml(item.value)}</span>
          <strong>${escapeHtml(item.label)}</strong>
          <p class="record-meta">${escapeHtml(item.detail)}</p>
        </article>
      `
    )
    .join("");

  elements.today.empty.hidden = model.hasAnyData;

  renderAreaChart(elements.today.weightChart, model.today.charts.weightTrend, {
    lineColor: "#ffdfc7",
    dotColor: "#fff7f4",
    fillColor: "rgba(255, 236, 220, 0.82)",
    yFormatter: (value) => `${value.toFixed(1)}kg`,
  });

  renderLineChart(elements.today.waistChart, model.today.charts.waistTrend, {
    lineColor: "#f4c6b1",
    dotColor: "#fff7f4",
    yFormatter: (value) => `${value.toFixed(1)}cm`,
  });

  renderBarChart(elements.today.trainingChart, model.today.charts.weeklyTrainingTrend, {
    height: 236,
    barColor: "#f4d7c2",
    accentColor: "#8f5c72",
  });

  renderBarChart(elements.today.highCalorieChart, model.today.charts.weeklyHighCalorieTrend, {
    height: 236,
    barColor: "#f9e4bf",
    accentColor: "#d6944a",
  });

  renderBarChart(elements.today.socialChart, model.today.charts.weeklySocialTrend, {
    height: 236,
    barColor: "#efd3dc",
    accentColor: "#8e5d77",
  });
}

function renderTrends(model) {
  renderAreaChart(elements.trends.weightChart, model.weightTrend, {
    lineColor: "#d28b63",
    dotColor: "#fef7f2",
    fillColor: "rgba(250, 221, 198, 0.62)",
    yFormatter: (value) => `${value.toFixed(1)}kg`,
  });

  renderLineChart(elements.trends.waistChart, model.waistTrend, {
    lineColor: "#9d5f78",
    dotColor: "#fef7f2",
    yFormatter: (value) => `${value.toFixed(1)}cm`,
  });

  renderBarChart(elements.trends.trainingChart, model.weeklyTrainingTrend, {
    height: 246,
    barColor: "#f3d3c1",
    accentColor: "#8f5c72",
  });

  renderBarChart(elements.trends.highCalorieChart, model.weeklyHighCalorieTrend, {
    height: 246,
    barColor: "#f8e5c3",
    accentColor: "#d6944a",
  });

  renderBarChart(elements.trends.socialChart, model.weeklySocialTrend, {
    height: 246,
    barColor: "#efd3dc",
    accentColor: "#8e5d77",
  });

  renderLineChart(elements.trends.boneMuscleChart, model.boneMuscleTrend, {
    lineColor: "#7fa693",
    dotColor: "#fef7f2",
    yFormatter: (value) => `${value.toFixed(1)}kg`,
  });
}

function renderReview(model) {
  elements.review.stats.innerHTML = model.stats
    .map(
      (item) => `
        <div class="review-stat">
          <span class="record-meta">${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
        </div>
      `
    )
    .join("");

  elements.review.summary.textContent = model.summary;
  elements.review.reminder.textContent = model.reminder;

  renderBarChart(elements.review.compareChart, model.comparisonChart, {
    height: 248,
    barColor: "#f3d5c2",
    accentColor: "#87546d",
    valueClassName: "chart-value-soft",
    labelClassName: "chart-label-soft",
  });
}

function renderRecordLists(records) {
  renderSelectionHeader("meals", elements.meal, records.meals.length);
  renderSelectionHeader("trainings", elements.training, records.trainings.length);

  elements.meal.list.innerHTML = records.meals.length
    ? records.meals.map((entry) => renderMealCard(entry)).join("")
    : renderEmptyList("还没有饮食记录，从今天的一顿饭开始就行。");

  elements.training.list.innerHTML = records.trainings.length
    ? records.trainings.map((entry) => renderTrainingCard(entry)).join("")
    : renderEmptyList("还没有训练记录，随便记一场也没关系。");
}

function renderSelectionHeader(key, group, count) {
  if (!group.count || !group.selectToggle || !group.selectionBar || !group.selectionCount) {
    return;
  }

  const selection = state.ui.selection[key];
  group.count.textContent = `${count} 条`;
  group.selectToggle.textContent = selection.active ? "结束选择" : "选择删除";
  group.selectionBar.hidden = !selection.active;
  group.selectionCount.textContent = `已选 ${selection.ids.size} 条`;
}

function renderMealCard(entry) {
  const selection = state.ui.selection.meals;
  const selected = selection.ids.has(entry.id);
  const tags = [
    entry.mealType,
    entry.portion || "",
    entry.highCalorie ? "高热量" : "",
    entry.social ? "应酬 / 喝酒" : "",
  ].filter(Boolean);

  return `
    <article class="record-card ${selected ? "selected" : ""}" data-id="${escapeHtml(entry.id)}" data-kind="meals">
      <div class="record-card-top">
        <label class="record-check ${selection.active ? "active" : ""}">
          <input type="checkbox" data-select-id="${escapeHtml(entry.id)}" ${selected ? "checked" : ""} />
        </label>
        <div>
          <h4 class="record-title">${escapeHtml(entry.foodName || "未填写食物名称")}</h4>
          <p class="record-meta">${escapeHtml(formatDisplayDate(entry.date))} · ${escapeHtml(entry.time || "未填时间")} · ${escapeHtml(weekdayLabel(entry.date))}</p>
        </div>
      </div>
      <div class="tag-row">
        ${tags.map((tag, index) => `<span class="tag ${index > 1 ? "warn" : ""}">${escapeHtml(tag)}</span>`).join("")}
      </div>
      ${entry.note ? `<p class="record-meta">${escapeHtml(entry.note)}</p>` : ""}
      <div class="record-actions">
        <button class="button ghost" data-action="edit" type="button">编辑</button>
        <button class="button ghost" data-action="delete" type="button">删除</button>
      </div>
    </article>
  `;
}

function renderTrainingCard(entry) {
  const selection = state.ui.selection.trainings;
  const selected = selection.ids.has(entry.id);
  const tags = [
    entry.duration ? `${entry.duration} 分钟` : "",
    buildTrainingStats(entry),
  ].filter(Boolean);

  return `
    <article class="record-card ${selected ? "selected" : ""}" data-id="${escapeHtml(entry.id)}" data-kind="trainings">
      <div class="record-card-top">
        <label class="record-check ${selection.active ? "active" : ""}">
          <input type="checkbox" data-select-id="${escapeHtml(entry.id)}" ${selected ? "checked" : ""} />
        </label>
        <div>
          <h4 class="record-title">${escapeHtml(entry.trainingName || "未填写训练名称")}</h4>
          <p class="record-meta">${escapeHtml(formatDisplayDate(entry.date))} · ${escapeHtml(entry.time || "未填时间")} · ${escapeHtml(weekdayLabel(entry.date))}</p>
        </div>
      </div>
      <div class="tag-row">
        ${tags.map((tag, index) => `<span class="tag ${index > 0 ? "alt" : ""}">${escapeHtml(tag)}</span>`).join("")}
      </div>
      ${entry.details ? `<p class="record-meta">${escapeHtml(entry.details)}</p>` : ""}
      ${entry.note ? `<p class="record-meta">${escapeHtml(entry.note)}</p>` : ""}
      <div class="record-actions">
        <button class="button ghost" data-action="edit" type="button">编辑</button>
        <button class="button ghost" data-action="delete" type="button">删除</button>
      </div>
    </article>
  `;
}

function renderBodyCard(entry) {
  const selection = state.ui.selection.bodyMetrics;
  const selected = selection.ids.has(entry.id);

  return `
    <article class="record-card ${selected ? "selected" : ""}" data-id="${escapeHtml(entry.id)}" data-kind="bodyMetrics">
      <div class="record-card-top">
        <label class="record-check ${selection.active ? "active" : ""}">
          <input type="checkbox" data-select-id="${escapeHtml(entry.id)}" ${selected ? "checked" : ""} />
        </label>
        <div>
          <h4 class="record-title">${escapeHtml(formatDisplayDate(entry.date))}</h4>
          <p class="record-meta">${escapeHtml(buildBodyStats(entry))}</p>
        </div>
      </div>
      <div class="record-actions">
        <button class="button ghost" data-action="edit" type="button">编辑</button>
        <button class="button ghost" data-action="delete" type="button">删除</button>
      </div>
    </article>
  `;
}

function renderEmptyList(text) {
  return `<div class="record-card"><p class="record-meta">${escapeHtml(text)}</p></div>`;
}

async function handleMealSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const finishSubmitting = setFormSubmitting(elements.meal.submit, state.ui.editing.mealId ? "确认更新" : "确认保存");
  try {
    const payload = {
      date: form.date.value,
      time: form.time.value,
      mealType: form.mealType.value,
      foodName: form.foodName.value.trim(),
      portion: form.portion.value.trim(),
      highCalorie: form.highCalorie.checked,
      social: form.social.checked,
      note: form.note.value.trim(),
    };

    if (!payload.foodName) {
      showMessage("请先写食物名称", "error", true);
      return;
    }

    upsertRecord("meals", payload, state.ui.editing.mealId);
    await persistData(state.ui.editing.mealId ? "饮食记录已更新" : "饮食记录已保存");
    resetMealForm();
  } finally {
    finishSubmitting();
  }
}

async function handleTrainingSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const finishSubmitting = setFormSubmitting(elements.training.submit, state.ui.editing.trainingId ? "确认更新" : "确认保存");
  try {
    const payload = {
      date: form.date.value,
      time: form.time.value,
      trainingName: form.trainingName.value.trim(),
      duration: parseOptionalNumber(form.duration.value),
      details: form.details.value.trim(),
      weight: parseOptionalNumber(form.weight.value),
      reps: parseOptionalNumber(form.reps.value),
      sets: parseOptionalNumber(form.sets.value),
      note: form.note.value.trim(),
    };

    if (!payload.trainingName) {
      showMessage("请先写训练名称", "error", true);
      return;
    }

    upsertRecord("trainings", payload, state.ui.editing.trainingId);
    await persistData(state.ui.editing.trainingId ? "训练记录已更新" : "训练记录已保存");
    resetTrainingForm();
  } finally {
    finishSubmitting();
  }
}

async function handleBodySubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const finishSubmitting = setFormSubmitting(elements.body.submit, state.ui.editing.bodyId ? "确认更新" : "确认保存");
  try {
    const payload = {
      date: form.date.value,
      weight: parseOptionalNumber(form.weight.value),
      waist: parseOptionalNumber(form.waist.value),
      bodyFat: parseOptionalNumber(form.bodyFat.value),
      boneMuscle: parseOptionalNumber(form.boneMuscle.value),
    };

    if (
      !isFiniteNumber(payload.weight) &&
      !isFiniteNumber(payload.waist) &&
      !isFiniteNumber(payload.bodyFat) &&
      !isFiniteNumber(payload.boneMuscle)
    ) {
      showMessage("至少填一项身体数据", "error", true);
      return;
    }

    upsertRecord("bodyMetrics", payload, state.ui.editing.bodyId);
    await persistData(state.ui.editing.bodyId ? "身体记录已更新" : "身体记录已保存");
    resetBodyForm();
  } finally {
    finishSubmitting();
  }
}

function upsertRecord(key, payload, editingId) {
  if (editingId) {
    state.data[key] = state.data[key].map((entry) => (entry.id === editingId ? { ...entry, ...payload } : entry));
    return;
  }

  state.data[key] = [
    {
      id: `${key}-${Date.now()}`,
      ...payload,
    },
    ...state.data[key],
  ];
}

function handleMealListClick(event) {
  handleListClick(event, "meals", state.data.meals, fillMealForm, "确定删除这条饮食记录吗？", "饮食记录已删除");
}

function handleTrainingListClick(event) {
  handleListClick(event, "trainings", state.data.trainings, fillTrainingForm, "确定删除这条训练记录吗？", "训练记录已删除");
}

function handleListClick(event, key, collection, editHandler, question, successMessage) {
  const checkbox = event.target.closest("input[data-select-id]");
  if (checkbox) {
    toggleSelectedId(key, checkbox.dataset.selectId, checkbox.checked);
    renderAll();
    return;
  }

  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const card = event.target.closest("[data-id]");
  if (!card) return;

  const id = card.dataset.id;

  if (state.ui.selection[key].active) {
    toggleSelectedId(key, id, !state.ui.selection[key].ids.has(id));
    renderAll();
    return;
  }

  if (button.dataset.action === "edit") {
    editHandler(collection.find((item) => item.id === id));
    return;
  }

  deleteSingleRecord(key, id, question, successMessage);
}

async function deleteSingleRecord(key, id, question, successMessage) {
  if (!window.confirm(question)) {
    return;
  }

  state.data[key] = state.data[key].filter((entry) => entry.id !== id);
  clearSelection(key);
  await persistData(successMessage);
  resetEditorByKey(key);
}

function toggleSelectionMode(key) {
  const selection = state.ui.selection[key];
  selection.active = !selection.active;

  if (!selection.active) {
    selection.ids.clear();
  }

  renderAll();
}

function toggleSelectedId(key, id, shouldSelect) {
  const selection = state.ui.selection[key];

  if (shouldSelect) {
    selection.ids.add(id);
  } else {
    selection.ids.delete(id);
  }
}

function toggleSelectAll(key) {
  const selection = state.ui.selection[key];
  const collection = state.data[key];

  if (selection.ids.size === collection.length) {
    selection.ids.clear();
  } else {
    selection.ids = new Set(collection.map((entry) => entry.id));
  }

  renderAll();
}

async function deleteSelectedRecords(key) {
  const selection = state.ui.selection[key];
  if (!selection.ids.size) {
    showMessage("先选中要删除的记录", "error", true);
    return;
  }

  const label =
    key === "meals" ? "饮食" : key === "trainings" ? "训练" : "身体";

  if (!window.confirm(`确定删除选中的 ${selection.ids.size} 条${label}记录吗？`)) {
    return;
  }

  state.data[key] = state.data[key].filter((entry) => !selection.ids.has(entry.id));
  clearSelection(key);
  await persistData(`已删除选中的${label}记录`);
  resetEditorByKey(key);
}

function clearSelection(key) {
  state.ui.selection[key] = createSelectionState();
}

function resetEditorByKey(key) {
  if (key === "meals") resetMealForm();
  if (key === "trainings") resetTrainingForm();
  if (key === "bodyMetrics") resetBodyForm();
}

function fillMealForm(entry) {
  if (!entry) return;
  setActiveTab("records");
  setRecordView("meal");

  const form = elements.meal.form;
  form.date.value = entry.date;
  form.time.value = entry.time || "";
  form.mealType.value = entry.mealType;
  form.foodName.value = entry.foodName;
  form.portion.value = entry.portion || "";
  form.highCalorie.checked = Boolean(entry.highCalorie);
  form.social.checked = Boolean(entry.social);
  form.note.value = entry.note || "";

  state.ui.editing.mealId = entry.id;
  elements.meal.formTitle.textContent = "编辑饮食记录";
  elements.meal.submit.textContent = "确认更新";
  focusCurrentRecordForm();
}

function fillTrainingForm(entry) {
  if (!entry) return;
  setActiveTab("records");
  setRecordView("training");

  const form = elements.training.form;
  form.date.value = entry.date;
  form.time.value = entry.time || "";
  form.trainingName.value = entry.trainingName || "";
  form.duration.value = entry.duration ?? "";
  form.details.value = entry.details || "";
  form.weight.value = entry.weight ?? "";
  form.reps.value = entry.reps ?? "";
  form.sets.value = entry.sets ?? "";
  form.note.value = entry.note || "";

  state.ui.editing.trainingId = entry.id;
  elements.training.formTitle.textContent = "编辑训练记录";
  elements.training.submit.textContent = "确认更新";
  focusCurrentRecordForm();
}

function fillBodyForm(entry) {
  if (!entry) return;
  setActiveTab("records");
  setRecordView("body");

  const form = elements.body.form;
  form.date.value = entry.date;
  form.weight.value = entry.weight ?? "";
  form.waist.value = entry.waist ?? "";
  form.bodyFat.value = entry.bodyFat ?? "";
  form.boneMuscle.value = entry.boneMuscle ?? "";

  state.ui.editing.bodyId = entry.id;
  elements.body.formTitle.textContent = "编辑身体记录";
  elements.body.submit.textContent = "确认更新";
  focusCurrentRecordForm();
}

function resetAllForms() {
  resetMealForm();
  resetTrainingForm();
  resetBodyForm();
}

function resetMealForm() {
  elements.meal.form.reset();
  elements.meal.form.date.value = todayString();
  elements.meal.form.time.value = currentTimeString();
  elements.meal.form.mealType.value = "早餐";
  state.ui.editing.mealId = null;
  elements.meal.formTitle.textContent = "新增饮食记录";
  elements.meal.submit.textContent = "确认保存";
}

function resetTrainingForm() {
  elements.training.form.reset();
  elements.training.form.date.value = todayString();
  elements.training.form.time.value = currentTimeString();
  state.ui.editing.trainingId = null;
  elements.training.formTitle.textContent = "新增训练记录";
  elements.training.submit.textContent = "确认保存";
}

function resetBodyForm() {
  elements.body.form.reset();
  elements.body.form.date.value = todayString();
  state.ui.editing.bodyId = null;
  elements.body.formTitle.textContent = "新增身体记录";
  elements.body.submit.textContent = "确认保存";
}

function setActiveTab(tab) {
  state.ui.activeTab = tab;
  updateTopbar();
}

function setRecordView(view) {
  state.ui.recordView = view;

  elements.recordSwitchButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.recordView === view);
  });

  elements.recordViews.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.recordView === view);
  });
}

function focusCurrentRecordForm() {
  const selector = {
    meal: "#meal-form input[name='foodName']",
    training: "#training-form input[name='trainingName']",
    body: "#body-form input[name='weight']",
  }[state.ui.recordView];

  document.querySelector(selector)?.focus();
}

function showMessage(text, tone = "success", persist = false) {
  elements.statusBanner.textContent = text;
  elements.statusBanner.className = `status-banner show${tone === "error" ? " error" : ""}`;

  if (!persist) {
    window.clearTimeout(showMessage.timer);
    showMessage.timer = window.setTimeout(() => {
      elements.statusBanner.className = "status-banner";
      elements.statusBanner.textContent = "";
    }, 3200);
  }
}

function setFormSubmitting(button, idleLabel) {
  const original = idleLabel || button.textContent;
  button.disabled = true;
  button.textContent = "保存中…";

  return () => {
    button.disabled = false;
    button.textContent = original;
  };
}

async function handleLogout() {
  await logout();
  window.location.href = "/auth/user-login?switch=1";
}

function handleSyncStatus(event) {
  const detail = event.detail || {};
  const status = detail.status || "synced";
  const label =
    status === "syncing" ? "正在同步" : status === "failed" ? "同步失败" : "已同步";

  elements.syncIndicator.textContent = label;
  elements.syncIndicator.className = `sync-indicator ${status}`;
  elements.syncHint.textContent = detail.message || "";
}

function buildTrainingStats(entry) {
  const parts = [];
  if (isFiniteNumber(entry.weight)) parts.push(`${entry.weight.toFixed(1)}kg`);
  if (isFiniteNumber(entry.reps)) parts.push(`${entry.reps}次`);
  if (isFiniteNumber(entry.sets)) parts.push(`${entry.sets}组`);
  return parts.join(" / ");
}

function buildBodyStats(entry) {
  const parts = [];
  if (isFiniteNumber(entry.weight)) parts.push(`体重 ${entry.weight.toFixed(1)}kg`);
  if (isFiniteNumber(entry.waist)) parts.push(`腰围 ${entry.waist.toFixed(1)}cm`);
  if (isFiniteNumber(entry.bodyFat)) parts.push(`体脂 ${entry.bodyFat.toFixed(1)}%`);
  if (isFiniteNumber(entry.boneMuscle)) parts.push(`骨骼肌 ${entry.boneMuscle.toFixed(1)}kg`);
  return parts.join(" · ") || "没有填写具体数值";
}

function createSelectionState() {
  return {
    active: false,
    ids: new Set(),
  };
}

function openProfileSheet() {
  state.ui.profileOpen = true;
  hydrateProfileForm();
  elements.profile.overlay.hidden = false;
  document.body.classList.add("profile-sheet-open");
  window.requestAnimationFrame(() => {
    elements.profile.sheet.classList.add("show");
  });
}

function closeProfileSheet() {
  state.ui.profileOpen = false;
  elements.profile.sheet.classList.remove("show");
  document.body.classList.remove("profile-sheet-open");
  window.setTimeout(() => {
    if (!state.ui.profileOpen) {
      elements.profile.overlay.hidden = true;
    }
  }, 180);
}

function hydrateProfileForm() {
  const user = state.sessionUser || getCurrentUser();
  if (!user) return;

  elements.profile.form.username.value = user.username || "";
  elements.profile.form.email.value = normalizeEditableEmail(user.email);
  elements.profile.form.subtitle.value = state.data.profile?.subtitle || "";
  const genderInput = elements.profile.form.querySelector(`input[name='gender'][value='${user.gender || "FEMALE"}']`);
  if (genderInput) {
    genderInput.checked = true;
  }
}

async function handleProfileSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector("button[type='submit']");
  submit.disabled = true;

  try {
    const profileResponse = await updateCurrentUserProfile({
      username: form.username.value.trim(),
      email: form.email.value.trim(),
      gender: form.querySelector("input[name='gender']:checked")?.value || "FEMALE",
    });

    state.sessionUser = profileResponse.user;
    saveSession({ user: profileResponse.user });
    state.data.profile.subtitle = form.subtitle.value.trim();
    await persistData("个人信息已保存");
    renderSession();
    closeProfileSheet();
  } catch (error) {
    console.error(error);
    showMessage(`保存失败：${error.message}`, "error", true);
  } finally {
    submit.disabled = false;
  }
}

function handleGlobalKeydown(event) {
  if (event.key === "Escape" && state.ui.profileOpen) {
    closeProfileSheet();
  }
}

function normalizeEditableEmail(email = "") {
  return /@(user|admin)\.yam\.local$/i.test(email) ? "" : email;
}

function byId(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`找不到元素：${id}`);
  }
  return element;
}
