import { buildWorkbookSheets, buildExportFileName } from "./export-data.js";
import { APP_NAME, createEmptyData, normalizeData } from "./data-model.js";
import { apiFetch, getCurrentUser, isAuthenticated } from "./api-client.js";

const LOCAL_KEY = "yam-cache-data";
const NATIVE_KEY = "yam-native-cache";

export async function loadStoredData() {
  if (!isAuthenticated()) {
    return loadFallbackData();
  }

  emitSyncStatus("syncing", "正在从云端拉取数据…");

  try {
    const response = await apiFetch("/api/me/sync", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(await readError(response, "同步失败"));
    }

    const payload = await response.json();
    const normalized = normalizeData(payload.data);
    await saveCache(normalized);
    emitSyncStatus("synced", "已同步");
    return normalized;
  } catch (error) {
    const cached = await loadCache();
    emitSyncStatus("failed", cached ? "同步失败，已显示最近缓存" : "同步失败");
    if (cached) {
      return cached;
    }

    throw error;
  }
}

export async function saveStoredData(data) {
  const normalized = normalizeData(data);
  normalized.meta.updatedAt = new Date().toISOString();

  await saveCache(normalized);

  if (!isAuthenticated()) {
    emitSyncStatus("failed", "未登录，暂时只保存在本地缓存");
    return normalized;
  }

  emitSyncStatus("syncing", "正在同步到云端…");

  const response = await apiFetch("/api/me/sync", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(normalized),
  });

  if (!response.ok) {
    emitSyncStatus("failed", "同步失败，改动已经临时保存在本地缓存");
    throw new Error(await readError(response, "保存失败"));
  }

  const payload = await response.json();
  const nextData = normalizeData(payload.data);
  await saveCache(nextData);
  emitSyncStatus("synced", "已同步");
  return nextData;
}

export async function exportExcelForPlatform(data, review) {
  if (isNativeApp()) {
    return exportExcelNative(data, review);
  }

  if (!isAuthenticated()) {
    return exportExcelBrowser(data, review);
  }

  const response = await apiFetch("/api/exports/me");
  if (!response.ok) {
    throw new Error(await readError(response, "导出失败"));
  }

  const blob = await response.blob();
  const fileName = getFileNameFromResponse(response) || buildExportFileName(new Date());
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return {
    ok: true,
    path: fileName,
    message: "Excel 已下载到浏览器默认下载目录。",
    mode: "browser",
  };
}

export function isNativeApp() {
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

export function currentPlatform() {
  return window.Capacitor?.getPlatform?.() || "web";
}

async function loadFallbackData() {
  return (await loadCache()) || createEmptyData();
}

async function loadCache() {
  if (isNativeApp()) {
    const Preferences = getPlugin("Preferences");
    const userKey = buildScopedKey();

    if (Preferences?.get) {
      const result = await Preferences.get({ key: userKey });
      if (result?.value) {
        return normalizeData(JSON.parse(result.value));
      }
    }
  }

  const raw = window.localStorage.getItem(buildScopedKey());
  return raw ? normalizeData(JSON.parse(raw)) : null;
}

async function saveCache(data) {
  const serialized = JSON.stringify(data);
  const key = buildScopedKey();

  if (isNativeApp()) {
    const Preferences = getPlugin("Preferences");
    if (Preferences?.set) {
      await Preferences.set({ key, value: serialized });
      return data;
    }
  }

  window.localStorage.setItem(key, serialized);
  return data;
}

async function exportExcelNative(data, review) {
  const xlsx = requireXlsx();
  const workbook = createWorkbook(xlsx, normalizeData(data), review);
  const fileName = buildExportFileName(new Date());
  const Filesystem = getPlugin("Filesystem");
  const Share = getPlugin("Share");

  if (!Filesystem?.writeFile) {
    return exportExcelBrowser(data, review);
  }

  const base64 = xlsx.write(workbook, { bookType: "xlsx", type: "base64" });
  const saved = await Filesystem.writeFile({
    path: fileName,
    data: base64,
    directory: "DOCUMENTS",
    recursive: true,
  });

  if (Share?.share) {
    await Share.share({
      title: APP_NAME,
      text: "导出 Excel",
      url: saved.uri,
      dialogTitle: "导出 Excel",
    });
  }

  return {
    ok: true,
    path: saved.uri,
    message: "已生成 Excel，并打开系统分享面板。",
    mode: "mobile",
  };
}

function exportExcelBrowser(data, review) {
  const xlsx = requireXlsx();
  const workbook = createWorkbook(xlsx, normalizeData(data), review);
  const fileName = buildExportFileName(new Date());
  const output = xlsx.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });
  const blob = new Blob([output], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return {
    ok: true,
    path: fileName,
    message: "已触发浏览器下载。",
    mode: "browser",
  };
}

function createWorkbook(xlsx, data, review) {
  const workbook = xlsx.utils.book_new();
  const sheets = buildWorkbookSheets(data, review);

  sheets.forEach((sheet) => {
    const rows = sheet.rows.length ? sheet.rows : [{ 提示: "还没有数据" }];
    const worksheet = xlsx.utils.json_to_sheet(rows);
    xlsx.utils.book_append_sheet(workbook, worksheet, sheet.name);
  });

  return workbook;
}

function getPlugin(name) {
  return window.Capacitor?.Plugins?.[name];
}

function requireXlsx() {
  if (!window.XLSX) {
    throw new Error("Excel 模块没有加载完成");
  }

  return window.XLSX;
}

function buildScopedKey() {
  const user = getCurrentUser();
  const suffix = user?.id || "guest";
  return `${isNativeApp() ? NATIVE_KEY : LOCAL_KEY}:${suffix}`;
}

function emitSyncStatus(status, message = "") {
  window.dispatchEvent(
    new CustomEvent("yam:sync-status", {
      detail: { status, message },
    })
  );
}

async function readError(response, fallback) {
  try {
    const payload = await response.json();
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

function getFileNameFromResponse(response) {
  const header = response.headers.get("Content-Disposition") || "";
  const match = header.match(/filename\*=UTF-8''([^;]+)/i);
  return match ? decodeURIComponent(match[1]) : "";
}
