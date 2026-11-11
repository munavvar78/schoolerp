import { splitInclusiveGst, type GstTreatment, type TaxSplit } from './gst.js';

export interface ChargeLine {
  code: string;
  name: string;
  grossPaise: number;
  gstTreatment: GstTreatment;
  gstRateBps: number;
}

export interface InvoiceLine extends TaxSplit {
  code: string;
  name: string;
  grossPaise: number;
  rateBps: number;
}

export interface BuiltInvoice {
  kind: 'TAX_INVOICE' | 'BILL_OF_SUPPLY';
  supply: 'INTRA_STATE' | 'INTER_STATE';
  needsGstProfile: boolean;
  lines: InvoiceLine[];
  taxablePaise: number;
  exemptPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  taxPaise: number;
  totalPaise: number;
}

function assertPaise(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer number of paise`);
  }
}

/** Spreads a payment across lines. The last line absorbs the rounding remainder. */
export function allocateGross(lines: ChargeLine[], paymentPaise: number): ChargeLine[] {
  assertPaise(paymentPaise, 'Payment');
  for (const line of lines) assertPaise(line.grossPaise, `Line ${line.code}`);
  const total = lines.reduce((sum, line) => sum + line.grossPaise, 0);
  if (paymentPaise > total) throw new Error('Payment exceeds the charge lines');
  if (lines.length === 0 || paymentPaise === 0 || total === 0) {
    return lines.map((line) => ({ ...line, grossPaise: 0 }));
  }
  if (paymentPaise === total) return lines.map((line) => ({ ...line }));

  let allocated = 0;
  return lines.map((line, index) => {
    if (index === lines.length - 1) return { ...line, grossPaise: paymentPaise - allocated };
    const share = Math.floor((line.grossPaise * paymentPaise) / total);
    allocated += share;
    return { ...line, grossPaise: share };
  });
}

/** Principal is collected before the late fee. */
export function splitPaymentTowardCharges(input: {
  principalPaise: number;
  alreadyPaidPaise: number;
  lateFeePaise: number;
  paymentPaise: number;
}): { principalPaise: number; lateFeePaise: number } {
  assertPaise(input.principalPaise, 'Principal');
  assertPaise(input.alreadyPaidPaise, 'Amount already paid');
  assertPaise(input.lateFeePaise, 'Late fee');
  assertPaise(input.paymentPaise, 'Payment');
  const outstanding = Math.max(0, input.principalPaise + input.lateFeePaise - input.alreadyPaidPaise);
  if (input.paymentPaise > outstanding) throw new Error('Amount exceeds the outstanding balance');
  const principalRemaining = Math.max(0, input.principalPaise - input.alreadyPaidPaise);
  const principalPaise = Math.min(input.paymentPaise, principalRemaining);
  return { principalPaise, lateFeePaise: input.paymentPaise - principalPaise };
}

export function buildTaxInvoice(input: {
  lines: ChargeLine[];
  paymentPaise: number;
  sellerStateCode: string | null;
  buyerStateCode: string | null;
}): BuiltInvoice {
  assertPaise(input.paymentPaise, 'Payment');
  const seller = input.sellerStateCode;
  const buyer = input.buyerStateCode ?? seller;
  const intraState = !seller || !buyer || seller === buyer;
  const allocated = allocateGross(input.lines, input.paymentPaise);
  return finishInvoice(allocated, intraState);
}

export function composeFeeInvoice(input: {
  lines: ChargeLine[];
  demandTotalPaise: number;
  concessionPaise: number;
  alreadyPaidPaise: number;
  lateFeePaise: number;
  paymentPaise: number;
  intraState: boolean;
}): BuiltInvoice {
  assertPaise(input.demandTotalPaise, 'Demand');
  assertPaise(input.concessionPaise, 'Concession');
  if (input.concessionPaise > input.demandTotalPaise) throw new Error('Concession exceeds the demand');
  const lineSum = input.lines.reduce((sum, line) => sum + line.grossPaise, 0);
  if (lineSum !== input.demandTotalPaise) throw new Error('Fee lines do not match the demand total');
  const principal = input.demandTotalPaise - input.concessionPaise;
  const netLines = input.concessionPaise === 0 ? input.lines : allocateGross(input.lines, principal);
  const split = splitPaymentTowardCharges({
    principalPaise: principal,
    alreadyPaidPaise: input.alreadyPaidPaise,
    lateFeePaise: input.lateFeePaise,
    paymentPaise: input.paymentPaise,
  });
  const allocated = split.principalPaise === 0 ? [] : allocateGross(netLines, split.principalPaise);
  const withLate: ChargeLine[] =
    split.lateFeePaise > 0
      ? [
          ...allocated,
          {
            code: 'LATE',
            name: 'Late fee',
            grossPaise: split.lateFeePaise,
            gstTreatment: 'EXEMPT',
            gstRateBps: 0,
          },
        ]
      : allocated;
  return finishInvoice(withLate, input.intraState);
}

function finishInvoice(lines: ChargeLine[], intraState: boolean): BuiltInvoice {
  const invoiceLines: InvoiceLine[] = lines
    .filter((line) => line.grossPaise > 0)
    .map((line) => {
      const rateBps = line.gstTreatment === 'TAXABLE' ? line.gstRateBps : 0;
      return {
        code: line.code,
        name: line.name,
        grossPaise: line.grossPaise,
        rateBps,
        ...splitInclusiveGst(line.grossPaise, rateBps, intraState),
      };
    });
  const totals = invoiceLines.reduce(
    (sum, line) => ({
      taxablePaise: sum.taxablePaise + line.taxablePaise,
      exemptPaise: sum.exemptPaise + line.exemptPaise,
      cgstPaise: sum.cgstPaise + line.cgstPaise,
      sgstPaise: sum.sgstPaise + line.sgstPaise,
      igstPaise: sum.igstPaise + line.igstPaise,
      taxPaise: sum.taxPaise + line.taxPaise,
      totalPaise: sum.totalPaise + line.grossPaise,
    }),
    { taxablePaise: 0, exemptPaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0, taxPaise: 0, totalPaise: 0 },
  );
  return {
    kind: totals.taxPaise > 0 ? 'TAX_INVOICE' : 'BILL_OF_SUPPLY',
    supply: intraState ? 'INTRA_STATE' : 'INTER_STATE',
    needsGstProfile: totals.taxPaise > 0,
    lines: invoiceLines,
    ...totals,
  };
}
