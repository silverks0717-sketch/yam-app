const ACCESS_TOKEN_KEY = "yam-access-token";
const REFRESH_TOKEN_KEY = "yam-refresh-token";
const USER_KEY = "yam-session-user";

export function getSession() {
  return {
    accessToken: window.localStorage.getItem(ACCESS_TOKEN_KEY) || "",
    refreshToken: window.localStorage.getItem(REFRESH_TOKEN_KEY) || "",
    user: readStoredUser(),
  };
}

export function getCurrentUser() {
  return getSession().user;
}

export function isAuthenticated() {
  return Boolean(getSession().accessToken);
}

export function saveSession(payload = {}) {
  if (payload.accessToken) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, payload.accessToken);
  }

  if (payload.refreshToken) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken);
  }

  if (payload.user) {
    window.localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
  }
}

export function clearSession() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export async function requireUserSession(options = "/auth") {
  const redirectOptions =
    typeof options === "string"
      ? { next: options, mode: options === "/admin" ? "admin-login" : "user-login" }
      : {
          next: options?.next || "/auth",
          mode: options?.mode || (options?.next === "/admin" ? "admin-login" : "user-login"),
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
  const safeMode = encodeURIComponent(mode);
  window.location.href = `/auth?mode=${safeMode}&next=${safeNext}`;
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
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(values),
  });

  return handleAuthResponse(response);
}

export async function login(values) {
  const response = await fetch("/api/auth/login", {
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
      await fetch("/api/auth/logout", {
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

export async function apiFetch(url, options = {}, allowRetry = true) {
  const session = getSession();
  const headers = new Headers(options.headers || {});

  if (session.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }

  const response = await fetch(url, {
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
    const response = await fetch("/api/auth/refresh", {
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
