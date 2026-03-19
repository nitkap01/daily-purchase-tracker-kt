-- Migration: 001_initial
-- Creates all tables required for Kapoor Trader Daily Purchase Tracker.
-- Run via: scripts/setup_db.py  OR  psql -f migrations/001_initial.sql

-- ── Purchases ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchases (
    id           SERIAL PRIMARY KEY,
    date         DATE            NOT NULL,
    item         VARCHAR(500)    NOT NULL,
    quantity     NUMERIC(12, 3)  NOT NULL DEFAULT 0,
    price        NUMERIC(12, 2)  NOT NULL DEFAULT 0,
    amount       NUMERIC(12, 2)  NOT NULL DEFAULT 0,
    synced_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases (date);
CREATE INDEX IF NOT EXISTS idx_purchases_item ON purchases (item);

-- ── Cash Entries ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cash_entries (
    id           SERIAL PRIMARY KEY,
    date         DATE            NOT NULL,
    amount       NUMERIC(12, 2)  NOT NULL DEFAULT 0,
    note         VARCHAR(500)    NOT NULL DEFAULT '',
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_entries_date ON cash_entries (date);

-- ── Sync Log ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_log (
    id           SERIAL PRIMARY KEY,
    direction    VARCHAR(20)     NOT NULL,   -- 'sheet_to_db' | 'db_to_sheet'
    rows_synced  INTEGER         NOT NULL DEFAULT 0,
    status       VARCHAR(20)     NOT NULL,   -- 'success' | 'failed'
    message      TEXT,
    synced_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
