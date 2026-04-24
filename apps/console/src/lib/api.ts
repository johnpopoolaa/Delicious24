const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ── Types ────────────────────────────────────────────────────────────────────

export type RiskSegment = 'VIP' | 'SAFE' | 'RISK' | 'BANNED';
export type NotifChannel = 'WHATSAPP' | 'SMS' | 'BOTH';
export type CreditStatus = 'ACTIVE' | 'PENDING_VERIFICATION' | 'SETTLED' | 'DEFAULTED';
export type OrderType = 'PAID' | 'CREDIT';
export type TransactionKind = 'CHARGE' | 'PAYMENT' | 'REFUND';
export type ScheduledJobType = 'COURTESY' | 'URGENT' | 'OVERDUE' | 'MANUAL' | 'APPRECIATION';
export type ScheduledJobStatus = 'PENDING' | 'RUNNING' | 'CANCELLED' | 'FAILED' | 'COMPLETED';
export type PendingCandidateStatus = 'NEW' | 'REVIEWED' | 'REJECTED';
export type ReconciliationTaskStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  trustScore: number;
  riskSegment: RiskSegment;
  storeCreditBalance: string;
  notifChannel: NotifChannel;
  createdAt: string;
  updatedAt: string;
}

export interface Credit {
  id: string;
  orderId?: string;
  customerId: string;
  principal: string;
  balance: string;
  dueDate: string;
  status: CreditStatus;
  remindersSent: number;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  creditId?: string;
  orderId?: string;
  amount: string;
  kind: TransactionKind;
  note?: string;
  createdAt: string;
}

export interface CustomerLedger {
  customer: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    notif_channel: NotifChannel;
    trust_score: number;
    risk_segment: RiskSegment;
    store_credit_balance: string;
  };
  credits: Credit[];
  transactions: Transaction[];
  running_balance: string;
}

export interface MenuItem {
  id: number;
  name: string;
  price: string;
  inStock: boolean;
}

