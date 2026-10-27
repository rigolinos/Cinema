"use client";

import { useCallback, useEffect, useState } from "react";
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

// Vídeos (aba do menu): todos, separados por situação, com arquivar, apagar e limpar rascunhos vazios.
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
      <h1 className="font-display text-[32px]">Vídeos</h1>

      <div role="tablist" aria-label="Situação dos vídeos" className="scroll-row -mx-5 flex gap-2 overflow-x-auto px-5 py-1">
        {TABS.map(([t, label]) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-input bg-card px-4 text-sm font-semibold",
              tab === t && "border-foreground bg-foreground text-background",
            )}
          >
            {label}
            {/* O número fica mais claro que o nome; aba vazia não mostra "0". */}
            {videos && counts[t] > 0 && <span className={cn("font-normal", tab === t ? "opacity-70" : "text-muted-foreground")}>{counts[t]}</span>}
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
