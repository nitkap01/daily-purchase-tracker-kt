-- Migration: 002_example_template
-- Copy this file and rename to 003_your_change.sql for future migrations.
-- Follow the pattern: NNN_short_description.sql (zero-padded 3 digits)

-- Example: add a category column to purchases
-- ALTER TABLE purchases ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT '';
