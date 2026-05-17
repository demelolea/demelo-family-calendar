-- ============================================================
-- De Melo Family Calendar — Supabase Schema
-- Run this in Supabase > SQL Editor
-- ============================================================

-- Events table (personal events + family trips)
CREATE TABLE IF NOT EXISTS events (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT        NOT NULL,
  person      TEXT        NOT NULL,  -- 'jim' | 'isabelle' | 'elissa' | 'ines' | 'lea' | 'family'
  start_date  DATE        NOT NULL,
  end_date    DATE        NOT NULL,
  location    TEXT,
  trip_type   TEXT,                  -- 'equestrian' | 'family_trip' | 'other'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_events" ON events
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- -------------------------------------------------------

-- Locations table (one row per family member, upserted)
CREATE TABLE IF NOT EXISTS locations (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  person            TEXT        UNIQUE NOT NULL,
  current_location  TEXT        NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_locations" ON locations
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- -------------------------------------------------------

-- Phoebe schedule
CREATE TABLE IF NOT EXISTS phoebe_schedule (
  id          UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  with_whom   TEXT  NOT NULL,
  start_date  DATE  NOT NULL,
  end_date    DATE  NOT NULL,
  notes       TEXT
);

ALTER TABLE phoebe_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_phoebe" ON phoebe_schedule
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- -------------------------------------------------------

-- Guest visits
CREATE TABLE IF NOT EXISTS guests (
  id              UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_name      TEXT  NOT NULL,
  house           TEXT  NOT NULL CHECK (house IN ('aix', 'geneva')),
  arrival_date    DATE  NOT NULL,
  departure_date  DATE  NOT NULL
);

ALTER TABLE guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_guests" ON guests
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- ============================================================
-- Enable Realtime
-- (If tables are already in the publication this is a no-op)
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE locations;
ALTER PUBLICATION supabase_realtime ADD TABLE phoebe_schedule;
ALTER PUBLICATION supabase_realtime ADD TABLE guests;

-- ============================================================
-- Seed data
-- ============================================================

-- Default locations (Aix for everyone)
INSERT INTO locations (person, current_location) VALUES
  ('jim',      'Aix-en-Provence'),
  ('isabelle', 'Aix-en-Provence'),
  ('elissa',   'Aix-en-Provence'),
  ('ines',     'Aix-en-Provence'),
  ('lea',      'Aix-en-Provence')
ON CONFLICT (person) DO NOTHING;

-- Pre-loaded family trips
INSERT INTO events (title, person, start_date, end_date, location, trip_type) VALUES
  ('Monaco LGCT',     'family', '2026-07-02', '2026-07-05', 'Monaco', 'equestrian'),
  ('Dublin Horse Show','family', '2026-08-06', '2026-08-10', 'Dublin', 'equestrian');