export interface ScheduledJob {
  id: string;
  jobKey: string;
  creditId?: string;
  customerId?: string;
  type: ScheduledJobType;
  runAt: string;
  status: ScheduledJobStatus;
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PendingPaymentCandidate {
  id: string;
  fromPhone: string;
  parsedAmount?: string;
  rawText: string;
  matchedCreditId?: string;
  status: PendingCandidateStatus;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  targetTable: string;
  targetId?: string;
  payload: unknown;
  createdAt: string;
}

export interface ReconciliationTask {
  id: string;
  clientId?: string;
  entityType: string;
  payload: unknown;
  status: ReconciliationTaskStatus;
  createdAt: string;
  resolvedAt?: string;
}

// ── Customer endpoints ────────────────────────────────────────────────────────

export function getCustomer(id: string) {
  return apiFetch<{ success: true; data: Customer }>(`/api/customers/${id}`);
}

export function searchCustomers(q: string, page = 1, limit = 20) {
  const params = new URLSearchParams({ q, page: String(page), limit: String(limit) });
  return apiFetch<{ success: true; data: { items: Customer[]; page: number; limit: number; total: number } }>(
    `/api/customers/search?${params}`,
  );
}

export function getCustomerLedger(customerId: string) {
  return apiFetch<{ success: true; data: CustomerLedger }>(`/api/customers/${customerId}/ledger`);
}

export function createCustomer(body: { name: string; phone: string; email?: string }) {
  return apiFetch<{ success: true; data: Customer }>('/api/customers', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateCustomer(
  id: string,
  body: { name?: string; phone?: string; email?: string; notif_channel?: NotifChannel },
) {
  return apiFetch<{ success: true; data: Customer }>(`/api/customers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

// ── Menu endpoints ────────────────────────────────────────────────────────────

export function listMenuItems() {
  return apiFetch<{ success: true; data: { items: MenuItem[] } }>('/api/menu-items');
}

export function createMenuItem(body: { name: string; price: string; in_stock?: boolean }) {
  return apiFetch<{ success: true; data: MenuItem }>('/api/menu-items', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateMenuItem(id: number, body: { name?: string; price?: string; in_stock?: boolean }) {
  return apiFetch<{ success: true; data: MenuItem }>(`/api/menu-items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

// ── Order endpoints ───────────────────────────────────────────────────────────

export interface CreateOrderBody {
  type: OrderType;
  customer_id: string;
  items: { menu_item_id: number; qty: number }[];
  total: string;
  due_date?: string;
  note?: string;
}

export function createOrder(body: CreateOrderBody) {
  return apiFetch<{ success: true; data: unknown }>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// ── Payments endpoints ────────────────────────────────────────────────────────

export function confirmPayment(body: {
  credit_id: string;
  amount: number;
  note?: string;
  idempotency_key: string;
}) {
  const { credit_id, ...rest } = body;
  return apiFetch<{ success: true; data: unknown }>(`/api/credits/${credit_id}/confirm-payment`, {
    method: 'POST',
    body: JSON.stringify(rest),
  });
}

// ── Pending payment candidates ────────────────────────────────────────────────

export function listPendingCandidates(status?: PendingCandidateStatus, page = 1, limit = 20) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set('status', status);
  return apiFetch<{ success: true; data: { items: PendingPaymentCandidate[]; total: number } }>(
    `/api/pending-payments?${params}`,
  );
}

export function updatePendingCandidate(id: string, body: { status: PendingCandidateStatus }) {
  return apiFetch<{ success: true; data: unknown }>(`/api/pending-payments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

// ── Scheduled jobs ────────────────────────────────────────────────────────────

export function listScheduledJobs(params?: {
  credit_id?: string;
  status?: ScheduledJobStatus;
  run_at_from?: string;
  run_at_to?: string;
  skip?: number;
  take?: number;
}) {
  const qp = new URLSearchParams();
  if (params?.credit_id) qp.set('credit_id', params.credit_id);
  if (params?.status) qp.set('status', params.status);
  if (params?.run_at_from) qp.set('run_at_from', params.run_at_from);
  if (params?.run_at_to) qp.set('run_at_to', params.run_at_to);
  if (params?.skip != null) qp.set('skip', String(params.skip));
  if (params?.take != null) qp.set('take', String(params.take));
  return apiFetch<{ success: true; data: { items: ScheduledJob[] } }>(
    `/api/scheduled-jobs?${qp}`,
  );
}

export function cancelJob(id: string) {
  return apiFetch<{ success: boolean; data?: ScheduledJob }>(`/api/scheduled-jobs/${id}/cancel`, {
    method: 'POST',
  });
}

export function sendJobNow(id: string) {
  return apiFetch<{ success: boolean; data?: ScheduledJob }>(`/api/scheduled-jobs/${id}/send-now`, {
    method: 'POST',
  });
}

export function scheduleManualReminder(body: { credit_id: string; run_at: string }) {
  return apiFetch<{ success: true; data: ScheduledJob }>('/api/scheduled-jobs/manual', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// ── Audit log ─────────────────────────────────────────────────────────────────

export function listAuditLogs(params?: { skip?: number; take?: number }) {
  const qp = new URLSearchParams();
  if (params?.skip != null) qp.set('skip', String(params.skip));
  if (params?.take != null) qp.set('take', String(params.take));
  return apiFetch<{ success: true; data: { items: AuditLog[] } }>(
    `/api/audit-log?${qp}`,
  );
}

// ── Reconciliation ────────────────────────────────────────────────────────────

export function listReconciliationTasks(status?: ReconciliationTaskStatus) {
  const qp = new URLSearchParams();
  if (status) qp.set('status', status);
  return apiFetch<{ success: true; data: { items: ReconciliationTask[] } }>(
    `/api/reconciliation-tasks?${qp}`,
  );
}

export function resolveReconciliationTask(id: string, status: 'RESOLVED' | 'DISMISSED') {
  return apiFetch<{ success: true; data: ReconciliationTask }>(`/api/reconciliation-tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
