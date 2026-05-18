-- schema_updates_v8.sql
-- Push notification subscriptions for PWA Web Push API

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  person       TEXT        NOT NULL,
  endpoint     TEXT        NOT NULL UNIQUE,
  subscription JSONB       NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_person_idx ON push_subscriptions (person);

-- Allow all operations (family-only private app, no sensitive data)
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON push_subscriptions FOR ALL USING (true) WITH CHECK (true);
