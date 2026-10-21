"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, Copy, Printer, Share2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { exportPackage } from "@/lib/meus-videos";
import type { Shot } from "@/lib/planos";
import type { ScriptBlock } from "@/lib/roteiro";
import type { Video } from "@/types/database";

type Block = ScriptBlock & { id: string; position: number };
type Post = { title: string; caption: string; hashtags: string[]; cover_text: string; cover_idea: string };

// Exportar o vídeo: roteiro, planos na ordem de gravação e publicação, para copiar, compartilhar ou salvar em PDF.
export default function ExportarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [text, setText] = useState<string | null>(null);
  const [title, setTitle] = useState("Vídeo");
  const [copied, setCopied] = useState(false);
  // Só é lido depois que o texto carrega no aparelho (no servidor, o texto ainda é null).
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  useEffect(() => {
    const db = createClient();
    Promise.all([
      db.from("videos").select("*").eq("id", id).maybeSingle(),
      db.from("script_blocks").select("*").eq("video_id", id).order("position"),
      db.from("shots").select("*").eq("video_id", id).order("position"),
      db.from("video_posts").select("*").eq("video_id", id).maybeSingle(),
    ]).then(([v, b, s, p]) => {
      if (!v.data) {
        setText("");
        return;
      }
      const video = v.data as Video;
      const blocks = (b.data ?? []) as Block[];
      setTitle(video.title || "Vídeo");
      setText(
        exportPackage({
          video,
          blocks,
          blockIds: blocks.map((x) => x.id),
          shots: (s.data ?? []) as Shot[],
          post: (p.data as Post | null) ?? null,
        }),
      );
    });
  }, [id]);

  async function copy() {
    if (!text) return;
    await navigator.clipboard.writeText(text).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    if (!text) return;
    await navigator.share({ title: `Gravaí · ${title}`, text }).catch(() => null);
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col gap-5 px-5 pb-16 pt-3 print:max-w-none print:p-0">
      <Link href={`/video/${id}`} aria-label="Voltar ao vídeo" className="-ml-3 flex size-11 items-center justify-center print:hidden">
        <ChevronLeft className="size-6" strokeWidth={1.75} aria-hidden="true" />
      </Link>

      <header className="flex flex-col gap-2 print:hidden">
        <p className="label-set text-muted-foreground">Exportar</p>
        <h1 className="font-display text-[28px]">{title}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Roteiro, planos na ordem de gravação e publicação, num texto só. Mande para quem filma ou edita, guarde fora do app ou
          imprima para levar ao set.
        </p>
      </header>

      {text === null && <p className="label-set text-muted-foreground print:hidden">Montando…</p>}
      {text === "" && <p className="text-sm text-destructive">Não encontramos este vídeo.</p>}

      {text && (
        <>
          <div className="flex flex-col gap-2.5 print:hidden">
            {canShare && (
              <button type="button" onClick={share} className="flex min-h-13 items-center justify-center gap-2 rounded-full bg-primary font-bold text-primary-foreground">
                <Share2 className="size-5" strokeWidth={1.75} aria-hidden="true" />
                Compartilhar (WhatsApp e outros)
              </button>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" onClick={copy} className="flex min-h-12 items-center justify-center gap-2 rounded-full border-[1.5px] border-foreground font-semibold">
                {copied ? <Check className="size-5" strokeWidth={2} aria-hidden="true" /> : <Copy className="size-5" strokeWidth={1.75} aria-hidden="true" />}
                {copied ? "Copiado" : "Copiar"}
              </button>
              <button type="button" onClick={() => window.print()} className="flex min-h-12 items-center justify-center gap-2 rounded-full border-[1.5px] border-foreground font-semibold">
                <Printer className="size-5" strokeWidth={1.75} aria-hidden="true" />
                PDF / imprimir
              </button>
            </div>
          </div>

          <pre className="whitespace-pre-wrap break-words rounded-2xl bg-card p-4 font-mono text-[13px] leading-relaxed print:rounded-none print:bg-transparent print:p-0 print:text-[11pt]">
            {text}
          </pre>
        </>
      )}
    </div>
  );
}
