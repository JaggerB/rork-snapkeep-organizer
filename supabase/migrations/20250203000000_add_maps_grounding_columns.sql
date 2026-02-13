-- Add Google Maps grounding columns to saved_items
ALTER TABLE saved_items
ADD COLUMN IF NOT EXISTS place_id TEXT,
ADD COLUMN IF NOT EXISTS place_maps_uri TEXT,
ADD COLUMN IF NOT EXISTS rating TEXT,
ADD COLUMN IF NOT EXISTS open_now BOOLEAN,
ADD COLUMN IF NOT EXISTS opening_hours TEXT,
ADD COLUMN IF NOT EXISTS review_snippet TEXT;
