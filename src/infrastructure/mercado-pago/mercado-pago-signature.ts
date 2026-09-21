import { createHmac, timingSafeEqual } from 'node:crypto';

export interface SignatureInput {
  xSignature: string | undefined;
  xRequestId: string | undefined;
  dataId: string | undefined;
  secret: string;
  toleranceSeconds?: number;
  now?: () => number;
}

export type SignatureVerification = { valid: true } | { valid: false; reason: string };

const parseHeader = (header: string): { ts?: string; v1?: string } =>
  Object.fromEntries(
    header
      .split(',')
      .map((part) => part.trim().split('='))
      .filter(
        (pair): pair is [string, string] => pair.length === 2 && pair[0] !== '' && pair[1] !== '',
      ),
  );

export const buildManifest = (
  dataId: string | undefined,
  requestId: string | undefined,
  ts: string,
): string => {
  const parts = [
    ...(dataId ? [`id:${dataId.toLowerCase()}`] : []),
    ...(requestId ? [`request-id:${requestId}`] : []),
    `ts:${ts}`,
  ];

  return `${parts.join(';')};`;
};

export const signManifest = (manifest: string, secret: string): string =>
  createHmac('sha256', secret).update(manifest).digest('hex');

export const verifyMercadoPagoSignature = (input: SignatureInput): SignatureVerification => {
  if (!input.xSignature) return { valid: false, reason: 'missing x-signature header' };

  const { ts, v1 } = parseHeader(input.xSignature);

  if (!ts || !/^\d+$/.test(ts)) return { valid: false, reason: 'malformed timestamp' };
  if (!v1) return { valid: false, reason: 'missing v1 hash' };

  const expected = signManifest(buildManifest(input.dataId, input.xRequestId, ts), input.secret);

  if (expected.length !== v1.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(v1))) {
    return { valid: false, reason: 'signature mismatch' };
  }

  if (input.toleranceSeconds !== undefined) {
    const now = input.now ?? Date.now;
    const driftSeconds = Math.abs(now() / 1000 - Number(ts));

    if (driftSeconds > input.toleranceSeconds)
      return { valid: false, reason: 'timestamp out of tolerance' };
  }

  return { valid: true };
};
