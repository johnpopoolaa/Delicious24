-- Recalculate risk_segment for all customers based on current trust_score.
-- Intermediate pass: uses 4-tier thresholds (before PROBATION was added).
-- Migration 20260503110000 adds the PROBATION enum value and re-backfills
-- with the final 5-tier thresholds (VIP>=80, SAFE>=65, PROBATION>=50, RISK>=25).
UPDATE "customers"
SET "risk_segment" = CASE
  WHEN "trust_score" >= 80 THEN 'VIP'
  WHEN "trust_score" >= 50 THEN 'SAFE'
  WHEN "trust_score" >= 25 THEN 'RISK'
  ELSE 'BANNED'
END::"RiskSegment";
