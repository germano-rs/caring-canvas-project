import type { SummaryRow } from "../components/ComparisonSummary";

const HEADERS = ["Mapa", "Periodo", "Registros", "Variacao (%)", "Bairro mais afetado", "Ocorrencias no bairro"];

function toRows(rows: SummaryRow[]) {
  return rows.map((r) => [
    r.label,
    r.range,
    String(r.count),
    r.variation === null ? "-" : `${r.variation.toFixed(1)}%`,
    r.topBairro,
    String(r.topBairroCount),
  ]);
}

export function exportComparisonsCSV(rows: SummaryRow[], planilha: string) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    [`Planilha: ${planilha}`],
    [`Gerado em: ${new Date().toLocaleString("pt-BR")}`],
    [],
    HEADERS,
    ...toRows(rows),
  ]
    .map((line) => line.map((c) => escape(String(c ?? ""))).join(";"))
    .join("\n");

  const blob = new Blob(["\uFEFF" + lines], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `comparacoes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportComparisonsPDF(rows: SummaryRow[], planilha: string) {
  const body = toRows(rows)
    .map((cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("");

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
<title>Comparações de períodos</title>
<style>
body{font-family:system-ui,sans-serif;padding:32px;color:#111}
h1{font-size:20px;margin:0 0 4px}
p{color:#555;font-size:12px;margin:0 0 16px}
table{border-collapse:collapse;width:100%;font-size:12px}
th,td{border:1px solid #ddd;padding:8px;text-align:left}
th{background:#f3f4f6}
</style></head><body>
<h1>Comparações de períodos — Eventos de Saúde</h1>
<p>Planilha: ${planilha} · Gerado em ${new Date().toLocaleString("pt-BR")}</p>
<table><thead><tr>${HEADERS.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>
<script>window.onload=()=>{window.print()}<\/script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}
