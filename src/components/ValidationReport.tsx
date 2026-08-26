import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import type { SpreadsheetValidation } from "@/lib/data-service";

export function ValidationReport({ report }: { report: SpreadsheetValidation }) {
  const hasErrors = report.errors?.length > 0;
  const hasWarnings = report.warnings?.length > 0;

  return (
    <div
      className={`rounded-lg border p-4 space-y-3 text-sm ${
        hasErrors
          ? "border-destructive/30 bg-destructive/5"
          : hasWarnings
            ? "border-amber-300 bg-amber-50/60"
            : "border-emerald-300 bg-emerald-50/60"
      }`}
    >
      <div className="flex items-center gap-2 font-semibold">
        {hasErrors ? (
          <>
            <XCircle className="w-4 h-4 text-destructive" />
            <span className="text-destructive">Planilha inválida para sincronização</span>
          </>
        ) : hasWarnings ? (
          <>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-amber-700">Planilha válida, com alertas</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-emerald-700">Planilha válida e pronta para sincronizar</span>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
        <div>
          <span className="block uppercase tracking-wide text-[10px]">Acessível</span>
          <strong className="text-foreground">{report.accessible ? "Sim" : "Não"}</strong>
        </div>
        <div>
          <span className="block uppercase tracking-wide text-[10px]">Linhas</span>
          <strong className="text-foreground">{report.rowCount ?? 0}</strong>
        </div>
        <div>
          <span className="block uppercase tracking-wide text-[10px]">Colunas</span>
          <strong className="text-foreground">{report.columnCount ?? 0}</strong>
        </div>
        <div>
          <span className="block uppercase tracking-wide text-[10px]">Amostra analisada</span>
          <strong className="text-foreground">{report.sampleSize ?? 0}</strong>
        </div>
      </div>

      {hasErrors && (
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase text-destructive">Erros que impedem a sincronização</p>
          <ul className="list-disc pl-5 space-y-1 text-xs text-destructive">
            {report.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {hasWarnings && (
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase text-amber-700">Alertas (a sincronização continua)</p>
          <ul className="list-disc pl-5 space-y-1 text-xs text-amber-800">
            {report.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
