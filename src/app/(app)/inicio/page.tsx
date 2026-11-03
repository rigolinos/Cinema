"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo";
import { MemoryNote } from "@/components/gravai/memoria";
import { RadarCard, useRadar } from "@/components/gravai/radar";
import { InviteCard, VideoCard, type VideoRow } from "@/components/gravai/video-card";
import { createClient } from "@/lib/supabase/client";
import { withInvites, type InviteRow } from "@/lib/convites";
import { FORMATS } from "@/lib/formats";
import { daysUntilNext, periodLabel, periodStart } from "@/lib/quinzena";

// O formato muda todo dia, à meia-noite de Brasília (dias contados desde 01/01/2026). Hora fixa, para servidor e celular
// escolherem o mesmo.
function formatOfTheDay() {
  const day = Math.floor((Date.now() - 3 * 60 * 60 * 1000 - Date.UTC(2026, 0, 1)) / (24 * 60 * 60 * 1000));
  return FORMATS[((day % FORMATS.length) + FORMATS.length) % FORMATS.length];
}

const SHOW = 5;

export default function InicioPage() {
  const [videos, setVideos] = useState<VideoRow[] | null>(null);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const today = formatOfTheDay();
  const radar = useRadar();

  useEffect(() => {
    const db = createClient();
    // Rascunhos vazios com mais de 1 hora somem antes de listar (vídeo aberto e abandonado sem resposta).
    db.rpc("delete_empty_drafts", { p_keep_minutes: 60 }).then(() =>
      Promise.all([
        db.from("videos").select("*", { count: "exact" }).is("archived_at", null).neq("stage", "pronto").order("updated_at", { ascending: false }).limit(SHOW),
        db.rpc("my_invites"),
      ]).then(([{ data, error, count }, mine]) => {
        if (error) setError("Não foi possível carregar seus vídeos.");
        setInvites(((mine.data ?? []) as InviteRow[]).filter((i) => i.stage !== "pronto"));
        setVideos((data ?? []) as VideoRow[]);
        setTotal(count ?? 0);
      }),
    );
  }, []);

  const list = withInvites(videos ?? [], invites).slice(0, SHOW);
  const all = total + invites.length;

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
          <span className="text-sm opacity-75">Da ideia à gravação</span>
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
        <div className="flex items-center justify-between">
          <h2 id="andamento" className="label-set text-muted-foreground">
            Em andamento
          </h2>
          <Link href="/videos" className="flex min-h-11 items-center rounded-full bg-card px-4 text-sm font-semibold">
            Ver todos{all > SHOW ? ` (${all})` : ""}
          </Link>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {videos === null && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {videos !== null && list.length === 0 && (
          <p className="rounded-2xl bg-card p-4 text-sm leading-relaxed text-muted-foreground">
            Nada em andamento. Toque em <strong className="text-foreground">Novo vídeo</strong> ou escolha uma das ideias da quinzena.
          </p>
        )}
        {list.map((item) =>
          item.kind === "invite" ? (
            <InviteCard key={item.row.token} invite={item.row} onRemove={() => setInvites((rows) => rows.filter((x) => x.token !== item.row.token))} />
          ) : (
            <VideoCard
              key={item.row.id}
              video={item.row}
              onChange={(next) => {
                const stays = next && !next.archived_at && next.stage !== "pronto";
                setVideos((rows) => (rows ?? []).flatMap((x) => (x.id !== item.row.id ? [x] : stays ? [next] : [])));
                if (!stays) setTotal((t) => t - 1);
              }}
            />
          ),
        )}
      </section>

      {radar?.[0] ? (
        <RadarCard item={radar[0]} />
      ) : (
        <Link href={`/ideias/formatos#${today.slug}`} className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-foreground p-4">
          <span className="label-set text-muted-foreground">Formato do dia</span>
          <span className="text-lg font-bold">{today.name}</span>
          <span className="text-sm leading-relaxed text-muted-foreground">{today.summary}</span>
        </Link>
      )}

      {/* Por último: ele só aparece depois de carregar, e aqui não empurra nada na tela. */}
      <MemoryNote />
    </div>
  );
}
