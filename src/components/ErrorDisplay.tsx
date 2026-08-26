import { useState } from "react";
import { AlertCircle, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { describeError, type ErrorContext } from "@/lib/errors";

interface ErrorDisplayProps {
  error: unknown;
  context?: ErrorContext;
  onRetry?: () => void;
  className?: string;
}

/** Bloco de erro explicativo, com dica de solução e detalhe técnico opcional. */
export function ErrorDisplay({ error, context = "generic", onRetry, className }: ErrorDisplayProps) {
  const [showDetails, setShowDetails] = useState(false);
  const info = describeError(error, context);

  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{info.title}</AlertTitle>
      <AlertDescription>
        <div className="space-y-3">
          <p>{info.message}</p>
          {info.hint && (
            <p className="text-sm opacity-90">
              <span className="font-semibold">Como resolver: </span>
              {info.hint}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {onRetry && (
              <Button size="sm" variant="outline" onClick={onRetry} className="gap-2">
                <RefreshCw className="w-3.5 h-3.5" />
                Tentar novamente
              </Button>
            )}
            {info.details && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowDetails((v) => !v)}
                className="gap-1 px-2"
              >
                {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                Detalhe técnico
              </Button>
            )}
          </div>

          {showDetails && info.details && (
            <pre className="whitespace-pre-wrap break-words rounded-md bg-destructive/10 p-3 text-xs font-mono">
              {info.code ? `[${info.code}] ` : ""}
              {info.details}
            </pre>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

/** Versão compacta, para linhas de tabela e cards. */
export function InlineError({ error, context = "generic" }: { error: unknown; context?: ErrorContext }) {
  const info = describeError(error, context);
  return (
    <div className="flex items-start gap-2 text-sm text-destructive">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <span>
        <span className="font-medium">{info.title}. </span>
        {info.message}
      </span>
    </div>
  );
}
