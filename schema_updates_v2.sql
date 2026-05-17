-- ============================================================
-- De Melo Family Calendar — Schema Updates v2
-- Run in Supabase > SQL Editor AFTER schema_updates.sql
-- ============================================================

-- Stays table (personal schedule / location history)
CREATE TABLE IF NOT EXISTS stays (
  id                  UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  person              TEXT  NOT NULL,          -- lowercase: 'jim', 'isabelle', etc.
  location            TEXT  NOT NULL,
  start_date          DATE  NOT NULL,
  end_date            DATE  NOT NULL,
  arr_transport_type  TEXT,                    -- 'flight' | 'train' | 'car'
  arr_station         TEXT,
  arr_time            TEXT,
  dep_transport_type  TEXT,
  dep_station         TEXT,
  dep_time            TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_stays" ON stays
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE stays;

-- -------------------------------------------------------
-- Trip RSVPs
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS trip_rsvps (
  id        UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id   UUID  NOT NULL,       -- references events.id
  person    TEXT  NOT NULL,       -- lowercase person key
  response  TEXT  NOT NULL CHECK (response IN ('yes', 'no', 'maybe')),
  UNIQUE (trip_id, person)
);

ALTER TABLE trip_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_trip_rsvps" ON trip_rsvps
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE trip_rsvps;
