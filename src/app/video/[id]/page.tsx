"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronLeft, Lock } from "lucide-react";
import { READY_STAGES as READY, Trail, STAGES, reachableIndex, stageLabel } from "@/components/gravai/trail";
import { createClient } from "@/lib/supabase/client";
import { findFormat } from "@/lib/formats";
import { OBJECTIVES, PLATFORMS, durationLabel } from "@/lib/ideas";
import { cn } from "@/lib/utils";
import type { Video } from "@/types/database";

const NEXT_STEPS: Record<string, string> = {
  roteiro: "Escrever junto com você, bloco a bloco: gancho, contexto, conteúdo, virada e chamada final.",
  pessoas: "Quem aparece e quem filma, cada um com um link só com a parte dele.",
  planos: "Cada parte do roteiro vira as tomadas que você precisa, com o porquê de cada ângulo.",
  gravar: "No celular: lista de planos, teleprompter e nada esquecido no dia.",
};

// Visão geral do vídeo: a ideia escolhida e o que vem pela frente na trilha.
export default function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [video, setVideo] = useState<Video | null | undefined>(undefined);

  useEffect(() => {
    createClient()
      .from("videos")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => setVideo((data as Video | null) ?? null));
  }, [id]);

  const format = findFormat(video?.format_slug);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-5 pb-16 pt-3">
      <Link href="/inicio" aria-label="Voltar ao início" className="-ml-3 flex size-11 items-center justify-center">
        <ChevronLeft className="size-6" strokeWidth={1.75} aria-hidden="true" />
      </Link>

      {video === undefined && <p className="label-set text-muted-foreground">Carregando…</p>}
      {video === null && <p className="text-sm text-destructive">Não encontramos este vídeo.</p>}

      {video && (
        <>
          <div className="flex flex-col gap-3">
            <p className="label-set text-muted-foreground">{stageLabel(video.stage)}</p>
            <h1 className="font-display text-[28px]">{video.title || "Vídeo sem ideia ainda"}</h1>
            <Trail stage={video.stage} />
            <p className="font-mono text-sm text-muted-foreground">
              {[
                video.objective && OBJECTIVES[video.objective],
                video.platform && PLATFORMS[video.platform],
                video.duration_s && durationLabel(video.duration_s),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          {video.hook && (
            <section className="flex flex-col gap-2.5 rounded-2xl bg-card p-4" aria-labelledby="ideia">
              <h2 id="ideia" className="label-set text-muted-foreground">
                Ideia{format ? ` · ${format.name}` : ""}
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
          </section>
        </>
      )}
    </div>
  );
}
