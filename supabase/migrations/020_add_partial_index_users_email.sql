-- Partial index for dbGetUsersWithEmail() query pattern.
-- Covers: WHERE email_notifications = true AND email IS NOT NULL
-- Avoids full table scan on the users table when syncing email audience.

CREATE INDEX IF NOT EXISTS idx_users_email_notifications_active
  ON users (email)
  WHERE email IS NOT NULL AND email_notifications = true;
