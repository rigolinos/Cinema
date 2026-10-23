"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUp } from "lucide-react";
import { StepHeader } from "@/components/gravai/step-header";
import { Thinking } from "@/components/gravai/thinking";
import { createClient } from "@/lib/supabase/client";
import { findFormat } from "@/lib/formats";
import {
  DURATIONS,
  OBJECTIVES,
  PLATFORMS,
  QUESTION_ORDER,
  RESOURCES,
  durationLabel,
  mainPlatform,
  mixesOrientation,
  nextQuestion,
  platformsLabel,
  videoPlatforms,
  type Answers,
  type Platform,
  type QuestionId,
  type Resource,
} from "@/lib/ideas";
import { logSignal } from "@/lib/sinais";
import { cn } from "@/lib/utils";
import type { Video, VideoIdea } from "@/types/database";

const QUESTIONS: Record<QuestionId, string> = {
  niche: "Sobre o que é o seu perfil? Pode ser bem simples, tipo “treino em casa” ou “receitas baratas”.",
  objective: "O que esse vídeo precisa fazer por você?",
  platform: "Onde ele vai sair? Pode marcar mais de um.",
  duration: "E quanto tempo, mais ou menos?",
  resources: "Com o que você conta hoje? Pode marcar mais de um.",
};

const NICHE_EXAMPLES = [
  "Humor",
  "Treino em casa",
  "Receitas",
  "Maquiagem",
  "Moda",
  "Finanças",
  "Meu negócio",
  "Games",
  "Viagem",
  "Pets",
  "Maternidade",
  "Estudos",
  "Música",
  "Decoração",
  "Tecnologia",
  "Bem-estar",
];
const QUICK_REQUESTS = ["Outras ideias", "Mais engraçado", "Mais fácil de gravar"];

const chip =
  "min-h-11 rounded-full border border-input bg-card px-4 text-sm font-semibold whitespace-nowrap transition-colors";
const chipOn = "border-foreground bg-foreground text-background";

function answerText(q: QuestionId, a: Answers): string {
  switch (q) {
    case "niche":
      return a.niche ?? "";
    case "objective":
      return a.objective ? OBJECTIVES[a.objective] : "";
    case "platform":
      return platformsLabel(a.platforms);
    case "duration":
      return a.durationS ? durationLabel(a.durationS) : "";
    case "resources":
      return a.resources.map((r) => RESOURCES[r]).join(" · ");
  }
}

function Assistant({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="label-set flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-rec" aria-hidden="true" />
        Gravaí
      </span>
      <div className="text-base leading-relaxed">{children}</div>
    </div>
  );
}

// Resposta da pessoa. Tocar nela reabre a pergunta.
function Mine({ text, onClick }: { text: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={onClick ? `Mudar resposta: ${text}` : undefined}
      className="max-w-[85%] self-end rounded-[14px_14px_4px_14px] bg-primary px-3.5 py-3 text-left text-[15px] leading-snug text-primary-foreground"
    >
      {text}
    </button>
  );
}

