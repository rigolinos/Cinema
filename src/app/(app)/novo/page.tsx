"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isEmptyDraft } from "@/lib/meus-videos";

// Abre o primeiro passo (Ideia) num vídeo novo, ou no rascunho vazio que já existir.
export default function NovoVideoPage() {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Vindo de "Usar este formato" (?formato=slug), a conversa da ideia já sugere nesse formato.
    const formato = new URLSearchParams(window.location.search).get("formato");
    const suffix = formato && /^[a-z0-9-]{1,60}$/.test(formato) ? `?formato=${formato}` : "";
    (async () => {
      const db = createClient();
      // Já existe um rascunho vazio (aberto e abandonado)? Usa ele em vez de criar outro.
      const { data: drafts } = await db
        .from("videos")
        .select("id, title, objective, platform, duration_s, resources, video_ideas(count)")
        .eq("stage", "ideia")
        .is("archived_at", null)
        .is("title", null)
        .order("created_at", { ascending: false })
        .limit(5);
      const reuse = (drafts ?? []).find(
        (d) => isEmptyDraft(d as Parameters<typeof isEmptyDraft>[0]) && !((d.video_ideas as { count: number }[] | null)?.[0]?.count),
      );
      if (reuse) {
        router.replace(`/video/${reuse.id}/ideia${suffix}`);
        return;
      }
      const { data, error } = await db.from("videos").insert({}).select("id").single();
      if (error || !data) setError("Não foi possível criar o vídeo. Confira sua conexão e tente de novo.");
      else router.replace(`/video/${data.id}/ideia${suffix}`);
    })();
  }, [router]);

  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-3 text-center">
      {error ? (
        <>
          <p className="text-sm text-destructive">{error}</p>
          <button type="button" onClick={() => window.location.reload()} className="min-h-12 rounded-full bg-primary px-6 font-bold text-primary-foreground">
            Tentar de novo
          </button>
        </>
      ) : (
        <p className="label-set text-muted-foreground">Preparando o set…</p>
      )}
    </div>
  );
}
