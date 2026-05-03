-- Add PROBATION tier to RiskSegment enum and backfill all customers.
-- New customers now start on PROBATION (score 50) and must earn SAFE (score >= 65)
-- through demonstrated payment behaviour.
-- Tier boundaries: BANNED 0-24, RISK 25-49, PROBATION 50-64, SAFE 65-79, VIP 80-100.
--
-- NOTE: ALTER TYPE ADD VALUE cannot run inside a transaction in PostgreSQL.
-- On production, run this line manually first:
--   psql $DATABASE_URL -c "ALTER TYPE \"RiskSegment\" ADD VALUE IF NOT EXISTS 'PROBATION';"
-- Then run: prisma migrate resolve --applied 20260503110000_add_probation_risk_segment
-- Then apply the backfill below directly:
--   psql $DATABASE_URL -c "UPDATE \"customers\" SET \"risk_segment\" = CASE WHEN \"trust_score\" >= 80 THEN 'VIP' WHEN \"trust_score\" >= 65 THEN 'SAFE' WHEN \"trust_score\" >= 50 THEN 'PROBATION' WHEN \"trust_score\" >= 25 THEN 'RISK' ELSE 'BANNED' END::\"RiskSegment\";"
ALTER TYPE "RiskSegment" ADD VALUE IF NOT EXISTS 'PROBATION';

UPDATE "customers"
SET "risk_segment" = CASE
  WHEN "trust_score" >= 80 THEN 'VIP'
  WHEN "trust_score" >= 65 THEN 'SAFE'
  WHEN "trust_score" >= 50 THEN 'PROBATION'
  WHEN "trust_score" >= 25 THEN 'RISK'
  ELSE 'BANNED'
END::"RiskSegment";
