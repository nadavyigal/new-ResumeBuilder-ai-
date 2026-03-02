-- Rename columns in optimizations table to match application code
-- gaps_json -> gaps_data
-- rewrite_json -> rewrite_data

ALTER TABLE public.optimizations
  RENAME COLUMN gaps_json TO gaps_data;

ALTER TABLE public.optimizations
  RENAME COLUMN rewrite_json TO rewrite_data;
