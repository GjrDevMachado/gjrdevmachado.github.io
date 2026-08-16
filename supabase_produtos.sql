-- =============================================================
-- MODULO DE PRODUTOS DE COMPRA E VENDA (revenda)
-- Execute este SQL no painel do Supabase
-- (Supabase Dashboard > SQL Editor > New Query > Run)
--
-- Cria as tabelas de produtos de revenda com preco de compra,
-- preco de venda, custos e controle de estoque, alem do registro
-- de compras e vendas realizadas. Pode ser executado mais de
-- uma vez sem causar erro.
-- =============================================================

-- 1) TABELA PRODUTO_CATEGORIAS (categorias separadas dos produtos do PDV)
CREATE TABLE IF NOT EXISTS produto_categorias (
    id BIGINT PRIMARY KEY,
    nome TEXT NOT NULL
);

ALTER TABLE produto_categorias ENABLE ROW LEVEL SECURITY;

-- 2) TABELA PRODUTOS_REVENDA (produtos para compra e venda)
CREATE TABLE IF NOT EXISTS produtos_revenda (
    id BIGINT PRIMARY KEY,
    nome TEXT NOT NULL,
    categoria_id BIGINT,
    preco_compra NUMERIC(12,2) NOT NULL DEFAULT 0,
    preco_venda NUMERIC(12,2) NOT NULL DEFAULT 0,
    custos_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    quantidade NUMERIC(12,3) NOT NULL DEFAULT 0
);

ALTER TABLE produtos_revenda ENABLE ROW LEVEL SECURITY;

-- 3) TABELA PRODUTO_TRANSACOES (compras e vendas realizadas)
CREATE TABLE IF NOT EXISTS produto_transacoes (
    id BIGINT PRIMARY KEY,
    produto_id BIGINT,
    tipo TEXT NOT NULL DEFAULT 'venda',
    data TIMESTAMPTZ DEFAULT now(),
    quantidade NUMERIC(12,3) NOT NULL DEFAULT 1,
    valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    custos_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    lucro NUMERIC(12,2) NOT NULL DEFAULT 0,
    descricao TEXT
);

ALTER TABLE produto_transacoes ENABLE ROW LEVEL SECURITY;

-- 4) Politicas RLS (usuarios autenticados)
DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'produto_categorias', 'produtos_revenda', 'produto_transacoes'
    ]
    LOOP
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
    END LOOP;
END $$;
