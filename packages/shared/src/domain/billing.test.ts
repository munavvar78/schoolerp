import { describe, expect, it } from 'vitest';
import { buildTaxInvoice, composeFeeInvoice } from './billing.js';

const tuition = {
  code: 'TUITION',
  name: 'Tuition Fee',
  grossPaise: 450000,
  gstTreatment: 'EXEMPT' as const,
  gstRateBps: 0,
};
const transport = {
  code: 'TRANSPORT',
  name: 'Transport',
  grossPaise: 150000,
  gstTreatment: 'TAXABLE' as const,
  gstRateBps: 500,
};

describe('tax invoice', () => {
  it('allocates a partial payment and taxes only the taxable share inside the state', () => {
    const invoice = buildTaxInvoice({
      lines: [tuition, transport],
      paymentPaise: 100000,
      sellerStateCode: '07',
      buyerStateCode: '07',
    });
    expect(invoice.totalPaise).toBe(100000);
    expect(invoice.lines.map((line) => line.grossPaise)).toEqual([75000, 25000]);
    expect(invoice.supply).toBe('INTRA_STATE');
    expect(invoice.needsGstProfile).toBe(true);
    expect(invoice.cgstPaise + invoice.sgstPaise).toBe(invoice.taxPaise);
    expect(invoice.igstPaise).toBe(0);
  });

  it('charges IGST when the buyer is in another state', () => {
    const invoice = buildTaxInvoice({
      lines: [transport],
      paymentPaise: 10500,
      sellerStateCode: '07',
      buyerStateCode: '27',
    });
    expect(invoice.supply).toBe('INTER_STATE');
    expect(invoice.igstPaise).toBe(500);
    expect(invoice.cgstPaise).toBe(0);
  });

  it('puts the tail of a payment on an exempt late fee after principal is covered', () => {
    const invoice = composeFeeInvoice({
      lines: [tuition, transport],
      demandTotalPaise: 600000,
      concessionPaise: 0,
      alreadyPaidPaise: 600000,
      lateFeePaise: 5000,
      paymentPaise: 5000,
      intraState: true,
    });
    expect(invoice.kind).toBe('BILL_OF_SUPPLY');
    expect(invoice.needsGstProfile).toBe(false);
    expect(invoice.lines.map((line) => line.code)).toEqual(['LATE']);
  });

  it('rejects a payment above the outstanding balance', () => {
    expect(() =>
      composeFeeInvoice({
        lines: [tuition, transport],
        demandTotalPaise: 600000,
        concessionPaise: 0,
        alreadyPaidPaise: 0,
        lateFeePaise: 0,
        paymentPaise: 600001,
        intraState: true,
      }),
    ).toThrow(/outstanding/i);
  });
});
