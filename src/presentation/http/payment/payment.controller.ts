import { CreatePaymentUseCase } from '@application/payment/use-cases/create-payment.use-case';
import { GetPaymentUseCase } from '@application/payment/use-cases/get-payment.use-case';
import { ListPaymentsUseCase } from '@application/payment/use-cases/list-payments.use-case';
import { UpdatePaymentUseCase } from '@application/payment/use-cases/update-payment.use-case';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ApiErrorResponseDto } from '../filters/api-error-response.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { PaymentPageResponseDto, PaymentResponseDto } from './dto/payment-response.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { toPaymentPageResponse, toPaymentResponse } from './payment.presenter';

@ApiTags('Payments')
@Controller('payment')
export class PaymentController {
  constructor(
    private readonly createPayment: CreatePaymentUseCase,
    private readonly updatePayment: UpdatePaymentUseCase,
    private readonly getPayment: GetPaymentUseCase,
    private readonly listPayments: ListPaymentsUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a payment',
    description:
      'PIX payments are stored as PENDING. Credit card payments start a Mercado Pago checkout and return its URL when it is ready within a few seconds, otherwise fetch the payment again to read it.',
  })
  @ApiResponse({ status: HttpStatus.CREATED, type: PaymentResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, type: ApiErrorResponseDto })
  async create(
    @Body() body: CreatePaymentDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PaymentResponseDto> {
    const payment = await this.createPayment.execute(body);

    response.setHeader('Location', `/api/payment/${payment.id}`);

    return toPaymentResponse(payment);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Replace the editable representation of a payment',
    description:
      'Full replacement of the client-owned fields. PIX payments can be confirmed or failed manually. Credit card payments can only be failed manually, their confirmation comes from the gateway.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: PaymentResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, type: ApiErrorResponseDto })
  @ApiResponse({ status: HttpStatus.CONFLICT, type: ApiErrorResponseDto })
  @ApiResponse({ status: HttpStatus.UNPROCESSABLE_ENTITY, type: ApiErrorResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdatePaymentDto,
  ): Promise<PaymentResponseDto> {
    const payment = await this.updatePayment.execute({ paymentId: id, ...body });

    return toPaymentResponse(payment);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a payment by id' })
  @ApiResponse({ status: HttpStatus.OK, type: PaymentResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, type: ApiErrorResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PaymentResponseDto> {
    const payment = await this.getPayment.execute(id);

    return toPaymentResponse(payment);
  }

  @Get()
  @ApiOperation({ summary: 'List payments filtered by CPF, payment method and status' })
  @ApiResponse({ status: HttpStatus.OK, type: PaymentPageResponseDto })
  async list(@Query() query: ListPaymentsQueryDto): Promise<PaymentPageResponseDto> {
    const page = await this.listPayments.execute(query);

    return toPaymentPageResponse(page);
  }
}
