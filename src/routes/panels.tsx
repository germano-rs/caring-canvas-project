import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchSavedPanels, deletePanel } from "../lib/data-service";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Eye, 
  Edit, 
  Trash2, 
  Layout, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/panels")({
  component: PanelsPage,
});

function PanelsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: panels, isLoading } = useQuery({
    queryKey: ["savedPanels"],
    queryFn: fetchSavedPanels,
  });

  const deleteMutation = useMutation({
    mutationFn: deletePanel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedPanels"] });
      toast.success("Painel excluído com sucesso.");
    },
    onError: () => {
      toast.error("Erro ao excluir painel.");
    }
  });

  const totalPages = Math.max(1, Math.ceil((panels?.length || 0) / itemsPerPage));
  const paginatedPanels = (panels || []).slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleAction = (id: string, action: "view" | "edit") => {
    const params: any = { panelId: id };
    if (action === "view") {
      params.readonly = "true";
    }
    navigate({ to: "/", search: params });
  };

  return (
    <div className="flex-1 overflow-auto p-4 md:p-8 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Painéis Salvos</h1>
          <p className="text-muted-foreground">Gerencie seus filtros e visualizações customizadas.</p>
        </div>
        <Button onClick={() => navigate({ to: "/" })} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Painel
        </Button>
      </header>

      <Card>
        <CardHeader className="pb-2 border-b">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Layout className="w-4 h-4 text-primary" />
            {panels?.length || 0} Painéis Configurados
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Nome</TableHead>
                  <TableHead>Planilha Base</TableHead>
                  <TableHead>Comparação</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic">Carregando painéis...</TableCell>
                  </TableRow>
                ) : paginatedPanels.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic">Nenhum painel salvo encontrado.</TableCell>
                  </TableRow>
                ) : (
                  paginatedPanels.map((panel) => (
                    <TableRow key={panel.id}>
                      <TableCell className="font-medium">{panel.name}</TableCell>
                      <TableCell>{panel.spreadsheet_configs?.name || "Todas as Planilhas"}</TableCell>
                      <TableCell>{panel.is_comparison ? "Sim" : "Não"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          {panel.created_at ? new Date(panel.created_at).toLocaleDateString('pt-BR') : '---'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            title="Visualizar"
                            onClick={() => handleAction(panel.id, "view")}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            title="Editar"
                            onClick={() => handleAction(panel.id, "edit")}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Excluir"
                            onClick={() => {
                              if (confirm("Deseja realmente excluir este painel?")) {
                                deleteMutation.mutate(panel.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
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
