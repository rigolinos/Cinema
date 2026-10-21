"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { VideoCard, type VideoRow } from "@/components/gravai/video-card";
import { createClient } from "@/lib/supabase/client";
import { isEmptyDraft, videoTab, type VideoTab } from "@/lib/meus-videos";
import { cn } from "@/lib/utils";

const TABS: [VideoTab, string][] = [
  ["andamento", "Em andamento"],
  ["prontos", "Prontos"],
  ["arquivados", "Arquivados"],
];

const EMPTY: Record<VideoTab, string> = {
  andamento: "Nenhum vídeo em andamento. Toque em Novo vídeo para começar.",
  prontos: "Quando você concluir a gravação de um vídeo, ele aparece aqui.",
  arquivados: "Arquive pelo menu ⋯ de um vídeo para tirá-lo da frente sem apagar.",
};

// Meus vídeos: todos, separados por situação, com arquivar, apagar e limpar rascunhos vazios.
export default function MeusVideosPage() {
  const [videos, setVideos] = useState<VideoRow[] | null>(null);
  const [tab, setTab] = useState<VideoTab>("andamento");
  const [cleaning, setCleaning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    createClient()
      .from("videos")
      .select("*")
      .order("updated_at", { ascending: false })
      .then(({ data }) => setVideos((data ?? []) as VideoRow[]));
  }, []);

  useEffect(load, [load]);

  async function cleanEmpty() {
    setCleaning(true);
    setNotice(null);
    const { data, error } = await createClient().rpc("delete_empty_drafts", { p_keep_minutes: 0 });
    setCleaning(false);
    if (error) {
      setNotice("Não deu para limpar agora. Tente de novo.");
      return;
    }
    setNotice(data === 1 ? "1 rascunho vazio apagado." : `${data} rascunhos vazios apagados.`);
    // O banco é quem sabe o que estava vazio de verdade (inclusive sem ideias sugeridas): recarrega.
    load();
  }

  const counts = Object.fromEntries(TABS.map(([t]) => [t, (videos ?? []).filter((v) => videoTab(v) === t).length])) as Record<VideoTab, number>;
  const shown = (videos ?? []).filter((v) => videoTab(v) === tab);
  const empties = (videos ?? []).filter((v) => !v.archived_at && isEmptyDraft(v)).length;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/inicio" aria-label="Voltar ao início" className="-ml-3 -mt-3 flex size-11 items-center justify-center">
        <ChevronLeft className="size-6" strokeWidth={1.75} aria-hidden="true" />
      </Link>
      <h1 className="font-display text-[32px]">Meus vídeos</h1>

      <div role="tablist" aria-label="Situação dos vídeos" className="grid grid-cols-3 gap-1 rounded-full bg-card p-1">
        {TABS.map(([t, label]) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn("min-h-11 rounded-full px-1 text-sm font-semibold", tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
          >
            {label}
            {videos ? ` · ${counts[t]}` : ""}
          </button>
        ))}
      </div>

      {tab === "andamento" && empties > 0 && (
        <button type="button" onClick={cleanEmpty} disabled={cleaning} className="flex min-h-11 items-center self-start text-sm font-semibold underline disabled:opacity-40">
          {cleaning ? "Limpando…" : `Limpar rascunhos vazios (${empties})`}
        </button>
      )}
      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

      {videos === null && <p className="label-set text-muted-foreground">Carregando…</p>}
      {videos && shown.length === 0 && <p className="rounded-2xl bg-card p-4 text-sm leading-relaxed text-muted-foreground">{EMPTY[tab]}</p>}

      <div className="flex flex-col gap-2.5">
        {shown.map((v) => (
          <VideoCard
            key={v.id}
            video={v}
            onChange={(next) => setVideos((list) => (list ?? []).flatMap((x) => (x.id !== v.id ? [x] : next ? [next] : [])))}
          />
        ))}
      </div>
    </div>
  );
}
