import { describe, expect, it } from 'vitest';
import { canTransition, isFinalStatus, PaymentStatus } from './payment-status';

describe('payment status transitions', () => {
  it('allows PENDING to reach PAID or FAIL only', () => {
    expect(canTransition(PaymentStatus.PENDING, PaymentStatus.PAID)).toBe(true);
    expect(canTransition(PaymentStatus.PENDING, PaymentStatus.FAIL)).toBe(true);
    expect(canTransition(PaymentStatus.PAID, PaymentStatus.FAIL)).toBe(false);
    expect(canTransition(PaymentStatus.FAIL, PaymentStatus.PAID)).toBe(false);
    expect(canTransition(PaymentStatus.PAID, PaymentStatus.PENDING)).toBe(false);
  });

  it('treats PAID and FAIL as final', () => {
    expect(isFinalStatus(PaymentStatus.PENDING)).toBe(false);
    expect(isFinalStatus(PaymentStatus.PAID)).toBe(true);
    expect(isFinalStatus(PaymentStatus.FAIL)).toBe(true);
  });
});
