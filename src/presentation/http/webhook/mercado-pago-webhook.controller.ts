import {
  type ReceiveGatewayNotificationResult,
  ReceiveGatewayNotificationUseCase,
} from '@application/payment/use-cases/receive-gateway-notification.use-case';
import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../filters/api-error-response.dto';

export class WebhookAckDto {
  received!: true;
  result!: ReceiveGatewayNotificationResult;
}

@ApiTags('Webhooks')
@Controller('webhooks')
export class MercadoPagoWebhookController {
  constructor(private readonly receiveNotification: ReceiveGatewayNotificationUseCase) {}

  @Post('mercado-pago')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mercado Pago notification endpoint',
    description:
      'Validates the x-signature header, stores the notification in the outbox and answers immediately. The payment status is reconciled asynchronously.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: WebhookAckDto })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, type: ApiErrorResponseDto })
  async handle(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query() query: Record<string, unknown>,
    @Body() body: unknown,
  ): Promise<WebhookAckDto> {
    const result = await this.receiveNotification.execute({ headers, query, body });

    return { received: true, result };
  }
}
