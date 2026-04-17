import { clearSession, fetchCurrentUser, login, register, requestJson } from "./api-client.js";
import { APP_NAME } from "./data-model.js";
import { initPwa } from "./pwa.js";
import { getDailyQuote } from "./quotes.js";

const MODE_META = {
  "user-login": {
    kicker: "用户登录",
    title: "回到你的记录里。",
    quote: "只留这一条入口，把注意力放回今天本身。",
    next: "/app",
  },
  "user-register": {
    kicker: "用户注册",
    title: "从今天开始，把变化留下来。",
    quote: "先把账号建好，剩下的记录留给今天去写。",
    next: "/app",
  },
  "admin-login": {
    kicker: "管理员登录",
    title: "进入总控后台。",
    quote: "这里只接受管理员身份，不再混入普通用户操作。",
    next: "/admin",
  },
  "admin-register": {
    kicker: "管理员注册",
    title: "用校验码创建后台权限。",
    quote: "后台入口应该被严格区分，也应该只显示这一页需要的字段。",
    next: "/admin",
  },
};

const PATH_BY_MODE = {
  "user-login": "/auth/user-login",
  "user-register": "/auth/user-register",
  "admin-login": "/auth/admin-login",
  "admin-register": "/auth/admin-register",
};

const elements = {};
let currentMode = "user-login";

document.addEventListener("DOMContentLoaded", async () => {
  initPwa();
  currentMode = resolvePageMode();

  const params = new URLSearchParams(window.location.search);
  if (params.get("switch") === "1") {
    clearSession();
  } else {
    const restoredUser = await tryRestoreSession();
    if (restoredUser) {
      redirectAuthenticatedUser(restoredUser);
      return;
    }
  }

  cacheElements();
  bindEvents();
  renderCopy();
  renderQuote();
});

function cacheElements() {
  elements.message = byId("auth-message");
  elements.kicker = byId("auth-kicker");
  elements.title = byId("auth-title");
  elements.quote = byId("auth-quote");
  elements.form = byId("auth-form");
}

function bindEvents() {
  elements.form.addEventListener("submit", handleSubmit);
}

function renderCopy() {
  const meta = MODE_META[currentMode] || MODE_META["user-login"];
  elements.kicker.textContent = meta.kicker;
  elements.title.textContent = meta.title;
  document.title = `${APP_NAME} · ${meta.kicker}`;
}

function renderQuote() {
  const quote = getDailyQuote(new Date());
  const meta = MODE_META[currentMode] || MODE_META["user-login"];
  elements.quote.textContent = meta.quote || quote.cn;
}

async function handleSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector("button[type='submit']");
  submit.disabled = true;

  try {
    if (currentMode === "user-login") {
      await login({
        identifier: form.identifier.value.trim(),
        password: form.password.value,
      });
      showMessage("欢迎回来。", "success");
      window.location.href = resolveNextPath("/app");
      return;
    }

    if (currentMode === "user-register") {
      const gender = form.querySelector("input[name='gender']:checked")?.value;
      if (!gender) {
        throw new Error("请选择用户性别");
      }
      await register({
        username: form.username.value.trim(),
        password: form.password.value,
        email: "",
        gender,
      });
      showMessage("用户账号创建完成。", "success");
      window.location.href = resolveNextPath("/app");
      return;
    }

    if (currentMode === "admin-login") {
      await requestJson("/api/auth/admin/login", {
        identifier: form.identifier.value.trim(),
        password: form.password.value,
      });
      showMessage("管理员权限已验证。", "success");
      window.location.href = resolveNextPath("/admin");
      return;
    }

    const gender = form.querySelector("input[name='gender']:checked")?.value;
    if (!gender) {
      throw new Error("请选择管理员性别");
    }
    await requestJson("/api/auth/admin/register", {
      username: form.username.value.trim(),
      password: form.password.value,
      email: "",
      gender,
      adminKey: form.adminKey.value.trim(),
    });
    showMessage("管理员账号创建完成。", "success");
    window.location.href = resolveNextPath("/admin");
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    submit.disabled = false;
  }
}

async function tryRestoreSession() {
  try {
    const payload = await fetchCurrentUser();
    return payload.user || null;
  } catch {
    clearSession();
    return null;
  }
}

function redirectAuthenticatedUser(user) {
  const target = user?.role === "ADMIN" ? "/admin" : "/app";
  window.location.replace(resolveNextPath(target));
}

function showMessage(text, tone = "success") {
  elements.message.textContent = text;
  elements.message.className = `status-banner show${tone === "error" ? " error" : ""}`;
}

function resolvePageMode() {
  const value = document.body.dataset.authMode;
  return MODE_META[value] ? value : "user-login";
}

function resolveNextPath(fallback) {
  const params = new URLSearchParams(window.location.search);
  return params.get("next") || fallback;
}

function byId(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`找不到元素：${id}`);
  }
  return element;
}

export function pathForAuthMode(mode, search = "") {
  const path = PATH_BY_MODE[mode] || PATH_BY_MODE["user-login"];
  return `${path}${search}`;
}
