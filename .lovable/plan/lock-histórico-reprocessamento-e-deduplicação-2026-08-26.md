# Lock, histórico, reprocessamento e deduplicação

1. Adicionar índice único em `health_events` (`spreadsheet_id`, `row_hash`) via migração, após limpar eventuais duplicatas existentes.
2. Adicionar em `spreadsheet_configs` as colunas de lock (`sync_locked_at`, `sync_lock_owner`) via migração.
3. Criar função no banco que adquire o lock de forma atômica (só marca se estiver livre ou expirado, ex.: 10 minutos) e função que libera o lock.
4. No modo `enqueue` do job, tentar adquirir o lock antes de qualquer leitura e retornar erro claro ("sincronização já em andamento") quando não conseguir.
5. No modo `process`, renovar o lock a cada lote e liberar o lock ao concluir, falhar ou esgotar o tempo do lote.
6. Trocar as inserções de `health_events` por `upsert` com `onConflict: 'spreadsheet_id,row_hash'` e `ignoreDuplicates: true`, contando duplicatas ignoradas separadamente.
7. Passar a calcular `row_hash` a partir da chave estável da linha (número da notificação + índice da linha na planilha), não do JSON completo.
8. Garantir que cada `sync_job` grave `finished_at`, `imported_rows`, `failed_rows` e `error` em todos os caminhos de término (sucesso, falha, cancelamento por lock).
9. Adicionar modo `reset` no job: apaga `health_events` da planilha, zera `last_row_count`, limpa itens pendentes e enfileira tudo do zero, também protegido pelo lock.
10. Criar em `src/lib/data-service.ts` as funções `fetchSyncHistory(configId)` e `resetSpreadsheet(configId)`.
11. Na tela de configuração, adicionar no modal de visualização uma aba/seção "Histórico de execuções" com data/hora, importados, falhas e mensagem de erro por execução.
12. Adicionar botão "Reprocessar do zero" por linha da tabela, com diálogo de confirmação explicando que registros imutáveis serão reimportados.
13. Desabilitar os botões de sincronizar/reprocessar enquanto houver job ativo ou lock ativo para aquela planilha.
14. Validar ponta a ponta: sincronizar duas vezes seguidas e confirmar que nenhum registro é duplicado e que a segunda execução é bloqueada pelo lock.
