-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RiskSegment" AS ENUM ('VIP', 'SAFE', 'RISK', 'BANNED');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('PAID', 'CREDIT', 'CASH_WITHDRAWAL');

-- CreateEnum
CREATE TYPE "CreditStatus" AS ENUM ('ACTIVE', 'PENDING_VERIFICATION', 'SETTLED', 'DEFAULTED');

-- CreateEnum
CREATE TYPE "TransactionKind" AS ENUM ('CHARGE', 'PAYMENT', 'REFUND');

-- CreateEnum
CREATE TYPE "ScheduledJobType" AS ENUM ('COURTESY', 'URGENT', 'OVERDUE', 'MANUAL', 'APPRECIATION');

-- CreateEnum
CREATE TYPE "ScheduledJobStatus" AS ENUM ('PENDING', 'RUNNING', 'CANCELLED', 'FAILED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PendingPaymentCandidateStatus" AS ENUM ('NEW', 'REVIEWED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReconciliationTaskStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT NOT NULL,
    "trust_score" INTEGER NOT NULL DEFAULT 50,
    "risk_segment" "RiskSegment" NOT NULL DEFAULT 'SAFE',
    "store_credit_balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "in_stock" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "type" "OrderType" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_lines" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "menu_item_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credits" (
    "id" UUID NOT NULL,
    "order_id" UUID,
    "customer_id" UUID NOT NULL,
    "principal" DECIMAL(10,2) NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "status" "CreditStatus" NOT NULL,
    "reminders_sent" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "credit_id" UUID,
    "order_id" UUID,
    "amount" DECIMAL(10,2) NOT NULL,
    "kind" "TransactionKind" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_jobs" (
    "id" UUID NOT NULL,
    "job_key" TEXT NOT NULL,
    "credit_id" UUID,
    "customer_id" UUID,
    "type" "ScheduledJobType" NOT NULL,
    "run_at" TIMESTAMP(3) NOT NULL,
    "status" "ScheduledJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trust_score_events" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "source_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trust_score_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_table" TEXT NOT NULL,
    "target_id" UUID,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_payment_candidates" (
    "id" UUID NOT NULL,
    "from_phone" TEXT NOT NULL,
    "parsed_amount" DECIMAL(10,2),
    "raw_text" TEXT NOT NULL,
    "matched_credit_id" UUID,
    "status" "PendingPaymentCandidateStatus" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_payment_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_requests" (
    "id" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "response_body" JSONB NOT NULL,
    "status_code" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_tasks" (
    "id" UUID NOT NULL,
    "client_id" TEXT,
    "entity_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "ReconciliationTaskStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "reconciliation_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "orders_customer_id_idx" ON "orders"("customer_id");

-- CreateIndex
CREATE INDEX "order_lines_order_id_idx" ON "order_lines"("order_id");

-- CreateIndex
CREATE INDEX "credits_customer_id_idx" ON "credits"("customer_id");

-- CreateIndex
CREATE INDEX "credits_order_id_idx" ON "credits"("order_id");

-- CreateIndex
CREATE INDEX "credits_status_idx" ON "credits"("status");

-- CreateIndex
CREATE INDEX "transactions_credit_id_idx" ON "transactions"("credit_id");

-- CreateIndex
CREATE INDEX "transactions_order_id_idx" ON "transactions"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_jobs_job_key_key" ON "scheduled_jobs"("job_key");

-- CreateIndex
CREATE INDEX "scheduled_jobs_credit_id_idx" ON "scheduled_jobs"("credit_id");

-- CreateIndex
CREATE INDEX "scheduled_jobs_customer_id_idx" ON "scheduled_jobs"("customer_id");

-- CreateIndex
CREATE INDEX "scheduled_jobs_status_run_at_idx" ON "scheduled_jobs"("status", "run_at");

-- CreateIndex
CREATE INDEX "trust_score_events_customer_id_idx" ON "trust_score_events"("customer_id");

-- CreateIndex
CREATE INDEX "audit_log_target_table_target_id_idx" ON "audit_log"("target_table", "target_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- CreateIndex
CREATE INDEX "pending_payment_candidates_from_phone_idx" ON "pending_payment_candidates"("from_phone");

-- CreateIndex
CREATE INDEX "pending_payment_candidates_status_idx" ON "pending_payment_candidates"("status");

-- CreateIndex
CREATE INDEX "idempotency_requests_created_at_idx" ON "idempotency_requests"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_requests_idempotency_key_route_key" ON "idempotency_requests"("idempotency_key", "route");

-- CreateIndex
CREATE INDEX "reconciliation_tasks_status_idx" ON "reconciliation_tasks"("status");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credits" ADD CONSTRAINT "credits_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credits" ADD CONSTRAINT "credits_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_credit_id_fkey" FOREIGN KEY ("credit_id") REFERENCES "credits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_credit_id_fkey" FOREIGN KEY ("credit_id") REFERENCES "credits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_score_events" ADD CONSTRAINT "trust_score_events_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_payment_candidates" ADD CONSTRAINT "pending_payment_candidates_matched_credit_id_fkey" FOREIGN KEY ("matched_credit_id") REFERENCES "credits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

