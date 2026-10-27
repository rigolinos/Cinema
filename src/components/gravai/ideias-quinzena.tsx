"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { findFormat } from "@/lib/formats";
import { DURATIONS, OBJECTIVES, PLATFORMS, RESOURCES, durationLabel, mainPlatform, type Objective, type Platform, type Resource } from "@/lib/ideas";
import { daysUntilNext, periodLabel, quickStartDefaults, type QuickStart } from "@/lib/quinzena";
import { Explain } from "@/components/gravai/explain";
import { SaveButton } from "@/components/gravai/guardar";
import { STEPS, Thinking } from "@/components/gravai/thinking";
import { logSignal } from "@/lib/sinais";
import { cn } from "@/lib/utils";

interface FortnightIdea {
  id: string;
  title: string;
  format_slug: string | null;
  hook: string;
  situation: string;
  payoff: string;
  why: string | null;
  objective: Objective | null;
  video_id: string | null;
}

const chip = "min-h-11 rounded-full border border-input bg-card px-4 text-sm font-semibold whitespace-nowrap";
const chipOn = "border-foreground bg-foreground text-background";

function Choice<T extends string | number>({ label, options, value, onPick }: { label: string; options: [T, string][]; value: T | T[]; onPick: (v: T) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(([v, text]) => {
          const on = Array.isArray(value) ? value.includes(v) : value === v;
          return (
            <button key={String(v)} type="button" aria-pressed={on} onClick={() => onPick(v)} className={cn(chip, on && chipOn)}>
              {text}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

// Começa um vídeo com a ideia da quinzena; devolve o id do vídeo (ou null se não deu).
async function startFromFortnight(idea: FortnightIdea, answers: QuickStart): Promise<string | null> {
  const { data, error } = await createClient().rpc("start_video_from_idea", {
    p_idea_id: idea.id,
    p_objective: answers.objective,
    p_platform: mainPlatform(answers.platforms),
    p_duration: answers.durationS,
    p_resources: answers.resources,
  });
  if (error || !data) return null;
  // A função do banco recebe só a principal; as outras plataformas entram logo depois.
  if (answers.platforms.length > 1) await createClient().from("videos").update({ platforms: answers.platforms }).eq("id", data);
  logSignal("ideia_quinzena_usada", { title: idea.title, format: findFormat(idea.format_slug)?.name }, data);
  return data as string;
}

// Folha para começar o vídeo com um toque: as respostas já vêm preenchidas.
export function StartSheet({
  idea,
  platforms,
  onStart,
  onClose,
}: {
  idea: { title: string; format_slug: string | null; objective?: Objective | null };
  platforms: string[];
  onStart: (answers: QuickStart) => Promise<string | null>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<QuickStart>(() => quickStartDefaults(idea.format_slug, platforms, idea.objective ?? "crescer"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const videoId = await onStart(answers);
    if (!videoId) {
      setError("Não deu para começar o vídeo. Tente de novo.");
      setBusy(false);
      return;
    }
    router.push(`/video/${videoId}/roteiro`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="comecar-titulo"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-lg flex-col gap-5 overflow-y-auto rounded-t-3xl bg-background p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="label-set text-muted-foreground">Começar com esta ideia</span>
            <h2 id="comecar-titulo" className="text-lg font-bold leading-snug">
              {idea.title}
            </h2>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} className="-mr-2 flex size-11 shrink-0 items-center justify-center">
            <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">Já deixei preenchido. Confira e toque em começar: o vídeo abre direto no roteiro.</p>

        <Choice<Platform>
          label="Onde vai sair (pode marcar mais de um)"
          options={Object.entries(PLATFORMS) as [Platform, string][]}
          value={answers.platforms}
          onPick={(p) =>
            setAnswers((a) => {
              const platforms = a.platforms.includes(p) ? a.platforms.filter((x) => x !== p) : [...a.platforms, p];
              return { ...a, platforms: platforms.length ? platforms : a.platforms };
            })
          }
        />
        <Choice<number> label="Quanto tempo" options={DURATIONS.map((d) => [d, durationLabel(d)] as [number, string])} value={answers.durationS} onPick={(durationS) => setAnswers((a) => ({ ...a, durationS }))} />
        <Choice<Resource>
          label="Com o que você conta"
          options={Object.entries(RESOURCES) as [Resource, string][]}
          value={answers.resources}
          onPick={(r) =>
            setAnswers((a) => {
              const resources = a.resources.includes(r) ? a.resources.filter((x) => x !== r) : [...a.resources, r];
              return { ...a, resources: resources.length ? resources : a.resources };
            })
          }
        />
        <Choice<Objective> label="O que o vídeo precisa fazer" options={Object.entries(OBJECTIVES) as [Objective, string][]} value={answers.objective} onPick={(objective) => setAnswers((a) => ({ ...a, objective }))} />

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <button type="button" onClick={start} disabled={busy} className="flex min-h-13 items-center justify-center gap-2 rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-40">
          {busy ? "Começando…" : "Começar pelo roteiro"}
          {!busy && <ArrowRight className="size-5" strokeWidth={1.75} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

export function IdeiasQuinzena() {
  const [niche, setNiche] = useState<string | null | undefined>(undefined);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [nicheDraft, setNicheDraft] = useState("");
  const [period, setPeriod] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<FortnightIdea[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<FortnightIdea | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/ideias-quinzena", { method: "POST" }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) setError(data?.error ?? "Sem conexão. Tente de novo.");
    else {
      setPeriod(data.period);
      setIdeas(data.ideas as FortnightIdea[]);
    }
  }, []);

  useEffect(() => {
    createClient()
      .from("creator_profiles")
      .select("niche, platforms")
      .maybeSingle()
      .then(({ data }) => {
        const n = data?.niche?.trim() || null;
        setNiche(n);
        setPlatforms(data?.platforms ?? []);
        if (n) load();
      });
  }, [load]);

  async function saveNiche(e: React.FormEvent) {
    e.preventDefault();
    const n = nicheDraft.trim().slice(0, 120);
    if (!n) return;
    const { error } = await createClient().from("creator_profiles").upsert({ niche: n }, { onConflict: "user_id" });
    if (error) setError("Não deu para salvar. Tente de novo.");
    else {
      setNiche(n);
      load();
    }
  }

  return (
    <section aria-labelledby="quinzena" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 border-b-2 border-foreground pb-4">
        <p id="quinzena" className="label-set flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-rec" aria-hidden="true" />
          Ideias da quinzena
        </p>
        <h2 className="font-display text-[26px]">{niche ? <>Para quem fala de {niche}</> : "Feitas para o seu perfil"}</h2>
        {period && (
          <p className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-sm text-muted-foreground">
            <span>{periodLabel(period)}</span>
            <span aria-hidden="true">·</span>
            <span>{daysUntilNext() === 1 ? "NOVAS AMANHÃ" : `NOVAS EM ${daysUntilNext()} DIAS`}</span>
          </p>
        )}
        {niche && <p className="text-sm leading-relaxed text-muted-foreground">Quanto mais a gente cria junto, mais estas ideias ficam com a sua cara.</p>}
      </div>

      {niche === null && (
        <form onSubmit={saveNiche} className="flex flex-col gap-3 rounded-2xl bg-card p-4">
          <label htmlFor="nicho-quinzena" className="leading-relaxed">
            Sobre o que é o seu perfil? A cada 15 dias eu separo ideias novas para ele.
          </label>
          <div className="flex gap-2">
            <input
              id="nicho-quinzena"
              value={nicheDraft}
              maxLength={120}
              placeholder="Ex.: receitas baratas"
              onChange={(e) => setNicheDraft(e.target.value)}
              className="min-h-12 flex-1 rounded-full border border-input bg-background px-4 text-base outline-none focus:border-foreground"
            />
            <button type="submit" disabled={!nicheDraft.trim()} className="min-h-12 rounded-full bg-primary px-5 font-bold text-primary-foreground disabled:opacity-40">
              Pronto
            </button>
          </div>
        </form>
      )}

      {niche && !ideas && !error && <p className="label-set text-muted-foreground"><Thinking label="Separando suas ideias" steps={STEPS.ideias} /></p>}

      {error && (
        <div role="alert" className="flex flex-col items-start gap-2 rounded-2xl border border-destructive/40 bg-card p-4 text-sm text-destructive">
          {error}
          {niche && (
            <button type="button" onClick={load} className="min-h-11 font-semibold text-foreground underline">
              Tentar de novo
            </button>
          )}
        </div>
      )}

      {ideas?.map((idea) => {
        const format = findFormat(idea.format_slug);
        return (
          <article key={idea.id} className="flex flex-col gap-2.5 rounded-2xl bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                {format && <span className="label-set text-muted-foreground">{format.name}</span>}
                {idea.video_id && <span className="rounded-md bg-foreground px-2 py-1 font-mono text-xs uppercase text-background">Em vídeo</span>}
              </span>
              <SaveButton
                idea={{
                  source: "quinzena",
                  source_id: idea.id,
                  title: idea.title,
                  format_slug: idea.format_slug,
                  hook: idea.hook,
                  situation: idea.situation,
                  payoff: idea.payoff,
                  why: idea.why,
                }}
              />
            </div>
            <h3 className="text-lg font-bold leading-snug">{idea.title}</h3>
            <div className="flex flex-col gap-1 rounded-lg bg-muted px-3 py-2.5">
              <span className="label-set text-muted-foreground">Gancho · 0–3 s</span>
              <p className="text-[15px] font-semibold leading-snug">“{idea.hook}”</p>
            </div>
            {idea.situation && <p className="text-[15px] leading-relaxed">{idea.situation}</p>}
            {(idea.payoff || idea.why) && (
              <Explain id="ideia-porque" question={idea.payoff ? "Ver o desfecho e por que funciona" : "Por que funciona?"} closed>
                {idea.payoff && (
                  <>
                    <strong className="font-semibold text-foreground">Desfecho:</strong> {idea.payoff}{" "}
                  </>
                )}
                {idea.why}
              </Explain>
            )}
            {idea.video_id ? (
              <Link href={`/video/${idea.video_id}`} className="flex min-h-12 items-center justify-center rounded-full border-[1.5px] border-foreground font-semibold">
                Abrir o vídeo
              </Link>
            ) : (
              <button type="button" onClick={() => setPicked(idea)} className="min-h-12 rounded-full bg-primary font-bold text-primary-foreground">
                Gravar esta ideia
              </button>
            )}
          </article>
        );
      })}

      {picked && <StartSheet idea={picked} platforms={platforms} onStart={(a) => startFromFortnight(picked, a)} onClose={() => setPicked(null)} />}
    </section>
  );
}
