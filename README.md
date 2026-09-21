# Payments API

API REST que gerencia o ciclo de vida de cobranças: PIX e cartão de crédito via Mercado Pago (Checkout Pro). Backend-only, sem auth.

## Stack

NestJS 12, Node 24, TypeScript, Prisma 7 + PostgreSQL 17, Redis 7 (cache, locks e dedupe), Temporal (workflow do cartão), Biome, Vitest, Scalar (docs), Docker Compose.

---

## Rodando o projeto

Precisa de Node >= 24, pnpm >= 10 e Docker.

```bash
cp .env.example .env
docker compose up --build
```

Isso sobe tudo: Postgres, Redis, Temporal (com UI), um mock do Mercado Pago, as migrations, a API e o worker.

| Serviço | URL |
|---|---|
| API | `http://localhost:3000/api` |
| Docs (Scalar) | `http://localhost:3000/docs` |
| Temporal UI | `http://localhost:8080` |
| Mock do Mercado Pago | `http://localhost:8081` |

Se preferir rodar a API e o worker fora do container:

```bash
docker compose up postgres redis temporal-postgres temporal temporal-ui mercado-pago-mock -d
cp .env.example .env
pnpm install
pnpm generate
pnpm migrate:deploy
pnpm start:dev          # API
pnpm start:worker:dev   # worker do Temporal, em outro terminal
```

Testes e qualidade:

```bash
pnpm test        # unitários + workflow do Temporal (time skipping)
pnpm test:cov    # cobertura de domain e application
pnpm check       # lint e formatação (Biome)
pnpm typecheck
```

O teste do workflow usa o test server do Temporal, que é baixado na primeira execução.

---

## Variáveis de ambiente

Tudo tem default pra desenvolvimento no `.env.example`.

| Variável | Default | Pra quê |
|---|---|---|
| `APP_PORT` | `3000` | porta da API |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/payments` | Postgres da aplicação |
| `REDIS_HOST` / `REDIS_PORT` | `localhost` / `6379` | cache, locks e dedupe de webhook |
| `TEMPORAL_ADDRESS` | `localhost:7233` | frontend do Temporal |
| `TEMPORAL_NAMESPACE` / `TEMPORAL_TASK_QUEUE` | `default` / `payments` | namespace e fila do worker |
| `MERCADO_PAGO_BASE_URL` | `http://localhost:8081` | `https://api.mercadopago.com` pra usar a API real |
| `MERCADO_PAGO_ACCESS_TOKEN` | `TEST-local-token` | access token (qualquer valor serve no mock) |
| `MERCADO_PAGO_WEBHOOK_SECRET` | `local-webhook-secret` | segredo usado na validação do `x-signature` |
| `MERCADO_PAGO_NOTIFICATION_URL` | `http://host.docker.internal:3000/api/webhooks/mercado-pago` | URL que o Mercado Pago chama no callback |
| `CHECKOUT_BACK_URL` | `http://localhost:3000/docs` | pra onde o comprador volta depois do checkout |
| `CHECKOUT_TTL_MINUTES` | `1440` | quanto tempo o workflow espera antes de marcar `FAIL` |
| `CHECKOUT_POLL_INTERVAL_SECONDS` | `300` | intervalo do polling no Mercado Pago quando o webhook não chega |

Pra usar o Mercado Pago de verdade: aponte `MERCADO_PAGO_BASE_URL` pra API oficial, use um access token de teste, o segredo de webhook do painel e uma `MERCADO_PAGO_NOTIFICATION_URL` pública (ngrok resolve em dev).

---

## Endpoints

Documentação completa com exemplos no Scalar (`/docs`) e o OpenAPI em `/docs/openapi.json`. Resumo:

- `POST /api/payment`: cria um pagamento. Responde `201` com `Location`.
- `PUT /api/payment/{id}`: substitui a representação editável (`cpf`, `description`, `amount`, `paymentMethod`, `status`).
- `GET /api/payment/{id}`: detalhe.
- `GET /api/payment`: lista com filtros `cpf`, `paymentMethod`, `status` e paginação `page`/`limit`.
- `POST /api/webhooks/mercado-pago`: callback do Mercado Pago.
- `GET /api/health`: estado da API, do banco e do Redis.

Criando um pagamento com cartão:

```bash
curl -s -X POST http://localhost:3000/api/payment \
  -H 'content-type: application/json' \
  -d '{"cpf":"529.982.247-25","description":"Assinatura mensal","amount":150.75,"paymentMethod":"CREDIT_CARD"}'
```

```json
{
  "id": "9d1c02f0-55ba-4856-80a2-8d4bcdfc1a75",
  "cpf": "52998224725",
  "description": "Assinatura mensal",
  "amount": 150.75,
  "paymentMethod": "CREDIT_CARD",
  "status": "PENDING",
  "checkoutUrl": "http://localhost:8081/checkout/1790026555481-57c61ecd",
  "gatewayPaymentId": null,
  "failureReason": null,
  "paidAt": null,
  "createdAt": "2026-09-21T21:35:54.706Z",
  "updatedAt": "2026-09-21T21:35:55.598Z"
}
```

