"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Explain } from "@/components/gravai/explain";
import { SaveButton, useSavedIdeas, type SavedIdea } from "@/components/gravai/guardar";
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

  if (!saved?.length) return null;

  return (
    <section aria-labelledby="guardadas" className="flex flex-col gap-3">
      <h2 id="guardadas" className="label-set">
        Guardadas
      </h2>
      {saved.map((idea) => {
        const format = findFormat(idea.format_slug);
        return (
          <article key={idea.id} className="flex flex-col gap-2.5 rounded-2xl bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                {format && <span className="label-set text-muted-foreground">{format.name}</span>}
                {idea.video_id && <span className="rounded-md bg-foreground px-2 py-1 font-mono text-xs uppercase text-background">Em vídeo</span>}
              </span>
              <SaveButton idea={idea} />
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
      {picked && <StartSheet idea={picked} platforms={platforms} onStart={(a) => startFromSaved(picked, a)} onClose={() => setPicked(null)} />}
    </section>
  );
}
