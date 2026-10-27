"use client";

import { useEffect, useState } from "react";
import { Explain } from "@/components/gravai/explain";
import { SaveButton, useSavedIdeas, type SavedIdea } from "@/components/gravai/guardar";
import { OpenVideoLink, RecButton } from "@/components/gravai/rec-button";
import { StartSheet } from "@/components/gravai/ideias-quinzena";
import { createClient } from "@/lib/supabase/client";
import { findFormat } from "@/lib/formats";
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

// Ideias: as que a pessoa guardou com o marcador. Some quando não há nenhuma.
export function IdeiasGuardadas() {
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
      <p className="rounded-2xl bg-card p-4 text-sm leading-relaxed text-muted-foreground">
        Nenhuma ideia guardada ainda. Toque no marcador de uma ideia para guardar e gravar quando quiser.
      </p>
    );
  }

  // Lista compacta: título e gancho à vista; cena, desfecho e porquê num toque.
  return (
    <section aria-label="Ideias guardadas" className="flex flex-col gap-2.5">
      {saved.map((idea) => {
        const format = findFormat(idea.format_slug);
        const detail = [idea.situation, idea.payoff && `Desfecho: ${idea.payoff}`, idea.why].filter(Boolean).join(" ");
        return (
          <article key={idea.id} className="flex flex-col gap-2 rounded-2xl bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                {format && <span className="label-set text-muted-foreground">{format.name}</span>}
                {idea.video_id && <span className="label-set text-foreground">· Em vídeo</span>}
              </span>
              <SaveButton idea={idea} />
            </div>
            <h3 className="idea-title">{idea.title}</h3>
            <p className="text-[15px] leading-snug text-muted-foreground">“{idea.hook}”</p>
            <div className="flex items-end justify-between gap-3">
              {detail && (
                <Explain id="ideia-porque" question="Ver a cena e o desfecho" closed className="min-w-0 flex-1">
                  {detail}
                </Explain>
              )}
              <span className="ml-auto">
                {idea.video_id ? <OpenVideoLink href={`/video/${idea.video_id}`} /> : <RecButton onClick={() => setPicked(idea)} ariaLabel={`Gravar a ideia: ${idea.title}`} />}
              </span>
            </div>
          </article>
        );
      })}
      {picked && <StartSheet idea={picked} platforms={platforms} onStart={(a) => startFromSaved(picked, a)} onClose={() => setPicked(null)} />}
    </section>
  );
}
