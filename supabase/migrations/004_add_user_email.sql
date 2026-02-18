-- Add email and notification preferences to users table.
-- Supports score-bump email notifications (issue #424).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN NOT NULL DEFAULT true;
