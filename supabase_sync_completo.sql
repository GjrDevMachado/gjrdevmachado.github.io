-- =============================================================
-- SINCRONIZACAO COMPLETA - Execute este SQL no painel do Supabase
-- (Supabase Dashboard > SQL Editor > New Query > Run)
--
-- Garante que TODOS os dados sejam salvos no banco e visiveis em
-- TODOS os aparelhos (caixa, produtos, orcamentos, rascunhos, etc.).
-- Pode ser executado mais de uma vez sem causar erro.
-- =============================================================

-- 1) TABELA CAIXA (saldo compartilhado entre todos os aparelhos)
CREATE TABLE IF NOT EXISTS caixa (
    id INTEGER PRIMARY KEY,
    saldo NUMERIC(12,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE caixa ENABLE ROW LEVEL SECURITY;

-- 2) TABELA PRODUTO_BUDGET (dados de orcamento de cada produto)
CREATE TABLE IF NOT EXISTS produto_budget (
    produto_id BIGINT PRIMARY KEY,
    budget_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE produto_budget ENABLE ROW LEVEL SECURITY;

-- 3) TABELA PRODUTO_CATEGORIAS (categorias dos produtos de compra/venda)
CREATE TABLE IF NOT EXISTS produto_categorias (
    id BIGINT PRIMARY KEY,
    nome TEXT NOT NULL
);

ALTER TABLE produto_categorias ENABLE ROW LEVEL SECURITY;

-- 4) TABELA PRODUTOS_REVENDA (produtos para compra e revenda com estoque)
CREATE TABLE IF NOT EXISTS produtos_revenda (
    id BIGINT PRIMARY KEY,
    nome TEXT NOT NULL,
    categoria_id BIGINT,
    preco_compra NUMERIC(12,2) NOT NULL DEFAULT 0,
    preco_venda NUMERIC(12,2) NOT NULL DEFAULT 0,
    quantidade NUMERIC(12,2) NOT NULL DEFAULT 0,
    custos_json JSONB NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE produtos_revenda ENABLE ROW LEVEL SECURITY;

-- 5) TABELA PRODUTO_TRANSACOES (compras e vendas registradas)
CREATE TABLE IF NOT EXISTS produto_transacoes (
    id BIGINT PRIMARY KEY,
    produto_id BIGINT,
    tipo TEXT NOT NULL DEFAULT 'venda',
    data TIMESTAMPTZ DEFAULT now(),
    quantidade NUMERIC(12,2) NOT NULL DEFAULT 0,
    valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    custos_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    lucro NUMERIC(12,2) NOT NULL DEFAULT 0,
    descricao TEXT
);

ALTER TABLE produto_transacoes ENABLE ROW LEVEL SECURITY;

-- 6) Garante RLS + politicas para TODAS as tabelas do sistema
--    (se a politica ja existir, nao cria de novo)
DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'caixa', 'produto_budget',
        'categorias', 'produtos', 'clientes', 'insumos',
        'transacoes', 'itens_transacao',
        'maquinas', 'insumos_orcamento', 'filamentos', 'orcamentos',
        'rascunhos', 'empresa',
        'servico_categorias', 'servicos', 'servico_transacoes',
        'produto_categorias', 'produtos_revenda', 'produto_transacoes'
    ]
    LOOP
        IF to_regclass(format('public.%I', t)) IS NOT NULL THEN

            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE schemaname = 'public' AND tablename = t
                  AND policyname = t || '_select_policy'
            ) THEN
                EXECUTE format(
                    'CREATE POLICY %I ON public.%I FOR SELECT USING (auth.role() = ''authenticated'')',
                    t || '_select_policy', t
                );
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE schemaname = 'public' AND tablename = t
                  AND policyname = t || '_insert_policy'
            ) THEN
                EXECUTE format(
                    'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (auth.role() = ''authenticated'')',
                    t || '_insert_policy', t
                );
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE schemaname = 'public' AND tablename = t
                  AND policyname = t || '_update_policy'
            ) THEN
                EXECUTE format(
                    'CREATE POLICY %I ON public.%I FOR UPDATE USING (auth.role() = ''authenticated'')',
                    t || '_update_policy', t
                );
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE schemaname = 'public' AND tablename = t
                  AND policyname = t || '_delete_policy'
            ) THEN
                EXECUTE format(
                    'CREATE POLICY %I ON public.%I FOR DELETE USING (auth.role() = ''authenticated'')',
                    t || '_delete_policy', t
                );
            END IF;

        END IF;
    END LOOP;
END $$;

-- 4) Registro inicial do caixa (nao sobrescreve um saldo existente)
INSERT INTO caixa (id, saldo) VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;
