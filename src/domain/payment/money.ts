import { InvalidAmountError } from './payment.errors';

const CENTS_PER_UNIT = 100;
const MAX_CENTS = 999_999_999_999;

export class Money {
  private constructor(readonly cents: number) {}

  static fromDecimal(value: number): Money {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new InvalidAmountError('must be a finite number');
    }

    const cents = Math.round(value * CENTS_PER_UNIT);

    if (Math.abs(cents - value * CENTS_PER_UNIT) > 1e-6) {
      throw new InvalidAmountError('must have at most two decimal places');
    }

    return Money.fromCents(cents);
  }

  static fromCents(cents: number): Money {
    if (!Number.isInteger(cents)) throw new InvalidAmountError('cents must be an integer');
    if (cents <= 0) throw new InvalidAmountError('must be greater than zero');
    if (cents > MAX_CENTS) throw new InvalidAmountError('exceeds the maximum supported amount');

    return new Money(cents);
  }

  toDecimal(): number {
    return this.cents / CENTS_PER_UNIT;
  }

  equals(other: Money): boolean {
    return this.cents === other.cents;
  }
}
