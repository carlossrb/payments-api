import { createHmac, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_PORT ?? 8081);
const PUBLIC_URL = process.env.MOCK_PUBLIC_URL ?? `http://localhost:${PORT}`;
const WEBHOOK_SECRET = process.env.MOCK_WEBHOOK_SECRET ?? 'local-webhook-secret';

const preferences = new Map();
const payments = new Map();
let paymentSequence = Math.floor(Date.now() / 1000);

const OUTCOMES = {
  approved: { status: 'approved', status_detail: 'accredited' },
  rejected: { status: 'rejected', status_detail: 'cc_rejected_insufficient_amount' },
  pending: { status: 'in_process', status_detail: 'pending_contingency' },
};

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

const html = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
  res.end(body);
};

const readBody = (req) =>
  new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
  });

const parseBody = async (req) => {
  const raw = await readBody(req);
  if (!raw) return {};
  const contentType = req.headers['content-type'] ?? '';
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const signManifest = (dataId, requestId, ts) =>
  createHmac('sha256', WEBHOOK_SECRET)
    .update(`id:${dataId};request-id:${requestId};ts:${ts};`)
    .digest('hex');

const sendWebhook = async (preference, payment) => {
  if (!preference.notification_url) return { skipped: true };
  const ts = Math.floor(Date.now() / 1000);
  const requestId = randomUUID();
  const url = new URL(preference.notification_url);
  url.searchParams.set('data.id', String(payment.id));
  url.searchParams.set('type', 'payment');
  const body = {
    id: Date.now(),
    live_mode: false,
    type: 'payment',
    date_created: new Date().toISOString(),
    user_id: 1,
    api_version: 'v1',
    action: 'payment.updated',
    data: { id: String(payment.id) },
  };
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-signature': `ts=${ts},v1=${signManifest(String(payment.id), requestId, ts)}`,
        'x-request-id': requestId,
      },
      body: JSON.stringify(body),
    });
    return { url: url.toString(), status: response.status, body: await response.text() };
  } catch (error) {
    return { url: url.toString(), error: error.message };
  }
};

const createPayment = (preference, outcomeKey) => {
  const outcome = OUTCOMES[outcomeKey] ?? OUTCOMES.approved;
  const item = preference.items?.[0] ?? {};
  const now = new Date().toISOString();
  const payment = {
    id: paymentSequence++,
    date_created: now,
    date_approved: outcome.status === 'approved' ? now : null,
    date_last_updated: now,
    operation_type: 'regular_payment',
    payment_method_id: 'master',
    payment_type_id: 'credit_card',
    status: outcome.status,
    status_detail: outcome.status_detail,
    currency_id: item.currency_id ?? 'BRL',
    description: item.title ?? '',
    live_mode: false,
    external_reference: preference.external_reference ?? null,
    transaction_amount: Number(item.unit_price ?? 0) * Number(item.quantity ?? 1),
    installments: 1,
    payer: preference.payer ?? {},
    metadata: preference.metadata ?? {},
    order: { id: preference.id, type: 'mercadopago' },
  };
  payments.set(String(payment.id), payment);
  return payment;
};

const page = (title, content) => `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${title}</title>
<style>
body{font-family:system-ui,sans-serif;max-width:560px;margin:48px auto;padding:0 16px;color:#1f2933}
.card{border:1px solid #d9dee3;border-radius:12px;padding:24px}
h1{font-size:20px;margin:0 0 8px}p{margin:8px 0}.muted{color:#6b7280;font-size:14px}
.amount{font-size:32px;font-weight:600;margin:16px 0}
form{display:inline-block;margin:8px 8px 0 0}
button{border:0;border-radius:8px;padding:12px 20px;font-size:15px;cursor:pointer;color:#fff}
.ok{background:#009ee3}.no{background:#d64545}.wait{background:#6b7280}
pre{background:#f3f4f6;padding:12px;border-radius:8px;overflow:auto;font-size:12px}
</style></head><body><div class="card">${content}</div></body></html>`;

const checkoutPage = (preference) => {
  const item = preference.items?.[0] ?? {};
  const amount = Number(item.unit_price ?? 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: item.currency_id ?? 'BRL',
  });
  return page(
    'Mercado Pago (mock)',
    `<p class="muted">Checkout Pro simulado</p>
     <h1>${item.title ?? 'Pagamento'}</h1>
     <p class="muted">Referência: ${preference.external_reference ?? '-'}</p>
     <div class="amount">${amount}</div>
     <form method="post" action="/checkout/${preference.id}/pay"><input type="hidden" name="outcome" value="approved"><button class="ok">Aprovar pagamento</button></form>
     <form method="post" action="/checkout/${preference.id}/pay"><input type="hidden" name="outcome" value="rejected"><button class="no">Recusar pagamento</button></form>
     <form method="post" action="/checkout/${preference.id}/pay"><input type="hidden" name="outcome" value="pending"><button class="wait">Deixar em análise</button></form>`,
  );
};