Erros seguem sempre o mesmo formato:

```json
{
  "code": "STATUS_MANAGED_BY_GATEWAY",
  "message": "Credit card payments are confirmed by the payment gateway, not manually",
  "statusCode": 422,
  "timestamp": "2026-09-21T21:35:55.643Z",
  "path": "/api/payment/9d1c02f0-55ba-4856-80a2-8d4bcdfc1a75"
}
```

Erros de validação vêm com `code: VALIDATION_ERROR` e a lista de problemas em `details`.

---

## Regras de negócio

- Todo pagamento nasce `PENDING`. Transições: `PENDING` vira `PAID` ou `FAIL`. `PAID` e `FAIL` são finais.
- `cpf` precisa ser válido (dígitos verificadores), com ou sem máscara. É guardado só com dígitos.
- `amount` é positivo, com no máximo duas casas decimais.
- `paymentMethod` nunca muda depois de criado.
- PIX: só grava o registro. O `PUT` pode confirmar (`PAID`) ou falhar (`FAIL`) manualmente, já que não há integração nessa etapa.
- Cartão: a confirmação vem do Mercado Pago. O `PUT` só aceita `FAIL` manual (que cancela o workflow); `PAID` manual devolve `422`.
- Depois que o checkout é criado, `amount` e `cpf` congelam (a preference foi gerada com esses valores). `description` continua editável enquanto pendente.
- Alterar qualquer coisa num pagamento final devolve `409`. Reenviar a mesma representação é idempotente e devolve `200`.

O `PUT` é substituição completa da representação editável, por isso todos os campos são obrigatórios. Não tem `PATCH` porque a doc pede `PUT`.

---

## Fluxo do cartão

O que acontece num `POST` com `CREDIT_CARD`:

1. A API grava o pagamento `PENDING` e um evento `CREDIT_CARD_PAYMENT_REQUESTED` no outbox, na mesma transação.
2. A API tenta iniciar o workflow no Temporal inline e espera até 8s pela URL de checkout (via update do workflow). Se vier, o `201` já traz o `checkoutUrl`. Se não vier (gateway lento, Temporal fora), o `201` sai sem a URL e o `GET` mostra ela quando ficar pronta. O outbox garante que o workflow será iniciado mesmo se o Temporal estiver indisponível na hora do `POST`.
3. O workflow `creditCardPaymentWorkflow` roda a activity `createCheckout` (cria a preference no Mercado Pago, com retry e backoff) e fica esperando, de forma durável, um sinal com o resultado. Enquanto não chega, faz polling no Mercado Pago a cada `CHECKOUT_POLL_INTERVAL_SECONDS`. Se o checkout expirar (`CHECKOUT_TTL_MINUTES`), marca `FAIL`.
4. O webhook valida o `x-signature` (HMAC do `id`, `x-request-id` e `ts`, com tolerância de 5 min), deduplica pelo id da notificação no Redis, grava `GATEWAY_NOTIFICATION_RECEIVED` no outbox e responde `200` na hora. O Mercado Pago espera resposta rápida.
5. O processador do outbox consulta o pagamento no Mercado Pago (`data.id`), acha o pagamento local pelo `external_reference` e sinaliza o workflow. Se não houver workflow rodando (histórico perdido, worker que nunca subiu), liquida direto.
6. A activity `settlePayment` grava `PAID` ou `FAIL`, sob lock por pagamento e ignorando quem chegar depois num estado final.

Se o worker cair no meio, o Temporal retoma de onde parou. Dá pra acompanhar cada execução na Temporal UI.

### Testando o fluxo com o mock

O mock implementa `POST /checkout/preferences`, `GET /v1/payments/{id}`, `GET /v1/payments/search` e uma página de checkout com botões de aprovar, recusar e deixar em análise. Ao clicar, ele cria o pagamento e dispara o webhook assinado pra API, igual ao Mercado Pago.

1. Crie um pagamento com cartão (curl acima) e abra o `checkoutUrl` no navegador.
2. Clique em "Aprovar pagamento".
3. `GET /api/payment/{id}` passa a devolver `status: PAID` e `gatewayPaymentId` em poucos segundos.

Sem navegador:

```bash
curl -s -X POST http://localhost:8081/checkout/<id-da-preference>/pay \
  -H 'content-type: application/json' -H 'accept: application/json' \
  -d '{"outcome":"approved"}'
```

O id da preference é o último segmento do `checkoutUrl`. `outcome` aceita `approved`, `rejected` e `pending`.

---

## Decisões e trade-offs

### Clean Architecture

```
src/
  domain/         entidade Payment, value objects (Cpf, Money), estados e erros. Sem framework.
  application/    use cases e ports (repositório, gateway, orquestrador, cache, lock, outbox).
  infrastructure/ adapters: Prisma, Redis, Mercado Pago, Temporal (workflow, activities, worker), outbox.
  presentation/   controllers, DTOs, filtro de exceção e docs.
  modules/        composição: amarra os ports aos adapters nos módulos do Nest.
```

