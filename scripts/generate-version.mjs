import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const packagePath = path.join(rootDir, "package.json");
const releaseConfigPath = path.join(rootDir, "release", "release.config.json");
const versionPath = path.join(rootDir, "public", "version.json");
const generatedVersionPath = path.join(rootDir, "public", "generated-version.js");
const latestApkPath = path.join(rootDir, "public", "downloads", "latest.apk");

const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
const releaseConfig = JSON.parse(await readFile(releaseConfigPath, "utf8"));

let updatedAt = new Date().toISOString();

try {
  const fileStat = await stat(latestApkPath);
  updatedAt = fileStat.mtime.toISOString();
} catch {
  updatedAt = new Date().toISOString();
}

const changelog = Object.entries(releaseConfig.notes || {})
  .filter(([, items]) => Array.isArray(items) && items.length)
  .map(([type, items]) => ({
    type,
    items: items.map((item) => String(item).trim()).filter(Boolean),
  }));

const payload = {
  productName: "YAM",
  latestVersion: packageJson.version,
  forceUpdate: Boolean(releaseConfig.forceUpdate),
  downloadUrl: "/downloads/latest.apk",
  webUrl: "/auth?mode=user-login&switch=1",
  privacyUrl: "/privacy",
  updatedAt,
  changelog,
};

await mkdir(path.dirname(versionPath), { recursive: true });
await writeFile(versionPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
await writeFile(
  generatedVersionPath,
  `export const APP_VERSION = "${packageJson.version}";\n`,
  "utf8"
);
console.log(`已生成版本清单：${versionPath}`);
