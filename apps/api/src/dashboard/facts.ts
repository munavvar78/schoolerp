export type CampusFactInput = {
  classStrength: number;
  sectionCount: number;
  demandPaise: number;
  collectedPaise: number;
  outstandingPaise: number;
  attendance: Array<{ date: string; percentage: number }>;
  examAverages: Array<{ subject: string; average: number }>;
  openLoans: number;
  overdueLoans: number;
  transportOccupied: number;
  transportCapacity: number;
  hostelOccupied: number;
  hostelBeds: number;
  pendingLeave: number;
  outOfStock: number;
};

export type CampusFactInclude = {
  dashboard?: boolean;
  fees?: boolean;
  attendance?: boolean;
  exams?: boolean;
  library?: boolean;
  transport?: boolean;
  hostel?: boolean;
  hr?: boolean;
  inventory?: boolean;
};

function rupees(paise: number) {
  return `₹${(paise / 100).toFixed(2)}`;
}

export function campusFactLines(input: CampusFactInput, include?: CampusFactInclude): string[] {
  const on = (key: keyof CampusFactInclude) => include == null || include[key] !== false;
  const lines: string[] = [];
  if (on('dashboard')) {
    lines.push(`Class strength: ${input.classStrength} students across ${input.sectionCount} sections.`);
  }
  if (on('fees')) {
    lines.push(
      `Fee demand ${rupees(input.demandPaise)}, collected ${rupees(input.collectedPaise)}, outstanding ${rupees(input.outstandingPaise)}.`,
    );
  }
  if (on('attendance')) {
    lines.push(
      `Recent attendance: ${
        input.attendance.map((day) => `${day.date}=${day.percentage}%`).join(', ') || 'no recent marks'
      }.`,
    );
  }
  if (on('exams')) {
    lines.push(
      `Subject averages: ${
        input.examAverages.map((row) => `${row.subject} ${row.average}%`).join(', ') || 'no scores yet'
      }.`,
    );
  }
  if (on('library')) lines.push(`Library: ${input.openLoans} open loans, ${input.overdueLoans} overdue.`);
  if (on('transport')) {
    lines.push(`Transport: ${input.transportOccupied} seats taken of ${input.transportCapacity}.`);
  }
  if (on('hostel')) lines.push(`Hostel: ${input.hostelOccupied} beds taken of ${input.hostelBeds}.`);
  if (on('hr')) lines.push(`HR: ${input.pendingLeave} leave requests pending.`);
  if (on('inventory')) {
    lines.push(`Inventory: ${input.outOfStock} ${input.outOfStock === 1 ? 'item' : 'items'} at zero stock.`);
  }
  return lines;
}
