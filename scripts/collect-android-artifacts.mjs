import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const packageJson = JSON.parse(await readFile(path.join(rootDir, "package.json"), "utf8"));
const version = String(packageJson.version || "1.0.0");

const releaseDir = path.join(rootDir, "release", "android");
const outputs = [
  {
    from: path.join(rootDir, "android", "app", "build", "outputs", "apk", "release", `yam-${version}-release.apk`),
    to: path.join(releaseDir, `yam-${version}-release.apk`),
  },
  {
    from: path.join(rootDir, "android", "app", "build", "outputs", "apk", "release", "app-release.apk"),
    to: path.join(releaseDir, `yam-${version}-release.apk`),
  },
  {
    from: path.join(rootDir, "android", "app", "build", "outputs", "bundle", "release", "app-release.aab"),
    to: path.join(releaseDir, `yam-${version}-release.aab`),
  },
];

await mkdir(releaseDir, { recursive: true });

const copied = new Set();
for (const artifact of outputs) {
  try {
    await copyFile(artifact.from, artifact.to);
    copied.add(path.basename(artifact.to));
  } catch {
    // Skip missing artifacts so the script works for apk-only or bundle-only builds.
  }
}

if (!copied.size) {
  console.log("没有发现可收集的 Android 发布产物。");
  process.exit(0);
}

for (const fileName of copied) {
  console.log(`已收集 Android 发布产物：release/android/${fileName}`);
}
