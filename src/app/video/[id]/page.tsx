"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/gravai/confirm";
import { ArrowRight, Check, ChevronLeft, Lock, Pencil, RotateCcw, Share2, Trash2 } from "lucide-react";
import { PlansOutdated } from "@/components/gravai/aviso-planos";
import { VideoMaterial, type SheetBlock, type SheetPerson, type SheetShot } from "@/components/gravai/material-video";
import { BackLink } from "@/components/gravai/voltar";
import { READY_STAGES as READY, Trail, STAGES, nextReadyStage, reachableIndex, stageLabel } from "@/components/gravai/trail";
import { createClient } from "@/lib/supabase/client";
import { findFormat } from "@/lib/formats";
import { OBJECTIVES, durationLabel, platformsLabel, videoPlatforms } from "@/lib/ideas";
import { cn } from "@/lib/utils";
import type { Video } from "@/types/database";

const NEXT_STEPS: Record<string, string> = {
  roteiro: "Escrever junto com você, cena por cena: gancho, contexto, conteúdo, virada e chamada final.",
  pessoas: "Quem aparece e quem filma, cada um com um link só com a parte dele.",
  planos: "Cada cena do roteiro vira as tomadas que você precisa, com o porquê de cada ângulo.",
  gravar: "No celular: lista de planos, teleprompter e nada esquecido no dia.",
};

