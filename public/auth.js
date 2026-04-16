import { clearSession, getSession, login, register, saveSession } from "./api-client.js";
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
    quote: "填完这几项，就可以开始真正属于你的那一页。",
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
    title: "用密钥创建后台权限。",
    quote: "管理员身份会被严格校验，密钥不对就不会放行。",
    next: "/admin",
  },
};

const elements = {};
let currentMode = "user-login";

document.addEventListener("DOMContentLoaded", async () => {
  initPwa();

  const params = new URLSearchParams(window.location.search);
  const shouldSwitchAccount = params.get("switch") === "1";
  const hasExplicitMode = hasModeInParams(params);

  if (shouldSwitchAccount) {
    clearSession();
  }

  const session = getSession();
  if (session.accessToken && !shouldSwitchAccount && !hasExplicitMode && session.user?.role === "ADMIN") {
    window.location.replace("/admin");
    return;
  }
  if (session.accessToken && !shouldSwitchAccount && !hasExplicitMode) {
    window.location.replace("/app");
    return;
  }

  cacheElements();
  bindEvents();
  renderQuote();
  setMode(resolveInitialMode());
  await hydrateDeviceAccess();
});

function cacheElements() {
  elements.message = byId("auth-message");
  elements.kicker = byId("auth-kicker");
  elements.title = byId("auth-title");
  elements.quote = byId("auth-quote");
  elements.forms = {
    "user-login": byId("user-login-form"),
    "user-register": byId("user-register-form"),
    "admin-login": byId("admin-login-form"),
    "admin-register": byId("admin-register-form"),
  };
  elements.copyButtons = Array.from(document.querySelectorAll(".copy-link-button"));
  elements.deviceLinks = {
    iphone: byId("iphone-link-text"),
    ipad: byId("ipad-link-text"),
    android: byId("android-link-text"),
    iphoneOpen: byId("iphone-open-link"),
    ipadOpen: byId("ipad-open-link"),
    androidDownload: byId("android-download-link"),
  };
}

function bindEvents() {
  elements.forms["user-login"].addEventListener("submit", handleUserLogin);
  elements.forms["user-register"].addEventListener("submit", handleUserRegister);
  elements.forms["admin-login"].addEventListener("submit", handleAdminLogin);
  elements.forms["admin-register"].addEventListener("submit", handleAdminRegister);
  elements.copyButtons.forEach((button) => {
    button.addEventListener("click", () => copyLink(button.dataset.copyTarget));
  });
}

async function handleUserLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector("button[type='submit']");
  submit.disabled = true;

  try {
    await login({
      identifier: form.identifier.value.trim(),
      password: form.password.value,
    });
    showMessage("欢迎回来。", "success");
    window.location.href = resolveNextPath("/app");
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    submit.disabled = false;
  }
}

async function handleUserRegister(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector("button[type='submit']");
  submit.disabled = true;

  try {
    await register({
      username: form.username.value.trim(),
      email: form.email.value.trim(),
      password: form.password.value,
      gender: readFormGender(form),
    });
    showMessage("用户账号创建完成。", "success");
    window.location.href = resolveNextPath("/app");
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    submit.disabled = false;
  }
}

async function handleAdminLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector("button[type='submit']");
  submit.disabled = true;

  try {
    await submitJson("/api/auth/admin/login", {
      identifier: form.identifier.value.trim(),
      password: form.password.value,
    });
    showMessage("管理员权限已验证。", "success");
    window.location.href = "/admin";
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    submit.disabled = false;
  }
}

async function handleAdminRegister(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector("button[type='submit']");
  submit.disabled = true;

  try {
    await submitJson("/api/auth/admin/register", {
      username: form.username.value.trim(),
      email: form.email.value.trim(),
      password: form.password.value,
      gender: readFormGender(form),
      adminKey: form.adminKey.value.trim(),
    });
    showMessage("管理员账号创建完成。", "success");
    window.location.href = "/admin";
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    submit.disabled = false;
  }
}

function setMode(mode) {
  currentMode = MODE_META[mode] ? mode : "user-login";
  const meta = MODE_META[currentMode];
  elements.kicker.textContent = meta.kicker;
  elements.title.textContent = meta.title;
  elements.quote.textContent = meta.quote;
  document.title = `${APP_NAME} · ${meta.kicker}`;

  Object.entries(elements.forms).forEach(([key, form]) => {
    form.hidden = key !== currentMode;
  });
}

function renderQuote() {
  const quote = getDailyQuote(new Date());
  if (!elements.quote.textContent) {
    elements.quote.textContent = quote.cn;
  }
}

function showMessage(text, tone = "success") {
  elements.message.textContent = text;
  elements.message.className = `status-banner show${tone === "error" ? " error" : ""}`;
}

async function hydrateDeviceAccess() {
  const fallbackOrigin = window.location.origin;
  let publicOrigin = fallbackOrigin;
  let downloadUrl = "/downloads/latest.apk";

  try {
    const response = await fetch("/api/public/release", { cache: "no-store" });
    if (response.ok) {
      const payload = await response.json();
      publicOrigin = payload.release?.publicOrigin || fallbackOrigin;
      downloadUrl = payload.release?.downloadUrl || downloadUrl;
    }
  } catch {
    publicOrigin = fallbackOrigin;
  }

  const authUrl = new URL("/auth", publicOrigin).toString();
  const apkUrl = new URL(downloadUrl, publicOrigin).toString();

  elements.deviceLinks.iphone.textContent = authUrl;
  elements.deviceLinks.ipad.textContent = authUrl;
  elements.deviceLinks.android.textContent = apkUrl;
  elements.deviceLinks.iphoneOpen.href = authUrl;
  elements.deviceLinks.ipadOpen.href = authUrl;
  elements.deviceLinks.androidDownload.href = apkUrl;
}

async function copyLink(targetId) {
  const target = byId(targetId);
  const value = target.textContent?.trim();
  if (!value || value === "读取中…") {
    showMessage("链接还没准备好，请稍后再试。", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
    showMessage("网址已复制。");
  } catch {
    showMessage("复制失败，请手动复制。", "error");
  }
}

function resolveInitialMode() {
  const params = new URLSearchParams(window.location.search);
  const direct = params.get("mode");
  if (MODE_META[direct]) {
    return direct;
  }

  const role = params.get("role");
  const action = params.get("action");
  const combined = role && action ? `${role}-${action}` : "";
  return MODE_META[combined] ? combined : "user-login";
}

function hasModeInParams(params) {
  const direct = params.get("mode");
  if (MODE_META[direct]) {
    return true;
  }

  const role = params.get("role");
  const action = params.get("action");
  return Boolean(role && action && MODE_META[`${role}-${action}`]);
}

function resolveNextPath(fallback) {
  const params = new URLSearchParams(window.location.search);
  return params.get("next") || fallback;
}

function readFormGender(form) {
  return form.querySelector("input[name='gender']:checked")?.value || "FEMALE";
}

async function submitJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "请求失败");
  }

  saveSession(data);
  return data;
}

function byId(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`找不到元素：${id}`);
  }
  return element;
}
