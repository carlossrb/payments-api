import { PaymentMethod } from '@domain/payment/payment-method';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Max,
  MaxLength,
} from 'class-validator';
import { IsCpf } from '../../validation/is-cpf.decorator';

export const MAX_AMOUNT = 9_999_999_999.99;

export class CreatePaymentDto {
  @ApiProperty({ example: '529.982.247-25', description: 'Customer CPF, with or without mask' })
  @IsString()
  @IsCpf()
  cpf!: string;

  @ApiProperty({ example: 'Monthly subscription', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description!: string;

  @ApiProperty({ example: 150.75, description: 'Amount in BRL with up to two decimal places' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(MAX_AMOUNT)
  amount!: number;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CREDIT_CARD })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;
}
