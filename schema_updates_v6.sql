-- schema_updates_v6.sql
-- Adds confirmed/tentative status to stays

ALTER TABLE stays
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'tentative'));
