-- =============================================================
-- TABELA: user_settings (configuracoes avancadas por usuario)
-- Execute este SQL no painel do Supabase > SQL Editor
-- =============================================================
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    settings_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Cada usuario so ve e edita suas proprias configuracoes
CREATE POLICY "user_settings_select" ON user_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_settings_insert" ON user_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_settings_update" ON user_settings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_settings_delete" ON user_settings
    FOR DELETE USING (auth.uid() = user_id);

-- Index para buscas rapidas por user_id
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
