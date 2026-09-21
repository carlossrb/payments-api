import { describe, expect, it } from 'vitest';
import { buildManifest, signManifest, verifyMercadoPagoSignature } from './mercado-pago-signature';

const SECRET = 'webhook-secret';
const TS = '1758470400';
const REQUEST_ID = 'req-123';
const DATA_ID = '123456789';

const validHeader = () =>
  `ts=${TS},v1=${signManifest(buildManifest(DATA_ID, REQUEST_ID, TS), SECRET)}`;

describe('buildManifest', () => {
  it('follows the documented template and lowercases the data id', () => {
    expect(buildManifest('ABC123', REQUEST_ID, TS)).toBe(
      `id:abc123;request-id:${REQUEST_ID};ts:${TS};`,
    );
  });

  it('omits the parts that are missing', () => {
    expect(buildManifest(undefined, undefined, TS)).toBe(`ts:${TS};`);
    expect(buildManifest(DATA_ID, undefined, TS)).toBe(`id:${DATA_ID};ts:${TS};`);
  });
});

describe('verifyMercadoPagoSignature', () => {
  const base = { xRequestId: REQUEST_ID, dataId: DATA_ID, secret: SECRET };

  it('accepts a signature produced with the shared secret', () => {
    expect(verifyMercadoPagoSignature({ ...base, xSignature: validHeader() })).toEqual({
      valid: true,
    });
  });

  it('accepts extra header parts in any order', () => {
    const hash = signManifest(buildManifest(DATA_ID, REQUEST_ID, TS), SECRET);

    expect(verifyMercadoPagoSignature({ ...base, xSignature: ` v1=${hash} , ts=${TS} ` })).toEqual({
      valid: true,
    });
  });

  it.each([
    ['missing header', { xSignature: undefined }, 'missing x-signature header'],
    ['no timestamp', { xSignature: 'v1=abc' }, 'malformed timestamp'],
    ['no hash', { xSignature: `ts=${TS}` }, 'missing v1 hash'],
    ['wrong secret', { xSignature: validHeader(), secret: 'other' }, 'signature mismatch'],
    ['tampered data id', { xSignature: validHeader(), dataId: '999' }, 'signature mismatch'],
  ])('rejects %s', (_label, overrides, reason) => {
    expect(verifyMercadoPagoSignature({ ...base, ...overrides })).toEqual({ valid: false, reason });
  });

  it('enforces the timestamp tolerance', () => {
    const now = () => (Number(TS) + 600) * 1000;

    expect(
      verifyMercadoPagoSignature({
        ...base,
        xSignature: validHeader(),
        toleranceSeconds: 300,
        now,
      }),
    ).toEqual({ valid: false, reason: 'timestamp out of tolerance' });
    expect(
      verifyMercadoPagoSignature({
        ...base,
        xSignature: validHeader(),
        toleranceSeconds: 900,
        now,
      }),
    ).toEqual({ valid: true });
  });
});
