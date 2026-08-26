import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchEventsFromDb, fetchSpreadsheetConfigs, type HealthData } from "@/lib/data-service";
import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  FileSpreadsheet,
  MapPin,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Download,
  Eraser,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorDisplay } from "@/components/ErrorDisplay";

export const Route = createFileRoute("/events")({
  component: EventsPage,
});

type ColumnKey =
  | "numero_notificacao"
  | "tipo_notificacao"
  | "data"
  | "ano_notificacao"
  | "id_unidade"
  | "data_nascimento"
  | "sexo"
  | "gestante"
  | "rua"
  | "bairro"
  | "cep"
  | "coordenadas"
  | "geo_source"
  | "geo_provider"
  | "status";

const COLUMNS: { key: ColumnKey; label: string; width?: string }[] = [
  { key: "numero_notificacao", label: "Nº Notificação", width: "w-[120px]" },
  { key: "tipo_notificacao", label: "Tipo", width: "w-[150px]" },
  { key: "data", label: "Data", width: "w-[120px]" },
  { key: "ano_notificacao", label: "Ano", width: "w-[80px]" },
  { key: "id_unidade", label: "ID Unidade", width: "w-[110px]" },
  { key: "data_nascimento", label: "Nascimento", width: "w-[120px]" },
  { key: "sexo", label: "Sexo", width: "w-[80px]" },
  { key: "gestante", label: "Gestante", width: "w-[100px]" },
  { key: "rua", label: "Logradouro", width: "w-[190px]" },
  { key: "bairro", label: "Bairro", width: "w-[160px]" },
  { key: "cep", label: "CEP", width: "w-[110px]" },
  { key: "coordenadas", label: "Coordenadas (Lat, Lon)", width: "w-[180px]" },
  { key: "geo_source", label: "Origem da Coord.", width: "w-[140px]" },
  { key: "geo_provider", label: "Serviço", width: "w-[130px]" },
  { key: "status", label: "Status", width: "w-[130px]" },
];

const SOURCE_LABEL: Record<string, string> = {
  cep: "CEP",
  endereco: "Endereço",
};

const PROVIDER_LABEL: Record<string, string> = {
  google: "Google Geocoding",
  nominatim: "Nominatim (OSM)",
  photon: "Photon (Komoot)",
  cache: "Cache",
};

function sourceLabel(v: string | null) {
  return v ? (SOURCE_LABEL[v] ?? v) : "";
}
function providerLabel(v: string | null) {
  return v ? (PROVIDER_LABEL[v] ?? v) : "";
}

function cellValue(event: HealthData, key: ColumnKey): string {
  switch (key) {
    case "data":
      return event.data ? new Date(event.data).toLocaleDateString("pt-BR") : "";
    case "coordenadas":
      return event.location_found
        ? `${event.latitude.toFixed(6)}, ${event.longitude.toFixed(6)}`
        : "";
    case "geo_source":
      return sourceLabel(event.geo_source);
    case "geo_provider":
      return providerLabel(event.geo_provider);
    case "status":
      return event.location_found ? "Consistente" : "Inconsistente";
    default:
      return (event[key as keyof HealthData] as string | null) ?? "";
  }
}

function sortValue(event: HealthData, key: ColumnKey): string | number {
  if (key === "data") return event.data ? new Date(event.data).getTime() : 0;
  if (key === "coordenadas") return event.location_found ? event.latitude : -999;
  if (key === "status") return event.location_found ? 1 : 0;
  return cellValue(event, key).toLowerCase();
}

