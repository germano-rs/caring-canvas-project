import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

export interface SummaryRow {
  label: string;
  range: string;
  count: number;
  topBairro: string;
  topBairroCount: number;
  variation: number | null;
}

export function ComparisonSummary({ rows }: { rows: SummaryRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Resumo das comparações</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b">
              <th className="py-2 pr-4 font-medium">Mapa</th>
              <th className="py-2 pr-4 font-medium">Período</th>
              <th className="py-2 pr-4 font-medium">Registros</th>
              <th className="py-2 pr-4 font-medium">Variação vs. base</th>
              <th className="py-2 pr-4 font-medium">Bairro mais afetado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b last:border-0">
                <td className="py-2 pr-4 font-medium">{r.label}</td>
                <td className="py-2 pr-4 text-muted-foreground">{r.range}</td>
                <td className="py-2 pr-4 font-semibold">{r.count}</td>
                <td className="py-2 pr-4">
                  {r.variation === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 font-medium ${
                        r.variation > 0
                          ? "text-destructive"
                          : r.variation < 0
                            ? "text-primary"
                            : "text-muted-foreground"
                      }`}
                    >
                      {r.variation > 0 ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : r.variation < 0 ? (
                        <ArrowDownRight className="w-4 h-4" />
                      ) : (
                        <ArrowRight className="w-4 h-4" />
                      )}
                      {r.variation > 0 ? "+" : ""}
                      {r.variation.toFixed(1)}%
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4">
                  {r.topBairro} {r.topBairroCount ? `(${r.topBairroCount})` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
