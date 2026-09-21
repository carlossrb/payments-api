export interface MercadoPagoPreferenceRequest {
  items: Array<{
    id: string;
    title: string;
    description: string;
    quantity: number;
    currency_id: string;
    unit_price: number;
  }>;
  payer: { identification: { type: string; number: string } };
  external_reference: string;
  notification_url: string;
  payment_methods: {
    excluded_payment_types: Array<{ id: string }>;
    installments: number;
  };
  metadata: Record<string, string>;
  expires: boolean;
  expiration_date_to: string;
  back_urls?: { success: string; failure: string; pending: string };
  auto_return?: 'approved';
}

export interface MercadoPagoPreferenceResponse {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
}

export interface MercadoPagoPayment {
  id: number | string;
  status?: string;
  status_detail?: string;
  external_reference?: string | null;
}

export interface MercadoPagoPaymentSearchResponse {
  results?: MercadoPagoPayment[];
}

export interface MercadoPagoWebhookBody {
  id?: number | string;
  type?: string;
  topic?: string;
  action?: string;
  data?: { id?: number | string };
}
