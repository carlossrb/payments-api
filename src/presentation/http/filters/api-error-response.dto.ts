import { ApiProperty } from '@nestjs/swagger';

export class ApiErrorResponseDto {
  @ApiProperty({ example: 'PAYMENT_NOT_FOUND' })
  code!: string;

  @ApiProperty({ example: 'Payment 3fa85f64-5717-4562-b3fc-2c963f66afa6 was not found' })
  message!: string;

  @ApiProperty({ example: 404 })
  statusCode!: number;

  @ApiProperty({ example: '2026-09-21T12:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: '/api/payment/3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  path!: string;

  @ApiProperty({ required: false, example: ['amount must be a positive number'] })
  details?: unknown;
}
