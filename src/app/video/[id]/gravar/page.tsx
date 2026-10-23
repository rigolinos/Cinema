"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Minus, Plus, Star, X } from "lucide-react";
import { logSignal } from "@/lib/sinais";
import { createClient } from "@/lib/supabase/client";
import { ANGLES, FRAMINGS, MOVEMENTS, shotTerms, type Shot } from "@/lib/planos";
import { BLOCK_KINDS, type ScriptBlock } from "@/lib/roteiro";
import { CHECKLIST, firstPending, nextPending, progress, setOrder, setupChange } from "@/lib/set";
import { cn } from "@/lib/utils";
import type { Video } from "@/types/database";

type Block = ScriptBlock & { id: string; position: number };
type SetShot = Shot & { id: string; shoot_order: number | null; recorded: boolean; good_take: boolean; takes: number };
type Phase = "checklist" | "set" | "fim";

const TEXT_SIZES = ["text-xl", "text-2xl", "text-[28px]", "text-[34px]"];

// Mantém a tela acesa enquanto grava (onde o navegador permite).
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock.request("screen").then((l) => (lock = l)).catch(() => null);
    return () => {
      lock?.release().catch(() => null);
    };
  }, [active]);
}

export default function GravarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [video, setVideo] = useState<Video | null | undefined>(undefined);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [shots, setShots] = useState<SetShot[]>([]);
  const [phase, setPhase] = useState<Phase>("checklist");
  const [checked, setChecked] = useState<string[]>([]);
  const [current, setCurrent] = useState(0);
  const [previousId, setPreviousId] = useState<string | null>(null); // último plano mostrado, para o aviso de troca de cenário
  const [size, setSize] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null); // "Plano 3 gravado": diz o que aconteceu ao tocar

  useWakeLock(phase === "set");

  // Plano novo começa do topo, com o cabeçalho à vista.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [current, phase]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    const db = createClient();
    Promise.all([
      db.from("videos").select("*").eq("id", id).maybeSingle(),
      db.from("script_blocks").select("*").eq("video_id", id).order("position"),
      db.from("shots").select("*").eq("video_id", id),
    ]).then(([v, b, s]) => {
      setVideo((v.data as Video | null) ?? null);
      setBlocks((b.data ?? []) as Block[]);
      const ordered = setOrder((s.data ?? []) as SetShot[]);
      setShots(ordered);
      // Quem volta no meio da gravação continua de onde parou.
      if (ordered.some((x) => x.recorded)) {
        const next = firstPending(ordered);
        setPhase(next === -1 ? "fim" : "set");
        setCurrent(Math.max(0, next));
      }
    });
  }, [id]);

  function goTo(index: number) {
    if (phase === "set" && shots[current]) setPreviousId(shots[current].id);
    setCurrent(index);
  }

  async function mark(shot: SetShot, patch: Partial<SetShot>, advance: boolean) {
    const updated = { ...shot, ...patch };
    const list = shots.map((s) => (s.id === shot.id ? updated : s));
    setShots(list);
    setError(null);
    const { error } = await createClient()
      .from("shots")
      .update({ recorded: updated.recorded, takes: updated.takes, good_take: updated.good_take })
      .eq("id", shot.id);
    if (error) {
      setShots(shots);
      setError("Não deu para salvar. Confira a conexão e toque de novo.");
      return;
    }
    if (advance) {
      const next = nextPending(list, list.indexOf(updated));
      const done = `Plano ${scriptNumber.get(shot.id)} ${patch.good_take ? "gravado e marcado como bom" : "gravado"}`;
      setNotice(next === -1 ? done : `${done}. Agora o plano ${scriptNumber.get(list[next].id)}.`);
      if (next === -1) setPhase("fim");
      else goTo(next);
    }
  }

  async function finishVideo() {
    const { error } = await createClient().from("videos").update({ stage: "pronto" }).eq("id", id);
    if (error) setError("Não deu para concluir. Tente de novo.");
    else router.push(`/video/${id}`);
  }

  const p = progress(shots);
  const shot = shots[current];
  const block = blocks.find((b) => b.id === shot?.block_id);
  const blockNumber = block ? blocks.indexOf(block) + 1 : 0;
  const scriptNumber = new Map(
    [...shots].sort((a, b) => (blocks.findIndex((x) => x.id === a.block_id) - blocks.findIndex((x) => x.id === b.block_id)) || a.position - b.position).map((s, i) => [s.id, i + 1]),
  );
  const change = shot ? setupChange(shots.find((s) => s.id === previousId), shot) : null;
  const upcoming = shots.find((s, i) => i > current && !s.recorded);

  return (
    <div className="dark min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
        <header className="flex flex-col gap-3 px-5 pb-3 pt-3">
          <div className="flex items-center justify-between">
            <Link href={`/video/${id}`} aria-label="Sair do modo set" className="-ml-3 flex size-11 items-center justify-center">
              <X className="size-6" strokeWidth={1.75} aria-hidden="true" />
            </Link>
            <span className="label-set flex items-center gap-2">
              <span className={cn("size-2.5 rounded-full bg-rec", phase === "set" && "animate-pulse")} aria-hidden="true" />
              Modo set
            </span>
            <span className="font-mono text-sm text-muted-foreground">{shots.length > 0 ? `${p.recorded} / ${p.total}` : ""}</span>
          </div>
          {shots.length > 0 && (
            <div className="flex gap-1" role="img" aria-label={`${p.recorded} de ${p.total} planos gravados`}>
              {shots.map((s, i) => (
                <span key={s.id} className={cn("h-1 flex-1 rounded-full", s.recorded ? "bg-foreground" : i === current && phase === "set" ? "bg-rec" : "bg-input")} />
              ))}
            </div>
          )}
        </header>

        {notice && (
          <p role="status" className="fixed inset-x-4 top-3 z-50 mx-auto max-w-md rounded-full bg-foreground px-4 py-3 text-center text-sm font-semibold text-background">
            <Check className="mr-1.5 inline size-4 align-[-3px]" strokeWidth={2.5} aria-hidden="true" />
            {notice}
          </p>
        )}

        <main className="flex flex-1 flex-col gap-5 px-5 pb-6">
          {video === undefined && <p className="label-set text-muted-foreground">Carregando…</p>}
          {video === null && <p className="text-sm text-destructive">Não encontramos este vídeo.</p>}

          {video && shots.length === 0 && (
            <p className="rounded-2xl bg-card p-4 text-sm leading-relaxed">
              Para gravar, primeiro monte os planos.{" "}
              <Link href={`/video/${id}/planos`} className="font-semibold underline">
                Ir para os planos
              </Link>
            </p>
          )}

          {video && shots.length > 0 && phase === "checklist" && (
            <>
              <div className="flex flex-col gap-2">
                <h1 className="font-display text-[28px]">Antes de gravar</h1>
                <p className="leading-relaxed text-muted-foreground">Um minuto aqui evita refazer tudo depois. Toque em cada item quando estiver certo.</p>
              </div>
              <ul className="flex flex-col gap-2.5">
                {CHECKLIST.map((c) => {
                  const on = checked.includes(c.id);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => setChecked((l) => (on ? l.filter((x) => x !== c.id) : [...l, c.id]))}
                        className={cn("flex w-full items-start gap-3 rounded-2xl border p-4 text-left", on ? "border-foreground bg-card" : "border-border")}
                      >
                        <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px]", on ? "border-foreground bg-foreground text-background" : "border-input")}>
                          {on && <Check className="size-4" strokeWidth={2.5} aria-hidden="true" />}
                        </span>
                        <span className="flex flex-col gap-1">
                          <span className="font-bold">{c.label}</span>
                          <span className="text-sm leading-relaxed text-muted-foreground">{c.tip}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="label-set text-muted-foreground">
                {shots.length} planos · {new Set(shots.map((s) => s.location.trim().toLowerCase())).size} lugar(es)
              </p>
              <button type="button" onClick={() => setPhase("set")} className="mt-auto min-h-14 rounded-full bg-primary text-lg font-bold text-primary-foreground">
                {checked.length === CHECKLIST.length ? "Começar a gravar" : "Começar mesmo assim"}
              </button>
            </>
          )}

          {video && shot && phase === "set" && (
            <>
              {change && <p className="rounded-xl border border-rec/50 px-4 py-3 text-sm font-semibold">{change}</p>}

              <div className="flex flex-col gap-2">
                <p className="font-mono text-sm tracking-wide text-muted-foreground">
                  BLOCO {String(blockNumber).padStart(2, "0")} · PLANO {String(scriptNumber.get(shot.id)).padStart(2, "0")}
                  {shot.takes > 0 ? ` · TAKE ${shot.takes + 1}` : ""}
                </p>
                <h1 className="font-display text-[26px]">{shot.description || FRAMINGS[shot.framing].label}</h1>
                <div className="flex flex-wrap gap-1.5">
                  {[FRAMINGS[shot.framing].label, ANGLES[shot.angle].label, MOVEMENTS[shot.movement].label, shot.orientation === "vertical" ? "Vertical" : "Horizontal"].map((t) => (
                    <span key={t} className="rounded-md border border-input px-2 py-1 font-mono text-xs uppercase">
                      {t}
                    </span>
                  ))}
                </div>
                {(shot.location || shot.wardrobe) && <p className="label-set text-muted-foreground">{[shot.location, shot.wardrobe].filter(Boolean).join(" · ")}</p>}
              </div>

              {block && (block.speech || block.on_screen) && (
                <section aria-label="Teleprompter" className="flex flex-col gap-3 rounded-2xl bg-card p-5">
                  <div className="flex items-center justify-between">
                    <span className="label-set text-muted-foreground">Fala · {block.label || BLOCK_KINDS[block.kind].label}</span>
                    <span className="flex gap-1">
                      <button type="button" aria-label="Diminuir o texto" disabled={size === 0} onClick={() => setSize((s) => s - 1)} className="flex size-11 items-center justify-center rounded-full disabled:opacity-30">
                        <Minus className="size-4" strokeWidth={2} aria-hidden="true" />
                      </button>
                      <button type="button" aria-label="Aumentar o texto" disabled={size === TEXT_SIZES.length - 1} onClick={() => setSize((s) => s + 1)} className="flex size-11 items-center justify-center rounded-full disabled:opacity-30">
                        <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
                      </button>
                    </span>
                  </div>
                  {block.speech && <p className={cn("font-semibold leading-snug", TEXT_SIZES[size])}>{block.speech}</p>}
                  {block.on_screen && <p className="text-sm text-muted-foreground">Na tela (entra na edição): {block.on_screen}</p>}
                </section>
              )}

              {upcoming && (
                <p className="truncate text-sm text-muted-foreground">
                  <span className="label-set mr-2">Depois</span>
                  {upcoming.description || FRAMINGS[upcoming.framing].label}
                </p>
              )}

              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

              <div className="mt-auto flex flex-col gap-2.5 pt-2">
                <button type="button" onClick={() => mark(shot, { recorded: true, takes: shot.takes + 1 }, true)} className="min-h-14 rounded-full bg-primary text-lg font-bold text-primary-foreground">
                  Gravei este plano
                </button>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => mark(shot, { recorded: true, good_take: true, takes: shot.takes + 1 }, true)}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-full border-[1.5px] border-input font-semibold"
                  >
                    <Star className="size-4" strokeWidth={1.75} aria-hidden="true" />
                    Ficou bom
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      logSignal("plano_pulado", { plano: `(${shotTerms(shot)})` }, id);
                      setNotice(`Plano ${scriptNumber.get(shot.id)} ficou para depois. Ele volta no fim.`);
                      const next = nextPending(shots, current);
                      if (next === -1 || next === current) setPhase("fim");
                      else goTo(next);
                    }}
                    className="min-h-12 rounded-full border-[1.5px] border-input font-semibold"
                  >
                    Pular por agora
                  </button>
                </div>
                {current > 0 && (
                  <button type="button" onClick={() => goTo(current - 1)} className="flex min-h-11 items-center gap-1 self-center text-sm text-muted-foreground">
                    <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
                    Plano anterior
                  </button>
                )}
              </div>
            </>
          )}

          {video && shots.length > 0 && phase === "fim" && (
            <>
              <div className="flex flex-col gap-2">
                <h1 className="font-display text-[28px]">{p.done ? "Tudo gravado." : "Faltou algum plano?"}</h1>
                <p className="leading-relaxed text-muted-foreground">
                  {p.done
                    ? `Os ${p.total} planos estão gravados${p.good ? `, ${p.good} com take marcado como bom` : ""}. Confira a lista antes de desmontar o set.`
                    : `${p.missing === 1 ? "Falta 1 plano" : `Faltam ${p.missing} planos`}. Grave agora, enquanto o set está montado: voltar depois custa caro.`}
                </p>
              </div>

              <ol className="flex flex-col gap-2">
                {[...shots]
                  .sort((a, b) => scriptNumber.get(a.id)! - scriptNumber.get(b.id)!)
                  .map((s) => (
                    <li key={s.id} className="flex items-center gap-3 rounded-2xl bg-card p-3.5">
                      <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", s.recorded ? "bg-foreground text-background" : "border-[1.5px] border-rec")}>
                        {s.recorded && <Check className="size-4" strokeWidth={2.5} aria-hidden="true" />}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[15px] font-semibold">{s.description || FRAMINGS[s.framing].label}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          PLANO {String(scriptNumber.get(s.id)).padStart(2, "0")} · {s.takes} TAKE{s.takes === 1 ? "" : "S"}
                          {s.good_take ? " · BOM" : ""}
                        </span>
                      </span>
                      {!s.recorded ? (
                        <button
                          type="button"
                          onClick={() => {
                            setCurrent(shots.indexOf(s));
                            setPhase("set");
                          }}
                          className="min-h-11 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground"
                        >
                          Gravar
                        </button>
                      ) : (
                        <button type="button" onClick={() => mark(s, { recorded: false, good_take: false }, false)} className="min-h-11 px-2 text-sm text-muted-foreground underline">
                          Refazer
                        </button>
                      )}
                    </li>
                  ))}
              </ol>

              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

              {p.done && (
                <div className="flex flex-col gap-3 rounded-2xl border border-border p-4 text-sm leading-relaxed">
                  <p className="font-bold">Na edição</p>
                  <p className="text-muted-foreground">
                    Monte na ordem dos números dos planos (é a ordem do roteiro). Use os takes marcados como bons e corte 2 segundos
                    do começo e do fim de cada um.
                  </p>
                </div>
              )}

              <div className="mt-auto flex flex-col gap-2.5 pt-2">
                {p.done ? (
                  <button type="button" onClick={finishVideo} className="min-h-14 rounded-full bg-primary text-lg font-bold text-primary-foreground">
                    Concluir vídeo
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setCurrent(Math.max(0, firstPending(shots)));
                      setPhase("set");
                    }}
                    className="min-h-14 rounded-full bg-primary text-lg font-bold text-primary-foreground"
                  >
                    Gravar o que falta
                  </button>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
