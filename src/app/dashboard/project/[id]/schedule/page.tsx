"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Calendar,
  Film,
  Users,
  MapPin,
  Clock,
  DollarSign,
  Sun,
  Moon,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  GripVertical,
  CloudRain,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCinemaStore } from "@/lib/store";
import type { Scene } from "@/types/database";

interface ScheduleDayMapped {
  id: string;
  dayNumber: number;
  date: string;
  location: string;
  scenes: {
    id: string;
    number: string;
    synopsis: string;
    pages: number;
    timeOfDay: string;
    intExt: string;
    weather: string;
  }[];
  actors: string[];
  estimatedHours: number;
  costEstimate: number;
  alerts: string[];
}

export default function SchedulePage() {
  const router = useRouter();
  const pathname = usePathname();
  const projectId = pathname.split("/")[3];

  const {
    shootingDays,
    scenes,
    actors,
    locations,
    loading,
    fetchProjectDetails,
    generateProjectSchedule,
    reorderShootingDays,
  } = useCinemaStore();

  const [generating, setGenerating] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (projectId) {
      fetchProjectDetails(projectId);
    }
  }, [projectId, fetchProjectDetails]);

  // Map backend model representation into clean UI schedule data structures
  const mappedSchedule: ScheduleDayMapped[] = shootingDays.map((day) => {
    const loc = locations.find((l) => l.id === day.location_id);
    const dayScenes = day.scene_ids
      .map((sid) => scenes.find((s) => s.id === sid))
      .filter((s): s is Scene => !!s);
    
    const dayActors = day.actor_ids
      .map((aid) => actors.find((a) => a.id === aid)?.full_name || "")
      .filter((name) => !!name);

    const alerts = day.notes ? day.notes.split("\n").filter((n) => !!n) : [];

    return {
      id: day.id,
      dayNumber: day.day_number,
      date: day.date,
      location: loc?.name || "Sem Locação",
      scenes: dayScenes.map((s) => ({
        id: s.id,
        number: s.number,
        synopsis: s.synopsis || "",
        pages: s.pages,
        timeOfDay: s.time_of_day,
        intExt: s.int_ext,
        weather: s.weather_requirement || "any",
      })),
      actors: dayActors,
      estimatedHours: day.estimated_hours,
      costEstimate: day.cost_estimate,
      alerts,
    };
  });

  const totalDays = mappedSchedule.length;
  const totalCost = mappedSchedule.reduce((a, d) => a + d.costEstimate, 0);
  const totalScenes = mappedSchedule.reduce((a, d) => a + d.scenes.length, 0);
  const totalAlerts = mappedSchedule.reduce((a, d) => a + d.alerts.length, 0);
  const uniqueActors = new Set(mappedSchedule.flatMap((d) => d.actors)).size;

  async function handleOptimize() {
    if (!projectId) return;
    setGenerating(true);
    try {
      await generateProjectSchedule(projectId);
    } finally {
      setGenerating(false);
    }
  }

  // HTML5 Drag and Drop handlers
  function handleDragStart(e: React.DragEvent, index: number) {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  async function handleDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex || !projectId) return;

    const newDays = [...shootingDays];
    const [draggedDay] = newDays.splice(draggedIndex, 1);
    newDays.splice(targetIndex, 0, draggedDay);

    await reorderShootingDays(projectId, newDays.map((d) => d.id));
    setDraggedIndex(null);
  }

  // Button-based fallback reordering for accessibility
  async function moveDay(index: number, direction: "up" | "down") {
    if (!projectId) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= shootingDays.length) return;

    const newDays = [...shootingDays];
    const temp = newDays[index];
    newDays[index] = newDays[targetIndex];
    newDays[targetIndex] = temp;

    await reorderShootingDays(projectId, newDays.map((d) => d.id));
  }

  if (loading && mappedSchedule.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground text-sm">Carregando cronograma...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Ordem do Dia</h2>
            <p className="text-muted-foreground mt-1">
              Roteiro de filmagem otimizado pela IA. Reordene arrastando ou usando as setas.
            </p>
          </div>
          {mappedSchedule.length > 0 && (
            <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary border border-primary/20">
              <CheckCircle2 className="h-3 w-3" />
              Otimizado com Sucesso
            </Badge>
          )}
        </div>
      </div>

      {mappedSchedule.length === 0 ? (
        <Card className="border-border/50 bg-card/30 border-dashed py-16">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">Ordem do Dia Pendente</h3>
            <p className="text-muted-foreground text-sm max-w-sm mt-1 mb-6">
              Use nossa inteligência artificial para estruturar a melhor sequência lógica de filmagens baseada no elenco, locações e orçamentos.
            </p>
            <Button
              className="font-semibold shadow-lg shadow-primary/20 gap-2 bg-gradient-to-r from-primary to-amber-500 hover:from-primary/90 hover:to-amber-500/90 text-background border-none"
              onClick={handleOptimize}
              disabled={generating}
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Otimizando Roteiro...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Otimizar com IA
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            {[
              { label: "Dias", value: totalDays, icon: Calendar, color: "text-primary" },
              { label: "Cenas", value: totalScenes, icon: Film, color: "text-chart-2" },
              { label: "Atores", value: uniqueActors, icon: Users, color: "text-chart-3" },
              { label: "Custo Total", value: `R$ ${(totalCost / 1000).toFixed(0)}k`, icon: DollarSign, color: "text-chart-4" },
              { label: "Alertas", value: totalAlerts, icon: AlertTriangle, color: totalAlerts > 0 ? "text-warning" : "text-chart-3" },
            ].map((stat) => (
              <Card key={stat.label} className="border-border/50 bg-card/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <stat.icon className={cn("h-4 w-4", stat.color)} />
                  </div>
                  <p className={cn("text-xl font-bold", stat.color)}>{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Schedule Days */}
          <div className="space-y-4">
            {mappedSchedule.map((day, index) => (
              <div
                key={day.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                className="group relative"
              >
                <Card
                  className={cn(
                    "border-border/50 bg-card/30 transition-all hover:border-primary/20",
                    day.alerts.length > 0 && "border-l-2 border-l-warning"
                  )}
                >
                  <CardContent className="p-0">
                    {/* Day Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 pb-3">
                      <div className="flex items-center gap-2 cursor-grab text-muted-foreground hover:text-foreground">
                        <GripVertical className="h-4 w-4" />
                      </div>

                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                        <span className="text-sm font-bold text-primary">D{day.dayNumber}</span>
                      </div>

                      <div className="flex-1">
                        <div>
                          <h3 className="font-semibold text-sm">
                            Dia {day.dayNumber} — {day.location}
                          </h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-primary/70" />
                            {new Date(day.date + "T12:00:00").toLocaleDateString("pt-BR", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-primary/70" />
                            {day.estimatedHours}h
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <DollarSign className="h-3.5 w-3.5 text-primary/70" />
                            R$ {day.costEstimate.toLocaleString("pt-BR")}
                          </span>
                        </div>
                      </div>

                      {/* Castings tags list */}
                      <div className="flex flex-wrap gap-1 items-center max-w-[300px]">
                        {day.actors.map((actor) => (
                          <Badge
                            key={actor}
                            variant="secondary"
                            className="text-[10px] bg-primary/5 text-primary/80 border border-primary/10"
                          >
                            {actor}
                          </Badge>
                        ))}
                      </div>

                      {/* Navigation order tools */}
                      <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity self-end sm:self-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-card"
                          disabled={index === 0}
                          onClick={() => moveDay(index, "up")}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-card"
                          disabled={index === mappedSchedule.length - 1}
                          onClick={() => moveDay(index, "down")}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Scenes */}
                    <div className="border-t border-border/30 bg-background/20">
                      {day.scenes.map((scene, idx) => (
                        <div
                          key={scene.id}
                          className={cn(
                            "flex items-center gap-4 px-4 py-2.5 text-sm",
                            idx > 0 && "border-t border-border/20"
                          )}
                        >
                          <span className="font-mono text-xs text-primary/80 w-8">
                            #{scene.number}
                          </span>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-[10px]",
                              scene.intExt === "EXT"
                                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                : scene.intExt === "INT/EXT"
                                ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                : "bg-muted text-muted-foreground border border-border"
                            )}
                          >
                            {scene.intExt}
                          </Badge>
                          {scene.timeOfDay === "DIA" || scene.timeOfDay === "AMANHECER" ? (
                            <Sun className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                          ) : (
                            <Moon className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                          )}
                          <span className="flex-1 text-xs text-muted-foreground truncate">
                            {scene.synopsis}
                          </span>
                          <span className="text-xs font-mono text-muted-foreground shrink-0">
                            {scene.pages}/8 pág
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Alerts */}
                    {day.alerts.length > 0 && (
                      <div className="border-t border-warning/20 bg-warning/5 px-4 py-2">
                        {day.alerts.map((alert, idx) => (
                          <p key={idx} className="text-xs text-warning flex items-center gap-1.5 py-0.5">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            {alert}
                          </p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>

          {/* Continue */}
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={handleOptimize} disabled={generating} className="gap-1 border-border/80 hover:bg-card">
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Carregando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-primary" />
                  Reotimizar com IA
                </>
              )}
            </Button>
            <Button
              className="font-semibold gap-1 bg-gradient-to-r from-primary to-amber-500 hover:from-primary/95 hover:to-amber-500/95 text-background"
              onClick={() => router.push(`/dashboard/project/${projectId}/export`)}
            >
              Exportar
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