// A página do vídeo. Sem roteiro ainda, mostra a ideia e o que vem pela frente na trilha.
// Com roteiro, vira a folha do vídeo: o material do dia de gravar, com o passo a passo como opção.
export default function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [video, setVideo] = useState<Video | null | undefined>(undefined);
  const [blocks, setBlocks] = useState<SheetBlock[]>([]);
  const [shots, setShots] = useState<SheetShot[]>([]);
  const [people, setPeople] = useState<SheetPerson[]>([]);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const { confirm, sheet } = useConfirm();
  const router = useRouter();

  useEffect(() => {
    const db = createClient();
    Promise.all([
      db.from("videos").select("*").eq("id", id).maybeSingle(),
      db.from("script_blocks").select("*").eq("video_id", id).order("position"),
      db.from("shots").select("*").eq("video_id", id),
      db.from("video_people").select("id, name, role, roles, confirmed_at").eq("video_id", id).order("created_at"),
    ]).then(([v, b, s, p]) => {
      setBlocks((b.data ?? []) as SheetBlock[]);
      setShots((s.data ?? []) as SheetShot[]);
      setPeople((p.data ?? []) as SheetPerson[]);
      setVideo((v.data as Video | null) ?? null);
    });
  }, [id]);

  const format = findFormat(video?.format_slug);
  const hasScript = blocks.length > 0;
  const ready = video?.stage === "gravar" || video?.stage === "pronto";
  const sheetOpen = Boolean(video && hasScript);

  // Ninguém para chamar: segue direto para os planos (dá para voltar em Pessoas depois).
  async function skipPeople() {
    if (!video) return;
    const stage = nextReadyStage("pessoas");
    const { error } = await createClient().from("videos").update({ stage }).eq("id", id);
    if (error) setDeleteError("Não deu para pular. Tente de novo.");
    else router.push(`/video/${id}/${stage}`);
  }

  async function saveName() {
    const title = name.trim().slice(0, 140);
    if (!video || !title) return;
    const { error } = await createClient().from("videos").update({ title }).eq("id", id);
    if (error) {
      setDeleteError("Não deu para mudar o nome. Tente de novo.");
      return;
    }
    setVideo({ ...video, title });
    setRenaming(false);
  }

  // Marcar direto na lista, para quem gravou sem o passo a passo. Conta como um take bom, e desmarcar desfaz.
  async function toggleShot(shotId: string) {
    const shot = shots.find((s) => s.id === shotId);
    if (!shot) return;
    const patch = shot.recorded ? { recorded: false, good_take: false } : { recorded: true, good_take: true, takes: Math.max(shot.takes, 1) };
    const before = shots;
    setShots(shots.map((s) => (s.id === shotId ? { ...s, ...patch } : s)));
    const { error } = await createClient().from("shots").update(patch).eq("id", shotId);
    if (error) {
      setShots(before);
      setDeleteError("Não deu para marcar o plano. Confira a conexão.");
    }
  }

  // Marcar sem passar pelo set: muita gente grava fora do app e só quer deixar organizado.
  async function toggleRecorded() {
    if (!video) return;
    const stage = video.stage === "pronto" ? "gravar" : "pronto";
    const { error } = await createClient().from("videos").update({ stage }).eq("id", id);
    if (error) setDeleteError("Não deu para mudar. Tente de novo.");
    else setVideo({ ...video, stage });
  }

  async function removeVideo() {
    if (!(await confirm({ title: "Apagar este vídeo?", text: "A ideia, o roteiro, os planos e os links das pessoas somem. Isso não tem volta.", action: "Apagar para sempre", danger: true }))) return;
    setDeleteError(null);
    const { error } = await createClient().from("videos").delete().eq("id", id);
    if (error) setDeleteError("Não deu para apagar o vídeo. Tente de novo.");
    else router.push("/inicio");
  }

  return (
    <div className={cn("mx-auto flex max-w-lg flex-col gap-6 px-5 pt-3", sheetOpen ? "pb-32" : "pb-16")}>
      {sheet}
      <BackLink href="/videos" className="-ml-3 flex size-11 items-center justify-center">
        <ChevronLeft className="size-6" strokeWidth={1.75} aria-hidden="true" />
      </BackLink>

      {video === undefined && <p className="label-set text-muted-foreground">Carregando…</p>}
      {video === null && <p className="text-sm text-destructive">Não encontramos este vídeo.</p>}

      {video && (
        <>
          <div className="flex flex-col gap-3">
            <p className="label-set text-muted-foreground">{stageLabel(video.stage)}</p>
            {renaming ? (
              <form
                className="flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveName();
                }}
              >
                <label className="sr-only" htmlFor="nome-do-video">
                  Nome do vídeo
                </label>
                <input
                  id="nome-do-video"
                  autoFocus
                  value={name}
                  maxLength={140}
                  onChange={(e) => setName(e.target.value)}
                  className="min-h-12 w-full rounded-xl border border-input bg-card px-3.5 text-lg font-bold outline-none focus:border-foreground"
                />
                <div className="flex gap-4 text-sm font-semibold">
                  <button type="submit" disabled={!name.trim()} className="min-h-11 underline disabled:opacity-40">
                    Salvar o nome
                  </button>
                  <button type="button" onClick={() => setRenaming(false)} className="min-h-11 text-muted-foreground">
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <h1 className="font-display text-[28px]">{video.title || "Vídeo sem ideia ainda"}</h1>
                {video.title && (
                  <button
                    type="button"
                    aria-label="Mudar o nome do vídeo"
                    onClick={() => {
                      setName(video.title ?? "");
                      setRenaming(true);
                    }}
                    className="-mr-2.5 -mt-1 flex size-11 shrink-0 items-center justify-center text-muted-foreground"
                  >
                    <Pencil className="size-4" strokeWidth={1.75} aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
            {!ready && <Trail stage={video.stage} />}
            <p className="font-mono text-sm text-muted-foreground">
              {[
                video.objective && OBJECTIVES[video.objective],
                platformsLabel(videoPlatforms(video)),
                video.duration_s && durationLabel(video.duration_s),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          {hasScript && <PlansOutdated videoId={id} blocks={blocks} shots={shots} onUpdated={setShots} />}

          {hasScript && <VideoMaterial video={video} blocks={blocks} shots={shots} people={people} onToggleShot={toggleShot} />}

          {!hasScript && video.hook && (
            <section className="flex flex-col gap-2.5 rounded-2xl bg-card p-4" aria-labelledby="ideia">
              <h2 id="ideia" className="label-set text-muted-foreground">
                Ideia
              </h2>
              <div className="flex flex-col gap-1 rounded-lg bg-muted px-3 py-2.5">
                <span className="label-set text-muted-foreground">Gancho · 0–3 s</span>
                <p className="text-[15px] font-semibold leading-snug">“{video.hook}”</p>
              </div>
              {format && (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  <strong className="font-semibold text-foreground">Estrutura:</strong> {format.structure.join(" → ")}
                </p>
              )}
              <Link href={`/video/${video.id}/ideia`} className="flex min-h-11 items-center text-sm font-semibold underline">
                Trocar de ideia
              </Link>
            </section>
          )}

          {!hasScript && (
            <section className="flex flex-col gap-2.5" aria-labelledby="passos">
              <h2 id="passos" className="label-set text-muted-foreground">
                Passos
              </h2>
              {STAGES.slice(1).map((s, i) => {
                const index = i + 1;
                const current = reachableIndex(video.stage);
                const open = video.hook && READY.includes(s.id) && index <= current;
                if (open) {
                  return (
                    <Link
                      key={s.id}
                      href={`/video/${video.id}/${s.id}`}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-2xl p-4",
                        index === current ? "bg-primary text-primary-foreground" : "bg-card",
                      )}
                    >
                      <span className="flex flex-col gap-1">
                        <span className="font-bold">{s.label}</span>
                        <span className={cn("text-sm leading-relaxed", index === current ? "opacity-75" : "text-muted-foreground")}>
                          {index < current ? "Feito. Toque para rever ou mudar." : NEXT_STEPS[s.id]}
                        </span>
                      </span>
                      {index < current ? (
                        <Check className="size-5 shrink-0" strokeWidth={2} aria-hidden="true" />
                      ) : (
                        <ArrowRight className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                      )}
                    </Link>
                  );
                }
                return (
                  <div key={s.id} className="flex items-start gap-3 rounded-2xl border border-border p-4">
                    <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                    <div className="flex flex-col gap-1">
                      <p className="font-bold">{s.label}</p>
                      <p className="text-sm leading-relaxed text-muted-foreground">{NEXT_STEPS[s.id]}</p>
                      <p className="label-set text-muted-foreground">
                        {READY.includes(s.id) ? "Depois do passo anterior" : "Chega numa próxima atualização"}
                      </p>
                    </div>
                  </div>
                );
              })}
              {video.stage === "pessoas" && (
                <button type="button" onClick={skipPeople} className="flex min-h-12 items-center justify-center rounded-full border-[1.5px] border-foreground font-semibold">
                  Vou gravar sozinho, pular para os planos
                </button>
              )}
            </section>
          )}

          {hasScript && video.stage === "pessoas" && (
            <button type="button" onClick={skipPeople} className="flex min-h-12 items-center justify-center rounded-full border-[1.5px] border-foreground font-semibold">
              Vou gravar sozinho, pular para os planos
            </button>
          )}

          {hasScript && !ready && (
            <Link href={`/video/${video.id}/ideia`} className="flex min-h-11 items-center self-start text-sm font-semibold underline">
              Trocar de ideia
            </Link>
          )}

          {ready && (
            <button type="button" onClick={toggleRecorded} className="flex min-h-12 items-center justify-center gap-2 rounded-full border-[1.5px] border-foreground font-semibold">
              {video.stage === "pronto" ? <RotateCcw className="size-5" strokeWidth={1.75} aria-hidden="true" /> : <Check className="size-5" strokeWidth={2} aria-hidden="true" />}
              {video.stage === "pronto" ? "Ainda não gravei" : "Já gravei"}
            </button>
          )}

          {video.hook && (
            <Link href={`/video/${video.id}/exportar`} className="flex min-h-12 items-center justify-center gap-2 rounded-full border-[1.5px] border-foreground font-semibold">
              <Share2 className="size-5" strokeWidth={1.75} aria-hidden="true" />
              Exportar o vídeo
            </Link>
          )}

          <button type="button" onClick={removeVideo} className="flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-destructive">
            <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Apagar este vídeo
          </button>
          {deleteError && (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          )}

          {/* A ação do momento fica sempre à mão: quem abre para gravar não precisa rolar até o fim. */}
          {sheetOpen && (
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] print:hidden">
              <div className="mx-auto max-w-lg px-4 py-3">
                {video.stage === "gravar" ? (
                  <Link href={`/video/${video.id}/gravar`} className="flex min-h-13 items-center justify-center gap-2.5 rounded-full bg-primary font-bold text-primary-foreground">
                    <span className="size-2.5 rounded-full bg-rec" aria-hidden="true" />
                    Gravar passo a passo
                  </Link>
                ) : video.stage === "pronto" ? (
                  <Link href={`/video/${video.id}/publicar`} className="flex min-h-13 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
                    {video.published_at ? "Ver a publicação" : "Preparar a publicação"}
                  </Link>
                ) : (
                  <Link href={`/video/${video.id}/${video.stage}`} className="flex min-h-13 items-center justify-center gap-2 rounded-full bg-primary font-bold text-primary-foreground">
                    Continuar: {STAGES[reachableIndex(video.stage)]?.label}
                    <ArrowRight className="size-5" strokeWidth={1.75} aria-hidden="true" />
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
