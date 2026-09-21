import { InvalidCpfError } from './payment.errors';

const CPF_LENGTH = 11;

const calculateCheckDigit = (partial: string): number => {
  const length = partial.length + 1;
  const sum = partial
    .split('')
    .map((char, index) => Number.parseInt(char, 10) * (length - index))
    .reduce((acc, value) => acc + value, 0);
  const remainder = sum % 11;

  if (remainder < 2) return 0;

  return 11 - remainder;
};

export class Cpf {
  private constructor(readonly value: string) {}

  static sanitize(raw: string): string {
    return raw.replace(/\D/g, '');
  }

  static isValid(raw: string): boolean {
    const digits = Cpf.sanitize(raw);

    if (digits.length !== CPF_LENGTH || /^(\d)\1{10}$/.test(digits)) return false;

    const base = digits.slice(0, 9);
    const firstCheckDigit = calculateCheckDigit(base);

    if (firstCheckDigit !== Number(digits.charAt(9))) return false;

    const secondCheckDigit = calculateCheckDigit(base + firstCheckDigit);

    return secondCheckDigit === Number(digits.charAt(10));
  }

  static create(raw: string): Cpf {
    if (typeof raw !== 'string' || !Cpf.isValid(raw)) throw new InvalidCpfError();

    return new Cpf(Cpf.sanitize(raw));
  }

  get formatted(): string {
    return this.value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }

  equals(other: Cpf): boolean {
    return this.value === other.value;
  }
}
