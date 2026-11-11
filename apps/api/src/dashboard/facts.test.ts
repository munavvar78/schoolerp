import { describe, expect, it } from 'vitest';
import { campusFactLines } from './facts.js';

const base = {
  classStrength: 10,
  sectionCount: 2,
  demandPaise: 10000,
  collectedPaise: 4000,
  outstandingPaise: 6000,
  attendance: [],
  examAverages: [],
  openLoans: 3,
  overdueLoans: 1,
  transportOccupied: 12,
  transportCapacity: 40,
  hostelOccupied: 4,
  hostelBeds: 8,
  pendingLeave: 2,
  outOfStock: 1,
};

describe('campusFactLines', () => {
  it('includes operations counts and empty academic lines', () => {
    const lines = campusFactLines(base);
    expect(lines.join('\n')).toContain('Library: 3 open loans, 1 overdue.');
    expect(lines.join('\n')).toContain('Transport: 12 seats taken of 40.');
    expect(lines.join('\n')).toContain('Hostel: 4 beds taken of 8.');
    expect(lines.join('\n')).toContain('HR: 2 leave requests pending.');
    expect(lines.join('\n')).toContain('Inventory: 1 item at zero stock.');
    expect(lines.join('\n')).toContain('no recent marks');
    expect(lines.join('\n')).toContain('outstanding ₹60.00');
  });

  it('leaves out modules the caller cannot open', () => {
    const lines = campusFactLines(base, {
      dashboard: true,
      attendance: true,
      exams: true,
      fees: false,
      library: false,
      transport: false,
      hostel: false,
      hr: false,
      inventory: false,
    });
    const text = lines.join('\n');
    expect(text).toContain('Class strength: 10');
    expect(text).toContain('no recent marks');
    expect(text).not.toContain('Fee demand');
    expect(text).not.toContain('Library:');
    expect(text).not.toContain('Hostel:');
    expect(text).not.toContain('HR:');
    expect(text).not.toContain('Inventory:');
    expect(text).not.toContain('Transport:');
  });
});
