"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Minus, Plus, RotateCcw, X } from "lucide-react";
import { Folha } from "@/components/gravai/folha";
import { FramingIcon } from "@/components/gravai/framing-icon";
import { PlanList, type PlanRow } from "@/components/gravai/lista-planos";
import { durationLabel } from "@/lib/ideas";
import { logSignal } from "@/lib/sinais";
import { createClient } from "@/lib/supabase/client";
import { FRAMINGS, isSolo, shotTags, shotTerms, type Shot } from "@/lib/planos";
import { BLOCK_KINDS, speakerOf, totalSeconds, type ScriptBlock } from "@/lib/roteiro";
import { firstPending, nextPending, progress, setOrder, setupChange, tipFor } from "@/lib/set";
import { cn } from "@/lib/utils";
import type { Video } from "@/types/database";

type Block = ScriptBlock & { id: string; position: number; person_id?: string | null };
type SetShot = Shot & { id: string; shoot_order: number | null; recorded: boolean; good_take: boolean; takes: number };
type Phase = "abertura" | "set" | "fim";

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
  const [people, setPeople] = useState<{ id: string; name: string; role: string }[]>([]);
  const [shots, setShots] = useState<SetShot[]>([]);
  const [phase, setPhase] = useState<Phase>("abertura");
  const [current, setCurrent] = useState(0);
  const [previousId, setPreviousId] = useState<string | null>(null); // último plano mostrado, para o aviso de troca de cenário
  const [size, setSize] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null); // "Plano 3 gravado": diz o que aconteceu ao tocar
  // A lista de planos (o contador "3 / 8" abre): pular para qualquer plano, sem passar por todos.
  const [listOpen, setListOpen] = useState(false);
  const counter = useRef<HTMLButtonElement>(null);
  const [skipped, setSkipped] = useState<string[]>([]); // pulados nesta sessão de gravação
  // Depois de "Gravei", o plano espera a resposta: ficou bom (segue) ou outro take (fica).
  const [review, setReview] = useState<string | null>(null);
  const finaleStarted = useRef(false);

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
      db.from("video_people").select("id, name, role").eq("video_id", id),
    ]).then(([v, b, s, p]) => {
      setPeople(p.data ?? []);
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
    setReview(null);
    setCurrent(index);
  }

  // Cada "Gravei" é um take a mais, salvo na hora: sair no meio não perde nada.
  async function recorded(shot: SetShot) {
    if (await mark(shot, { recorded: true, takes: shot.takes + 1 }, false)) setReview(shot.id);
  }

  async function mark(shot: SetShot, patch: Partial<SetShot>, advance: boolean): Promise<boolean> {
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
      return false;
    }
    if (updated.recorded) setSkipped((l) => l.filter((x) => x !== shot.id));
    if (advance) {
      const next = nextPending(list, list.indexOf(updated));
      const done = `Plano ${scriptNumber.get(shot.id)} ${patch.good_take ? "ficou bom" : "gravado"}`;
      setNotice(next === -1 ? done : `${done}. Agora o plano ${scriptNumber.get(list[next].id)}.`);
      if (next === -1) {
        setReview(null);
        setPhase("fim");
      } else goTo(next);
    }
    return true;
  }

  async function finishVideo(to: "publicar" | "visao") {
    const { error } = await createClient().from("videos").update({ stage: "pronto" }).eq("id", id);
    if (error) setError("Não deu para concluir. Tente de novo.");
    else router.push(to === "publicar" ? `/video/${id}/publicar` : `/video/${id}`);
  }

  const p = progress(shots);

  // Tudo gravado: o Gravaí já deixa a publicação pronta (se ainda não houver), sem segurar a tela.
  useEffect(() => {
    if (phase !== "fim" || !p.done || !video || finaleStarted.current) return;
    finaleStarted.current = true;
    const db = createClient();
    db.from("video_posts")
      .select("platform", { count: "exact", head: true })
      .eq("video_id", id)
      .then(({ count }) => {
        if (count) return;
        fetch("/api/publicar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ videoId: id }) }).catch(() => null);
      });
  }, [phase, p.done, video, id]);
  const shot = shots[current];
  const block = blocks.find((b) => b.id === shot?.block_id);
  const blockNumber = block ? blocks.indexOf(block) + 1 : 0;
  const scriptNumber = new Map(
    [...shots].sort((a, b) => (blocks.findIndex((x) => x.id === a.block_id) - blocks.findIndex((x) => x.id === b.block_id)) || a.position - b.position).map((s, i) => [s.id, i + 1]),
  );
  const change = shot ? setupChange(shots.find((s) => s.id === previousId), shot) : null;
  const upcoming = shots.find((s, i) => i > current && !s.recorded);
  const rows: PlanRow[] = shots.map((s, i) => ({
    id: s.id,
    number: scriptNumber.get(s.id) ?? i + 1,
    description: s.description,
    framing: s.framing,
    angle: s.angle,
    movement: s.movement,
    orientation: s.orientation,
    location: s.location,
    recorded: s.recorded,
    good: s.good_take,
    takes: s.takes,
    skipped: skipped.includes(s.id),
    current: phase === "set" && i === current,
  }));

  function closeList() {
    setListOpen(false);
    counter.current?.focus();
  }

  // Da lista direto para o plano escolhido, de qualquer fase.
  function pick(shotId: string) {
    const index = shots.findIndex((s) => s.id === shotId);
    if (index === -1) return;
    goTo(index);
    setPhase("set");
    setListOpen(false);
  }

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
            {shots.length > 0 ? (
              <button
                ref={counter}
                type="button"
                onClick={() => setListOpen(true)}
                aria-haspopup="dialog"
                aria-label={`${p.recorded} de ${p.total} planos gravados. Ver a lista de planos`}
                className="-mr-3 flex min-h-11 items-center gap-1 px-3 font-mono text-sm"
              >
                {p.recorded} / {p.total}
                <ChevronDown className="size-4" strokeWidth={1.75} aria-hidden="true" />
              </button>
            ) : (
              <span className="size-11" />
            )}
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

          {video && shots.length > 0 && phase === "abertura" && (
            <>
              <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
                {/* O símbolo do Gravaí: a lente com a luz de gravação olhando de um lado para o outro. */}
                <span className="flex size-36 items-center justify-center rounded-full border-[10px] border-foreground" aria-hidden="true">
                  <span className="set-look size-20 rounded-full bg-rec" />
                </span>
                <div className="flex flex-col gap-2">
                  <h1 className="font-display text-[34px]">Bora gravar.</h1>
                  <p className="label-set text-muted-foreground">
                    {shots.length} {shots.length === 1 ? "plano" : "planos"} · {new Set(shots.map((s) => s.location.trim().toLowerCase())).size}{" "}
                    {new Set(shots.map((s) => s.location.trim().toLowerCase())).size === 1 ? "lugar" : "lugares"}
                  </p>
                </div>
              </div>
              <p className="text-center text-sm text-muted-foreground">
                <span className="label-set mr-2">Dica</span>
                {tipFor(id)}
              </p>
              <button type="button" onClick={() => setPhase("set")} className="flex min-h-14 items-center justify-center gap-2.5 rounded-full bg-primary text-lg font-bold text-primary-foreground">
                <span className="size-3 rounded-full bg-rec" aria-hidden="true" />
                Começar a gravar
              </button>
            </>
          )}

          {video && shot && phase === "set" && (
            <>
              {change && <p className="rounded-xl border border-rec/50 px-4 py-3 text-sm font-semibold">{change}</p>}

              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-4">
                  <FramingIcon framing={shot.framing} orientation={shot.orientation} size="lg" />
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <p className="font-mono text-sm tracking-wide text-muted-foreground">
                      PARTE {String(blockNumber).padStart(2, "0")} · PLANO {String(scriptNumber.get(shot.id)).padStart(2, "0")}
                      {review === shot.id ? ` · TAKE ${shot.takes}` : shot.takes > 0 ? ` · TAKE ${shot.takes + 1}` : ""}
                    </p>
                    <p className="label-set">{shotTags(shot).join(" · ")}</p>
                    {(shot.location || shot.wardrobe) && <p className="label-set text-muted-foreground">{[shot.location, shot.wardrobe].filter(Boolean).join(" · ")}</p>}
                  </div>
                </div>
                <h1 className="font-display text-[26px]">{shot.description || FRAMINGS[shot.framing].label}</h1>
              </div>

              {block && (block.speech || block.on_screen) && (
                <section aria-label="Teleprompter" className="flex flex-col gap-3 rounded-2xl bg-card p-5">
                  <div className="flex items-center justify-between">
                    <span className="label-set text-muted-foreground">
                      {["Fala", speakerOf(block, people, isSolo(video.resources ?? [])), block.label || BLOCK_KINDS[block.kind].label].filter(Boolean).join(" · ")}
                    </span>
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
                {review === shot.id ? (
                  <>
                    <p className="label-set text-center text-muted-foreground" role="status">
                      Take {shot.takes} gravado · ficou bom?
                    </p>
                    <button
                      type="button"
                      onClick={() => mark(shot, { good_take: true }, true)}
                      className="flex min-h-14 items-center justify-center gap-2 rounded-full bg-primary text-lg font-bold text-primary-foreground"
                    >
                      <Check className="size-5" strokeWidth={2.5} aria-hidden="true" />
                      Ficou bom, próximo
                    </button>
                    <button type="button" onClick={() => setReview(null)} className="flex min-h-12 items-center justify-center gap-2 rounded-full border-[1.5px] border-input font-semibold">
                      <RotateCcw className="size-4" strokeWidth={1.75} aria-hidden="true" />
                      Gravar outro take
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => recorded(shot)} className="min-h-14 rounded-full bg-primary text-lg font-bold text-primary-foreground">
                      Gravei
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        logSignal("plano_pulado", { plano: `(${shotTerms(shot)})` }, id);
                        setSkipped((l) => (l.includes(shot.id) ? l : [...l, shot.id]));
                        setNotice(`Plano ${scriptNumber.get(shot.id)} ficou para depois. Ele volta no fim.`);
                        const next = nextPending(shots, current);
                        if (next === -1 || next === current) setPhase("fim");
                        else goTo(next);
                      }}
                      className="min-h-12 rounded-full border-[1.5px] border-input font-semibold"
                    >
                      Pular por agora
                    </button>
                  </>
                )}
              </div>
            </>
          )}

          {video && shots.length > 0 && phase === "fim" && p.done && (
            <>
              <div className="flex flex-col gap-2">
                <h1 className="font-display text-[30px]">Vídeo gravado.</h1>
              </div>

              <div className="grid grid-cols-3 gap-2" aria-label="Resumo da gravação">
                {[
                  [String(p.total), p.total === 1 ? "plano" : "planos"],
                  [String(p.good), p.good === 1 ? "take bom" : "takes bons"],
                  [durationLabel(Math.round(totalSeconds(blocks))), "de roteiro"],
                ].map(([n, label]) => (
                  <div key={label} className="flex flex-col items-center gap-0.5 rounded-xl bg-card py-3">
                    <span className="font-display text-xl">{n}</span>
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>

              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            </>
          )}

          {video && shots.length > 0 && phase === "fim" && !p.done && (
            <>
              <div className="flex flex-col gap-2">
                <h1 className="font-display text-[28px]">Faltou algum plano?</h1>
                <p className="leading-relaxed text-muted-foreground">
                  {`${p.missing === 1 ? "Falta 1 plano" : `Faltam ${p.missing} planos`}. Grave agora, com o set montado.`}
                </p>
              </div>
              <PlanList rows={rows} onPick={pick} />
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            </>
          )}

          {video && shots.length > 0 && phase === "fim" && (
            <>
              <div className="mt-auto flex flex-col gap-2.5 pt-2">
                {p.done ? (
                  <>
                    <button type="button" onClick={() => finishVideo("publicar")} className="min-h-14 rounded-full bg-primary text-lg font-bold text-primary-foreground">
                      Ver a publicação
                    </button>
                    <button type="button" onClick={() => finishVideo("visao")} className="min-h-11 text-sm text-muted-foreground underline">
                      Concluir sem publicar agora
                    </button>
                  </>
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

      {listOpen && (
        <Folha title="Ordem de gravação" summary={`${p.recorded} ${p.recorded === 1 ? "gravado" : "gravados"}${skipped.length ? ` · ${skipped.length} pulado${skipped.length === 1 ? "" : "s"}` : ""} · ${p.total} planos`} onClose={closeList}>
          <PlanList rows={rows} onPick={pick} />
        </Folha>
      )}
    </div>
  );
}