export default function IdeiaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loaded, setLoaded] = useState(false);
  const [answers, setAnswers] = useState<Answers>({ niche: null, objective: null, platforms: [], durationS: null, resources: [] });
  const [editing, setEditing] = useState<QuestionId | null>(null);
  const [nicheDraft, setNicheDraft] = useState("");
  const [resourcesDraft, setResourcesDraft] = useState<Resource[]>([]);
  const [platformsDraft, setPlatformsDraft] = useState<Platform[]>([]);
  const [ideas, setIdeas] = useState<VideoIdea[]>([]);
  const [requests, setRequests] = useState<Record<number, string>>({});
  const [ask, setAsk] = useState("");
  const [knowsYou, setKnowsYou] = useState(false);
  const [busy, setBusy] = useState<"ideas" | "choose" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const autoAsked = useRef(false);
  // Rodada nova de ideias: a tela para no começo dela, não no fim da página.
  const jumpToRound = useRef<number | null>(null);

  useEffect(() => {
    Promise.all([
      createClient().from("videos").select("*").eq("id", id).maybeSingle(),
      createClient().from("creator_profiles").select("niche").maybeSingle(),
      createClient().from("video_ideas").select("*").eq("video_id", id).order("round").order("created_at"),
      createClient().from("creator_memory").select("items").maybeSingle(),
    ]).then(([v, p, i, m]) => {
      if (v.error || !v.data) {
        setError("Não encontramos este vídeo.");
        setLoaded(true);
        return;
      }
      const video = v.data as Video;
      setAnswers({
        niche: p.data?.niche ?? null,
        objective: video.objective,
        platforms: videoPlatforms(video),
        durationS: video.duration_s,
        resources: video.resources ?? [],
      });
      setIdeas((i.data ?? []) as VideoIdea[]);
      setKnowsYou(Array.isArray(m.data?.items) && m.data.items.length > 0);
      setLoaded(true);
    });
  }, [id]);

  const question = editing ?? nextQuestion(answers);

  const requestIdeas = useCallback(
    async (request?: string) => {
      setBusy("ideas");
      setError(null);
      const res = await fetch("/api/ideias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: id, request }),
      }).catch(() => null);
      const body = await res?.json().catch(() => null);
      if (!res?.ok) {
        setError(body?.error ?? "Sem conexão. Tente de novo.");
      } else {
        const fresh = body.ideas as VideoIdea[];
        if (request && fresh[0]) setRequests((r) => ({ ...r, [fresh[0].round]: request }));
        if (fresh[0]) jumpToRound.current = fresh[0].round;
        setIdeas((prev) => [...prev, ...fresh]);
        setAsk("");
      }
      setBusy(null);
    },
    [id],
  );

  // Com todas as respostas e nenhuma ideia ainda, o Gravaí já sugere.
  useEffect(() => {
    if (loaded && !question && ideas.length === 0 && !autoAsked.current) {
      autoAsked.current = true;
      // Vindo de "Usar este formato", a primeira rodada já usa o formato escolhido.
      const chosen = findFormat(searchParams.get("formato"));
      requestIdeas(chosen ? `Quero ideias no formato “${chosen.name}”.` : undefined);
    }
  }, [loaded, question, ideas.length, requestIdeas, searchParams]);

  useEffect(() => {
    const round = jumpToRound.current;
    if (round !== null) {
      jumpToRound.current = null;
      document.getElementById(`rodada-${round}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [ideas.length, question, busy]);

  async function save(q: QuestionId, patch: Partial<Answers>) {
    setBusy("save");
    setError(null);
    const { error } =
      q === "niche"
        ? await createClient().from("creator_profiles").upsert({ niche: patch.niche }, { onConflict: "user_id" })
        : await createClient()
            .from("videos")
            .update(
              q === "objective"
                ? { objective: patch.objective }
                : q === "platform"
                  ? { platforms: patch.platforms, platform: mainPlatform(patch.platforms ?? []) }
                  : q === "duration"
                    ? { duration_s: patch.durationS }
                    : { resources: patch.resources },
            )
            .eq("id", id);
    setBusy(null);
    if (error) {
      setError("Não deu para salvar. Tente de novo.");
      return;
    }
    setAnswers((a) => ({ ...a, ...patch }));
    setEditing(null);
  }

  function edit(q: QuestionId) {
    if (busy) return;
    if (q === "niche") setNicheDraft(answers.niche ?? "");
    if (q === "resources") setResourcesDraft(answers.resources);
    if (q === "platform") setPlatformsDraft(answers.platforms);
    setEditing(q);
  }

  async function choose(idea: VideoIdea) {
    setBusy("choose");
    setError(null);
    const { error } = await createClient().rpc("choose_idea", { p_idea_id: idea.id });
    if (error) {
      setBusy(null);
      setError("Não deu para escolher esta ideia. Tente de novo.");
      return;
    }
    logSignal(
      "ideia_escolhida",
      {
        title: idea.title,
        format: findFormat(idea.format_slug)?.name,
        ignored: ideas.filter((i) => i.round === idea.round && i.id !== idea.id).map((i) => i.title),
      },
      id,
    );
    // Escolheu: segue direto para o roteiro (a visão geral do vídeo fica no ícone do topo).
    router.push(`/video/${id}/roteiro`);
  }

  const answered = QUESTION_ORDER.filter((q) => q !== question && answerText(q, answers));
  const rounds = [...new Set(ideas.map((i) => i.round))];

  return (
    <div className="flex min-h-dvh flex-col">
      <StepHeader step="ideia" backHref="/inicio" videoId={id} />

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-5 pb-48 pt-5">
        {!loaded && <p className="label-set text-muted-foreground">Carregando…</p>}

        {loaded && (
          <Assistant>
            Bora achar a ideia. Vou te fazer umas perguntas rápidas e sugerir ideias com o <strong>gancho</strong>: o que
            você fala ou mostra nos 3 primeiros segundos, que é quando a pessoa decide se fica.
            {knowsYou && " Já fui guardando o que você curte, então as ideias já vêm mais com a sua cara."}
          </Assistant>
        )}

        {answered.map((q) => (
          <div key={q} className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{QUESTIONS[q]}</p>
            <Mine text={answerText(q, answers)} onClick={busy ? undefined : () => edit(q)} />
          </div>
        ))}

        {loaded && question && (
          <div className="flex flex-col gap-3">
            <Assistant>{QUESTIONS[question]}</Assistant>

            {question === "niche" && (
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (nicheDraft.trim()) save("niche", { niche: nicheDraft.trim().slice(0, 120) });
                }}
              >
                <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
                  {NICHE_EXAMPLES.map((n) => (
                    <button key={n} type="button" className={chip} onClick={() => setNicheDraft(n)}>
                      {n}
                    </button>
                  ))}
                </div>
                <label htmlFor="nicho" className="sr-only">
                  Seu nicho
                </label>
                <div className="flex gap-2">
                  <input
                    id="nicho"
                    value={nicheDraft}
                    onChange={(e) => setNicheDraft(e.target.value)}
                    maxLength={120}
                    placeholder="Ou escreva com suas palavras"
                    className="min-h-12 flex-1 rounded-full border border-input bg-card px-4 text-base outline-none focus:border-foreground"
                  />
                  <button
                    type="submit"
                    disabled={!nicheDraft.trim() || busy !== null}
                    className="min-h-12 rounded-full bg-primary px-5 font-bold text-primary-foreground disabled:opacity-40"
                  >
                    Pronto
                  </button>
                </div>
              </form>
            )}

            {question === "objective" && (
              <div className="flex flex-wrap gap-2">
                {(Object.keys(OBJECTIVES) as (keyof typeof OBJECTIVES)[]).map((o) => (
                  <button key={o} type="button" disabled={busy !== null} className={cn(chip, answers.objective === o && chipOn)} onClick={() => save("objective", { objective: o })}>
                    {OBJECTIVES[o]}
                  </button>
                ))}
              </div>
            )}

            {question === "platform" && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(PLATFORMS) as Platform[]).map((p) => {
                    const on = platformsDraft.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        aria-pressed={on}
                        className={cn(chip, on && chipOn)}
                        onClick={() => setPlatformsDraft((d) => (on ? d.filter((x) => x !== p) : [...d, p]))}
                      >
                        {PLATFORMS[p]}
                      </button>
                    );
                  })}
                </div>
                {mixesOrientation(platformsDraft) && (
                  <p className="text-sm leading-relaxed text-muted-foreground">Vou planejar em pé (vertical): no YouTube ele entra como Short.</p>
                )}
                <button
                  type="button"
                  disabled={platformsDraft.length === 0 || busy !== null}
                  onClick={() => save("platform", { platforms: platformsDraft })}
                  className="mt-2 min-h-13 w-full rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-40"
                >
                  Pronto, seguir
                </button>
              </div>
            )}

            {question === "duration" && (
              <div className="flex flex-wrap gap-2">
                {DURATIONS.map((d) => (
                  <button key={d} type="button" disabled={busy !== null} className={cn(chip, "font-mono", answers.durationS === d && chipOn)} onClick={() => save("duration", { durationS: d })}>
                    {durationLabel(d)}
                  </button>
                ))}
              </div>
            )}

            {question === "resources" && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(RESOURCES) as Resource[]).map((r) => {
                    const on = resourcesDraft.includes(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        aria-pressed={on}
                        className={cn(chip, on && chipOn)}
                        onClick={() => setResourcesDraft((d) => (on ? d.filter((x) => x !== r) : [...d, r]))}
                      >
                        {RESOURCES[r]}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  disabled={resourcesDraft.length === 0 || busy !== null}
                  onClick={() => save("resources", { resources: resourcesDraft })}
                  className="mt-2 min-h-13 w-full rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-40"
                >
                  Pronto, seguir
                </button>
              </div>
            )}
          </div>
        )}

        {!question && rounds.length > 0 && (
          <Assistant>
            Separei ideias para quem fala de <strong>{answers.niche}</strong>. Escolha uma para seguir para o roteiro, ou peça
            outras lá embaixo.
          </Assistant>
        )}

        {!question &&
          rounds.map((round) => (
            <div key={round} id={`rodada-${round}`} className="flex scroll-mt-32 flex-col gap-3.5">
              {requests[round] && <Mine text={requests[round]} />}
              {ideas
                .filter((i) => i.round === round)
                .map((idea) => {
                  const format = findFormat(idea.format_slug);
                  return (
                    <article key={idea.id} className="flex flex-col gap-2.5 rounded-2xl bg-card p-4">
                      {format && <p className="label-set text-muted-foreground">Formato · {format.name}</p>}
                      <h2 className="text-lg font-bold leading-snug">{idea.title}</h2>
                      <div className="flex flex-col gap-1 rounded-lg bg-muted px-3 py-2.5">
                        <span className="label-set text-muted-foreground">Gancho · 0–3 s</span>
                        <p className="text-[15px] font-semibold leading-snug">“{idea.hook}”</p>
                      </div>
                      {idea.why && (
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          <strong className="font-semibold text-foreground">Por que funciona:</strong> {idea.why}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => choose(idea)}
                          className="min-h-12 flex-1 rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-40"
                        >
                          {idea.chosen ? "Seguir com esta" : "Quero essa"}
                        </button>
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => setAsk(`Ajuste a ideia "${idea.title}": `)}
                          className="min-h-12 rounded-full border-[1.5px] border-foreground px-5 font-semibold disabled:opacity-40"
                        >
                          Ajustar
                        </button>
                      </div>
                    </article>
                  );
                })}
            </div>
          ))}

        {!question && rounds.length > 0 && (
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5">
            {QUICK_REQUESTS.map((r) => (
              <button key={r} type="button" disabled={busy !== null} className={chip} onClick={() => requestIdeas(r)}>
                {r}
              </button>
            ))}
          </div>
        )}

        {busy === "ideas" && <p className="label-set text-muted-foreground"><Thinking label="Pensando nas ideias" /></p>}
        {error && (
          <div role="alert" className="flex flex-col items-start gap-2 rounded-2xl border border-destructive/40 bg-card p-4 text-sm text-destructive">
            {error}
            {!question && busy === null && (
              <button type="button" onClick={() => requestIdeas()} className="min-h-11 font-semibold text-foreground underline">
                Tentar de novo
              </button>
            )}
          </div>
        )}
        <div ref={bottom} />
      </div>

      {!question && rounds.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]">
          <form
            className="mx-auto flex max-w-lg flex-col gap-2.5 px-4 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (ask.trim() && !busy) requestIdeas(ask.trim());
            }}
          >
            <div className="flex items-center gap-2">
              <label htmlFor="pedido" className="sr-only">
                Peça algo ao Gravaí
              </label>
              <input
                id="pedido"
                value={ask}
                onChange={(e) => setAsk(e.target.value)}
                maxLength={300}
                placeholder="Escreva ou peça algo…"
                className="min-h-12 flex-1 rounded-full border border-input bg-muted px-4 text-base outline-none focus:border-foreground"
              />
              <button
                type="submit"
                aria-label="Enviar"
                disabled={!ask.trim() || busy !== null}
                className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
              >
                <ArrowUp className="size-5" strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
