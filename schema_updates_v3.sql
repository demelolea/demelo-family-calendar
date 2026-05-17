-- ============================================================
-- De Melo Family Calendar — Schema Updates v3
-- Run in Supabase > SQL Editor AFTER schema_updates_v2.sql
-- ============================================================

-- Add room allocation field to guests
-- Stores which Aix room the guest is assigned to (null = unallocated)
ALTER TABLE guests ADD COLUMN IF NOT EXISTS allocated_room TEXT;
