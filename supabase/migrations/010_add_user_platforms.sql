-- Platform connections for linked accounts (Bitbucket, future: GitLab, etc.)
CREATE TABLE IF NOT EXISTS user_platforms (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle         text NOT NULL,                    -- GitHub handle (lowercase, FK to users conceptually)
  platform       text NOT NULL,                    -- 'bitbucket' (future: 'gitlab', 'gitea')
  remote_login   text NOT NULL,                    -- username on linked platform
  access_token   text NOT NULL,                    -- encrypted OAuth access token
  refresh_token  text,                             -- encrypted OAuth refresh token (Bitbucket tokens expire)
  token_expires_at timestamptz,                    -- when access_token expires (null = never)
  connected_at   timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(handle, platform)                         -- one link per platform per user
);

-- Index for quick lookups by handle
CREATE INDEX IF NOT EXISTS idx_user_platforms_handle ON user_platforms (handle);

-- Enable RLS (service role bypasses, deny anon)
ALTER TABLE user_platforms ENABLE ROW LEVEL SECURITY;
CREATE POLICY deny_anon_user_platforms ON user_platforms FOR ALL TO anon USING (false);
