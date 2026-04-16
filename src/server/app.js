import express from "express";
import path from "node:path";

import { env, paths } from "./config.js";
import { prisma } from "./lib/prisma.js";
import authRoutes from "./routes/auth.js";
import dataRoutes from "./routes/data.js";
import adminRoutes from "./routes/admin.js";
import publicRoutes, { resolveApkPath } from "./routes/public.js";

const CONTENT_PAGES = new Map([
  ["/", "index.html"],
  ["/auth", "auth.html"],
  ["/auth/user-login", "auth.html"],
  ["/auth/user-register", "auth-user-register.html"],
  ["/auth/admin-login", "auth-admin-login.html"],
  ["/auth/admin-register", "auth-admin-register.html"],
  ["/app", "app.html"],
  ["/admin", "admin.html"],
  ["/install", "install.html"],
  ["/privacy", "privacy.html"],
]);

export async function startServer() {
  await prisma.$connect();

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "4mb" }));
  app.use(express.urlencoded({ extended: false }));

  app.get("/healthz", (request, response) => {
    response.json({
      ok: true,
      product: "YAM",
      nodeEnv: env.nodeEnv,
      publicOrigin: env.publicAppOrigin,
    });
  });

  app.get("/downloads/latest.apk", async (request, response, next) => {
    try {
      const apkPath = await resolveApkPath();
      if (!apkPath) {
        response.status(404).send("暂时还没有可下载的 APK");
        return;
      }

      response.download(apkPath, path.basename(apkPath));
    } catch (error) {
      next(error);
    }
  });

  app.use(publicRoutes);
  app.use(authRoutes);
  app.use(dataRoutes);
  app.use(adminRoutes);
  app.use(
    express.static(paths.public, {
      extensions: ["html"],
      setHeaders: (response, filePath) => {
        const normalizedPath = filePath.replaceAll("\\", "/");
        const noStoreTargets = [".html", ".js", ".css", "manifest.webmanifest", "sw.js", "version.json"];

        if (noStoreTargets.some((suffix) => normalizedPath.endsWith(suffix))) {
          response.setHeader("Cache-Control", "no-store");
          return;
        }

        if (normalizedPath.includes("/assets/") || normalizedPath.includes("/downloads/")) {
          response.setHeader("Cache-Control", "public, max-age=604800");
          return;
        }

        response.setHeader("Cache-Control", "public, max-age=300");
      },
    })
  );

  for (const [route, fileName] of CONTENT_PAGES.entries()) {
    app.get(route, (request, response) => {
      response.sendFile(path.join(paths.public, fileName));
    });
  }

  app.use("/api", (request, response) => {
    response.status(404).json({ error: "接口不存在" });
  });

  app.use((request, response) => {
    response.status(404).send("未找到页面");
  });

  app.use((error, request, response, next) => {
    console.error("Server error:", error);
    if ((request.path || "").startsWith("/api/")) {
      response.status(500).json({ error: "服务出错了，请看一下终端。" });
      return;
    }

    response.status(500).send("服务出错了，请看一下终端。");
  });

  const server = app.listen(env.port, () => {
    console.log(`YAM 已启动：http://localhost:${env.port}`);
    console.log(`数据库：${env.databaseUrl}`);
    console.log(`下载页：${env.publicAppOrigin}/install`);
    console.log("按 Ctrl + C 可以停止");
  });

  server.on("error", (error) => {
    console.error("启动失败：", error.message);
    process.exit(1);
  });

  return server;
}
