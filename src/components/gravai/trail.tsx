import { cn } from "@/lib/utils";
import type { VideoStage } from "@/types/database";

export const STAGES: { id: VideoStage; label: string }[] = [
  { id: "ideia", label: "Ideia" },
  { id: "roteiro", label: "Roteiro" },
  { id: "pessoas", label: "Pessoas" },
  { id: "planos", label: "Planos" },
  { id: "gravar", label: "Gravar" },
];

export function stageIndex(stage: VideoStage): number {
  const i = STAGES.findIndex((s) => s.id === stage);
  return i === -1 ? STAGES.length : i;
}

// Passos que já existem no app; os outros chegam nos próximos lotes e, até lá, são pulados.
export const READY_STAGES: VideoStage[] = ["ideia", "roteiro", "pessoas", "planos", "gravar"];

// Próximo passo pronto depois de `stage` (ou "pronto" quando não há mais nenhum).
export function nextReadyStage(stage: VideoStage): VideoStage {
  return STAGES.slice(stageIndex(stage) + 1).find((s) => READY_STAGES.includes(s.id))?.id ?? "pronto";
}

// Até onde a pessoa pode ir: se parou num passo que ainda não existe, segue para o próximo pronto.
export function reachableIndex(stage: VideoStage): number {
  const i = stageIndex(stage);
  if (i >= STAGES.length || READY_STAGES.includes(stage)) return i;
  const next = STAGES.slice(i).findIndex((s) => READY_STAGES.includes(s.id));
  return next === -1 ? i : i + next;
}

export function stageLabel(stage: VideoStage): string {
  const i = stageIndex(stage);
  return i >= STAGES.length ? "Pronto" : `Passo ${i + 1} de ${STAGES.length} · ${STAGES[i].label}`;
}

// A trilha de 5 passos: o passo atual e os anteriores ficam preenchidos.
export function Trail({ stage, className }: { stage: VideoStage; className?: string }) {
  const current = stageIndex(stage);
  return (
    <div className={cn("flex gap-1", className)} role="img" aria-label={stageLabel(stage)}>
      {STAGES.map((s, i) => (
        <span key={s.id} className={cn("h-[5px] flex-1 rounded-full", i <= current ? "bg-foreground" : "bg-input")} />
      ))}
    </div>
  );
}
