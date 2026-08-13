# Plan: Painéis Personalizados (Salvar Filtros e Comparações)

Adicionar funcionalidade para salvar estados específicos do Dashboard (filtros de data, planilha selecionada e modo de comparação) como "Painéis" nomeados.

## Ações

### 1. Banco de Dados e API
- Criar tabela `public.dashboards` para armazenar as configurações dos painéis.
- Colunas: `id`, `name` (string), `config_id` (uuid, opcional), `is_comparison` (boolean), `filters` (jsonb), `created_at`.
- Adicionar RLS e permissões para `authenticated` e `service_role`.
- Adicionar funções em `src/lib/data-service.ts` para CRUD de painéis.

### 2. UI: Dashboard (`src/routes/index.tsx`)
- Adicionar botão "Salvar como Painel" no header do Dashboard.
- O botão deve habilitar apenas quando houver filtros aplicados ou modo de comparação ativo.
- Implementar um `Dialog` para capturar o nome do novo painel.
- Adicionar suporte a `searchParams` via TanStack Router para carregar um painel salvo (ex: `/?panelId=...`).
- Quando um `panelId` estiver presente:
  - Carregar configurações do painel via query.
  - Aplicar filtros e modo de comparação.
  - No modo "Visualizar" (`readonly=true`), ocultar controles de filtro e botões de edição.

### 3. UI: Nova Tela de Painéis (`src/routes/panels.tsx`)
- Criar nova rota `/panels`.
- Exibir tabela com os painéis salvos: Nome, Data de Criação, Ações.
- Botões de ação:
  - **Visualizar**: Link para `/?panelId=...&readonly=true`.
  - **Editar**: Link para `/?panelId=...`.
  - **Excluir**: Chamar função de remoção no banco.

### 4. Navegação (`src/routes/__root.tsx`)
- Adicionar link "Painéis" (ícone `Layout`) na barra lateral.

## Detalhes Técnicos
- **Estrutura do JSON `filters`**: `{ start1, end1, start2, end2 }`.
- **TanStack Router**: Usar `validateSearch` na rota index para gerenciar `panelId` e `readonly`.
- **Estilos**: Manter a consistência com Shadcn UI e Tailwind.

```text
Tabela Dashboards:
| id (uuid) | name (text) | config_id (uuid?) | is_comparison (bool) | filters (jsonb) | created_at |
```
