import { describe, expect, it } from 'vitest';
import { Cpf } from './cpf';
import { InvalidCpfError } from './payment.errors';

describe('Cpf', () => {
  it('accepts a valid CPF with or without mask', () => {
    expect(Cpf.create('529.982.247-25').value).toBe('52998224725');
    expect(Cpf.create('52998224725').value).toBe('52998224725');
  });

  it('formats the digits back with the standard mask', () => {
    expect(Cpf.create('52998224725').formatted).toBe('529.982.247-25');
  });

  it.each(['12345678900', '00000000000', '11111111111', '5299822472', '529982247256', 'abc'])(
    'rejects %s',
    (raw) => {
      expect(() => Cpf.create(raw)).toThrow(InvalidCpfError);
      expect(Cpf.isValid(raw)).toBe(false);
    },
  );

  it('compares by value', () => {
    expect(Cpf.create('529.982.247-25').equals(Cpf.create('52998224725'))).toBe(true);
  });
});
