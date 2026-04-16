import { APP_NAME, APP_SUBTITLE, normalizeData } from "../../../public/data-model.js";

export function combineDateTime(dateKey, timeKey = "12:00") {
  const safeTime = timeKey && /^\d{2}:\d{2}$/.test(timeKey) ? timeKey : "12:00";
  return new Date(`${dateKey}T${safeTime}:00`);
}

export function serializeMeal(record) {
  return {
    id: record.id,
    date: record.dateKey,
    time: record.timeKey || "",
    mealType: record.mealType,
    foodName: record.foodName,
    portion: record.portion || "",
    highCalorie: record.highCalorie,
    social: record.social,
    note: record.note || "",
  };
}

export function serializeTraining(record) {
  return {
    id: record.id,
    date: record.dateKey,
    time: record.timeKey || "",
    trainingName: record.trainingName,
    duration: record.duration,
    details: record.details || "",
    weight: record.weight,
    reps: record.reps,
    sets: record.sets,
    note: record.note || "",
  };
}

export function serializeBodyMetric(record) {
  return {
    id: record.id,
    date: record.dateKey,
    weight: record.weight,
    waist: record.waist,
    bodyFat: record.bodyFat,
    boneMuscle: record.boneMuscle,
  };
}

function latestUpdatedAt(records = []) {
  return records
    .map((record) => record.updatedAt || record.createdAt)
    .filter(Boolean)
    .sort((left, right) => new Date(right) - new Date(left))[0];
}

export function buildUserDataset({ user, meals, trainings, bodyMetrics }) {
  return normalizeData({
    meta: {
      version: 4,
      updatedAt:
        latestUpdatedAt([...meals, ...trainings, ...bodyMetrics]) ||
        user?.updatedAt ||
        new Date().toISOString(),
    },
    profile: {
      title: APP_NAME,
      subtitle: APP_SUBTITLE,
    },
    meals: meals.map(serializeMeal),
    trainings: trainings.map(serializeTraining),
    bodyMetrics: bodyMetrics.map(serializeBodyMetric),
  });
}

export async function fetchUserDataset(prisma, userId) {
  const [user, meals, trainings, bodyMetrics] = await prisma.$transaction([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
    }),
    prisma.meal.findMany({
      where: { userId },
      orderBy: { occurredAt: "desc" },
    }),
    prisma.training.findMany({
      where: { userId },
      orderBy: { occurredAt: "desc" },
    }),
    prisma.bodyMetric.findMany({
      where: { userId },
      orderBy: { occurredAt: "desc" },
    }),
  ]);

  return buildUserDataset({ user, meals, trainings, bodyMetrics });
}

export async function replaceUserDataset(prisma, userId, payload) {
  const previous = await fetchUserDataset(prisma, userId);
  const normalized = normalizeData(payload);
  const activityLogs = buildActivityLogs(previous, normalized);

  const mealRows = normalized.meals.map((entry) => ({
    userId,
    id: entry.id || undefined,
    dateKey: entry.date,
    timeKey: entry.time || null,
    occurredAt: combineDateTime(entry.date, entry.time || "12:00"),
    mealType: entry.mealType,
    foodName: entry.foodName,
    portion: entry.portion || null,
    highCalorie: Boolean(entry.highCalorie),
    social: Boolean(entry.social),
    note: entry.note || null,
  }));

  const trainingRows = normalized.trainings.map((entry) => ({
    userId,
    id: entry.id || undefined,
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
  }));

  const bodyRows = normalized.bodyMetrics.map((entry) => ({
    userId,
    id: entry.id || undefined,
    dateKey: entry.date,
    occurredAt: combineDateTime(entry.date, "12:00"),
    weight: entry.weight ?? null,
    waist: entry.waist ?? null,
    bodyFat: entry.bodyFat ?? null,
    boneMuscle: entry.boneMuscle ?? null,
  }));

  await prisma.$transaction(async (tx) => {
    await tx.meal.deleteMany({ where: { userId } });
    await tx.training.deleteMany({ where: { userId } });
    await tx.bodyMetric.deleteMany({ where: { userId } });

    if (mealRows.length) {
      await tx.meal.createMany({ data: mealRows });
    }

    if (trainingRows.length) {
      await tx.training.createMany({ data: trainingRows });
    }

    if (bodyRows.length) {
      await tx.bodyMetric.createMany({ data: bodyRows });
    }

    if (activityLogs.length) {
      await tx.activityLog.createMany({
        data: activityLogs.map((entry) => ({
          userId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId || null,
          detail: entry.detail,
        })),
      });
    }
  });

  return fetchUserDataset(prisma, userId);
}

export function normalizeMealCandidate(payload) {
  return normalizeData({ meals: [payload] }).meals[0] || null;
}

export function normalizeTrainingCandidate(payload) {
  return normalizeData({ trainings: [payload] }).trainings[0] || null;
}

export function normalizeBodyCandidate(payload) {
  return normalizeData({ bodyMetrics: [payload] }).bodyMetrics[0] || null;
}

function buildActivityLogs(previous, next) {
  return [
    ...diffRecords(previous.meals, next.meals, "meal", summarizeMeal),
    ...diffRecords(previous.trainings, next.trainings, "training", summarizeTraining),
    ...diffRecords(previous.bodyMetrics, next.bodyMetrics, "body_metric", summarizeBodyMetric),
  ];
}

function diffRecords(previousRecords, nextRecords, entityType, summaryBuilder) {
  const previousMap = new Map(previousRecords.map((entry) => [entry.id, entry]));
  const nextMap = new Map(nextRecords.map((entry) => [entry.id, entry]));
  const logs = [];

  nextRecords.forEach((entry) => {
    const previous = previousMap.get(entry.id);
    if (!previous) {
      logs.push({
        action: "create",
        entityType,
        entityId: entry.id,
        detail: summaryBuilder(entry),
      });
      return;
    }

    if (JSON.stringify(previous) !== JSON.stringify(entry)) {
      logs.push({
        action: "update",
        entityType,
        entityId: entry.id,
        detail: {
          before: summaryBuilder(previous),
          after: summaryBuilder(entry),
        },
      });
    }
  });

  previousRecords.forEach((entry) => {
    if (!nextMap.has(entry.id)) {
      logs.push({
        action: "delete",
        entityType,
        entityId: entry.id,
        detail: summaryBuilder(entry),
      });
    }
  });

  return logs;
}

function summarizeMeal(entry) {
  return {
    date: entry.date,
    foodName: entry.foodName,
    mealType: entry.mealType,
  };
}

function summarizeTraining(entry) {
  return {
    date: entry.date,
    trainingName: entry.trainingName,
    duration: entry.duration ?? null,
  };
}

function summarizeBodyMetric(entry) {
  return {
    date: entry.date,
    weight: entry.weight ?? null,
    waist: entry.waist ?? null,
  };
}
