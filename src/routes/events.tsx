import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchEventsFromDb, fetchSpreadsheetConfigs } from "@/lib/data-service";
import { useState } from "react";
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
import { Search, FileSpreadsheet, MapPin, Calendar } from "lucide-react";

export const Route = createFileRoute("/events")({
  component: EventsPage,
});

function EventsPage() {
  const [spreadsheetId, setSpreadsheetId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: configs } = useQuery({
    queryKey: ["spreadsheetConfigs"],
    queryFn: () => fetchSpreadsheetConfigs(),
  });

  const { data: events, isLoading } = useQuery({
    queryKey: ["healthEvents", spreadsheetId],
    queryFn: () => fetchEventsFromDb(spreadsheetId === "all" ? undefined : spreadsheetId),
  });

  const filteredEvents = events?.filter((event) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (event.rua?.toLowerCase().includes(searchLower)) ||
      (event.bairro?.toLowerCase().includes(searchLower)) ||
      (event.cep?.toLowerCase().includes(searchLower)) ||
      (event.evento?.toLowerCase().includes(searchLower))
    );
  }) || [];

  return (
    <div className="flex-1 overflow-auto p-4 md:p-8 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lista de Registros</h1>
          <p className="text-muted-foreground">Visualize todos os dados sincronizados das suas planilhas</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={spreadsheetId} onValueChange={setSpreadsheetId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por Planilha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Planilhas</SelectItem>
              {configs?.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <div className="flex items-center space-x-2 bg-background border rounded-md px-3 py-2 shadow-sm max-w-md">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por rua, bairro, CEP ou evento..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border-0 focus-visible:ring-0 p-0 h-auto"
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            {filteredEvents.length} Registros Encontrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[150px]">Data</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>CEP</TableHead>
                  <TableHead>Coordenadas</TableHead>
                  <TableHead>Evento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">Carregando dados...</TableCell>
                  </TableRow>
                ) : filteredEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">Nenhum registro encontrado.</TableCell>
                  </TableRow>
                ) : (
                  filteredEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          {new Date(event.data).toLocaleDateString('pt-BR')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="font-medium text-sm">{event.rua || "Rua não informada"}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {event.bairro || "Bairro não informado"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">{event.cep || "N/A"}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {event.latitude.toFixed(4)}, {event.longitude.toFixed(4)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{event.evento || "Saúde"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
