"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, List, RefreshCw } from "lucide-react";
import { FramingIcon } from "@/components/gravai/framing-icon";
import { PlanList, type PlanRow } from "@/components/gravai/lista-planos";
import type { CueLine } from "@/lib/convidado";
import { FRAMINGS, shotTags, type Angle, type Framing, type Movement, type Orientation } from "@/lib/planos";
import { cn } from "@/lib/utils";

export interface GuestShot {
  number: number;
  block: number;
  framing: Framing;
  angle: Angle;
  movement: Movement;
  orientation: Orientation;
  description: string;
  location: string;
  wardrobe: string;
  recorded: boolean;
  good: boolean;
  takes: number;
  mine: boolean;
}

const HOUR = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

// Acompanhar a gravação pelo link: a lista do que já foi gravado e, plano a plano, as falas da pessoa
// com a deixa. Só leitura: quem marca o que foi gravado é quem convidou. A lista se atualiza quando
// a pessoa volta para a tela (por exemplo, depois do WhatsApp) ou toca em Atualizar.
export function Acompanhar({
  shots,
  lines,
  scenes,
  appears,
  films,
  loadedAt,
}: {
  shots: GuestShot[];
  lines: CueLine[];
  scenes: Record<number, string[]>; // falas de cada parte, para quem filma ou ajuda
  appears: boolean;
  films: boolean;
  loadedAt: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null); // índice do plano aberto
  const [onlyMine, setOnlyMine] = useState(false);

  useEffect(() => {
    const refresh = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [router]);

  const done = shots.filter((s) => s.recorded).length;
  const mine = shots.filter((s) => s.mine).length;
  const visible = shots.map((s, i) => ({ s, i })).filter(({ s }) => !onlyMine || s.mine);
  const rows: PlanRow[] = visible.map(({ s, i }) => ({
    id: String(i),
    number: s.number,
    description: s.description,
    framing: s.framing,
    angle: s.angle,
    movement: s.movement,
    orientation: s.orientation,
    location: s.location,
    recorded: s.recorded,
    good: s.good,
    takes: s.takes,
    skipped: false,
    current: false,
    tag: s.mine ? "Você aparece" : undefined,
  }));

  if (shots.length === 0) return <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Os planos ainda não foram montados. Quando forem, a gravação aparece aqui.</p>;

  const shot = open === null ? null : shots[open];
  const shotLines = shot ? lines.filter((l) => l.block === shot.block) : [];
  const sceneLines = shot && !appears ? (scenes[shot.block] ?? []) : [];
  const step = (d: number) => setOpen((i) => (i === null ? i : Math.min(shots.length - 1, Math.max(0, i + d))));

  return (
    <section aria-label="Acompanhar a gravação" className="flex flex-col gap-4">

      {done === shots.length && (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-full border-[6px] border-foreground" aria-hidden="true">
            <span className="size-7 rounded-full bg-rec" />
          </span>
          <p className="font-display text-2xl">Gravação feita.</p>
          <p className="text-sm leading-relaxed text-muted-foreground">Deu para ver como é gravar com roteiro e planos prontos.</p>
          <Link href="/register" className="flex min-h-13 w-full items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
            Fazer o meu vídeo
          </Link>
          <p className="label-set text-muted-foreground">Grátis · sem baixar nada para começar</p>
        </div>
      )}

      {shot && open !== null ? (
        <div className="dark flex flex-col gap-4 rounded-2xl bg-background p-4 text-foreground">
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setOpen(null)} className="-ml-2 flex min-h-11 items-center gap-1.5 px-2 text-sm font-semibold">
              <List className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Ver a lista
            </button>
            <span className="font-mono text-sm text-muted-foreground">
              {open + 1} / {shots.length}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <FramingIcon framing={shot.framing} orientation={shot.orientation} size="lg" />
            <div className="flex min-w-0 flex-col gap-1.5">
              <p className="font-mono text-sm text-muted-foreground">
                PLANO {String(shot.number).padStart(2, "0")}
                {shot.recorded ? " · GRAVADO" : ""}
              </p>
              <p className="label-set">{shotTags(shot).join(" · ")}</p>
              {(shot.location || shot.wardrobe) && <p className="label-set text-muted-foreground">{[shot.location, shot.wardrobe].filter(Boolean).join(" · ")}</p>}
              {(films || shot.mine) && (
                <p className="label-set text-rec">{[shot.mine && "Você aparece", films && "Você filma"].filter(Boolean).join(" · ")}</p>
              )}
            </div>
          </div>
          <p className="font-display text-[22px] leading-tight">{shot.description || FRAMINGS[shot.framing].label}</p>

          {shotLines.map((l, k) => (
            <div key={k} className="flex flex-col gap-1.5 rounded-xl bg-card p-4">
              {l.cue && <p className="text-sm text-muted-foreground">{l.cue}</p>}
              <p className="text-xl font-semibold leading-snug">{l.text}</p>
            </div>
          ))}
          {sceneLines.length > 0 && (
            <div className="flex flex-col gap-1 rounded-xl bg-card p-4 text-[15px] leading-relaxed">
              {sceneLines.map((t, k) => (
                <p key={k}>{t}</p>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" disabled={open === 0} onClick={() => step(-1)} className="flex min-h-12 items-center justify-center gap-1 rounded-full border-[1.5px] border-input font-semibold disabled:opacity-30">
              <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Anterior
            </button>
            <button type="button" disabled={open === shots.length - 1} onClick={() => step(1)} className="flex min-h-12 items-center justify-center gap-1 rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-30">
              Próximo
              <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
          <p className="text-center text-xs text-muted-foreground">Quem marca o que foi gravado é quem te convidou.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-lg font-bold">
              {done} de {shots.length} gravados
            </p>
            <button type="button" onClick={() => router.refresh()} className="-mr-2 flex min-h-11 items-center gap-1.5 px-2 font-mono text-xs text-muted-foreground">
              ATUALIZADO {HOUR.format(new Date(loadedAt))}
              <RefreshCw className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              <span className="sr-only">Atualizar</span>
            </button>
          </div>
          {appears && mine > 0 && mine < shots.length && (
            <div className="flex gap-2" role="group" aria-label="Filtrar planos">
              <button type="button" aria-pressed={!onlyMine} onClick={() => setOnlyMine(false)} className={cn("min-h-11 rounded-full border border-input px-4 text-sm font-semibold", !onlyMine && "border-foreground bg-foreground text-background")}>
                Todos
              </button>
              <button type="button" aria-pressed={onlyMine} onClick={() => setOnlyMine(true)} className={cn("min-h-11 rounded-full border border-input px-4 text-sm font-semibold", onlyMine && "border-foreground bg-foreground text-background")}>
                Só os meus · {mine}
              </button>
            </div>
          )}
          <div className="rounded-2xl bg-card p-2">
            <PlanList rows={rows} onPick={(rowId) => setOpen(Number(rowId))} />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">Toque num plano para ver o que acontece e as suas falas. Nada aqui muda a gravação.</p>
        </div>
      )}
    </section>
  );
}