const resultPage = (payment, webhook) =>
  page(
    'Mercado Pago (mock)',
    `<p class="muted">Pagamento simulado</p>
     <h1>Pagamento ${payment.id}: ${payment.status}</h1>
     <p>Webhook enviado para <code>${webhook.url ?? '-'}</code></p>
     <pre>${JSON.stringify(webhook, null, 2)}</pre>
     <pre>${JSON.stringify(payment, null, 2)}</pre>`,
  );

const requireToken = (req, res) => {
  const header = req.headers.authorization ?? '';
  if (header.startsWith('Bearer ') && header.length > 7) return true;
  json(res, 401, { message: 'invalid access token', error: 'unauthorized', status: 401 });
  return false;
};

const routes = [
  {
    method: 'POST',
    pattern: /^\/checkout\/preferences$/,
    handler: async (req, res) => {
      if (!requireToken(req, res)) return;
      const body = await parseBody(req);
      if (!Array.isArray(body.items) || body.items.length === 0) {
        json(res, 400, { message: 'items is required', error: 'bad_request', status: 400 });
        return;
      }
      const id = `${Date.now()}-${randomUUID()}`;
      const preference = {
        ...body,
        id,
        client_id: 'mock-client',
        collector_id: 1,
        date_created: new Date().toISOString(),
        init_point: `${PUBLIC_URL}/checkout/${id}`,
        sandbox_init_point: `${PUBLIC_URL}/checkout/${id}`,
        site_id: 'MLB',
      };
      preferences.set(id, preference);
      json(res, 201, preference);
    },
  },
  {
    method: 'GET',
    pattern: /^\/checkout\/preferences\/([^/]+)$/,
    handler: async (_req, res, [id]) => {
      const preference = preferences.get(id);
      if (!preference) return json(res, 404, { message: 'preference not found', status: 404 });
      json(res, 200, preference);
    },
  },
  {
    method: 'GET',
    pattern: /^\/checkout\/([^/]+)$/,
    handler: async (_req, res, [id]) => {
      const preference = preferences.get(id);
      if (!preference) return html(res, 404, page('Mercado Pago (mock)', '<h1>Checkout não encontrado</h1>'));
      html(res, 200, checkoutPage(preference));
    },
  },
  {
    method: 'POST',
    pattern: /^\/checkout\/([^/]+)\/pay$/,
    handler: async (req, res, [id]) => {
      const preference = preferences.get(id);
      if (!preference) return json(res, 404, { message: 'preference not found', status: 404 });
      const body = await parseBody(req);
      const payment = createPayment(preference, body.outcome);
      const webhook = await sendWebhook(preference, payment);
      if ((req.headers.accept ?? '').includes('text/html')) {
        return html(res, 200, resultPage(payment, webhook));
      }
      json(res, 201, { payment, webhook });
    },
  },
  {
    method: 'GET',
    pattern: /^\/v1\/payments\/search$/,
    handler: async (req, res, _params, url) => {
      if (!requireToken(req, res)) return;
      const reference = url.searchParams.get('external_reference');
      const results = [...payments.values()]
        .filter((payment) => !reference || payment.external_reference === reference)
        .sort((a, b) => b.date_created.localeCompare(a.date_created));
      json(res, 200, { paging: { total: results.length, limit: 30, offset: 0 }, results });
    },
  },
  {
    method: 'GET',
    pattern: /^\/v1\/payments\/([^/]+)$/,
    handler: async (req, res, [id]) => {
      if (!requireToken(req, res)) return;
      const payment = payments.get(id);
      if (!payment) return json(res, 404, { message: 'Payment not found', error: 'not_found', status: 404 });
      json(res, 200, payment);
    },
  },
  {
    method: 'GET',
    pattern: /^\/health$/,
    handler: async (_req, res) => json(res, 200, { status: 'ok', preferences: preferences.size, payments: payments.size }),
  },
];

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', PUBLIC_URL);
  const route = routes.find((candidate) => candidate.method === req.method && candidate.pattern.test(url.pathname));
  if (!route) return json(res, 404, { message: 'route not found', status: 404 });
  const params = url.pathname.match(route.pattern)?.slice(1) ?? [];
  try {
    await route.handler(req, res, params, url);
  } catch (error) {
    json(res, 500, { message: error.message, status: 500 });
  }
}).listen(PORT, () => {
  console.log(`Mercado Pago mock listening on ${PUBLIC_URL} (port ${PORT})`);
});