A dependência só aponta pra dentro, e o Biome falha o lint se `domain` importar qualquer camada de fora ou se `application` importar `infrastructure`, `presentation`, Prisma, Temporal ou Redis. O código de workflow também é bloqueado de importar Nest, Prisma ou `node:*`, porque roda no sandbox determinístico do Temporal.

As regras vivem na entidade: `Payment.update()` decide o que pode mudar, `markAsPaid()` e `markAsFailed()` validam a transição, `attachCheckout()` é idempotente. Os use cases orquestram (buscar, chamar o domínio, persistir, invalidar cache) e dependem só de interfaces. Trocar Prisma por outro ORM ou o Mercado Pago por outro gateway não toca em `domain` nem em `application`.

**Trade-off consciente:** os use cases usam `@Injectable()` e `@Inject(TOKEN)` do Nest. Manter a camada 100% livre de framework exigiria uma classe `Impl*` por use case só pra amarrar tokens. Pra esse escopo, o decorator custa menos que a duplicação. O domínio segue puro.

Erros de domínio carregam um `kind` (`VALIDATION`, `NOT_FOUND`, `CONFLICT`, `UNPROCESSABLE`, `UNAUTHORIZED`, `DEPENDENCY`) e o filtro HTTP traduz pra status. O domínio não conhece HTTP.

### Temporal

É opcional na doc, mas é o que faz o fluxo do cartão ser confiável sem gambiarra: a espera pelo callback é durável, o polling de fallback e a expiração ficam no mesmo lugar, e cada tentativa de chamar o Mercado Pago tem retry com backoff configurado na activity. Sem ele, a alternativa seria um cron varrendo pagamentos pendentes, com o estado espalhado entre tabela e job.

O `POST` devolve a URL de checkout sem virar um endpoint assíncrono: ele usa um update do workflow que resolve assim que a activity `createCheckout` termina, com timeout de 8s. Um workflow por pagamento, com `workflowId` derivado do id, então iniciar duas vezes é inofensivo.

### Outbox

Gravar no Postgres e iniciar um workflow no Temporal são dois sistemas: o clássico dual write. O outbox resolve isso sem custo extra de infra (é uma tabela) e ainda serve de fila interna pro webhook, com claim atômico (`UPDATE ... WHERE status = PENDING`), retry com backoff exponencial e um reaper pra eventos travados em `PROCESSING`. O cron roda a cada 2s sob lock do Redis, mas o lock só evita trabalho duplicado: a corretude vem do claim.

**Por que não BullMQ pro webhook?** Já existia um mecanismo durável com retry. Adicionar uma segunda fila só pra isso seria mais infra pra manter pelo mesmo resultado.

### Redis

- Cache do `GET /api/payment/{id}` com TTL de 60s, invalidado em toda escrita (PUT, checkout criado, liquidação).
- Lock por pagamento nas escritas de status, pra `PUT` manual e liquidação do gateway não se atropelarem.
- Lock do cron do outbox, pra rodar em uma instância só.
- Dedupe das notificações do Mercado Pago pelo id (ele reenvia).

Tudo fail-open: se o Redis cair, a API continua servindo sem cache e sem lock, porque a corretude está no domínio (transições validadas) e no banco (claim do outbox), não no Redis.

### Mercado Pago sem o SDK oficial

O SDK tem a URL base fixa em `api.mercadopago.com`, o que impede apontar pro mock e rodar o fluxo inteiro no compose. O adapter usa `fetch` nativo com timeout, idempotency key e mapeamento de erro (5xx e rede viram `GATEWAY_UNAVAILABLE`, retryável; 4xx vira `GATEWAY_REJECTED`, não). A validação do `x-signature` segue a doc do Mercado Pago e tem teste próprio.

### Persistência

- `amount` é `Decimal(12,2)` no banco e `Money` em centavos no domínio, pra não fazer aritmética com float.
- O id é UUID gerado no domínio, não no banco, o que permite montar o `workflowId` e o `external_reference` antes de persistir.
- Repositório com `save` idempotente (upsert) e transação exposta como `UnitOfWork`, pra gravar pagamento e evento do outbox juntos.

### O que ficou de fora

Auth, estorno e chargeback (o mapeamento de status já ignora `refunded` e `charged_back` de propósito), e a integração real do PIX, que a doc deixa pra uma etapa seguinte.

---

## Testes

`pnpm test` roda 124 testes:

- **Domínio**: CPF, Money, transições de status e todas as regras do `Payment.update()`.
- **Use cases**: cada um isolado com fakes em memória dos ports (repositório, cache, lock, outbox, gateway, orquestrador). Cobrem o caminho feliz, os erros de negócio e as degradações (Temporal fora no `POST`, workflow inexistente no webhook, notificação duplicada).
- **Infra**: assinatura do webhook, mapeamento do Mercado Pago, backoff e processador do outbox (claim, retry, desistência, reaper).
- **Workflow**: quatro cenários rodando no test server do Temporal com time skipping: aprovação via sinal, rejeição via polling, expiração e cancelamento manual.
- **HTTP**: controller e tradução de erros.
