"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Film,
  Calendar,
  Users,
  Clock,
  MoreHorizontal,
  FolderOpen,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useCinemaStore } from "@/lib/store";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  planning: "bg-primary/10 text-primary",
  scheduled: "bg-chart-3/10 text-chart-3",
  in_production: "bg-warning/10 text-warning",
  wrapped: "bg-success/10 text-success",
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  planning: "Planejamento",
  scheduled: "Agendado",
  in_production: "Em Produção",
  wrapped: "Finalizado",
};

export default function DashboardPage() {
  const { projects, loading, fetchProjects } = useCinemaStore();

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projetos</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie suas produções cinematográficas
          </p>
        </div>
        <Link href="/dashboard/new">
          <Button className="gap-2 font-semibold">
            <Plus className="h-4 w-4" />
            Novo Projeto
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="mt-8 grid gap-4 grid-cols-1 sm:grid-cols-3">
        {[
          {
            label: "Projetos Ativos",
            value: projects.length,
            icon: FolderOpen,
            color: "text-primary",
          },
          {
            label: "Cenas Totais",
            value: projects.reduce((sum, p) => sum + (p.counts?.scenes ?? 0), 0),
            icon: Film,
            color: "text-chart-2",
          },
          {
            label: "Dias de Gravação",
            value: projects.reduce((sum, p) => sum + (p.counts?.days ?? 0), 0),
            icon: Calendar,
            color: "text-chart-3",
          },
        ].map((stat) => (
          <Card
            key={stat.label}
            className="border-border/50 bg-card/50 backdrop-blur-sm"
          >
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <stat.icon className={cn("h-5 w-5", stat.color)} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] mt-8">
          <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
          <p className="text-sm text-muted-foreground">Carregando seus projetos...</p>
        </div>
      ) : (
        /* Project Grid */
        <div className="mt-8 grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {/* New Project Card */}
          <Link href="/dashboard/new">
            <Card className="group flex min-h-[220px] cursor-pointer flex-col items-center justify-center border-dashed border-border/50 bg-transparent transition-all hover:border-primary/40 hover:bg-primary/5">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30 transition-colors group-hover:border-primary/50">
                <Plus className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
              </div>
              <p className="mt-3 text-sm font-medium text-muted-foreground transition-colors group-hover:text-primary">
                Novo Projeto
              </p>
            </Card>
          </Link>

          {/* Project Cards */}
          {projects.map((project) => (
            <Link key={project.id} href={`/dashboard/project/${project.id}/upload`}>
              <Card className="group min-h-[220px] cursor-pointer border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                <CardHeader className="flex flex-row items-start justify-between pb-3">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors">
                      {project.title}
                    </CardTitle>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] font-medium",
                        statusColors[project.status]
                      )}
                    >
                      {statusLabels[project.status]}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </CardHeader>

                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="flex items-center justify-center gap-1 text-muted-foreground">
                        <Film className="h-3.5 w-3.5" />
                      </div>
                      <p className="mt-1 text-lg font-semibold">{project.counts?.scenes ?? 0}</p>
                      <p className="text-[10px] text-muted-foreground">Cenas</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-1 text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                      </div>
                      <p className="mt-1 text-lg font-semibold">{project.counts?.actors ?? 0}</p>
                      <p className="text-[10px] text-muted-foreground">Atores</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-1 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                      </div>
                      <p className="mt-1 text-lg font-semibold">{project.counts?.days ?? 0}</p>
                      <p className="text-[10px] text-muted-foreground">Dias</p>
                    </div>
                  </div>

                  <Separator className="my-4 opacity-50" />

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>
                      Atualizado em{" "}
                      {new Date(project.updated_at || project.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

