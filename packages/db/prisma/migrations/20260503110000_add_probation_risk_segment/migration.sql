-- Add PROBATION tier to RiskSegment enum.
-- New customers now start on PROBATION (score 50) and must earn SAFE (score >= 65)
-- through demonstrated payment behaviour.
-- Tier boundaries: BANNED 0-24, RISK 25-49, PROBATION 50-64, SAFE 65-79, VIP 80-100.
ALTER TYPE "RiskSegment" ADD VALUE 'PROBATION';
