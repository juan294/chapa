-- Add campaign type: "announcement" (manual blast) vs "engagement" (automated template)
ALTER TABLE email_campaigns
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'announcement';

CREATE INDEX IF NOT EXISTS idx_email_campaigns_type
  ON email_campaigns(type);
