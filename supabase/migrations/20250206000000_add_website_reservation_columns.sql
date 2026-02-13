-- Add website, reservation, and social columns for Maps grounding enrichment
ALTER TABLE saved_items
ADD COLUMN IF NOT EXISTS website_uri TEXT,
ADD COLUMN IF NOT EXISTS reservation_url TEXT,
ADD COLUMN IF NOT EXISTS instagram TEXT,
ADD COLUMN IF NOT EXISTS tiktok TEXT;
