import { toast } from "sonner";

export type FriendlyError = {
  /** Título curto, direto ao ponto */
  title: string;
  /** Explicação em linguagem clara do que aconteceu */
  message: string;
  /** O que o usuário pode fazer para resolver */
  hint?: string;
  /** Mensagem técnica original (para copiar/reportar) */
  details?: string;
  /** Código técnico quando disponível */
  code?: string;
};

/** Contexto opcional para deixar a mensagem mais específica */
export type ErrorContext =
  | "load-events"
  | "load-configs"
  | "save-config"
  | "delete-config"
  | "sync"
  | "geocode"
  | "save-panel"
  | "delete-panel"
  | "generic";

const CONTEXT_TITLES: Record<ErrorContext, string> = {
  "load-events": "Não foi possível carregar as notificações",
  "load-configs": "Não foi possível carregar as planilhas configuradas",
  "save-config": "Não foi possível salvar a planilha",
  "delete-config": "Não foi possível excluir a planilha",
  sync: "A sincronização não pôde ser concluída",
  geocode: "Não foi possível geolocalizar o endereço",
  "save-panel": "Não foi possível salvar o painel",
  "delete-panel": "Não foi possível excluir o painel",
  generic: "Ocorreu um erro",
};

function rawMessage(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  const anyErr = err as any;
  return (
    anyErr?.message ||
    anyErr?.error_description ||
    anyErr?.error ||
    anyErr?.hint ||
    (() => {
      try {
        return JSON.stringify(anyErr);
      } catch {
        return String(anyErr);
      }
    })()
  );
}

function rawCode(err: unknown): string | undefined {
  const anyErr = err as any;
  const code = anyErr?.code ?? anyErr?.status ?? anyErr?.statusCode;
  return code !== undefined && code !== null ? String(code) : undefined;
}

/**
 * Converte qualquer erro (Supabase, fetch, validação, sincronização)
 * em uma mensagem explicativa em português.
 */
