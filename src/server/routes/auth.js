import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import {
  createAccessToken,
  createRefreshToken,
  getRequestContext,
  hashPassword,
  hashToken,
  refreshTokenExpiresAt,
  serializeUser,
  verifyPassword,
} from "../lib/auth.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const ADMIN_REGISTRATION_KEY = "88888888";
const USER_GENDERS = ["MALE", "FEMALE"];

const userRegisterSchema = z.object({
  username: z.string().trim().min(3).max(40),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
  password: z.string().min(8).max(72),
  gender: z.enum(USER_GENDERS),
});

const adminRegisterSchema = z.object({
  username: z.string().trim().min(3).max(40),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
  password: z.string().min(8).max(72),
  gender: z.enum(USER_GENDERS),
  adminKey: z.string().trim().length(8),
});

const userLoginSchema = z.object({
  identifier: z.string().trim().min(3).max(160),
  password: z.string().min(8).max(72),
});

const adminLoginSchema = z.object({
  identifier: z.string().trim().min(3).max(160),
  password: z.string().min(8).max(72),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});

router.post("/api/auth/register", async (request, response, next) => {
  try {
    const parsed = userRegisterSchema.parse(request.body);
    const username = parsed.username.trim();
    const email = buildUserEmail(username, parsed.email);

    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: email, mode: "insensitive" } },
          { username: { equals: username, mode: "insensitive" } },
        ],
      },
    });

    if (existing) {
      response.status(409).json({ error: "用户名或邮箱已经被使用了" });
      return;
    }

    const passwordHash = await hashPassword(parsed.password);
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        gender: parsed.gender,
        role: "USER",
      },
    });

    const session = await createSession(user, request);
    response.status(201).json({
      ok: true,
      ...session,
    });
  } catch (error) {
    handleAuthError(error, response, next);
  }
});

router.post("/api/auth/admin/register", async (request, response, next) => {
  try {
    const parsed = adminRegisterSchema.parse(request.body);
    const username = parsed.username.trim();

    if (parsed.adminKey !== ADMIN_REGISTRATION_KEY) {
      response.status(403).json({ error: "管理员密钥不对" });
      return;
    }

    const email = buildAdminEmail(username, parsed.email);
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: username, mode: "insensitive" } },
          { email: { equals: email, mode: "insensitive" } },
        ],
      },
    });

    if (existing) {
      response.status(409).json({ error: "这个管理员用户名已经被使用了" });
      return;
    }

    const passwordHash = await hashPassword(parsed.password);
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        gender: parsed.gender,
        role: "ADMIN",
      },
    });

    const session = await createSession(user, request);
    response.status(201).json({
      ok: true,
      ...session,
    });
  } catch (error) {
    handleAuthError(error, response, next);
  }
});

router.post("/api/auth/login", async (request, response, next) => {
  try {
    const parsed = userLoginSchema.parse(request.body);
    const identifier = parsed.identifier.trim();

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: identifier, mode: "insensitive" } },
          { username: { equals: identifier, mode: "insensitive" } },
        ],
      },
    });

    if (!user || user.role !== "USER" || !(await verifyPassword(parsed.password, user.passwordHash))) {
      response.status(401).json({ error: "账号或密码不对" });
      return;
    }

    if (user.status !== "ACTIVE") {
      response.status(403).json({ error: "账号已被冻结" });
      return;
    }

    const session = await createSession(user, request);
    response.json({
      ok: true,
      ...session,
    });
  } catch (error) {
    handleAuthError(error, response, next);
  }
});

router.post("/api/auth/admin/login", async (request, response, next) => {
  try {
    const parsed = adminLoginSchema.parse(request.body);
    const identifier = parsed.identifier.trim();

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: identifier, mode: "insensitive" } },
          { email: { equals: identifier, mode: "insensitive" } },
        ],
      },
    });

    if (!user || user.role !== "ADMIN" || !(await verifyPassword(parsed.password, user.passwordHash))) {
      response.status(401).json({ error: "管理员账号或密码不对" });
      return;
    }

    if (user.status !== "ACTIVE") {
      response.status(403).json({ error: "账号已被冻结" });
      return;
    }

    const session = await createSession(user, request);
    response.json({
      ok: true,
      ...session,
    });
  } catch (error) {
    handleAuthError(error, response, next);
  }
});

router.post("/api/auth/refresh", async (request, response, next) => {
  try {
    const parsed = refreshSchema.parse(request.body);
    const refreshTokenHash = hashToken(parsed.refreshToken);
    const session = await prisma.userSession.findUnique({
      where: {
        refreshTokenHash,
      },
      include: {
        user: true,
      },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      response.status(401).json({ error: "刷新令牌已失效" });
      return;
    }

    if (session.user.status !== "ACTIVE") {
      response.status(403).json({ error: "账号已被冻结" });
      return;
    }

    const nextRefreshToken = createRefreshToken();
    const nextRefreshHash = hashToken(nextRefreshToken);
    const expiresAt = refreshTokenExpiresAt();

    await prisma.userSession.update({
      where: {
        id: session.id,
      },
      data: {
        refreshTokenHash: nextRefreshHash,
        expiresAt,
        lastUsedAt: new Date(),
      },
    });

    response.json({
      ok: true,
      accessToken: createAccessToken(session.user),
      refreshToken: nextRefreshToken,
      user: serializeUser(session.user),
    });
  } catch (error) {
    handleAuthError(error, response, next);
  }
});

router.post("/api/auth/logout", async (request, response, next) => {
  try {
    const parsed = refreshSchema.parse(request.body);
    const refreshTokenHash = hashToken(parsed.refreshToken);

    await prisma.userSession.updateMany({
      where: {
        refreshTokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    response.json({ ok: true });
  } catch (error) {
    handleAuthError(error, response, next);
  }
});

router.get("/api/auth/me", requireAuth, async (request, response) => {
  response.json({
    ok: true,
    user: request.publicUser,
  });
});

async function createSession(user, request) {
  const refreshToken = createRefreshToken();
  const refreshTokenHash = hashToken(refreshToken);
  const context = getRequestContext(request);

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      sessions: {
        create: {
          refreshTokenHash,
          expiresAt: refreshTokenExpiresAt(),
          lastUsedAt: new Date(),
          userAgent: context.userAgent,
          ipAddress: context.ipAddress,
        },
      },
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: updatedUser.id,
      action: "login",
      entityType: "session",
      detail: {
        role: updatedUser.role,
        userAgent: context.userAgent,
      },
    },
  });

  return {
    accessToken: createAccessToken(updatedUser),
    refreshToken,
    user: serializeUser(updatedUser),
  };
}

function buildAdminEmail(username, rawEmail = "") {
  const email = String(rawEmail || "").trim().toLowerCase();
  if (email) {
    return email;
  }
  return `${username.toLowerCase()}@admin.yam.local`;
}

function buildUserEmail(username, rawEmail = "") {
  const email = String(rawEmail || "").trim().toLowerCase();
  if (email) {
    return email;
  }
  return `${username.toLowerCase()}@user.yam.local`;
}

function handleAuthError(error, response, next) {
  if (error instanceof z.ZodError) {
    response.status(400).json({
      error: error.issues[0]?.message || "参数不完整",
    });
    return;
  }

  next(error);
}

export default router;
