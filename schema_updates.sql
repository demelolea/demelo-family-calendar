-- ============================================================
-- De Melo Family Calendar — Schema Updates
-- Run this in Supabase > SQL Editor AFTER the original schema.sql
-- ============================================================

-- Add transport / travel fields to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS travel_direction  TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS transport_type    TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS transport_station TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS transport_time    TEXT;

-- Add "invited by" field to guests
ALTER TABLE guests ADD COLUMN IF NOT EXISTS invited_by TEXT;

-- -------------------------------------------------------
-- Room allocations for Aix-en-Provence house
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS room_allocations (
  id             UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  room           TEXT  NOT NULL,   -- 'master' | 'lea' | 'middle' | 'elissa' | 'ines' | 'terrace'
  occupant_name  TEXT  NOT NULL,
  start_date     DATE  NOT NULL,
  end_date       DATE  NOT NULL,
  notes          TEXT
);

ALTER TABLE room_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_room_allocations" ON room_allocations
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- Enable realtime for the new table
ALTER PUBLICATION supabase_realtime ADD TABLE room_allocations;
