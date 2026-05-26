-- Add missing columns to orcamentos table
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS filamentos_json TEXT DEFAULT '[]';
