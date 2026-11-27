"use client";

import { useEffect, useState } from "react";
import { Explain } from "@/components/gravai/explain";
import { useConfirm } from "@/components/gravai/confirm";
import { SaveButton, deleteOwnIdea, saveOwnIdea, useSavedIdeas, type SavedIdea } from "@/components/gravai/guardar";
import { OpenVideoLink, UseIdeaButton } from "@/components/gravai/idea-action";
import { StartSheet } from "@/components/gravai/ideias-quinzena";
import { createClient } from "@/lib/supabase/client";
import type { QuickStart } from "@/lib/quinzena";

async function startFromSaved(idea: SavedIdea, answers: QuickStart): Promise<string | null> {
  const { data, error } = await createClient().rpc("start_video_from_saved", {
    p_saved_id: idea.id,
    p_objective: answers.objective,
    p_platforms: answers.platforms,
    p_duration: answers.durationS,
    p_resources: answers.resources,
  });
  return error || !data ? null : (data as string);
}

// A ideia da própria pessoa, do jeito dela, para usar quando quiser.
function OwnIdeaForm() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function keep() {
    setBusy(true);
    setNote(null);
    const ok = await saveOwnIdea(text);
    setBusy(false);
    if (ok) setText("");
    setNote(ok ? "Guardada" : "Não deu para guardar. Tente de novo.");
  }

  return (
    <form
      className="flex flex-col gap-2.5 rounded-2xl border border-border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        keep();
      }}
    >
      <label htmlFor="ideia-minha" className="font-bold">
        Guardar uma ideia minha
      </label>
      <textarea
        id="ideia-minha"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setNote(null);
        }}
        rows={3}
        maxLength={1500}
        placeholder="Conte do seu jeito, do tamanho que vier"
        className="w-full resize-none rounded-xl border border-input bg-card px-3.5 py-3 text-base leading-relaxed outline-none focus:border-foreground"
      />
      <button type="submit" disabled={busy || text.trim().length < 8} className="min-h-12 rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-40">
        {busy ? "Guardando…" : "Guardar"}
      </button>
      {note && (
        <p role="status" className="text-sm text-muted-foreground">
          {note}
        </p>
      )}
    </form>
  );
}

// Ideias: as que a pessoa guardou com o marcador e as que ela mesma escreveu.
export function IdeiasGuardadas() {
  const { confirm, sheet } = useConfirm();
  const saved = useSavedIdeas();
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [picked, setPicked] = useState<SavedIdea | null>(null);

  useEffect(() => {
    createClient()
      .from("creator_profiles")
      .select("platforms")
      .maybeSingle()
      .then(({ data }) => setPlatforms(data?.platforms ?? []));
  }, []);

  if (saved === null) return <p className="label-set text-muted-foreground">Carregando…</p>;
  if (saved.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <OwnIdeaForm />
        <p className="rounded-2xl bg-card p-4 text-sm leading-relaxed text-muted-foreground">
          Nenhuma ideia guardada ainda. Escreva a sua aqui em cima ou toque no marcador de uma ideia sugerida.
        </p>
      </div>
    );
  }

  async function remove(idea: SavedIdea) {
    const ok = await confirm({ title: "Apagar a sua ideia?", text: "O texto que você escreveu sai das guardadas.", action: "Apagar", danger: true });
    if (ok) await deleteOwnIdea(idea);
  }

  // Lista compacta: título e gancho à vista; cena, desfecho e porquê num toque.
  return (
    <section aria-label="Ideias guardadas" className="flex flex-col gap-2.5">
      {sheet}
      <OwnIdeaForm />
      {saved.map((idea) => {
        const own = idea.source === "pessoa";
        const detail = [idea.payoff && `Como termina: ${idea.payoff}`, idea.why].filter(Boolean).join(" ");
        return (
          <article key={idea.id} className="flex flex-col gap-2 rounded-2xl bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                {own && <span className="label-set text-muted-foreground">Sua ideia</span>}
                {idea.video_id && <span className="label-set text-foreground">· Em vídeo</span>}
              </span>
              {own ? (
                <button type="button" onClick={() => remove(idea)} aria-label={`Apagar a sua ideia: ${idea.title}`} className="-my-2.5 -mr-2 min-h-11 px-2 text-sm font-semibold text-muted-foreground">
                  Apagar
                </button>
              ) : (
                <SaveButton idea={idea} />
              )}
            </div>
            <h3 className="idea-title">{idea.title}</h3>
            <p className="whitespace-pre-line text-[15px] leading-relaxed">{(own && idea.brief) || idea.situation || idea.hook}</p>
            <div className="flex items-end justify-between gap-3">
              {detail && (
                <Explain id="ideia-porque" question="Ver como termina" closed className="min-w-0 flex-1">
                  {detail}
                </Explain>
              )}
              <span className="ml-auto">
                {idea.video_id ? <OpenVideoLink href={`/video/${idea.video_id}`} /> : <UseIdeaButton onClick={() => setPicked(idea)} ariaLabel={`Usar a ideia: ${idea.title}`} />}
              </span>
            </div>
          </article>
        );
      })}
      {picked && <StartSheet idea={picked} platforms={platforms} onStart={(a) => startFromSaved(picked, a)} onClose={() => setPicked(null)} />}
    </section>
  );
}
