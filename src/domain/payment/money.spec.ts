import { describe, expect, it } from 'vitest';
import { Money } from './money';
import { InvalidAmountError } from './payment.errors';

describe('Money', () => {
  it('stores decimals as integer cents', () => {
    expect(Money.fromDecimal(150.75).cents).toBe(15075);
    expect(Money.fromDecimal(0.1).cents).toBe(10);
    expect(Money.fromDecimal(1.15).toDecimal()).toBe(1.15);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.005, 10_000_000_000])(
    'rejects %s',
    (value) => {
      expect(() => Money.fromDecimal(value)).toThrow(InvalidAmountError);
    },
  );

  it('compares by cents', () => {
    expect(Money.fromDecimal(10).equals(Money.fromCents(1000))).toBe(true);
    expect(Money.fromDecimal(10).equals(Money.fromCents(1001))).toBe(false);
  });
});
