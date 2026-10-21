"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo";
import { RadarCard, useRadar } from "@/components/gravai/radar";
import { READY_STAGES, STAGES, Trail, reachableIndex, stageLabel } from "@/components/gravai/trail";
import { createClient } from "@/lib/supabase/client";
import { FORMATS } from "@/lib/formats";
import { durationLabel } from "@/lib/ideas";
import { daysUntilNext, periodLabel, periodStart } from "@/lib/quinzena";
import type { Video } from "@/types/database";

// O formato muda toda semana (semanas contadas desde 01/01/2026).
function formatOfTheWeek() {
  const week = Math.floor((Date.now() - Date.UTC(2026, 0, 1)) / (7 * 24 * 60 * 60 * 1000));
  return FORMATS[((week % FORMATS.length) + FORMATS.length) % FORMATS.length];
}

// "Continuar" abre direto o passo em que a pessoa está, se ele já existe no app.
function videoHref(v: Video): string {
  const step = STAGES[reachableIndex(v.stage)]?.id;
  return step && READY_STAGES.includes(step) ? `/video/${v.id}/${step}` : `/video/${v.id}`;
}

export default function InicioPage() {
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const week = formatOfTheWeek();
  const radar = useRadar();

  useEffect(() => {
    createClient()
      .from("videos")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (error) setError("Não foi possível carregar seus vídeos.");
        setVideos((data ?? []) as Video[]);
      });
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <Logo className="text-[26px]" />
      </header>

      <h1 className="font-display text-[32px]">
        O que vamos
        <br />
        gravar hoje?
      </h1>

      <Link href="/novo" className="flex min-h-11 items-center justify-between rounded-2xl bg-primary px-5 py-5 text-primary-foreground">
        <span className="flex flex-col gap-1">
          <span className="flex items-center gap-2 text-lg font-bold">
            <span className="size-2.5 rounded-full bg-rec" aria-hidden="true" />
            Novo vídeo
          </span>
          <span className="text-sm opacity-75">Da ideia à gravação em 5 passos</span>
        </span>
        <ArrowRight className="size-6" strokeWidth={1.75} aria-hidden="true" />
      </Link>

      <Link href="/ideias" className="flex items-center justify-between gap-3 rounded-2xl border-[1.5px] border-foreground px-5 py-4">
        <span className="flex flex-col gap-1">
          <span className="font-bold">Ideias da quinzena para você</span>
          {/* A data só aparece depois de carregar no aparelho: a página é montada no build. */}
          <span className="min-h-5 font-mono text-sm text-muted-foreground">
            {videos !== null && `${periodLabel(periodStart())} · ${daysUntilNext() === 1 ? "novas amanhã" : `novas em ${daysUntilNext()} dias`}`}
          </span>
        </span>
        <ArrowRight className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      </Link>

      <section className="flex flex-col gap-2.5" aria-labelledby="andamento">
        <h2 id="andamento" className="label-set text-muted-foreground">
          Seus vídeos
        </h2>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {videos === null && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {videos?.length === 0 && (
          <p className="rounded-2xl bg-card p-4 text-sm leading-relaxed text-muted-foreground">
            Nenhum vídeo ainda. Toque em <strong className="text-foreground">Novo vídeo</strong> e o Gravaí te ajuda a achar a
            primeira ideia.
          </p>
        )}
        {videos?.map((v) => (
          <Link
            key={v.id}
            href={videoHref(v)}
            className="flex flex-col gap-3 rounded-2xl bg-card p-4"
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-[17px] font-bold leading-snug">{v.title || "Vídeo sem ideia ainda"}</span>
              {v.duration_s && <span className="font-mono text-sm text-muted-foreground">{durationLabel(v.duration_s)}</span>}
            </span>
            <Trail stage={v.stage} />
            <span className="flex items-center justify-between">
              <span className="label-set text-muted-foreground">{stageLabel(v.stage)}</span>
              <span className="text-sm font-semibold">Continuar</span>
            </span>
          </Link>
        ))}
      </section>

      {radar?.[0] ? (
        <RadarCard item={radar[0]} />
      ) : (
        <Link href={`/ideias#${week.slug}`} className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-foreground p-4">
          <span className="label-set text-muted-foreground">Formato da semana</span>
          <span className="text-lg font-bold">{week.name}</span>
          <span className="text-sm leading-relaxed text-muted-foreground">{week.summary}</span>
        </Link>
      )}
    </div>
  );
}
