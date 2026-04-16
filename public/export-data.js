import { APP_NAME } from "./data-model.js";

export function buildExportFileName(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${APP_NAME}-${year}-${month}-${day}.xlsx`;
}

export function buildWorkbookSheets(data, review) {
  const sheets = [
    {
      name: "饮食记录",
      rows: data.meals.map((entry) => ({
        日期: entry.date,
        时间: entry.time || "",
        餐别: entry.mealType,
        食物名称: entry.foodName,
        份量: entry.portion || "",
        高热量: entry.highCalorie ? "是" : "",
        应酬或喝酒: entry.social ? "是" : "",
        备注: entry.note || "",
      })),
    },
    {
      name: "训练记录",
      rows: data.trainings.map((entry) => ({
        日期: entry.date,
        时间: entry.time || "",
        训练名称: entry.trainingName,
        训练时长_分钟: entry.duration ?? "",
        动作内容: entry.details || "",
        重量: entry.weight ?? "",
        次数: entry.reps ?? "",
        组数: entry.sets ?? "",
        备注: entry.note || "",
      })),
    },
    {
      name: "身体记录",
      rows: data.bodyMetrics.map((entry) => ({
        日期: entry.date,
        体重_kg: entry.weight ?? "",
        腰围_cm: entry.waist ?? "",
        体脂率_pct: entry.bodyFat ?? "",
        骨骼肌含量: entry.boneMuscle ?? "",
      })),
    },
  ];

  if (review) {
    sheets.push({
      name: "双周回顾摘要",
      rows: [
        ...review.stats.map((item) => ({
          项目: item.label,
          内容: item.value,
        })),
        { 项目: "总结", 内容: review.summary },
        { 项目: "提醒", 内容: review.reminder },
        { 项目: "时间范围", 内容: review.periodLabel },
      ],
    });
  }

  return sheets;
}
