-- Migration: 015_create_tool_insights
-- Description: Table for AI tool insights data (Craft dimension scoring)
-- Date: 2026-03-13

CREATE TABLE tool_insights (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  handle TEXT NOT NULL,
  tool TEXT NOT NULL,
  report_start DATE NOT NULL,
  report_end DATE NOT NULL,
  raw_data JSONB NOT NULL,
  proficiency NUMERIC(5,2) NOT NULL,
  effectiveness NUMERIC(5,2) NOT NULL,
  sophistication NUMERIC(5,2) NOT NULL,
  craft_score NUMERIC(5,2) NOT NULL,
  craft_tier TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (handle, tool)
);

-- Query pattern: "get insights for a handle"
CREATE INDEX idx_tool_insights_handle
  ON tool_insights (handle);

-- RLS: server-side only (service role key bypasses RLS)
ALTER TABLE tool_insights ENABLE ROW LEVEL SECURITY;
