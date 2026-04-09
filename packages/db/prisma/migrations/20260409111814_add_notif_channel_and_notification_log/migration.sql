-- CreateEnum
CREATE TYPE "NotifChannel" AS ENUM ('WHATSAPP', 'SMS', 'BOTH');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "notif_channel" "NotifChannel" NOT NULL DEFAULT 'WHATSAPP';

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" UUID NOT NULL,
    "scheduled_job_id" UUID NOT NULL,
    "channel" "NotifChannel" NOT NULL,
    "to_phone" TEXT NOT NULL,
    "message_sid" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_logs_scheduled_job_id_idx" ON "notification_logs"("scheduled_job_id");

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_scheduled_job_id_fkey" FOREIGN KEY ("scheduled_job_id") REFERENCES "scheduled_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
