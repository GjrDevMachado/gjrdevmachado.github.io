-- Adicionar coluna modo_calculo na tabela produtos
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS modo_calculo TEXT NOT NULL DEFAULT 'grafica';
