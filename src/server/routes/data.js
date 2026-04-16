import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import {
  buildUserDataset,
  combineDateTime,
  fetchUserDataset,
  normalizeBodyCandidate,
  normalizeMealCandidate,
  normalizeTrainingCandidate,
  replaceUserDataset,
  serializeBodyMetric,
  serializeMeal,
  serializeTraining,
} from "../lib/dataset.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/api/me/sync", requireAuth, async (request, response, next) => {
  try {
    const data = await fetchUserDataset(prisma, request.user.id);
    response.json({
      ok: true,
      data,
      user: request.publicUser,
      syncStatus: "synced",
    });
  } catch (error) {
    next(error);
  }
});

router.put("/api/me/sync", requireAuth, async (request, response, next) => {
  try {
    const data = await replaceUserDataset(prisma, request.user.id, request.body);
    response.json({
      ok: true,
      data,
      syncStatus: "synced",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/api/meals", requireAuth, async (request, response, next) => {
  try {
    const rows = await prisma.meal.findMany({
      where: { userId: request.user.id },
      orderBy: { occurredAt: "desc" },
    });

    response.json({ ok: true, items: rows.map(serializeMeal) });
  } catch (error) {
    next(error);
  }
});

router.post("/api/meals", requireAuth, async (request, response, next) => {
  try {
    const entry = normalizeMealCandidate(request.body);
    if (!entry?.date || !entry.foodName) {
      response.status(400).json({ error: "饮食记录至少要有日期和食物名称" });
      return;
    }

    const created = await prisma.meal.create({
      data: {
        userId: request.user.id,
        dateKey: entry.date,
        timeKey: entry.time || null,
        occurredAt: combineDateTime(entry.date, entry.time || "12:00"),
        mealType: entry.mealType,
        foodName: entry.foodName,
        portion: entry.portion || null,
        highCalorie: Boolean(entry.highCalorie),
        social: Boolean(entry.social),
        note: entry.note || null,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: request.user.id,
        action: "create",
        entityType: "meal",
        entityId: created.id,
        detail: {
          date: created.dateKey,
          foodName: created.foodName,
        },
      },
    });

    response.status(201).json({ ok: true, item: serializeMeal(created) });
  } catch (error) {
    next(error);
  }
});

router.put("/api/meals/:id", requireAuth, async (request, response, next) => {
  try {
    const entry = normalizeMealCandidate({ ...request.body, id: request.params.id });
    if (!entry?.date || !entry.foodName) {
      response.status(400).json({ error: "饮食记录至少要有日期和食物名称" });
      return;
    }

    const existing = await prisma.meal.findFirst({
      where: {
        id: request.params.id,
        userId: request.user.id,
      },
      select: { id: true },
    });

    if (!existing) {
      response.status(404).json({ error: "这条饮食记录不存在" });
      return;
    }

    const updated = await prisma.meal.update({
      where: { id: existing.id },
      data: {
        dateKey: entry.date,
        timeKey: entry.time || null,
        occurredAt: combineDateTime(entry.date, entry.time || "12:00"),
        mealType: entry.mealType,
        foodName: entry.foodName,
        portion: entry.portion || null,
        highCalorie: Boolean(entry.highCalorie),
        social: Boolean(entry.social),
        note: entry.note || null,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: request.user.id,
        action: "update",
        entityType: "meal",
        entityId: updated.id,
        detail: {
          date: updated.dateKey,
          foodName: updated.foodName,
        },
      },
    });

    response.json({ ok: true, item: serializeMeal(updated) });
  } catch (error) {
    next(error);
  }
});

router.delete("/api/meals/:id", requireAuth, async (request, response, next) => {
  try {
    const deleted = await prisma.meal.deleteMany({
      where: {
        id: request.params.id,
        userId: request.user.id,
      },
    });

    if (!deleted.count) {
      response.status(404).json({ error: "这条饮食记录不存在" });
      return;
    }

    await prisma.activityLog.create({
      data: {
        userId: request.user.id,
        action: "delete",
        entityType: "meal",
        entityId: request.params.id,
      },
    });

    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get("/api/trainings", requireAuth, async (request, response, next) => {
  try {
    const rows = await prisma.training.findMany({
      where: { userId: request.user.id },
      orderBy: { occurredAt: "desc" },
    });

    response.json({ ok: true, items: rows.map(serializeTraining) });
  } catch (error) {
    next(error);
  }
});

router.post("/api/trainings", requireAuth, async (request, response, next) => {
  try {
    const entry = normalizeTrainingCandidate(request.body);
    if (!entry?.date || !entry.trainingName) {
      response.status(400).json({ error: "训练记录至少要有日期和训练名称" });
      return;
    }

    const created = await prisma.training.create({
      data: {
        userId: request.user.id,
        dateKey: entry.date,
        timeKey: entry.time || null,
        occurredAt: combineDateTime(entry.date, entry.time || "12:00"),
        trainingName: entry.trainingName,
        duration: entry.duration ?? null,
        details: entry.details || null,
        weight: entry.weight ?? null,
        reps: entry.reps ?? null,
        sets: entry.sets ?? null,
        note: entry.note || null,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: request.user.id,
        action: "create",
        entityType: "training",
        entityId: created.id,
        detail: {
          date: created.dateKey,
          trainingName: created.trainingName,
        },
      },
    });

    response.status(201).json({ ok: true, item: serializeTraining(created) });
  } catch (error) {
    next(error);
  }
});

router.put("/api/trainings/:id", requireAuth, async (request, response, next) => {
  try {
    const entry = normalizeTrainingCandidate({ ...request.body, id: request.params.id });
    if (!entry?.date || !entry.trainingName) {
      response.status(400).json({ error: "训练记录至少要有日期和训练名称" });
      return;
    }

    const existing = await prisma.training.findFirst({
      where: {
        id: request.params.id,
        userId: request.user.id,
      },
      select: { id: true },
    });

    if (!existing) {
      response.status(404).json({ error: "这条训练记录不存在" });
      return;
    }

    const updated = await prisma.training.update({
      where: { id: existing.id },
      data: {
        dateKey: entry.date,
        timeKey: entry.time || null,
        occurredAt: combineDateTime(entry.date, entry.time || "12:00"),
        trainingName: entry.trainingName,
        duration: entry.duration ?? null,
        details: entry.details || null,
        weight: entry.weight ?? null,
        reps: entry.reps ?? null,
        sets: entry.sets ?? null,
        note: entry.note || null,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: request.user.id,
        action: "update",
        entityType: "training",
        entityId: updated.id,
        detail: {
          date: updated.dateKey,
          trainingName: updated.trainingName,
        },
      },
    });

    response.json({ ok: true, item: serializeTraining(updated) });
  } catch (error) {
    next(error);
  }
});

router.delete("/api/trainings/:id", requireAuth, async (request, response, next) => {
  try {
    const deleted = await prisma.training.deleteMany({
      where: {
        id: request.params.id,
        userId: request.user.id,
      },
    });

    if (!deleted.count) {
      response.status(404).json({ error: "这条训练记录不存在" });
      return;
    }

    await prisma.activityLog.create({
      data: {
        userId: request.user.id,
        action: "delete",
        entityType: "training",
        entityId: request.params.id,
      },
    });

    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get("/api/body-metrics", requireAuth, async (request, response, next) => {
  try {
    const rows = await prisma.bodyMetric.findMany({
      where: { userId: request.user.id },
      orderBy: { occurredAt: "desc" },
    });

    response.json({ ok: true, items: rows.map(serializeBodyMetric) });
  } catch (error) {
    next(error);
  }
});

router.post("/api/body-metrics", requireAuth, async (request, response, next) => {
  try {
    const entry = normalizeBodyCandidate(request.body);
    if (!entry?.date) {
      response.status(400).json({ error: "身体记录至少要有日期" });
      return;
    }

    const created = await prisma.bodyMetric.create({
      data: {
        userId: request.user.id,
        dateKey: entry.date,
        occurredAt: combineDateTime(entry.date, "12:00"),
        weight: entry.weight ?? null,
        waist: entry.waist ?? null,
        bodyFat: entry.bodyFat ?? null,
        boneMuscle: entry.boneMuscle ?? null,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: request.user.id,
        action: "create",
        entityType: "body_metric",
        entityId: created.id,
        detail: {
          date: created.dateKey,
          weight: created.weight,
          waist: created.waist,
        },
      },
    });

    response.status(201).json({ ok: true, item: serializeBodyMetric(created) });
  } catch (error) {
    next(error);
  }
});

router.put("/api/body-metrics/:id", requireAuth, async (request, response, next) => {
  try {
    const entry = normalizeBodyCandidate({ ...request.body, id: request.params.id });
    if (!entry?.date) {
      response.status(400).json({ error: "身体记录至少要有日期" });
      return;
    }

    const existing = await prisma.bodyMetric.findFirst({
      where: {
        id: request.params.id,
        userId: request.user.id,
      },
      select: { id: true },
    });

    if (!existing) {
      response.status(404).json({ error: "这条身体记录不存在" });
      return;
    }

    const updated = await prisma.bodyMetric.update({
      where: { id: existing.id },
      data: {
        dateKey: entry.date,
        occurredAt: combineDateTime(entry.date, "12:00"),
        weight: entry.weight ?? null,
        waist: entry.waist ?? null,
        bodyFat: entry.bodyFat ?? null,
        boneMuscle: entry.boneMuscle ?? null,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: request.user.id,
        action: "update",
        entityType: "body_metric",
        entityId: updated.id,
        detail: {
          date: updated.dateKey,
          weight: updated.weight,
          waist: updated.waist,
        },
      },
    });

    response.json({ ok: true, item: serializeBodyMetric(updated) });
  } catch (error) {
    next(error);
  }
});

router.delete("/api/body-metrics/:id", requireAuth, async (request, response, next) => {
  try {
    const deleted = await prisma.bodyMetric.deleteMany({
      where: {
        id: request.params.id,
        userId: request.user.id,
      },
    });

    if (!deleted.count) {
      response.status(404).json({ error: "这条身体记录不存在" });
      return;
    }

    await prisma.activityLog.create({
      data: {
        userId: request.user.id,
        action: "delete",
        entityType: "body_metric",
        entityId: request.params.id,
      },
    });

    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get("/api/exports/me", requireAuth, async (request, response, next) => {
  try {
    const dataset = await fetchUserDataset(prisma, request.user.id);
    const { createExportFileName, createWorkbookBuffer } = await import("../lib/excel.js");
    const buffer = createWorkbookBuffer(dataset);
    const fileName = createExportFileName(new Date());

    await prisma.export.create({
      data: {
        type: "USER_XLSX",
        fileName,
        subjectUserId: request.user.id,
        requestedById: request.user.id,
      },
    });

    response.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    response.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    response.send(buffer);
  } catch (error) {
    next(error);
  }
});

export default router;
