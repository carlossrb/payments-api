import { Cpf } from '@domain/payment/cpf';
import { registerDecorator, type ValidationOptions } from 'class-validator';

export function IsCpf(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isCpf',
      target: object.constructor,
      propertyName,
      options: { message: 'cpf must be a valid CPF', ...validationOptions },
      validator: {
        validate: (value: unknown) => typeof value === 'string' && Cpf.isValid(value),
      },
    });
  };
}
