-- Add ats_quick_wins column to anonymous_ats_scores table
ALTER TABLE anonymous_ats_scores
ADD COLUMN IF NOT EXISTS ats_quick_wins JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN anonymous_ats_scores.ats_quick_wins IS 'AI-generated quick win suggestions with before/after text improvements';
