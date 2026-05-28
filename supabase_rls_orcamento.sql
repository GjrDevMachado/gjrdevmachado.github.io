-- Add missing columns to orcamentos table
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS filamentos_json TEXT DEFAULT '[]';
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'rascunho';

-- Create rascunhos table for auto-save drafts (7-day expiry)
CREATE TABLE IF NOT EXISTS rascunhos (
    id BIGINT PRIMARY KEY,
    data TEXT,
    cliente_nome TEXT,
    cliente_id TEXT,
    produto TEXT,
    quantidade NUMERIC DEFAULT 1,
    tempo_gasto NUMERIC DEFAULT 0,
    valor_hora NUMERIC DEFAULT 0,
    margem NUMERIC DEFAULT 0,
    taxa_plataforma NUMERIC DEFAULT 0,
    taxa_fixa NUMERIC DEFAULT 0,
    aluguel NUMERIC DEFAULT 0,
    internet NUMERIC DEFAULT 0,
    mei NUMERIC DEFAULT 0,
    outros NUMERIC DEFAULT 0,
    horas_dia NUMERIC DEFAULT 1,
    dias_mes NUMERIC DEFAULT 1,
    modo_calculo TEXT DEFAULT 'grafica',
    peso NUMERIC DEFAULT 0,
    filamento_id BIGINT,
    filamentos_json TEXT DEFAULT '[]',
    tempo_impressao NUMERIC DEFAULT 0,
    falhas NUMERIC DEFAULT 10,
    acabamento NUMERIC DEFAULT 10,
    fixacao NUMERIC DEFAULT 0.10,
    roi_meses NUMERIC DEFAULT 12,
    maquinas_ativas NUMERIC DEFAULT 1,
    custo_fixo_3d NUMERIC DEFAULT 0,
    preco_luz NUMERIC DEFAULT 0,
    horas_dia_3d NUMERIC DEFAULT 8,
    dias_mes_3d NUMERIC DEFAULT 22,
    materiais_json TEXT DEFAULT '[]',
    maquinas_json TEXT DEFAULT '[]',
    custos_fixos_json TEXT DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and add policies for rascunhos
ALTER TABLE rascunhos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados podem ler rascunhos"
ON rascunhos FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Usuarios autenticados podem inserir rascunhos"
ON rascunhos FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Usuarios autenticados podem atualizar rascunhos"
ON rascunhos FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Usuarios autenticados podem deletar rascunhos"
ON rascunhos FOR DELETE
TO authenticated
USING (true);
