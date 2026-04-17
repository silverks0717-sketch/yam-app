const WEEKDAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function buildAppModel(data) {
  return {
    hasAnyData: Boolean(data.meals.length || data.trainings.length || data.bodyMetrics.length),
    today: buildTodayModel(data),
    trends: buildTrendModel(data),
    review: buildBiweeklyReview(data),
    records: {
      meals: sortByDateTimeDesc(data.meals),
      trainings: sortByDateTimeDesc(data.trainings),
      bodyMetrics: sortByDateTimeDesc(data.bodyMetrics),
    },
  };
}

export function todayString() {
  return toDateString(new Date());
}

export function currentTimeString() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function formatDisplayDate(dateString) {
  if (!dateString) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(parseDateKey(dateString));
}

export function formatDateTime(value) {
  if (!value) return "尚未保存";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function parseOptionalNumber(value) {
  if (value === "" || value === undefined || value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function formatSigned(value, unit = "") {
  if (!isFiniteNumber(value)) return "暂无";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}${unit ? ` ${unit}` : ""}`;
}

function buildTodayModel(data) {
  const today = todayString();
  const todayMeals = data.meals.filter((entry) => entry.date === today);
  const todayTrainings = data.trainings.filter((entry) => entry.date === today);
  const todayBody = data.bodyMetrics.filter((entry) => entry.date === today);

  return {
    statusCards: [
      buildStatusCard("饮食", todayMeals.length, "记一餐也算"),
      buildStatusCard("训练", todayTrainings.length, "出现就很好"),
      buildStatusCard("身体", todayBody.length, "体重腰围慢慢来"),
    ],
    charts: {
      weightTrend: buildMetricSeries(data.bodyMetrics, "weight", 28),
      waistTrend: buildMetricSeries(data.bodyMetrics, "waist", 28),
      weeklyTrainingTrend: buildWeeklyCountSeries(data.trainings, 8),
      weeklyHighCalorieTrend: buildWeeklyDistinctCountSeries(
        data.meals.filter((entry) => entry.highCalorie),
        8
      ),
      weeklySocialTrend: buildWeeklyDistinctCountSeries(
        data.meals.filter((entry) => entry.social),
        8
      ),
    },
  };
}

function buildTrendModel(data) {
  return {
    weightTrend: buildMetricSeries(data.bodyMetrics, "weight", 42),
    waistTrend: buildMetricSeries(data.bodyMetrics, "waist", 42),
    weeklyTrainingTrend: buildWeeklyCountSeries(data.trainings, 10),
    weeklyHighCalorieTrend: buildWeeklyDistinctCountSeries(
      data.meals.filter((entry) => entry.highCalorie),
      10
    ),
    weeklySocialTrend: buildWeeklyDistinctCountSeries(
      data.meals.filter((entry) => entry.social),
      10
    ),
    boneMuscleTrend: buildMetricSeries(data.bodyMetrics, "boneMuscle", 42),
  };
}

function buildBiweeklyReview(data) {
  const frame = buildDayFrame(13);
  const meals = filterEntriesInFrame(data.meals, frame);
  const trainings = filterEntriesInFrame(data.trainings, frame);
  const bodyMetrics = filterEntriesInFrame(data.bodyMetrics, frame).sort(sortDateAsc);

  const highCalorieDays = countDistinctDates(meals.filter((entry) => entry.highCalorie));
  const socialDays = countDistinctDates(meals.filter((entry) => entry.social));
  const weightDelta = calculateMetricDelta(bodyMetrics, "weight");
  const waistDelta = calculateMetricDelta(bodyMetrics, "waist");
  const boneMuscleDelta = calculateMetricDelta(bodyMetrics, "boneMuscle");

  const currentWeek = buildWeekFrame(0);
  const previousWeek = buildWeekFrame(1);

  const stats = [
    { label: "最近两周训练次数", value: `${trainings.length} 次` },
    { label: "最近两周高热量日", value: `${highCalorieDays} 天` },
    { label: "最近两周酒局次数", value: `${socialDays} 次` },
    { label: "最近两周体重变化", value: formatSigned(weightDelta, "kg") },
    { label: "最近两周腰围变化", value: formatSigned(waistDelta, "cm") },
  ];

  if (isFiniteNumber(boneMuscleDelta)) {
    stats.push({ label: "最近两周骨骼肌变化", value: formatSigned(boneMuscleDelta, "kg") });
  }

  return {
    stats,
    summary: buildBiweeklySummary({ trainings: trainings.length, highCalorieDays, socialDays, weightDelta, waistDelta }),
    reminder: buildBiweeklyReminder({ trainings: trainings.length, highCalorieDays, socialDays, boneMuscleDelta }),
    comparisonChart: [
      {
        label: "前一周训练",
        value: filterEntriesInFrame(data.trainings, previousWeek).length,
      },
      {
        label: "这一周训练",
        value: filterEntriesInFrame(data.trainings, currentWeek).length,
      },
      {
        label: "前一周高热量",
        value: countDistinctDates(filterEntriesInFrame(data.meals, previousWeek).filter((entry) => entry.highCalorie)),
      },
      {
        label: "这一周高热量",
        value: countDistinctDates(filterEntriesInFrame(data.meals, currentWeek).filter((entry) => entry.highCalorie)),
      },
      {
        label: "前一周酒局",
        value: countDistinctDates(filterEntriesInFrame(data.meals, previousWeek).filter((entry) => entry.social)),
      },
      {
        label: "这一周酒局",
        value: countDistinctDates(filterEntriesInFrame(data.meals, currentWeek).filter((entry) => entry.social)),
      },
    ],
    periodLabel: `${formatDisplayDate(frame.start)} - ${formatDisplayDate(frame.end)}`,
  };
}

function buildStatusCard(label, count, hint) {
  return {
    label,
    value: String(count),
    unit: "条",
    detail: count ? "今天已记录" : hint,
    tone: count ? "ready" : "idle",
  };
}

function buildBiweeklySummary({ trainings, highCalorieDays, socialDays, weightDelta, waistDelta }) {
  if (trainings >= 6 && highCalorieDays <= 4) {
    return "这两周整体挺稳，节奏没有散。";
  }

  if (socialDays >= 3 || highCalorieDays >= 5) {
    return "训练还在，但吃得偏松的日子有点多。";
  }

  if (isFiniteNumber(weightDelta) && weightDelta > 0.5) {
    return "最近更像是饮食和社交把数字轻轻往上推。";
  }

  if (isFiniteNumber(waistDelta) && waistDelta < 0) {
    return "虽然慢，但方向是对的。";
  }

  return "还在往前走，接下来继续守住日常就好。";
}

function buildBiweeklyReminder({ trainings, highCalorieDays, socialDays, boneMuscleDelta }) {
  if (trainings <= 3) {
    return "先把训练次数拉回稳定，再谈强度。";
  }

  if (socialDays >= 3) {
    return "下一段更值得看住的是周末和应酬后的收尾。";
  }

  if (highCalorieDays >= 5) {
    return "不用每顿都控制，先把高热量日从密集改成分散。";
  }

  if (isFiniteNumber(boneMuscleDelta) && boneMuscleDelta < 0) {
    return "如果最近掉得有点快，训练和蛋白可以再稳一点。";
  }

  return "现在最重要的不是做更多，而是别断。";
}

function calculateMetricDelta(entries, key) {
  const values = entries.filter((entry) => isFiniteNumber(entry[key]));
  if (values.length < 2) return null;
  return values.at(-1)[key] - values[0][key];
}

function buildMetricSeries(entries, key, days) {
  const frame = buildDayFrame(days - 1);
  return filterEntriesInFrame(entries, frame)
    .filter((entry) => isFiniteNumber(entry[key]))
    .sort(sortDateAsc)
    .map((entry) => ({
      label: shortDate(entry.date),
      value: entry[key],
      date: entry.date,
    }));
}

function buildWeeklyCountSeries(entries, weeks) {
  return buildWeekSeries(weeks).map((frame) => ({
    label: frame.shortLabel,
    value: filterEntriesInFrame(entries, frame).length,
  }));
}

function buildWeeklyDistinctCountSeries(entries, weeks) {
  return buildWeekSeries(weeks).map((frame) => ({
    label: frame.shortLabel,
    value: countDistinctDates(filterEntriesInFrame(entries, frame)),
  }));
}

function buildWeekSeries(weeks) {
  return Array.from({ length: weeks }, (_, index) => buildWeekFrame(weeks - index - 1));
}

function buildWeekFrame(weeksAgo) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = startOfWeek(now);
  start.setDate(start.getDate() - weeksAgo * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  return {
    start: toDateString(start),
    end: toDateString(end),
    shortLabel: `${start.getMonth() + 1}/${start.getDate()}`,
  };
}

function buildDayFrame(daysAgo) {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - daysAgo);

  return {
    start: toDateString(start),
    end: toDateString(end),
  };
}

function filterEntriesInFrame(entries, frame) {
  return entries.filter((entry) => entry.date >= frame.start && entry.date <= frame.end);
}

function countDistinctDates(entries) {
  return new Set(entries.map((entry) => entry.date)).size;
}

function sortByDateTimeDesc(entries) {
  return [...entries].sort((left, right) => {
    const leftKey = `${left.date} ${left.time || "00:00"}`;
    const rightKey = `${right.date} ${right.time || "00:00"}`;
    return rightKey.localeCompare(leftKey);
  });
}

function sortDateAsc(left, right) {
  return left.date.localeCompare(right.date);
}

function shortDate(dateString) {
  const date = parseDateKey(dateString);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function parseDateKey(dateString) {
  return new Date(`${dateString}T00:00:00`);
}

function startOfWeek(date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function weekdayLabel(dateString) {
  return WEEKDAY_LABELS[parseDateKey(dateString).getDay()];
}
