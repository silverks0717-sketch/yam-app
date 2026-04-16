import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

loadEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

function withFallback(name, fallback) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

export const env = {
  port: Number(process.env.PORT || 4321),
  databaseUrl: withFallback(
    "DATABASE_URL",
    `postgresql://${process.env.USER || "postgres"}@localhost:5432/yam_plan?schema=public`
  ),
  jwtSecret: withFallback("JWT_SECRET", "yam-local-dev-access-secret-change-me"),
  accessTokenTtlMinutes: Number(process.env.ACCESS_TOKEN_TTL_MINUTES || 45),
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30),
  publicAppOrigin: withFallback("PUBLIC_APP_ORIGIN", `http://localhost:${Number(process.env.PORT || 4321)}`),
  publicDownloadPath: withFallback("PUBLIC_DOWNLOAD_PATH", "/downloads/latest.apk"),
  adminUsername: withFallback("ADMIN_USERNAME", "admin"),
  adminEmail: withFallback("ADMIN_EMAIL", "admin@yam.local"),
  adminPassword: withFallback("ADMIN_PASSWORD", "Admin123456!"),
  nodeEnv: withFallback("NODE_ENV", "development"),
};

export const paths = {
  root: rootDir,
  public: path.join(rootDir, "public"),
  downloads: path.join(rootDir, "public", "downloads"),
  versionManifest: path.join(rootDir, "public", "version.json"),
  packageJson: path.join(rootDir, "package.json"),
};

export const isProduction = env.nodeEnv === "production";
