-- =============================================================
-- MODULO DE SERVICOS (Uber, Bicos, etc.)
-- Execute este SQL no painel do Supabase
-- (Supabase Dashboard > SQL Editor > New Query > Run)
--
-- Cria as tabelas de servicos com custos (combustivel, manutencao, etc.)
-- e registros de servicos realizados. Pode ser executado mais de
-- uma vez sem causar erro.
-- =============================================================

-- 1) TABELA SERVICO_CATEGORIAS (ex: Uber, Bicos, Freelancer, etc.)
CREATE TABLE IF NOT EXISTS servico_categorias (
    id BIGINT PRIMARY KEY,
    nome TEXT NOT NULL
);

ALTER TABLE servico_categorias ENABLE ROW LEVEL SECURITY;

-- 2) TABELA SERVICOS (nome, categoria e custos padrao)
CREATE TABLE IF NOT EXISTS servicos (
    id BIGINT PRIMARY KEY,
    nome TEXT NOT NULL,
    categoria_id BIGINT,
    valor_base NUMERIC(12,2) NOT NULL DEFAULT 0,
    custos_json JSONB NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;

-- 3) TABELA SERVICO_TRANSACOES (servicos realizados / vendidos)
CREATE TABLE IF NOT EXISTS servico_transacoes (
    id BIGINT PRIMARY KEY,
    servico_id BIGINT,
    data TIMESTAMPTZ DEFAULT now(),
    valor_recebido NUMERIC(12,2) NOT NULL DEFAULT 0,
    custos_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    lucro NUMERIC(12,2) NOT NULL DEFAULT 0,
    descricao TEXT
);

ALTER TABLE servico_transacoes ENABLE ROW LEVEL SECURITY;

-- 4) Politicas RLS (usuarios autenticados)
DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'servico_categorias', 'servicos', 'servico_transacoes'
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
E