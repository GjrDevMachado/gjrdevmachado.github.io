CREATE TABLE IF NOT EXISTS empresa (
  id BIGINT PRIMARY KEY DEFAULT 1,
  logo TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garante que existe pelo menos a linha padrão
INSERT INTO empresa (id, logo) VALUES (1, NULL)
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE empresa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler empresa"
  ON empresa FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir/atualizar empresa"
  ON empresa FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
