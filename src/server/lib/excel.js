import * as XLSX from "xlsx";

import { buildAppModel } from "../../../public/analytics.js";
import { buildExportFileName, buildWorkbookSheets } from "../../../public/export-data.js";

export function createWorkbookBuffer(data) {
  const workbook = XLSX.utils.book_new();
  const review = buildAppModel(data).review;
  const sheets = buildWorkbookSheets(data, review);

  sheets.forEach((sheet) => {
    const rows = sheet.rows.length ? sheet.rows : [{ 提示: "还没有数据" }];
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  });

  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  });
}

export function createExportFileName(date = new Date()) {
  return buildExportFileName(date);
}
