import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchEventsFromDb, fetchSpreadsheetConfigs } from "@/lib/data-service";
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
  Filter,
  ArrowUpDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorDisplay } from "@/components/ErrorDisplay";

export const Route = createFileRoute("/events")({
  component: EventsPage,
});

function EventsPage() {
  const [spreadsheetId, setSpreadsheetId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
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

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    
    return events.filter((event) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (event.rua?.toLowerCase().includes(searchLower)) ||
        (event.bairro?.toLowerCase().includes(searchLower)) ||
        (event.cep?.toLowerCase().includes(searchLower)) ||
        (event.numero_notificacao?.toLowerCase().includes(searchLower)) ||
        (event.tipo_notificacao?.toLowerCase().includes(searchLower)) ||
        (event.evento?.toLowerCase().includes(searchLower));

      const hasGeo = event.location_found;
      const matchesStatus = 
        statusFilter === "all" || 
        (statusFilter === "consistent" && hasGeo) || 
        (statusFilter === "inconsistent" && !hasGeo);

      return matchesSearch && matchesStatus;
    });
  }, [events, searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / itemsPerPage));
  const paginatedEvents = filteredEvents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="flex-1 overflow-auto p-4 md:p-8 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lista de Registros</h1>
          <p className="text-muted-foreground">Visualize todos os dados, incluindo registros inconsistentes para correção.</p>
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
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nº notificação, tipo, bairro, logradouro, CEP..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="pl-9"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="consistent">Consistentes (No Mapa)</SelectItem>
              <SelectItem value="inconsistent">Inconsistentes (Sem Coordenadas)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-primary" />
              {filteredEvents.length} Registros
            </CardTitle>
            <div className="text-xs text-muted-foreground">
              Mostrando {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredEvents.length)}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[110px]">Nº Notificação</TableHead>
                  <TableHead className="w-[140px]">Tipo</TableHead>
                  <TableHead className="w-[110px]">Data</TableHead>
                  <TableHead className="w-[70px]">Ano</TableHead>
                  <TableHead className="w-[100px]">ID Unidade</TableHead>
                  <TableHead className="w-[110px]">Nascimento</TableHead>
                  <TableHead className="w-[70px]">Sexo</TableHead>
                  <TableHead className="w-[90px]">Gestante</TableHead>
                  <TableHead>Logradouro</TableHead>
                  <TableHead>Bairro</TableHead>
                  <TableHead className="w-[100px]">CEP</TableHead>
                  <TableHead className="w-[170px]">Coordenadas (Lat, Lon)</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-12 text-muted-foreground italic">Carregando dados...</TableCell>
                  </TableRow>
                ) : paginatedEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-12 text-muted-foreground italic">Nenhum registro encontrado.</TableCell>
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
                            {new Date(event.data).toLocaleDateString('pt-BR')}
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
                              <span>{event.latitude.toFixed(6)}, {event.longitude.toFixed(6)}</span>
                            ) : (
                              <span className="text-destructive font-bold">---, ---</span>
                            )}
                          </div>
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

      {/* Pagination Controls */}
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
