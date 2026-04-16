export const APP_NAME = "YAM";
export const APP_SUBTITLE = "轻记饮食与训练";
export const DATA_VERSION = 4;

export function createEmptyData() {
  return {
    meta: {
      version: DATA_VERSION,
      updatedAt: null,
    },
    profile: {
      title: APP_NAME,
      subtitle: APP_SUBTITLE,
    },
    meals: [],
    trainings: [],
    bodyMetrics: [],
  };
}

export function normalizeData(candidate = {}) {
  const empty = createEmptyData();

  return {
    meta: {
      ...empty.meta,
      ...sanitizeObject(candidate.meta),
      version: DATA_VERSION,
    },
    profile: {
      title: APP_NAME,
      subtitle: sanitizeText(candidate.profile?.subtitle) || APP_SUBTITLE,
    },
    meals: Array.isArray(candidate.meals) ? candidate.meals.map(normalizeMeal).filter(Boolean) : [],
    trainings: Array.isArray(candidate.trainings)
      ? candidate.trainings.map(normalizeTraining).filter(Boolean)
      : [],
    bodyMetrics: Array.isArray(candidate.bodyMetrics)
      ? candidate.bodyMetrics.map(normalizeBodyMetric).filter(Boolean)
      : [],
  };
}

function normalizeMeal(entry, index = 0) {
  if (!entry || !entry.date) return null;

  return {
    id: sanitizeText(entry.id) || `meal-${index}-${entry.date}`,
    date: sanitizeText(entry.date),
    time: sanitizeText(entry.time),
    mealType: sanitizeText(entry.mealType || entry.meal) || "早餐",
    foodName: sanitizeText(entry.foodName || entry.food || entry.title),
    portion: sanitizeText(entry.portion),
    highCalorie: Boolean(entry.highCalorie),
    social: Boolean(entry.social || entry.alcohol || entry.socialEvent),
    note: sanitizeText(entry.note || entry.remark),
  };
}

function normalizeTraining(entry, index = 0) {
  if (!entry || !entry.date) return null;

  return {
    id: sanitizeText(entry.id) || `training-${index}-${entry.date}`,
    date: sanitizeText(entry.date),
    time: sanitizeText(entry.time || entry.startTime),
    trainingName: sanitizeText(entry.trainingName || entry.name || entry.trainingType || readLegacyTrainingName(entry) || entry.title),
    duration: sanitizeNullableNumber(entry.duration),
    details: sanitizeText(entry.details || entry.exerciseDetails || entry.content),
    weight: sanitizeNullableNumber(entry.weight),
    reps: sanitizeNullableNumber(entry.reps),
    sets: sanitizeNullableNumber(entry.sets),
    note: sanitizeText(entry.note),
  };
}

function normalizeBodyMetric(entry, index = 0) {
  if (!entry || !entry.date) return null;

  return {
    id: sanitizeText(entry.id) || `body-${index}-${entry.date}`,
    date: sanitizeText(entry.date),
    weight: sanitizeNullableNumber(entry.weight),
    waist: sanitizeNullableNumber(entry.waist),
    bodyFat: sanitizeNullableNumber(entry.bodyFat),
    boneMuscle: sanitizeNullableNumber(
      entry.boneMuscle ?? entry.skeletalMuscle ?? entry.muscleMass ?? entry.boneMuscleMass
    ),
  };
}

function sanitizeObject(value) {
  return value && typeof value === "object" ? value : {};
}

function sanitizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeNullableNumber(value) {
  if (value === "" || value === undefined || value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readLegacyTrainingName(entry) {
  if (!entry || typeof entry !== "object") return "";
  return entry["main" + "Exercise"] || "";
}
