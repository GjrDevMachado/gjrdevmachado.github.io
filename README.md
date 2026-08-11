# gjrdevmachado.github.io

Sistema de Gestão - MOLDART 3D (PDV online com Supabase).

## Para que os dados apareçam em TODOS os aparelhos

1. Abra o painel do Supabase > **SQL Editor** > **New Query**.
2. Execute o arquivo `supabase_sync_completo.sql` (cria as tabelas `caixa` e `produto_budget` e garante as permissões de todas as tabelas).
3. Se ainda não rodou os outros scripts, execute também `supabase_user_settings.sql` e `supabase_rls_orcamento.sql`.

A partir daí, o caixa, os orçamentos, os rascunhos e os dados dos produtos são salvos no banco e aparecem em qualquer aparelho com o mesmo login.
