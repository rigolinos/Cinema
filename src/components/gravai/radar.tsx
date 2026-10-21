"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { findFormat } from "@/lib/formats";
import { radarSince, type RadarItem } from "@/lib/radar";

export function useRadar(): RadarItem[] | null {
  const [items, setItems] = useState<RadarItem[] | null>(null);
  useEffect(() => {
    createClient()
      .from("trend_radar")
      .select("*")
      .gte("week_start", radarSince())
      .order("week_start", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data }) => setItems((data ?? []) as RadarItem[]));
  }, []);
  return items;
}

export function RadarCard({ item }: { item: RadarItem }) {
  const format = findFormat(item.format_slug);
  return (
    <article className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-foreground p-4">
      <span className="label-set flex items-center gap-1.5 text-muted-foreground">
        <span className="size-2 rounded-full bg-rec" aria-hidden="true" />
        Radar da semana
      </span>
      <h3 className="text-lg font-bold leading-snug">{item.title}</h3>
      <p className="text-sm leading-relaxed">{item.what}</p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        <strong className="font-semibold text-foreground">Como adaptar:</strong> {item.how_to_adapt}
      </p>
      {format && (
        <Link href={`/ideias#${format.slug}`} className="flex min-h-11 items-center self-start text-sm font-semibold underline">
          Formato: {format.name}
        </Link>
      )}
    </article>
  );
}

// Seção da tela Ideias: só aparece quando a equipe cadastrou trends recentes.
export function RadarSection() {
  const items = useRadar();
  if (!items?.length) return null;
  return (
    <section aria-labelledby="radar" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="radar" className="label-set">
          Radar da semana
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">O que está funcionando agora, escolhido pela equipe Gravaí, com uma dica de como trazer para o seu nicho.</p>
      </div>
      {items.map((i) => (
        <RadarCard key={i.id} item={i} />
      ))}
    </section>
  );
}
