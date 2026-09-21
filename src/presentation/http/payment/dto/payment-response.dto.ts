import { PaymentMethod } from '@domain/payment/payment-method';
import { PaymentStatus } from '@domain/payment/payment-status';
import { ApiProperty } from '@nestjs/swagger';

export class PaymentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '52998224725', description: 'CPF digits only' })
  cpf!: string;

  @ApiProperty({ example: 'Monthly subscription' })
  description!: string;

  @ApiProperty({ example: 150.75 })
  amount!: number;

  @ApiProperty({ enum: PaymentMethod })
  paymentMethod!: PaymentMethod;

  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Mercado Pago Checkout Pro URL, only for credit card payments',
  })
  checkoutUrl!: string | null;

  @ApiProperty({ nullable: true, type: String })
  gatewayPaymentId!: string | null;

  @ApiProperty({ nullable: true, type: String })
  failureReason!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  paidAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class PaymentPageResponseDto {
  @ApiProperty({ type: [PaymentResponseDto] })
  items!: PaymentResponseDto[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}
