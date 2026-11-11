export type BulkStudentRowInput = {
  firstName: string;
  lastName?: string;
  admissionNo: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  rollNo?: string;
};

export type ParsedBulkStudentRow = BulkStudentRowInput & {
  line: number;
};

const GENDER_MAP: Record<string, 'MALE' | 'FEMALE' | 'OTHER'> = {
  M: 'MALE',
  MALE: 'MALE',
  BOY: 'MALE',
  F: 'FEMALE',
  FEMALE: 'FEMALE',
  GIRL: 'FEMALE',
  O: 'OTHER',
  OTHER: 'OTHER',
};

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_]+/g, '');
}

const HEADER_ALIASES: Record<string, keyof BulkStudentRowInput> = {
  firstname: 'firstName',
  first: 'firstName',
  name: 'firstName',
  lastname: 'lastName',
  last: 'lastName',
  surname: 'lastName',
  admissionno: 'admissionNo',
  admissionnumber: 'admissionNo',
  admission: 'admissionNo',
  admno: 'admissionNo',
  dateofbirth: 'dateOfBirth',
  dob: 'dateOfBirth',
  birthdate: 'dateOfBirth',
  gender: 'gender',
  sex: 'gender',
  rollno: 'rollNo',
  roll: 'rollNo',
  rollnumber: 'rollNo',
};

/**
 * Parse CSV / TSV paste for bulk students.
 * Header row optional. Without header, columns are:
 * firstName, lastName, admissionNo, gender, dateOfBirth, rollNo
 */
export function parseBulkStudentCsv(raw: string): {
  rows: ParsedBulkStudentRow[];
  errors: Array<{ line: number; message: string }>;
} {
  const lines = raw
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (!lines.length) {
    return { rows: [], errors: [{ line: 0, message: 'No rows found' }] };
  }

  const delimiter = lines[0]!.includes('\t') && !lines[0]!.includes(',') ? '\t' : ',';
  const split = (line: string) =>
    delimiter === '\t' ? line.split('\t').map((c) => c.trim()) : splitCsvLine(line);

  const firstCells = split(lines[0]!);
  const mappedHeaders = firstCells.map((cell) => HEADER_ALIASES[normalizeHeader(cell)]);
  const hasHeader = mappedHeaders.some(Boolean);

  let startIndex = 0;
  let columnMap: Array<keyof BulkStudentRowInput | undefined> = [
    'firstName',
    'lastName',
    'admissionNo',
    'gender',
    'dateOfBirth',
    'rollNo',
  ];

  if (hasHeader) {
    columnMap = mappedHeaders;
    startIndex = 1;
  }

  const rows: ParsedBulkStudentRow[] = [];
  const errors: Array<{ line: number; message: string }> = [];
  const seenAdmission = new Set<string>();

  for (let i = startIndex; i < lines.length; i += 1) {
    const lineNo = i + 1;
    const cells = split(lines[i]!);
    const draft: Partial<BulkStudentRowInput> = {};

    columnMap.forEach((key, idx) => {
      if (!key) return;
      const value = cells[idx]?.trim();
      if (!value) return;
      if (key === 'gender') {
        const gender = GENDER_MAP[value.toUpperCase()];
        if (!gender) {
          errors.push({ line: lineNo, message: `Invalid gender "${value}"` });
          return;
        }
        draft.gender = gender;
        return;
      }
      draft[key] = value;
    });

    if (!draft.firstName || !draft.admissionNo) {
      errors.push({
        line: lineNo,
        message: 'firstName and admissionNo are required',
      });
      continue;
    }

    const admissionKey = draft.admissionNo.toUpperCase();
    if (seenAdmission.has(admissionKey)) {
      errors.push({
        line: lineNo,
        message: `Duplicate admission no in file: ${draft.admissionNo}`,
      });
      continue;
    }
    seenAdmission.add(admissionKey);

    rows.push({
      line: lineNo,
      firstName: draft.firstName,
      lastName: draft.lastName,
      admissionNo: draft.admissionNo,
      dateOfBirth: draft.dateOfBirth,
      gender: draft.gender,
      rollNo: draft.rollNo,
    });
  }

  return { rows, errors };
}
