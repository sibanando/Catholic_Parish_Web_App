import * as XLSX from 'xlsx';

export function generateExcelBuffer(data: Record<string, unknown>[], sheetName = 'Sheet1'): Buffer {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}