function EventsPage() {
  const [spreadsheetId, setSpreadsheetId] = useState<string>("all");
  const [globalSearch, setGlobalSearch] = useState("");
  const [filters, setFilters] = useState<Partial<Record<ColumnKey, string>>>({});
  const [sort, setSort] = useState<{ key: ColumnKey; dir: "asc" | "desc" }>({
    key: "data",
    dir: "desc",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: configs } = useQuery({
    queryKey: ["spreadsheetConfigs"],
    queryFn: () => fetchSpreadsheetConfigs(),
  });

  const { data: events, isLoading, error: eventsError, refetch: refetchEvents } = useQuery({
    queryKey: ["healthEvents", spreadsheetId, "all"],
    queryFn: () => fetchEventsFromDb(spreadsheetId === "all" ? undefined : spreadsheetId, undefined, undefined, false),
  });

  const setFilter = (key: ColumnKey, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    const search = globalSearch.trim().toLowerCase();

    const result = events.filter((event) => {
      if (search) {
        const matchesGlobal = COLUMNS.some((c) =>
          cellValue(event, c.key).toLowerCase().includes(search)
        );
        if (!matchesGlobal) return false;
      }

      return COLUMNS.every((c) => {
        const term = (filters[c.key] ?? "").trim().toLowerCase();
        if (!term) return true;
        return cellValue(event, c.key).toLowerCase().includes(term);
      });
    });

    const dir = sort.dir === "asc" ? 1 : -1;
    return [...result].sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [events, globalSearch, filters, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / itemsPerPage));
  const paginatedEvents = filteredEvents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const toggleSort = (key: ColumnKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  };

  const clearFilters = () => {
    setFilters({});
    setGlobalSearch("");
    setCurrentPage(1);
  };

  const exportCsv = () => {
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = COLUMNS.map((c) => escape(c.label)).join(";");
    const rows = filteredEvents.map((event) =>
      COLUMNS.map((c) => escape(cellValue(event, c.key))).join(";")
    );
    const csv = "\uFEFF" + [header, ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `registros_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const activeFilterCount =
    Object.values(filters).filter((v) => (v ?? "").trim() !== "").length +
    (globalSearch.trim() ? 1 : 0);

  return (
    <div className="flex-1 overflow-auto p-4 md:p-8 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lista de Registros</h1>
          <p className="text-muted-foreground">Filtre e ordene por qualquer coluna, incluindo a origem das coordenadas.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={spreadsheetId} onValueChange={(val) => { setSpreadsheetId(val); setCurrentPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Planilha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {configs?.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={clearFilters} disabled={activeFilterCount === 0}>
            <Eraser className="h-4 w-4 mr-1" /> Limpar filtros
          </Button>
          <Button size="sm" onClick={exportCsv} disabled={filteredEvents.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Baixar CSV
          </Button>
        </div>
      </header>

      {eventsError && (
        <ErrorDisplay error={eventsError} context="load-events" onRetry={() => refetchEvents()} />
      )}

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Busca geral em todas as colunas..."
          value={globalSearch}
          onChange={(e) => { setGlobalSearch(e.target.value); setCurrentPage(1); }}
          className="pl-9"
        />
      </div>

      <Card>
        <CardHeader className="pb-2 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-primary" />
              {filteredEvents.length} Registros
            </CardTitle>
            <div className="text-xs text-muted-foreground">
              Mostrando {filteredEvents.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredEvents.length)}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  {COLUMNS.map((c) => (
                    <TableHead key={c.key} className={c.width}>
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className="flex items-center gap-1 text-xs font-medium hover:text-primary transition-colors"
                      >
                        {c.label}
                        {sort.key === c.key ? (
                          sort.dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </button>
                    </TableHead>
                  ))}
                </TableRow>
                <TableRow className="bg-muted/10 hover:bg-muted/10">
                  {COLUMNS.map((c) => (
                    <TableHead key={`f-${c.key}`} className="py-1.5">
                      <Input
                        value={filters[c.key] ?? ""}
                        onChange={(e) => setFilter(c.key, e.target.value)}
                        placeholder="Filtrar..."
                        className="h-7 text-[11px]"
                      />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={COLUMNS.length} className="text-center py-12 text-muted-foreground italic">Carregando dados...</TableCell>
                  </TableRow>
                ) : paginatedEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={COLUMNS.length} className="text-center py-12 text-muted-foreground italic">Nenhum registro encontrado.</TableCell>
                  </TableRow>
                ) : (
                  paginatedEvents.map((event) => {
                    const hasGeo = event.location_found;
                    return (
                      <TableRow key={event.id} className={!hasGeo ? "bg-destructive/5" : ""}>
                        <TableCell className="font-medium text-xs whitespace-nowrap">
                          {event.numero_notificacao || "---"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px] h-5 max-w-[130px] truncate">
                            {event.tipo_notificacao || "Geral"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap text-xs">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 text-muted-foreground" />
                            {cellValue(event, "data")}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{event.ano_notificacao || "---"}</TableCell>
                        <TableCell className="text-xs">{event.id_unidade || "---"}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{event.data_nascimento || "---"}</TableCell>
                        <TableCell className="text-xs">{event.sexo || "---"}</TableCell>
                        <TableCell className="text-xs">{event.gestante || "---"}</TableCell>
                        <TableCell>
                          <div className="font-medium text-xs max-w-[180px] truncate">{event.rua || "N/I"}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1 max-w-[140px] truncate">
                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                            {event.bairro || "N/I"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-[10px] px-1.5 py-0.5 bg-muted rounded">{event.cep || "---"}</code>
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {hasGeo ? (
                              <span>{cellValue(event, "coordenadas")}</span>
                            ) : (
                              <span className="text-destructive font-bold">---, ---</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {event.geo_source ? (
                            <Badge variant="outline" className="text-[10px] h-5">
                              {sourceLabel(event.geo_source)}
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">---</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-[10px] text-muted-foreground">
                            {providerLabel(event.geo_provider) || "---"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {hasGeo ? (
                            <Badge variant="outline" className="text-[10px] h-5 bg-green-50 text-green-700 border-green-200 gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              Consistente
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px] h-5 gap-1">
                              <AlertCircle className="w-2.5 h-2.5" />
                              Inconsistente
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <div className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Próximo <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
