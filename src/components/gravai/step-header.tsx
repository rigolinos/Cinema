import Link from "next/link";
import { ChevronLeft, LayoutList } from "lucide-react";
import { Trail, stageIndex, STAGES } from "@/components/gravai/trail";
import type { VideoStage } from "@/types/database";

// Topo de cada passo: voltar (para o passo anterior), nome do passo, a visão geral do vídeo e a trilha.
export function StepHeader({ step, backHref, videoId }: { step: VideoStage; backHref: string; videoId?: string }) {
  const i = stageIndex(step);
  return (
    <header className="sticky top-0 z-30 flex flex-col gap-3 border-b border-border bg-background px-5 pb-3.5 pt-3">
      <div className="flex items-center gap-2">
        <Link href={backHref} aria-label="Voltar" className="-ml-3 flex size-11 items-center justify-center">
          <ChevronLeft className="size-6" strokeWidth={1.75} aria-hidden="true" />
        </Link>
        <div className="flex flex-1 flex-col gap-0.5">
          <h1 className="font-display text-xl">{STAGES[i]?.label ?? "Pronto"}</h1>
          <p className="label-set text-muted-foreground">
            Passo {Math.min(i + 1, STAGES.length)} de {STAGES.length}
          </p>
        </div>
        {videoId && (
          <Link href={`/video/${videoId}`} aria-label="Ver o vídeo inteiro" className="-mr-3 flex size-11 items-center justify-center">
            <LayoutList className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </Link>
        )}
      </div>
      <Trail stage={step} />
    </header>
  );
}
