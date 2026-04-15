-- Remove the CASH_WITHDRAWAL value from the OrderType enum.
-- Safe: no rows use this value (pre-production).

-- Postgres does not support ALTER TYPE DROP VALUE directly.
-- Workaround: rename old type, create new type without the value,
-- migrate the column, drop old type.

ALTER TYPE "OrderType" RENAME TO "OrderType_old";

CREATE TYPE "OrderType" AS ENUM ('PAID', 'CREDIT');

ALTER TABLE "orders" ALTER COLUMN "type" TYPE "OrderType" USING "type"::text::"OrderType";

DROP TYPE "OrderType_old";
