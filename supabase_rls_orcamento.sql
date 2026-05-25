-- Add missing columns to orcamentos table
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS taxa_fixa numeric DEFAULT 0;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS acabamento numeric DEFAULT 10;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS fixacao numeric DEFAULT 0.10;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS modo_calculo text DEFAULT 'grafica';
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS peso numeric DEFAULT 0;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS filamento_id integer DEFAULT NULL;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS tempo_impressao numeric DEFAULT 0;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS falhas numeric DEFAULT 10;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS roi_meses numeric DEFAULT 12;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS maquinas_ativas numeric DEFAULT 1;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS custo_materiais numeric DEFAULT 0;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS custo_maquinas numeric DEFAULT 0;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS custo_mo numeric DEFAULT 0;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS custo_fixo numeric DEFAULT 0;
