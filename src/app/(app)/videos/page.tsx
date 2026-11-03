"use client";

import { useCallback, useEffect, useState } from "react";
import { InviteCard, VideoCard, type VideoRow } from "@/components/gravai/video-card";
import { createClient } from "@/lib/supabase/client";
import { withInvites, type InviteRow } from "@/lib/convites";
import { isEmptyDraft, videoTab, type VideoTab } from "@/lib/meus-videos";
import { SlateTabs } from "@/components/gravai/slate-tabs";

const TABS: [VideoTab, string][] = [
  ["criando", "Criando"],
  ["prontos", "Prontos"],
  ["gravados", "Gravados"],
];

const EMPTY: Record<VideoTab, string> = {
  criando: "Nenhum vídeo em criação. Toque em Novo vídeo para começar.",
  prontos: "Quando o roteiro e os planos de um vídeo ficarem prontos, ele espera aqui pelo dia de gravar.",
  gravados: "Quando você gravar um vídeo, ele aparece aqui. Se gravou sem o passo a passo, use Já gravei no menu ⋯ do vídeo.",
  arquivados: "Arquive pelo menu ⋯ de um vídeo para tirá-lo da frente sem apagar.",
};

// Vídeos (aba do menu): todos, separados por situação, com arquivar, apagar e limpar rascunhos vazios.
export default function MeusVideosPage() {
  const [videos, setVideos] = useState<VideoRow[] | null>(null);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [tab, setTab] = useState<VideoTab>("criando");
  const [cleaning, setCleaning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    const db = createClient();
    Promise.all([db.from("videos").select("*").order("updated_at", { ascending: false }), db.rpc("my_invites")]).then(([v, i]) => {
      setInvites((i.data ?? []) as InviteRow[]);
      setVideos((v.data ?? []) as VideoRow[]);
    });
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

  const counts = Object.fromEntries((["criando", "prontos", "gravados", "arquivados"] as VideoTab[]).map((t) => [t, [...(videos ?? []), ...invites].filter((v) => videoTab(v) === t).length])) as Record<VideoTab, number>;
  const shown = withInvites((videos ?? []).filter((v) => videoTab(v) === tab), invites.filter((i) => videoTab(i) === tab));
  const empties = (videos ?? []).filter((v) => !v.archived_at && isEmptyDraft(v)).length;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-[32px]">Vídeos</h1>

      <SlateTabs
        label="Situação dos vídeos"
        items={TABS.map(([t, label]) => ({ id: t, label, count: videos ? counts[t] : undefined }))}
        value={tab}
        onChange={setTab}
      />

      {tab === "criando" && empties > 0 && (
        <button type="button" onClick={cleanEmpty} disabled={cleaning} className="flex min-h-11 items-center self-start text-sm font-semibold underline disabled:opacity-40">
          {cleaning ? "Limpando…" : `Limpar rascunhos vazios (${empties})`}
        </button>
      )}
      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

      {videos === null && <p className="label-set text-muted-foreground">Carregando…</p>}
      {tab === "arquivados" && <h2 className="label-set text-muted-foreground">Arquivo</h2>}
      {videos && shown.length === 0 && <p className="rounded-2xl bg-card p-4 text-sm leading-relaxed text-muted-foreground">{EMPTY[tab]}</p>}

      <div className="flex flex-col gap-2.5">
        {shown.map((item) =>
          item.kind === "invite" ? (
            <InviteCard key={item.row.token} invite={item.row} onRemove={() => setInvites((list) => list.filter((x) => x.token !== item.row.token))} />
          ) : (
            <VideoCard
              key={item.row.id}
              video={item.row}
              onChange={(next) => setVideos((list) => (list ?? []).flatMap((x) => (x.id !== item.row.id ? [x] : next ? [next] : [])))}
            />
          ),
        )}
      </div>

      {/* O arquivo não disputa espaço com as abas: quem arquivou sabe onde procurar. */}
      {tab !== "arquivados" && (
        <button type="button" onClick={() => setTab("arquivados")} className="flex min-h-11 items-center self-start text-sm font-semibold text-muted-foreground underline">
          Ver arquivo{counts.arquivados ? ` (${counts.arquivados})` : ""}
        </button>
      )}
    </div>
  );
}
