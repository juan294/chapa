-- Campaign metadata
CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  preview_text TEXT,
  headline TEXT NOT NULL,
  body_text TEXT NOT NULL,
  features JSONB DEFAULT '[]'::jsonb,
  cta_text TEXT NOT NULL DEFAULT 'See What''s New',
  cta_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Per-recipient send tracking
CREATE TABLE IF NOT EXISTS campaign_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  handle TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error TEXT,
  UNIQUE(campaign_id, handle)
);

CREATE INDEX IF NOT EXISTS idx_campaign_sends_campaign_status
  ON campaign_sends(campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_email_campaigns_status
  ON email_campaigns(status);

ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_sends ENABLE ROW LEVEL SECURITY;
