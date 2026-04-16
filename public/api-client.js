const ACCESS_TOKEN_KEY = "yam-access-token";
const REFRESH_TOKEN_KEY = "yam-refresh-token";
const USER_KEY = "yam-session-user";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const DEFAULT_REMOTE_ORIGIN = "https://yam-web.onrender.com";

export function getSession() {
  return {
    accessToken: window.localStorage.getItem(ACCESS_TOKEN_KEY) || readCookie(ACCESS_TOKEN_KEY),
    refreshToken: window.localStorage.getItem(REFRESH_TOKEN_KEY) || readCookie(REFRESH_TOKEN_KEY),
    user: readStoredUser(),
  };
}

export function getCurrentUser() {
  return getSession().user;
}

export function isAuthenticated() {
  const session = getSession();
  return Boolean(session.accessToken || session.refreshToken);
}

export function saveSession(payload = {}) {
  if (payload.accessToken) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, payload.accessToken);
    writeCookie(ACCESS_TOKEN_KEY, payload.accessToken);
  }

  if (payload.refreshToken) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken);
    writeCookie(REFRESH_TOKEN_KEY, payload.refreshToken);
  }

  if (payload.user) {
    window.localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
  }
}

export function clearSession() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  clearCookie(ACCESS_TOKEN_KEY);
  clearCookie(REFRESH_TOKEN_KEY);
}

export async function requireUserSession(options = "/auth") {
  const defaultMode = options?.next === "/admin" || options === "/admin" ? "admin-login" : "user-login";
  const redirectOptions =
    typeof options === "string"
      ? { next: options, mode: defaultMode }
      : {
          next: options?.next || "/auth",
          mode: options?.mode || defaultMode,
        };

  if (!isAuthenticated()) {
    redirectToAuth(redirectOptions);
    return null;
  }

  try {
    const payload = await fetchCurrentUser();
    return payload.user;
  } catch (error) {
    clearSession();
    redirectToAuth(redirectOptions);
    return null;
  }
}

export function redirectToAuth(options = "/app") {
  const next = typeof options === "string" ? options : options?.next || "/app";
  const mode = typeof options === "string" ? "user-login" : options?.mode || "user-login";
  const safeNext = encodeURIComponent(next);
  const path = resolveAuthPath(mode);
  window.location.href = `${path}?next=${safeNext}`;
}

export async function fetchCurrentUser() {
  const response = await apiFetch("/api/auth/me");
  const payload = await response.json();
  if (payload.user) {
    saveSession({ user: payload.user });
  }
  return payload;
}

export async function register(values) {
  const response = await fetch(resolveApiUrl("/api/auth/register"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(values),
  });

  return handleAuthResponse(response);
}

export async function login(values) {
  const response = await fetch(resolveApiUrl("/api/auth/login"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(values),
  });

  return handleAuthResponse(response);
}

export async function logout() {
  const { refreshToken } = getSession();

  try {
    if (refreshToken) {
      await fetch(resolveApiUrl("/api/auth/logout"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      });
    }
  } catch {
    // Ignore logout failures and clear local session anyway.
  }

  clearSession();
}

export async function updateCurrentUserProfile(values) {
  const response = await apiFetch("/api/auth/me", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(values),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "保存失败");
  }

  saveSession({ user: payload.user });
  return payload;
}

export async function apiFetch(url, options = {}, allowRetry = true) {
  const session = getSession();
  const headers = new Headers(options.headers || {});

  if (session.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }

  const response = await fetch(resolveApiUrl(url), {
    ...options,
    headers,
  });

  if (response.status !== 401 || !allowRetry || !session.refreshToken) {
    return response;
  }

  const refreshed = await refreshAccessToken(session.refreshToken);
  if (!refreshed) {
    clearSession();
    return response;
  }

  return apiFetch(url, options, false);
}

async function refreshAccessToken(refreshToken) {
  try {
    const response = await fetch(resolveApiUrl("/api/auth/refresh"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      return false;
    }

    const payload = await response.json();
    saveSession(payload);
    return true;
  } catch {
    return false;
  }
}

async function handleAuthResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "登录失败，请稍后再试");
  }

  saveSession(payload);
  return payload;
}

function readStoredUser() {
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function resolveAuthPath(mode) {
  const routes = {
    "user-login": "/auth/user-login",
    "user-register": "/auth/user-register",
    "admin-login": "/auth/admin-login",
    "admin-register": "/auth/admin-register",
  };

  return routes[mode] || routes["user-login"];
}

function resolveApiUrl(path) {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;

  const base = resolveApiBase();
  return `${base}${path}`;
}

function resolveApiBase() {
  if (window?.Capacitor?.isNativePlatform?.()) {
    return window.__YAM_PUBLIC_ORIGIN__ || DEFAULT_REMOTE_ORIGIN;
  }

  return "";
}

function writeCookie(name, value) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${SESSION_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
}

function clearCookie(name) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
}

function readCookie(name) {
  const target = `${name}=`;
  const cookie = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(target));

  return cookie ? decodeURIComponent(cookie.slice(target.length)) : "";
}