export function describeError(err: unknown, context: ErrorContext = "generic"): FriendlyError {
  const raw = rawMessage(err);
  const code = rawCode(err);
  const lower = raw.toLowerCase();
  const base = { details: raw || undefined, code };
  const title = CONTEXT_TITLES[context];

  // --- Rede / conectividade ---
  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("load failed") ||
    lower.includes("err_internet_disconnected")
  ) {
    return {
      ...base,
      title,
      message:
        "O aplicativo não conseguiu se comunicar com o servidor. Isso normalmente indica falta de conexão de internet ou um bloqueio de rede.",
      hint: "Verifique sua conexão e tente novamente em alguns segundos.",
    };
  }

  if (lower.includes("timeout") || lower.includes("timed out") || code === "504" || code === "408") {
    return {
      ...base,
      title,
      message:
        "A operação demorou mais do que o permitido e foi interrompida antes de terminar.",
      hint:
        context === "sync"
          ? "A sincronização é retomada de onde parou: clique em Sincronizar novamente para continuar processando os registros restantes."
          : "Tente novamente. Se persistir, reduza o intervalo de datas do filtro.",
    };
  }

  // --- Permissões / autenticação (Supabase / PostgREST) ---
  if (code === "42501" || lower.includes("row-level security") || lower.includes("permission denied")) {
    return {
      ...base,
      title,
      message:
        "O banco de dados recusou a operação por falta de permissão nas regras de acesso (RLS) da tabela.",
      hint: "Se você não estiver autenticado, faça login novamente. Caso o erro continue, as permissões da tabela precisam ser revisadas.",
    };
  }

  if (code === "401" || code === "403" || lower.includes("jwt") || lower.includes("unauthorized")) {
    return {
      ...base,
      title,
      message: "Sua sessão expirou ou não tem autorização para executar esta ação.",
      hint: "Recarregue a página e faça login novamente.",
    };
  }

  // --- Integridade de dados ---
  if (code === "23505" || lower.includes("duplicate key")) {
    return {
      ...base,
      title,
      message: "Já existe um registro com estes mesmos dados, e o sistema não permite duplicidade.",
      hint: "Altere o nome/identificador e tente salvar novamente.",
    };
  }

  if (code === "23503" || lower.includes("foreign key")) {
    return {
      ...base,
      title,
      message:
        "Este registro está vinculado a outros dados (por exemplo, notificações importadas) e por isso não pode ser alterado ou removido diretamente.",
      hint: "Remova primeiro os dados dependentes ou desative o registro em vez de excluí-lo.",
    };
  }

  if (code === "23502" || lower.includes("not-null") || lower.includes("violates not-null")) {
    return {
      ...base,
      title,
      message: "Um campo obrigatório ficou em branco.",
      hint: "Preencha todos os campos obrigatórios (nome e URL da planilha) antes de salvar.",
    };
  }

  if (code === "22P02" || lower.includes("invalid input syntax")) {
    return {
      ...base,
      title,
      message: "Um dos valores enviados está em formato inválido (por exemplo, uma data ou número mal formatado).",
      hint: "Revise as datas no formato dd/mm/aaaa e os campos numéricos.",
    };
  }

  if (code === "PGRST116" || lower.includes("results contain 0 rows")) {
    return {
      ...base,
      title,
      message: "O registro solicitado não foi encontrado — ele pode ter sido excluído por outro usuário.",
      hint: "Atualize a página para ver a lista mais recente.",
    };
  }

  if (lower.includes("does not exist") && lower.includes("column")) {
    return {
      ...base,
      title,
      message:
        "O sistema tentou usar um campo que não existe mais no banco de dados. Isso indica uma diferença entre o app e a estrutura das tabelas.",
      hint: "Recarregue a página; se o erro persistir, a estrutura do banco precisa ser atualizada.",
    };
  }

  // --- Planilha / sincronização ---
  if (lower.includes("estrutura da planilha inválida") || lower.includes("coluna")) {
    return {
      ...base,
      title: "A planilha está fora do formato esperado",
      message:
        "As colunas obrigatórias não foram encontradas nas posições fixas exigidas (A, B, D, F, J, N, R, S, AC, AE, AK). " +
        raw.replace(/^Estrutura da planilha inválida\.\s*/i, ""),
      hint: "Compare a planilha com o guia de estrutura desta tela e não remova nem reordene colunas — mesmo colunas não utilizadas devem permanecer.",
    };
  }

  if (lower.includes("planilha vazia") || lower.includes("sem cabeçalho")) {
    return {
      ...base,
      title: "A planilha não contém dados legíveis",
      message: "O arquivo baixado não tem linha de cabeçalho ou não possui nenhuma linha de dados.",
      hint: "Confira se a primeira aba da planilha é a correta e se ela contém o cabeçalho na primeira linha.",
    };
  }

  if (lower.includes("<!doctype") || lower.includes("<html") || lower.includes("sign in") || lower.includes("accounts.google")) {
    return {
      ...base,
      title: "A planilha do Google não está acessível publicamente",
      message:
        "Em vez dos dados, o Google devolveu uma página de login. Isso acontece quando a planilha não está compartilhada para leitura pública.",
      hint: 'No Google Sheets: Compartilhar → Acesso geral → "Qualquer pessoa com o link" como Leitor.',
    };
  }

  if (context === "geocode" && (lower.includes("429") || lower.includes("rate limit") || lower.includes("too many"))) {
    return {
      ...base,
      title,
      message:
        "O serviço gratuito de geolocalização recusou temporariamente novas consultas por excesso de requisições.",
      hint: "Aguarde cerca de um minuto e tente de novo. Durante a sincronização o sistema já faz novas tentativas automaticamente.",
    };
  }

  if (context === "geocode") {
    return {
      ...base,
      title,
      message:
        "Nenhum dos provedores de geolocalização (CEP, rua e bairro) encontrou coordenadas para os dados informados.",
      hint: "Confira se o CEP tem 8 dígitos e tente informar também rua e bairro, sem abreviações (ex.: 'Rua Doutor' em vez de 'R. Dr.').",
    };
  }

  // --- Fallback ---
  return {
    ...base,
    title,
    message: raw
      ? `Detalhe reportado pelo sistema: ${raw}`
      : "O sistema não retornou uma descrição para esta falha.",
    hint: "Tente novamente. Se o erro se repetir, use o detalhe técnico abaixo ao reportar o problema.",
  };
}

/** Exibe um toast de erro explicativo (título + explicação + dica). */
export function toastError(err: unknown, context: ErrorContext = "generic") {
  const info = describeError(err, context);
  toast.error(info.title, {
    description: [info.message, info.hint].filter(Boolean).join("\n\n"),
    duration: 8000,
  });
}
