import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { fetchUserDataset } from "../lib/dataset.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { serializeUser } from "../lib/auth.js";
import { createExportFileName, createWorkbookBuffer } from "../lib/excel.js";

const router = Router();

router.use("/api/admin", requireAuth, requireAdmin);

router.get("/api/admin/dashboard", async (request, response, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalMeals,
      totalTrainings,
      totalBodyMetrics,
      recentUsers,
      recentActiveUsers,
      activeSessions,
      todayMeals,
      todayTrainings,
      todayBodyMetrics,
      recentMealRows,
      recentTrainingRows,
      recentBodyRows,
    ] = await Promise.all([
      prisma.user.count({ where: { role: "USER" } }),
      prisma.meal.count(),
      prisma.training.count(),
      prisma.bodyMetric.count(),
      prisma.user.findMany({
        where: { role: "USER" },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.user.findMany({
        where: {
          role: "USER",
          lastLoginAt: { not: null },
        },
        orderBy: { lastLoginAt: "desc" },
        take: 6,
      }),
      prisma.userSession.findMany({
        where: {
          user: { role: "USER" },
          revokedAt: null,
          lastUsedAt: { gte: sevenDaysAgo },
        },
        distinct: ["userId"],
        select: { userId: true },
      }),
      prisma.meal.count({ where: { createdAt: { gte: today } } }),
      prisma.training.count({ where: { createdAt: { gte: today } } }),
      prisma.bodyMetric.count({ where: { createdAt: { gte: today } } }),
      prisma.meal.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true },
      }),
      prisma.training.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true },
      }),
      prisma.bodyMetric.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true },
      }),
    ]);

    response.json({
      ok: true,
      dashboard: {
        totals: {
          totalUsers,
          activeUsers7d: activeSessions.length,
          todayNewRecords: todayMeals + todayTrainings + todayBodyMetrics,
          mealCount: totalMeals,
          trainingCount: totalTrainings,
          bodyMetricCount: totalBodyMetrics,
        },
        recentUsers: recentUsers.map(serializeUser),
        recentActiveUsers: recentActiveUsers.map(serializeUser),
        weeklyTrend: buildWeeklyTrend([...recentMealRows, ...recentTrainingRows, ...recentBodyRows], 7),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/api/admin/users", async (request, response, next) => {
  try {
    const query = String(request.query.query || "").trim();

    const users = await prisma.user.findMany({
      where: query
        ? {
            role: "USER",
            OR: [
              { username: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          }
        : { role: "USER" },
      orderBy: { createdAt: "desc" },
      take: 60,
      include: {
        _count: {
          select: {
            meals: true,
            trainings: true,
            bodyMetrics: true,
          },
        },
      },
    });

    const activityRows = await prisma.activityLog.findMany({
      where: {
        userId: { in: users.map((user) => user.id) },
      },
      orderBy: { createdAt: "desc" },
      take: Math.max(users.length * 3, 20),
    });

    const latestActivityByUser = new Map();
    const latestDataChangeByUser = new Map();
    activityRows.forEach((row) => {
      if (!latestActivityByUser.has(row.userId)) {
        latestActivityByUser.set(row.userId, row);
      }

      if (!latestDataChangeByUser.has(row.userId) && row.action !== "login") {
        latestDataChangeByUser.set(row.userId, row.createdAt);
      }
    });

    response.json({
      ok: true,
      users: users.map((user) => ({
        ...serializeUser(user),
        counts: {
          meals: user._count.meals,
          trainings: user._count.trainings,
          bodyMetrics: user._count.bodyMetrics,
        },
        lastDataChangeAt: latestDataChangeByUser.get(user.id) || null,
        latestActivity: serializeActivity(latestActivityByUser.get(user.id)),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/api/admin/users/:id", async (request, response, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: request.params.id },
    });

    if (!user) {
      response.status(404).json({ error: "找不到这个用户" });
      return;
    }

    const [dataset, activities] = await Promise.all([
      fetchUserDataset(prisma, request.params.id),
      prisma.activityLog.findMany({
        where: { userId: request.params.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);
    const activity30d = buildRecordActivity(dataset, 30);
    const lastDataChangeAt = activities.find((entry) => entry.action !== "login")?.createdAt || null;

    response.json({
      ok: true,
      user: serializeUser(user),
      data: dataset,
      activity30d,
      lastDataChangeAt,
      activities: activities.map((entry) => ({
        id: entry.id,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        createdAt: entry.createdAt,
        detail: entry.detail,
        summary: formatActivity(entry),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/api/admin/users/:id/status", async (request, response, next) => {
  try {
    const nextStatus = String(request.body.status || "").toUpperCase();
    if (!["ACTIVE", "FROZEN"].includes(nextStatus)) {
      response.status(400).json({ error: "状态只能是 ACTIVE 或 FROZEN" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: request.params.id },
    });

    if (!user) {
      response.status(404).json({ error: "找不到这个用户" });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { status: nextStatus },
    });

    await prisma.adminLog.create({
      data: {
        actorId: request.user.id,
        targetUserId: user.id,
        action: nextStatus === "FROZEN" ? "freeze_user" : "activate_user",
        detail: {
          before: user.status,
          after: nextStatus,
        },
      },
    });

    response.json({
      ok: true,
      user: serializeUser(updated),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/api/admin/users/:id/export", async (request, response, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: request.params.id },
    });

    if (!user) {
      response.status(404).json({ error: "找不到这个用户" });
      return;
    }

    const dataset = await fetchUserDataset(prisma, user.id);
    const fileName = createExportFileName(new Date()).replace(
      ".xlsx",
      `-${encodeURIComponent(user.username)}.xlsx`
    );
    const buffer = createWorkbookBuffer(dataset);

    await prisma.export.create({
      data: {
        type: "ADMIN_USER_XLSX",
        fileName,
        subjectUserId: user.id,
        requestedById: request.user.id,
      },
    });

    await prisma.adminLog.create({
      data: {
        actorId: request.user.id,
        targetUserId: user.id,
        action: "export_user_xlsx",
        detail: {
          fileName,
        },
      },
    });

    response.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    response.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${fileName}`);
    response.send(buffer);
  } catch (error) {
    next(error);
  }
});

function buildWeeklyTrend(records, days) {
  const buckets = Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - index - 1));
    date.setHours(0, 0, 0, 0);
    return {
      key: date.toISOString().slice(0, 10),
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      value: 0,
    };
  });

  const lookup = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  records.forEach((record) => {
    const key = new Date(record.createdAt).toISOString().slice(0, 10);
    const bucket = lookup.get(key);
    if (bucket) bucket.value += 1;
  });

  return buckets;
}

function buildRecordActivity(data, days) {
  const buckets = Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - index - 1));
    date.setHours(0, 0, 0, 0);
    return {
      key: date.toISOString().slice(0, 10),
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      meals: 0,
      trainings: 0,
      bodyMetrics: 0,
    };
  });

  const lookup = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  data.meals.forEach((entry) => {
    const bucket = lookup.get(entry.date);
    if (bucket) bucket.meals += 1;
  });

  data.trainings.forEach((entry) => {
    const bucket = lookup.get(entry.date);
    if (bucket) bucket.trainings += 1;
  });

  data.bodyMetrics.forEach((entry) => {
    const bucket = lookup.get(entry.date);
    if (bucket) bucket.bodyMetrics += 1;
  });

  return buckets;
}

function formatActivity(entry) {
  if (!entry) return "";
  const detail = entry.detail || {};
  const labelMap = {
    meal: "饮食",
    training: "训练",
    body_metric: "身体数据",
    session: "登录",
  };
  const entityLabel = labelMap[entry.entityType] || entry.entityType;

  if (entry.action === "login") {
    return "登录";
  }

  if (entry.action === "create") {
    return `新增${entityLabel}`;
  }

  if (entry.action === "update") {
    return `修改${entityLabel}`;
  }

  if (entry.action === "delete") {
    return `删除${entityLabel}`;
  }

  return `${entityLabel}变化`;
}

function serializeActivity(entry) {
  if (!entry) return null;
  return {
    action: entry.action,
    entityType: entry.entityType,
    createdAt: entry.createdAt,
    summary: formatActivity(entry),
  };
}

export default router;
