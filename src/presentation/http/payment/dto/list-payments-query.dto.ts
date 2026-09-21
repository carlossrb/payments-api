import { PAGINATION } from '@application/payment/payment.const';
import { PaymentMethod } from '@domain/payment/payment-method';
import { PaymentStatus } from '@domain/payment/payment-status';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { IsCpf } from '../../validation/is-cpf.decorator';

export class ListPaymentsQueryDto {
  @ApiPropertyOptional({ example: '529.982.247-25' })
  @IsOptional()
  @IsString()
  @IsCpf()
  cpf?: string;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({ default: PAGINATION.DEFAULT_PAGE, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    default: PAGINATION.DEFAULT_LIMIT,
    minimum: 1,
    maximum: PAGINATION.MAX_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGINATION.MAX_LIMIT)
  limit?: number;
}
