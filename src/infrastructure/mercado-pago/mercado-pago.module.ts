import { PAYMENT_GATEWAY } from '@application/payment/ports/payment-gateway';
import { Module } from '@nestjs/common';
import { MercadoPagoClient } from './mercado-pago.client';
import { MercadoPagoGateway } from './mercado-pago.gateway';

@Module({
  providers: [MercadoPagoClient, { provide: PAYMENT_GATEWAY, useClass: MercadoPagoGateway }],
  exports: [PAYMENT_GATEWAY],
})
export class MercadoPagoModule {}
