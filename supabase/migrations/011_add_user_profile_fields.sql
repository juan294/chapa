-- Add profile display fields to users table.
-- Updated on OAuth login and badge render so admin dashboard
-- always has the latest known profile data.

ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
