import { Router } from "express";
import { stat, readFile } from "node:fs/promises";

import { env, paths } from "../config.js";

const router = Router();

router.get("/version", async (request, response, next) => {
  try {
    response.json(await loadVersionPayload(request));
  } catch (error) {
    next(error);
  }
});

router.get("/api/public/release", async (request, response, next) => {
  try {
    const version = await loadVersionPayload(request);

    response.json({
      ok: true,
      release: {
        productName: version.productName,
        version: version.latestVersion,
        updatedAt: version.updatedAt,
        downloadUrl: version.downloadUrl,
        webUrl: version.webUrl,
        privacyUrl: version.privacyUrl,
        publicOrigin: version.publicOrigin,
        forceUpdate: version.forceUpdate,
        changelog: version.changelog,
      },
    });
  } catch (error) {
    next(error);
  }
});

export async function loadVersionPayload(request) {
  const packageJson = JSON.parse(await readFile(paths.packageJson, "utf8"));
  const apkPath = await resolveApkPath();
  const apkStat = apkPath ? await stat(apkPath) : null;

  let versionManifest = null;
  try {
    versionManifest = JSON.parse(await readFile(paths.versionManifest, "utf8"));
  } catch {
    versionManifest = null;
  }

  return {
    productName: "YAM",
    latestVersion: versionManifest?.latestVersion || packageJson.version,
    forceUpdate: Boolean(versionManifest?.forceUpdate),
    downloadUrl: versionManifest?.downloadUrl || env.publicDownloadPath,
    webUrl: versionManifest?.webUrl || "/auth/user-login",
    privacyUrl: versionManifest?.privacyUrl || "/privacy",
    publicOrigin: resolvePublicOrigin(request),
    updatedAt: versionManifest?.updatedAt || apkStat?.mtime?.toISOString?.() || new Date().toISOString(),
    changelog: Array.isArray(versionManifest?.changelog) ? versionManifest.changelog : [],
  };
}

function resolvePublicOrigin(request) {
  if (env.publicAppOrigin && !isLocalOrigin(env.publicAppOrigin)) {
    return env.publicAppOrigin;
  }

  const derivedOrigin = deriveOriginFromRequest(request);
  if (derivedOrigin) {
    return derivedOrigin;
  }

  return env.publicAppOrigin || `http://localhost:${env.port}`;
}

function deriveOriginFromRequest(request) {
  if (!request) {
    return "";
  }

  const forwardedProto = request.get("x-forwarded-proto");
  const forwardedHost = request.get("x-forwarded-host");
  const host = forwardedHost || request.get("host");
  const protocol = forwardedProto || request.protocol || "https";

  if (!host) {
    return "";
  }

  return `${protocol}://${host}`;
}

function isLocalOrigin(origin) {
  return /localhost|127\.0\.0\.1/i.test(origin || "");
}

export async function resolveApkPath() {
  const candidates = [
    `${paths.downloads}/latest.apk`,
    `${paths.downloads}/YAM.apk`,
  ];

  for (const candidate of candidates) {
    try {
      await stat(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return "";
}

export default router;
