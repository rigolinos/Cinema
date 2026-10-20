"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  Download,
  FileText,
  FileSpreadsheet,
  Users,
  Film,
  Calendar,
  CheckCircle2,
  Loader2,
  Printer,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useCinemaStore } from "@/lib/store";

interface ExportOption {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  format: string;
  sheets?: string[];
}

const exportOptions: ExportOption[] = [
  {
    id: "pdf-schedule",
    title: "Ordem do Dia (Planilha CSV)",
    description:
      "Cronograma completo no formato tabular pronto para distribuição e controle diário.",
    icon: FileText,
    format: "CSV",
    sheets: [
      "Dia a dia com locações, cenas e sequências",
      "Horários e horas estimadas de gravação",
      "Notas de produção e alertas climáticos",
    ],
  },
  {
    id: "excel-full",
    title: "Planilha Completa (Exportação)",
    description:
      "Planilha contendo todos os dados do cronograma em colunas estruturadas para o time de produção.",
    icon: FileSpreadsheet,
    format: "CSV",
    sheets: [
      "Ordem do Dia completa",
      "Datas de gravação e custos por diária",
      "Resumo estruturado por locação",
    ],
  },
  {
    id: "csv-scenes",
    title: "Breakdown de Cenas (CSV)",
    description:
      "Lista de todas as cenas extraídas com seus metadados, importável em qualquer software de produção.",
    icon: Film,
    format: "CSV",
    sheets: [
      "Estrutura original das cenas",
      "Identificação de DIA/NOITE e INT/EXT",
      "Sinopse e contagem de oitavos de páginas",
    ],
  },
];

export default function ExportPage() {
  const [exporting, setExporting] = useState<string | null>(null);
  const [exported, setExported] = useState<Set<string>>(new Set());
  const pathname = usePathname();
  const projectId = pathname.split("/")[3];

  const {
    shootingDays,
    scenes,
    characters,
    fetchProjectDetails,
    loading,
  } = useCinemaStore();

  useEffect(() => {
    if (projectId) {
      fetchProjectDetails(projectId);
    }
  }, [projectId, fetchProjectDetails]);

  const totalDays = shootingDays.length;
  const totalScenes = scenes.length;
  const totalCharacters = characters.length;

  function downloadCSV(filename: string, content: string) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportBreakdownToCSV() {
    if (scenes.length === 0) return;
    const headers = ["Cena", "INT/EXT", "Locação", "Período", "Sinopse", "Páginas (Oitavos)", "Requisito Climático"];
    const rows = scenes.map((s) => [
      s.number,
      s.int_ext,
      s.location_name,
      s.time_of_day,
      `"${(s.synopsis || "").replace(/"/g, '""')}"`,
      s.pages,
      s.weather_requirement || "any",
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadCSV(`breakdown_projeto_${projectId}.csv`, csvContent);
  }

  function exportScheduleToCSV() {
    if (shootingDays.length === 0) return;
    const headers = ["Dia de Gravação", "Data", "Locação ID", "Cenas IDs", "Horas Estimadas", "Custo Estimado (R$)", "Notas/Alertas"];
    const rows = shootingDays.map((d) => [
      d.day_number,
      d.date,
      d.location_id,
      `"${d.scene_ids.join(", ")}"`,
      d.estimated_hours,
      d.cost_estimate,
      `"${(d.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadCSV(`ordem_do_dia_projeto_${projectId}.csv`, csvContent);
  }

  async function handleExport(optionId: string) {
    setExporting(optionId);

    // Simulate premium generation delay
    await new Promise((r) => setTimeout(r, 1200));

    try {
      if (optionId === "csv-scenes") {
        exportBreakdownToCSV();
      } else {
        exportScheduleToCSV();
      }
      setExported((prev) => new Set([...prev, optionId]));
    } catch (err) {
      console.error("Export failure: ", err);
    } finally {
      setExporting(null);
    }
  }

  if (loading && scenes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground text-sm">Carregando dados para exportação...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold">Exportar</h2>
        <p className="text-muted-foreground mt-1">
          Exporte a ordem do dia e os dados da produção nos formatos necessários.
        </p>
      </div>

      {/* Summary */}
      <Card className="border-border/50 bg-card mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-sm">
                <strong>{totalDays}</strong> dias de gravação
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Film className="h-4 w-4 text-chart-2" />
              <span className="text-sm">
                <strong>{totalScenes}</strong> cenas
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-chart-3" />
              <span className="text-sm">
                <strong>{totalCharacters}</strong> personagens
              </span>
            </div>
            {totalDays > 0 ? (
              <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary border border-primary/20">
                <CheckCircle2 className="h-3 w-3" />
                Pronto para exportar
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1 bg-warning/10 text-warning border border-warning/20">
                <AlertTriangle className="h-3 w-3" />
                Ordem do Dia Pendente
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Export Options */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {exportOptions.map((option) => {
          const isExporting = exporting === option.id;
          const isExported = exported.has(option.id);
          const hasDataToExport = option.id === "csv-scenes" ? totalScenes > 0 : totalDays > 0;

          return (
            <Card
              key={option.id}
              className={cn(
                "border-border/50 transition-all",
                isExported
                  ? "bg-primary/5 border-primary/20"
                  : "bg-card hover:border-primary/20"
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg",
                        isExported ? "bg-primary/20" : "bg-primary/10"
                      )}
                    >
                      <option.icon
                        className={cn(
                          "h-5 w-5",
                          isExported ? "text-primary" : "text-primary"
                        )}
                      />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold">
                        {option.title}
                      </CardTitle>
                      <Badge variant="secondary" className="text-[10px] mt-1">
                        {option.format}
                      </Badge>
                    </div>
                  </div>
                  {isExported && (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <p className="text-xs text-muted-foreground mb-3 min-h-[32px]">
                  {option.description}
                </p>

                {option.sheets && (
                  <div className="mb-4 space-y-1">
                    {option.sheets.map((sheet) => (
                      <div
                        key={sheet}
                        className="flex items-center gap-2 text-xs text-muted-foreground"
                      >
                        <div className="h-1 w-1 rounded-full bg-primary/50" />
                        {sheet}
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  className="w-full font-semibold"
                  variant={isExported ? "outline" : "default"}
                  disabled={isExporting || !hasDataToExport}
                  onClick={() => handleExport(option.id)}
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando...
                    </>
                  ) : isExported ? (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Baixar novamente
                    </>
                  ) : !hasDataToExport ? (
                    "Dados indisponíveis"
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Gerar e baixar
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Print Button */}
      <Separator className="my-6 opacity-50" />

      <div className="flex justify-center">
        <Button variant="outline" className="gap-2 border-border/80 hover:bg-card" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Imprimir página
        </Button>
      </div>
    </div>
  );
}
