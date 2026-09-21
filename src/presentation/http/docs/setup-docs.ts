import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';

export const DOCS_PATH = '/docs';
export const OPENAPI_PATH = '/docs/openapi.json';

export function setupDocs(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Payments API')
    .setDescription(
      'Payment lifecycle API with PIX and credit card (Mercado Pago Checkout Pro) support.',
    )
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);

  app.getHttpAdapter().get(OPENAPI_PATH, (_request, response) => response.json(document));
  app.use(DOCS_PATH, apiReference({ content: document, theme: 'default' }));
}
