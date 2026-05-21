-- ============================================================
-- SCRIPT COMPLETO PARA CRIAR AS TABELAS DO SISTEMA MOLDART 3D
-- Execute no SQL Editor do Supabase (https://supabase.com)
-- ============================================================

-- 1. CATEGORIAS
CREATE TABLE IF NOT EXISTS categorias (
    id BIGINT PRIMARY KEY,
    nome TEXT NOT NULL
);

ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver categorias" ON categorias
    FOR SELECT USING (true);
CREATE POLICY "Todos podem inserir categorias" ON categorias
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Todos podem atualizar categorias" ON categorias
    FOR UPDATE USING (true);
CREATE POLICY "Todos podem excluir categorias" ON categorias
    FOR DELETE USING (true);

-- 2. PRODUTOS
CREATE TABLE IF NOT EXISTS produtos (
    id BIGINT PRIMARY KEY,
    nome TEXT NOT NULL,
    preco DECIMAL(10,2) NOT NULL,
    custo DECIMAL(10,2) DEFAULT 0,
    categoria_id BIGINT DEFAULT 1,
    codigo_barras TEXT
);

ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver produtos" ON produtos
    FOR SELECT USING (true);
CREATE POLICY "Todos podem inserir produtos" ON produtos
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Todos podem atualizar produtos" ON produtos
    FOR UPDATE USING (true);
CREATE POLICY "Todos podem excluir produtos" ON produtos
    FOR DELETE USING (true);

-- 3. CLIENTES
CREATE TABLE IF NOT EXISTS clientes (
    id BIGINT PRIMARY KEY,
    nome TEXT NOT NULL,
    contato TEXT DEFAULT ''
);

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver clientes" ON clientes
    FOR SELECT USING (true);
CREATE POLICY "Todos podem inserir clientes" ON clientes
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Todos podem atualizar clientes" ON clientes
    FOR UPDATE USING (true);
CREATE POLICY "Todos podem excluir clientes" ON clientes
    FOR DELETE USING (true);

-- 4. INSUMOS (estoque)
CREATE TABLE IF NOT EXISTS insumos (
    id BIGINT PRIMARY KEY,
    nome TEXT NOT NULL,
    fornecedor TEXT DEFAULT '',
    estoque DECIMAL(10,2) DEFAULT 0,
    unidade TEXT DEFAULT 'un',
    custo_total DECIMAL(10,2) DEFAULT 0,
    data_recebimento TEXT
);

ALTER TABLE insumos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver insumos" ON insumos
    FOR SELECT USING (true);
CREATE POLICY "Todos podem inserir insumos" ON insumos
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Todos podem atualizar insumos" ON insumos
    FOR UPDATE USING (true);
CREATE POLICY "Todos podem excluir insumos" ON insumos
    FOR DELETE USING (true);

-- 5. TRANSACOES (vendas, recebimentos, estornos)
CREATE TABLE IF NOT EXISTS transacoes (
    id BIGINT PRIMARY KEY,
    tipo TEXT NOT NULL,
    cliente_id BIGINT,
    valor_total DECIMAL(10,2) DEFAULT 0,
    custo_total DECIMAL(10,2) DEFAULT 0,
    desconto_geral DECIMAL(10,2) DEFAULT 0,
    descricao TEXT,
    metodo_pagamento TEXT,
    parcelas INTEGER DEFAULT 1,
    status TEXT DEFAULT 'Pago',
    data_venda TIMESTAMPTZ DEFAULT NOW(),
    estornada BOOLEAN DEFAULT FALSE
);

ALTER TABLE transacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver transacoes" ON transacoes
    FOR SELECT USING (true);
CREATE POLICY "Todos podem inserir transacoes" ON transacoes
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Todos podem atualizar transacoes" ON transacoes
    FOR UPDATE USING (true);
CREATE POLICY "Todos podem excluir transacoes" ON transacoes
    FOR DELETE USING (true);

-- 6. ITENS_TRANSACAO (itens de cada venda)
CREATE TABLE IF NOT EXISTS itens_transacao (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    transacao_id BIGINT NOT NULL,
    produto_id BIGINT,
    quantidade INTEGER DEFAULT 1,
    preco_unitario DECIMAL(10,2) DEFAULT 0,
    desconto_item DECIMAL(10,2) DEFAULT 0
);

ALTER TABLE itens_transacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver itens_transacao" ON itens_transacao
    FOR SELECT USING (true);
CREATE POLICY "Todos podem inserir itens_transacao" ON itens_transacao
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Todos podem atualizar itens_transacao" ON itens_transacao
    FOR UPDATE USING (true);
CREATE POLICY "Todos podem excluir itens_transacao" ON itens_transacao
    FOR DELETE USING (true);

-- 7. MAQUINAS (para orçamentos)
CREATE TABLE IF NOT EXISTS maquinas (
    id BIGINT PRIMARY KEY,
    nome TEXT NOT NULL,
    potencia DECIMAL(10,2) DEFAULT 0,
    preco_luz DECIMAL(10,2) DEFAULT 1,
    valor_maquina DECIMAL(10,2) DEFAULT 0,
    anos_uso DECIMAL(10,2) DEFAULT 0,
    horas_dia DECIMAL(10,2) DEFAULT 0,
    depreciacao DECIMAL(10,2) DEFAULT 0,
    custo_hora DECIMAL(10,4) DEFAULT 0
);

ALTER TABLE maquinas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver maquinas" ON maquinas
    FOR SELECT USING (true);
CREATE POLICY "Todos podem inserir maquinas" ON maquinas
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Todos podem atualizar maquinas" ON maquinas
    FOR UPDATE USING (true);
CREATE POLICY "Todos podem excluir maquinas" ON maquinas
    FOR DELETE USING (true);

-- 8. INSUMOS_ORCAMENTO (catálogo de insumos para orçamentos)
CREATE TABLE IF NOT EXISTS insumos_orcamento (
    id BIGINT PRIMARY KEY,
    nome TEXT NOT NULL,
    preco_pacote DECIMAL(10,2) DEFAULT 0,
    qtd_pacote DECIMAL(10,2) DEFAULT 0,
    custo_unitario DECIMAL(10,4) DEFAULT 0
);

ALTER TABLE insumos_orcamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver insumos_orcamento" ON insumos_orcamento
    FOR SELECT USING (true);
CREATE POLICY "Todos podem inserir insumos_orcamento" ON insumos_orcamento
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Todos podem atualizar insumos_orcamento" ON insumos_orcamento
    FOR UPDATE USING (true);
CREATE POLICY "Todos podem excluir insumos_orcamento" ON insumos_orcamento
    FOR DELETE USING (true);

-- 9. ORCAMENTOS
CREATE TABLE IF NOT EXISTS orcamentos (
    id BIGINT PRIMARY KEY,
    data TEXT,
    cliente_nome TEXT,
    cliente_id BIGINT,
    produto TEXT,
    quantidade DECIMAL(10,2) DEFAULT 1,
    custo_total DECIMAL(10,2) DEFAULT 0,
    preco_sugerido DECIMAL(10,2) DEFAULT 0,
    preco_final DECIMAL(10,2) DEFAULT 0,
    lucro DECIMAL(10,2) DEFAULT 0,
    margem DECIMAL(10,2) DEFAULT 0,
    taxa_plataforma DECIMAL(10,2) DEFAULT 0,
    taxa_fixa DECIMAL(10,2) DEFAULT 0,
    tempo_gasto DECIMAL(10,2) DEFAULT 0,
    valor_hora DECIMAL(10,2) DEFAULT 0,
    materiais_json TEXT,
    maquinas_json TEXT,
    custos_fixos_json TEXT,
    modo_calculo TEXT DEFAULT 'grafica',
    peso DECIMAL(10,2) DEFAULT 0,
    filamento_id INTEGER,
    tempo_impressao DECIMAL(10,2) DEFAULT 0,
    falhas DECIMAL(10,2) DEFAULT 10,
    acabamento DECIMAL(10,2) DEFAULT 10,
    fixacao DECIMAL(10,2) DEFAULT 0.10,
    roi_meses DECIMAL(10,2) DEFAULT 12,
    maquinas_ativas DECIMAL(10,2) DEFAULT 1,
    custo_materiais DECIMAL(10,2) DEFAULT 0,
    custo_maquinas DECIMAL(10,2) DEFAULT 0,
    custo_mo DECIMAL(10,2) DEFAULT 0,
    custo_fixo DECIMAL(10,2) DEFAULT 0,
    status TEXT DEFAULT 'rascunho',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE orcamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver orcamentos" ON orcamentos
    FOR SELECT USING (true);
CREATE POLICY "Todos podem inserir orcamentos" ON orcamentos
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Todos podem atualizar orcamentos" ON orcamentos
    FOR UPDATE USING (true);
CREATE POLICY "Todos podem excluir orcamentos" ON orcamentos
    FOR DELETE USING (true);
