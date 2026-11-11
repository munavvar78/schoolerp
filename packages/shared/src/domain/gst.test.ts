import { describe, expect, it } from 'vitest';
import { gstinCheckCharacter, gstinStateCode, isValidGstin, splitInclusiveGst } from './gst.js';

describe('GSTIN', () => {
  const prefix = '07AAAAA0000A1Z';
  const gstin = `${prefix}${gstinCheckCharacter(prefix)}`;

  it('accepts a checksum-valid GSTIN and reads the state code', () => {
    expect(gstin).toHaveLength(15);
    expect(isValidGstin(gstin)).toBe(true);
    expect(gstinStateCode(gstin.toLowerCase())).toBe('07');
  });

  it('rejects a tampered checksum', () => {
    const broken = `${prefix}${gstin.endsWith('A') ? 'B' : 'A'}`;
    expect(isValidGstin(broken)).toBe(false);
  });
});

describe('inclusive GST split', () => {
  it('extracts 18 percent and splits it inside the state', () => {
    expect(splitInclusiveGst(11800, 1800, true)).toEqual({
      taxablePaise: 10000,
      exemptPaise: 0,
      cgstPaise: 900,
      sgstPaise: 900,
      igstPaise: 0,
      taxPaise: 1800,
    });
  });

  it('uses IGST across states', () => {
    const split = splitInclusiveGst(10500, 500, false);
    expect(split.igstPaise).toBe(500);
    expect(split.taxablePaise).toBe(10000);
  });
});
