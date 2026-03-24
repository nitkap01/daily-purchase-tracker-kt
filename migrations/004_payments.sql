-- Migration: 004_payments
-- Creates the payments table for tracking party payment status.
-- Run via: psql -f migrations/004_payments.sql

-- ── Payments ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
    id              SERIAL PRIMARY KEY,
    party_name      VARCHAR(500)    NOT NULL,
    amount          NUMERIC(12, 2)  NOT NULL DEFAULT 0,
    purchase_date   DATE            NOT NULL,
    notes           TEXT            NOT NULL DEFAULT '',
    status          VARCHAR(20)     NOT NULL DEFAULT 'pending',  -- 'pending' | 'received'
    received_at     TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_status       ON payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_party_name   ON payments (LOWER(party_name));
CREATE INDEX IF NOT EXISTS idx_payments_purchase_date ON payments (purchase_date);
