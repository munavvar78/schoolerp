import { describe, expect, it } from 'vitest';
import { parseBulkStudentCsv } from './bulk-students.js';

describe('parseBulkStudentCsv', () => {
  it('parses headered csv', () => {
    const raw = [
      'firstName,lastName,admissionNo,gender,dateOfBirth,rollNo',
      'Aarav,Sharma,ADM-9001,MALE,2014-05-01,1',
      'Diya,Patel,ADM-9002,F,,2',
    ].join('\n');
    const parsed = parseBulkStudentCsv(raw);
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toMatchObject({
      firstName: 'Aarav',
      admissionNo: 'ADM-9001',
      gender: 'MALE',
      rollNo: '1',
    });
  });

  it('parses headerless rows', () => {
    const parsed = parseBulkStudentCsv('Kabir,Singh,ADM-9003,MALE,,3');
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.rows[0]?.admissionNo).toBe('ADM-9003');
  });

  it('flags missing required fields and duplicates', () => {
    const raw = ['Aarav,,ADM-1', 'Diya,,', 'Kabir,,ADM-1'].join('\n');
    const parsed = parseBulkStudentCsv(raw);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.errors.length).toBeGreaterThanOrEqual(2);
  });
});
