-- Migration: 005_cheques
-- Creates the cheques table for tracking cheque payment status.
-- Run via: psql -f migrations/005_cheques.sql

CREATE TABLE IF NOT EXISTS cheques (
    id              SERIAL PRIMARY KEY,
    party_name      VARCHAR(500)    NOT NULL,
    amount          NUMERIC(12, 2)  NOT NULL DEFAULT 0,
    cheque_number   VARCHAR(100)    NOT NULL DEFAULT '',
    cheque_date     DATE            NOT NULL,
    status          VARCHAR(20)     NOT NULL DEFAULT 'pending',  -- 'pending' | 'cleared' | 'rejected'
    cleared_at      TIMESTAMP WITH TIME ZONE,
    rejected_at     TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cheques_status      ON cheques (status);
CREATE INDEX IF NOT EXISTS idx_cheques_party_name  ON cheques (LOWER(party_name));
CREATE INDEX IF NOT EXISTS idx_cheques_cheque_date ON cheques (cheque_date);
CREATE INDEX IF NOT EXISTS idx_cheques_amount      ON cheques (amount);
