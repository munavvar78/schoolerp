import ExcelJS from 'exceljs';

/** Exact header order expected by School ERP bulk student import. Do not reorder. */
export const BULK_STUDENT_HEADERS = [
  'firstName',
  'lastName',
  'admissionNo',
  'gender',
  'dateOfBirth',
  'rollNo',
] as const;

export type BulkStudentHeader = (typeof BULK_STUDENT_HEADERS)[number];

const SAMPLE_ROWS: Array<Record<BulkStudentHeader, string>> = [
  {
    firstName: 'Aarav',
    lastName: 'Sharma',
    admissionNo: 'ADM-9001',
    gender: 'MALE',
    dateOfBirth: '2014-05-01',
    rollNo: '1',
  },
  {
    firstName: 'Diya',
    lastName: 'Patel',
    admissionNo: 'ADM-9002',
    gender: 'FEMALE',
    dateOfBirth: '2014-08-12',
    rollNo: '2',
  },
];

const HEADER_HINTS: Record<BulkStudentHeader, string> = {
  firstName: 'Required. Student first name',
  lastName: 'Optional. Surname',
  admissionNo: 'Required. Unique on this campus',
  gender: 'Optional. MALE / FEMALE / OTHER (or M / F / O)',
  dateOfBirth: 'Optional. YYYY-MM-DD (not a future date)',
  rollNo: 'Optional. Used when auto-enrolling into a section',
};

const DATA_ROW_COUNT = 500;
/** Sheet protection password — headers stay locked; staff enter data in unlocked rows. */
const SHEET_PASSWORD = 'SchoolERP';

function styleHeader(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 11 };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F766E' },
  };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.border = {
    top: { style: 'thin', color: { argb: 'FF0F766E' } },
    left: { style: 'thin', color: { argb: 'FF0F766E' } },
    bottom: { style: 'thin', color: { argb: 'FF0F766E' } },
    right: { style: 'thin', color: { argb: 'FF0F766E' } },
  };
  cell.protection = { locked: true };
}

function unlockCell(cell: ExcelJS.Cell) {
  cell.protection = { locked: false };
}

export async function buildBulkStudentTemplateBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'School ERP';
  workbook.created = new Date();
  workbook.modified = new Date();

  const instructions = workbook.addWorksheet('Instructions', {
    properties: { tabColor: { argb: 'FF0F766E' } },
  });
  instructions.columns = [{ width: 92 }];
  const instructionLines = [
    'School ERP — Bulk Student Import Sheet',
    '',
    '1. Use only the "Students" sheet. Do not rename or reorder header columns.',
    '2. Header row (row 1) is locked and cannot be edited.',
    '3. Enter one student per row starting from row 2. Replace the sample rows.',
    '4. Required columns: firstName, admissionNo.',
    '5. gender: MALE, FEMALE, or OTHER (M / F / O also accepted).',
    '6. dateOfBirth must be YYYY-MM-DD (example: 2014-05-01) and not in the future.',
    '7. rollNo is optional; it is applied when you choose auto-enroll session + section in the app.',
    '8. Save as .xlsx and upload on Students → Bulk add students (CSV paste still works).',
    '9. Maximum 500 students per import.',
    '',
    `Sheet protection password (admins only, if you must unlock headers): ${SHEET_PASSWORD}`,
  ];
  instructionLines.forEach((line, index) => {
    const cell = instructions.getCell(index + 1, 1);
    cell.value = line;
    cell.font = {
      name: 'Calibri',
      size: index === 0 ? 14 : 11,
      bold: index === 0,
      color: { argb: 'FF0F172A' },
    };
    cell.protection = { locked: true };
  });
  await instructions.protect(SHEET_PASSWORD, {
    selectLockedCells: true,
    selectUnlockedCells: true,
  });

  const sheet = workbook.addWorksheet('Students', {
    views: [{ state: 'frozen', ySplit: 1 }],
    properties: { defaultRowHeight: 18, tabColor: { argb: 'FF0369A1' } },
  });

  sheet.columns = BULK_STUDENT_HEADERS.map((key) => ({
    header: key,
    key,
    width: key === 'dateOfBirth' ? 14 : key === 'admissionNo' ? 16 : 14,
  }));

  const headerRow = sheet.getRow(1);
  headerRow.height = 28;
  BULK_STUDENT_HEADERS.forEach((key, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = key;
    styleHeader(cell);
    cell.note = HEADER_HINTS[key];
  });

  SAMPLE_ROWS.forEach((row, rowIndex) => {
    const excelRow = sheet.getRow(rowIndex + 2);
    BULK_STUDENT_HEADERS.forEach((key, colIndex) => {
      const cell = excelRow.getCell(colIndex + 1);
      cell.value = row[key];
      unlockCell(cell);
      cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF334155' } };
    });
  });

  for (let r = SAMPLE_ROWS.length + 2; r <= DATA_ROW_COUNT + 1; r += 1) {
    const excelRow = sheet.getRow(r);
    for (let c = 1; c <= BULK_STUDENT_HEADERS.length; c += 1) {
      unlockCell(excelRow.getCell(c));
    }
  }

  // Gender dropdown for data rows
  for (let r = 2; r <= DATA_ROW_COUNT + 1; r += 1) {
    sheet.getCell(r, 4).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"MALE,FEMALE,OTHER"'],
      showErrorMessage: true,
      errorTitle: 'Invalid gender',
      error: 'Use MALE, FEMALE, or OTHER',
    };
    sheet.getCell(r, 5).numFmt = '@';
  }

  await sheet.protect(SHEET_PASSWORD, {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertColumns: false,
    deleteColumns: false,
    insertRows: true,
    deleteRows: true,
    sort: false,
    autoFilter: false,
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Convert an uploaded .xlsx Students sheet into CSV text for parseBulkStudentCsv. */
export async function workbookFileToBulkCsv(file: ArrayBuffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file);
  const sheet =
    workbook.getWorksheet('Students') ??
    workbook.worksheets.find((ws) => ws.name.toLowerCase() === 'students') ??
    workbook.worksheets[0];

  if (!sheet) {
    throw new Error('No worksheet found in the Excel file');
  }

  const lines: string[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values: string[] = [];
    for (let c = 1; c <= BULK_STUDENT_HEADERS.length; c += 1) {
      const raw = row.getCell(c).value;
      let text = '';
      if (raw == null) {
        text = '';
      } else if (typeof raw === 'object' && 'text' in raw && typeof (raw as { text: unknown }).text === 'string') {
        text = (raw as { text: string }).text;
      } else if (typeof raw === 'object' && 'result' in raw) {
        text = String((raw as { result: unknown }).result ?? '');
      } else if (raw instanceof Date) {
        text = raw.toISOString().slice(0, 10);
      } else {
        text = String(raw).trim();
      }
      values.push(escapeCsv(text));
    }
    // Skip fully empty data rows
    if (rowNumber > 1 && values.every((v) => !v)) return;
    lines.push(values.join(','));
  });

  if (!lines.length) {
    throw new Error('The Excel sheet has no rows');
  }

  return lines.join('\n');
}
