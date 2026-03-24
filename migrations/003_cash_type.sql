-- Migration: Add type column to cash_entries
-- Direction: sheet is source of truth; each cash entry is either credit (money in) or debit (money out)
-- Safe to run multiple times (IF NOT EXISTS guard)

ALTER TABLE cash_entries
  ADD COLUMN IF NOT EXISTS type VARCHAR(10) NOT NULL DEFAULT 'credit'
    CHECK (type IN ('credit', 'debit'));
