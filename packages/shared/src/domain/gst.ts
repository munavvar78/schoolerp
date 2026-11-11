const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Official GSTIN check character over the first 14 characters. */
export function gstinCheckCharacter(first14: string): string {
  const prefix = first14.trim().toUpperCase();
  if (!/^[0-9A-Z]{14}$/.test(prefix)) {
    throw new Error('GSTIN prefix must be 14 letters or digits');
  }
  let factor = 1;
  let sum = 0;
  for (const char of prefix) {
    const code = GSTIN_CHARS.indexOf(char);
    const product = factor * code;
    factor = factor === 2 ? 1 : 2;
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36] ?? '0';
}

const GSTIN_BODY = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function isValidGstin(value: string): boolean {
  const gstin = value.trim().toUpperCase();
  if (!GSTIN_BODY.test(gstin)) return false;
  return gstin[14] === gstinCheckCharacter(gstin.slice(0, 14));
}

export function gstinStateCode(gstin: string): string {
  if (!isValidGstin(gstin)) throw new Error('GSTIN is not valid');
  return gstin.trim().toUpperCase().slice(0, 2);
}

/** Indian state and union-territory codes, plus 97 for other territory. */
export function isGstStateCode(value: string): boolean {
  return /^(0[1-9]|[1-2][0-9]|3[0-8]|97)$/.test(value);
}

export type GstTreatment = 'EXEMPT' | 'TAXABLE';

export interface TaxSplit {
  taxablePaise: number;
  exemptPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  taxPaise: number;
}

/**
 * Splits a tax-inclusive gross amount. A zero rate is treated as exempt.
 * Intra-state tax is split into CGST and SGST. An odd paise stays on SGST.
 */
export function splitInclusiveGst(grossPaise: number, rateBps: number, intraState: boolean): TaxSplit {
  if (!Number.isInteger(grossPaise) || grossPaise < 0) {
    throw new Error('Gross amount must be a non-negative integer number of paise');
  }
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > 10000) {
    throw new Error('GST rate must be an integer from 0 to 10000 basis points');
  }
  if (grossPaise === 0 || rateBps === 0) {
    return {
      taxablePaise: 0,
      exemptPaise: grossPaise,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
      taxPaise: 0,
    };
  }
  const taxablePaise = Math.round((grossPaise * 10000) / (10000 + rateBps));
  const taxPaise = grossPaise - taxablePaise;
  if (!intraState) {
    return {
      taxablePaise,
      exemptPaise: 0,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: taxPaise,
      taxPaise,
    };
  }
  const cgstPaise = Math.floor(taxPaise / 2);
  return {
    taxablePaise,
    exemptPaise: 0,
    cgstPaise,
    sgstPaise: taxPaise - cgstPaise,
    igstPaise: 0,
    taxPaise,
  };
}
