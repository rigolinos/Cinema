"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, FileText, Lightbulb, Sparkles } from "lucide-react";
import { useSavedIdeas } from "@/components/gravai/guardar";
import { createClient } from "@/lib/supabase/client";
import { FORMATS, findFormat } from "@/lib/formats";
import { doorLabel } from "@/lib/memoria";
import { logSignal } from "@/lib/sinais";

type Door = "zero" | "ideia" | "roteiro";

const DOORS: { id: Door; icon: typeof Sparkles; title: string; text: string }[] = [
  { id: "zero", icon: Sparkles, title: "Do zero", text: "Eu te faço umas perguntas e trago ideias." },
  { id: "ideia", icon: Lightbulb, title: "Já tenho a ideia", text: "Você conta do seu jeito e eu deixo pronta para gravar." },
  { id: "roteiro", icon: FileText, title: "Já tenho o roteiro", text: "Cole o seu texto. Eu organizo sem mudar nada." },
];

// Reaproveita o rascunho que parou antes das ideias, em vez de criar outro: a lista não enche de "Vídeo sem ideia ainda".
async function draftVideo(): Promise<string | null> {
  const db = createClient();
  const { data: drafts } = await db
    .from("videos")
    .select("id, brief, video_ideas(count)")
    .eq("stage", "ideia")
    .is("archived_at", null)
    .is("title", null)
    .order("created_at", { ascending: false })
    .limit(5);
  const reuse = (drafts ?? []).find((d) => !d.brief && !((d.video_ideas as { count: number }[] | null)?.[0]?.count));
  if (reuse) {
    const { error } = await db.from("videos").update({ objective: null, platform: null, platforms: [], duration_s: null, resources: [] }).eq("id", reuse.id);
    if (!error) return reuse.id;
  }
  const { data } = await db.from("videos").insert({}).select("id").single();
  return data?.id ?? null;
}

// Cria (ou reaproveita) o vídeo, marca a porta de entrada e devolve o id.
async function startVideo(door: Door): Promise<string | null> {
  const id = await draftVideo();
  if (!id) return null;
  await createClient().from("videos").update({ start_door: door }).eq("id", id);
  logSignal("porta_entrada", { porta: doorLabel(door) }, id);
  return id;
}

const FAILED = "Não foi possível criar o vídeo. Confira sua conexão e tente de novo.";

function Doors() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formato = searchParams.get("formato");
  const started = useRef(false);
  const saved = useSavedIdeas();
  const [busy, setBusy] = useState<Door | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function open(door: Door) {
    setBusy(door);
    setError(null);
    const id = await startVideo(door);
    if (id) router.replace(`/video/${id}/ideia`);
    else {
      setError(FAILED);
      setBusy(null);
    }
  }

  // Vindo de "Usar este formato" (?formato=slug): é do zero, e a conversa da ideia já sugere nesse formato.
  useEffect(() => {
    if (!formato || started.current) return;
    started.current = true;
    const chosen = findFormat(formato);
    if (chosen) logSignal("formato_usado", { format: chosen.name });
    startVideo("zero").then((id) => {
      if (id) router.replace(`/video/${id}/ideia${chosen ? `?formato=${chosen.slug}` : ""}`);
      else setError(FAILED);
    });
  }, [formato, router]);

  if (formato) return <p className="label-set py-16 text-center text-muted-foreground">{error ?? "Preparando o set…"}</p>;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="label-set text-muted-foreground">Novo vídeo</p>
        <h1 className="font-display text-[30px]">Por onde você quer começar?</h1>
      </header>
      <div className="flex flex-col gap-2.5">
        {DOORS.map(({ id, icon: Icon, title, text }) => (
          <button
            key={id}
            type="button"
            disabled={busy !== null}
            onClick={() => open(id)}
            className="flex items-center gap-3.5 rounded-2xl bg-card p-4 text-left transition-transform active:scale-[0.99] disabled:opacity-50"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted" aria-hidden="true">
              <Icon className="size-5" strokeWidth={1.75} />
            </span>
            <span className="flex flex-1 flex-col gap-1">
              <span className="text-[17px] font-bold">{title}</span>
              <span className="text-sm leading-relaxed text-muted-foreground">{busy === id ? "Abrindo…" : text}</span>
            </span>
          </button>
        ))}
      </div>
      <section aria-labelledby="mais-ideias" className="flex flex-col gap-1.5">
        <h2 id="mais-ideias" className="label-set text-muted-foreground">
          Mais ideias
        </h2>
        <div className="flex flex-col divide-y divide-border rounded-2xl bg-card px-4">
          {[
            { href: "/ideias", title: "Ideias da quinzena", text: "Feitas para o seu perfil" },
            ...(saved && saved.length > 0 ? [{ href: "/ideias/guardadas", title: `Ideias guardadas (${saved.length})`, text: "As que você marcou para depois" }] : []),
            { href: "/ideias/formatos", title: "Biblioteca de formatos", text: `${FORMATS.length} estruturas que já funcionam` },
          ].map((row) => (
            <Link key={row.href} href={row.href} className="flex min-h-14 items-center justify-between gap-3 py-3">
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold">{row.title}</span>
                <span className="text-sm text-muted-foreground">{row.text}</span>
              </span>
              <ArrowRight className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

// Novo vídeo: três portas iguais. Quem já cria chega com a ideia ou o roteiro pronto.
export default function NovoVideoPage() {
  return (
    <Suspense fallback={null}>
      <Doors />
    </Suspense>
  );
}
