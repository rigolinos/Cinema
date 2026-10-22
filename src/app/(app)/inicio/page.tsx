"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo";
import { MemoryNote } from "@/components/gravai/memoria";
import { RadarCard, useRadar } from "@/components/gravai/radar";
import { VideoCard, type VideoRow } from "@/components/gravai/video-card";
import { createClient } from "@/lib/supabase/client";
import { FORMATS } from "@/lib/formats";
import { daysUntilNext, periodLabel, periodStart } from "@/lib/quinzena";

// O formato muda toda semana (semanas contadas desde 01/01/2026).
function formatOfTheWeek() {
  const week = Math.floor((Date.now() - Date.UTC(2026, 0, 1)) / (7 * 24 * 60 * 60 * 1000));
  return FORMATS[((week % FORMATS.length) + FORMATS.length) % FORMATS.length];
}

const SHOW = 5;

export default function InicioPage() {
  const [videos, setVideos] = useState<VideoRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const week = formatOfTheWeek();
  const radar = useRadar();

  useEffect(() => {
    const db = createClient();
    // Rascunhos vazios com mais de 1 hora somem antes de listar (vídeo aberto e abandonado sem resposta).
    db.rpc("delete_empty_drafts", { p_keep_minutes: 60 }).then(() =>
      db
        .from("videos")
        .select("*", { count: "exact" })
        .is("archived_at", null)
        .neq("stage", "pronto")
        .order("updated_at", { ascending: false })
        .limit(SHOW)
        .then(({ data, error, count }) => {
          if (error) setError("Não foi possível carregar seus vídeos.");
          setVideos((data ?? []) as VideoRow[]);
          setTotal(count ?? 0);
        }),
    );
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

      <MemoryNote />

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
        <div className="flex items-baseline justify-between">
          <h2 id="andamento" className="label-set text-muted-foreground">
            Em andamento
          </h2>
          <Link href="/videos" className="flex min-h-11 items-center text-sm font-semibold underline">
            Meus vídeos
          </Link>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {videos === null && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {videos?.length === 0 && (
          <p className="rounded-2xl bg-card p-4 text-sm leading-relaxed text-muted-foreground">
            Nada em andamento. Toque em <strong className="text-foreground">Novo vídeo</strong> ou escolha uma das ideias da quinzena.
          </p>
        )}
        {videos?.map((v) => (
          <VideoCard
            key={v.id}
            video={v}
            onChange={(next) => {
              setVideos((list) => (list ?? []).flatMap((x) => (x.id !== v.id ? [x] : next && !next.archived_at ? [next] : [])));
              if (!next || next.archived_at) setTotal((t) => t - 1);
            }}
          />
        ))}
        {total > SHOW && (
          <Link href="/videos" className="flex min-h-11 items-center justify-center text-sm font-semibold underline">
            Ver todos ({total} em andamento)
          </Link>
        )}
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
