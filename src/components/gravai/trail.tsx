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
