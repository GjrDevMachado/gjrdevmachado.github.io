-- =============================================================
-- TABELA: filamentos (catálogo de filamentos para impressão 3D)
-- =============================================================
CREATE TABLE IF NOT EXISTS filamentos (
    id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL,
    preco_kg NUMERIC(10,2) NOT NULL
);

ALTER TABLE filamentos ENABLE ROW LEVEL SECURITY;

-- Política para leitura (usuários autenticados)
CREATE POLICY "filamentos_select_policy" ON filamentos
    FOR SELECT USING (auth.role() = 'authenticated');

-- Política para inserção (usuários autenticados)
CREATE POLICY "filamentos_insert_policy" ON filamentos
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Política para atualização (usuários autenticados)
CREATE POLICY "filamentos_update_policy" ON filamentos
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Política para exclusão (usuários autenticados)
CREATE POLICY "filamentos_delete_policy" ON filamentos
    FOR DELETE USING (auth.role() = 'authenticated');
