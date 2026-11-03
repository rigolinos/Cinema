"use client";

import { useState } from "react";
import Link from "next/link";
import { useConfirm } from "@/components/gravai/confirm";
import { Archive, ArchiveRestore, MoreHorizontal, Trash2, X } from "lucide-react";
import { READY_STAGES, STAGES, Trail, reachableIndex, stageLabel } from "@/components/gravai/trail";
import { createClient } from "@/lib/supabase/client";
import { durationLabel } from "@/lib/ideas";
import type { InviteRow } from "@/lib/convites";
import type { Video, VideoStage } from "@/types/database";

export type VideoRow = Video & { archived_at?: string | null };

// "Continuar" abre direto o passo em que a pessoa está, se ele já existe no app.
export function videoHref(v: Video): string {
  const step = STAGES[reachableIndex(v.stage)]?.id;
  return step && READY_STAGES.includes(step) ? `/video/${v.id}/${step}` : `/video/${v.id}`;
}

// O que o cartão mostra, igual para vídeo próprio e convite. O rótulo fica junto do nome: fala do vídeo e não aperta o título.
function CardFace({ title, guest = false, durationS, stage, status, action }: { title: string; guest?: boolean; durationS: number | null; stage: VideoStage; status: React.ReactNode; action: string }) {
  return (
    <>
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-[17px] font-bold leading-snug">
          {title}
          {guest && (
            <>
              {" "}
              <span className="label-set whitespace-nowrap text-muted-foreground">Convidado</span>
            </>
          )}
        </span>
        {durationS && <span className="shrink-0 font-mono text-sm text-muted-foreground">{durationLabel(durationS)}</span>}
      </span>
      <Trail stage={stage} />
      <span className="flex items-center justify-between gap-2">
        <span className="label-set text-muted-foreground">{status}</span>
        <span className="text-sm font-semibold">{action}</span>
      </span>
    </>
  );
}

// Vídeo de outra pessoa, salvo pelo convite: abre a página do convite, e o menu só tira da lista.
export function InviteCard({ invite, onRemove }: { invite: InviteRow; onRemove: () => void }) {
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, sheet } = useConfirm();

  async function release() {
    setMenu(false);
    const ok = await confirm({
      title: `Tirar “${invite.title}” da sua lista?`,
      text: "O vídeo continua com quem te convidou. Para salvar de novo, abra o link do convite.",
      action: "Tirar da lista",
    });
    if (!ok) return;
    const { error } = await createClient().rpc("release_invite", { p_token: invite.token });
    if (error) setError("Não deu para tirar da lista. Tente de novo.");
    else onRemove();
  }

  return (
    <div className="relative">
      {sheet}
      <Link href={`/p/${invite.token}`} className="flex flex-col gap-3 rounded-2xl bg-card p-4 pr-14">
        <CardFace title={invite.title} guest durationS={invite.duration_s} stage={invite.stage} status={invite.published_at ? "Publicado" : stageLabel(invite.stage)} action="Abrir" />
      </Link>

      <button
        type="button"
        aria-label={`Opções de ${invite.title}`}
        aria-expanded={menu}
        onClick={() => setMenu((m) => !m)}
        className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-full"
      >
        <MoreHorizontal className="size-5" strokeWidth={1.75} aria-hidden="true" />
      </button>

      {menu && (
        <div role="menu" className="absolute right-2 top-14 z-20 flex w-52 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
          <button type="button" role="menuitem" onClick={release} className="flex min-h-12 items-center gap-2.5 px-4 text-left text-sm font-semibold">
            <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Tirar da minha lista
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-1 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

// Cartão do vídeo com menu ⋯ (arquivar/desarquivar e apagar). Avisa a lista quando algo muda.
export function VideoCard({ video, onChange }: { video: VideoRow; onChange: (v: VideoRow | null) => void }) {
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, sheet } = useConfirm();

  async function toggleArchive() {
    const archived_at = video.archived_at ? null : new Date().toISOString();
    const { error } = await createClient().from("videos").update({ archived_at }).eq("id", video.id);
    setMenu(false);
    if (error) setError("Não deu para mudar. Tente de novo.");
    else onChange({ ...video, archived_at });
  }

  async function remove() {
    setMenu(false);
    const ok = await confirm({
      title: `Apagar “${video.title || "Vídeo sem ideia ainda"}”?`,
      text: "A ideia, o roteiro, os planos e os links das pessoas somem. Isso não tem volta. Se só quiser tirar da frente, use Arquivar.",
      action: "Apagar para sempre",
      danger: true,
    });
    if (!ok) return;
    const { error } = await createClient().from("videos").delete().eq("id", video.id);
    if (error) setError("Não deu para apagar. Tente de novo.");
    else onChange(null);
  }

  return (
    <div className="relative">
      {sheet}
      <Link href={videoHref(video)} className="flex flex-col gap-3 rounded-2xl bg-card p-4 pr-14">
        <CardFace
          title={video.title || "Vídeo sem ideia ainda"}
          durationS={video.duration_s}
          stage={video.stage}
          status={
            <>
              {video.archived_at ? "Arquivado · " : ""}
              {video.published_at ? "Publicado" : stageLabel(video.stage)}
            </>
          }
          action={video.stage === "pronto" ? "Abrir" : "Continuar"}
        />
      </Link>

      <button
        type="button"
        aria-label={`Opções de ${video.title || "vídeo sem ideia"}`}
        aria-expanded={menu}
        onClick={() => setMenu((m) => !m)}
        className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-full"
      >
        <MoreHorizontal className="size-5" strokeWidth={1.75} aria-hidden="true" />
      </button>

      {menu && (
        <div role="menu" className="absolute right-2 top-14 z-20 flex w-52 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
          <button type="button" role="menuitem" onClick={toggleArchive} className="flex min-h-12 items-center gap-2.5 px-4 text-left text-sm font-semibold">
            {video.archived_at ? (
              <ArchiveRestore className="size-4" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Archive className="size-4" strokeWidth={1.75} aria-hidden="true" />
            )}
            {video.archived_at ? "Tirar do arquivo" : "Arquivar"}
          </button>
          <button type="button" role="menuitem" onClick={remove} className="flex min-h-12 items-center gap-2.5 border-t border-border px-4 text-left text-sm font-semibold text-destructive">
            <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Apagar
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-1 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
