"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Bookmark } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { findFormat } from "@/lib/formats";
import { logSignal } from "@/lib/sinais";
import { cn } from "@/lib/utils";

// Ideias guardadas com o marcador (o "salvar" do Instagram). Uma lista só para a página inteira:
// guardar num cartão da quinzena já aparece na seção "Guardadas" sem recarregar.
export interface SavedIdea {
  id: string;
  source: "video" | "quinzena";
  source_id: string;
  title: string;
  format_slug: string | null;
  hook: string;
  situation: string;
  payoff: string;
  why: string | null;
  video_id: string | null;
  created_at: string;
}

export type IdeaToSave = Pick<SavedIdea, "source" | "source_id" | "title" | "format_slug" | "hook" | "why"> & { situation?: string; payoff?: string };

let items: SavedIdea[] | null = null;
let loading = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function load() {
  if (loading) return;
  loading = true;
  const { data } = await createClient().from("saved_ideas").select("*").order("created_at", { ascending: false }).limit(200);
  items = (data ?? []) as SavedIdea[];
  loading = false;
  notify();
}

export function useSavedIdeas(): SavedIdea[] | null {
  const list = useSyncExternalStore(subscribe, () => items, () => null);
  useEffect(() => {
    if (items === null) load();
  }, []);
  return list;
}

export function forgetSaved(id: string) {
  items = (items ?? []).filter((i) => i.id !== id);
  notify();
}

async function toggle(idea: IdeaToSave): Promise<boolean> {
  const db = createClient();
  const current = (items ?? []).find((i) => i.source_id === idea.source_id);
  if (current) {
    forgetSaved(current.id);
    const { error } = await db.from("saved_ideas").delete().eq("id", current.id);
    if (error) {
      items = [current, ...(items ?? [])];
      notify();
      return false;
    }
    return true;
  }
  const { data, error } = await db.from("saved_ideas").insert(idea).select("*").single();
  if (error || !data) return false;
  items = [data as SavedIdea, ...(items ?? []).filter((i) => i.source_id !== idea.source_id)];
  notify();
  logSignal("ideia_guardada", { title: idea.title, format: findFormat(idea.format_slug)?.name });
  return true;
}

// O marcador no canto do cartão. Preenchido = guardada.
export function SaveButton({ idea, className }: { idea: IdeaToSave; className?: string }) {
  const list = useSavedIdeas();
  const saved = (list ?? []).some((i) => i.source_id === idea.source_id);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 2000);
    return () => clearTimeout(t);
  }, [note]);

  async function onClick() {
    const wasSaved = saved;
    const ok = await toggle(idea);
    setNote(ok ? (wasSaved ? "Tirada das guardadas" : "Guardada nas suas ideias") : "Não deu para guardar");
  }

  return (
    <span className={cn("relative flex shrink-0 items-center", className)}>
      {note && (
        <span role="status" className="absolute right-full mr-1 whitespace-nowrap rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background">
          {note}
        </span>
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={list === null}
        aria-pressed={saved}
        aria-label={saved ? "Tirar das ideias guardadas" : "Guardar esta ideia"}
        className="-m-2 flex size-11 items-center justify-center disabled:opacity-40"
      >
        <Bookmark className="size-5" strokeWidth={1.75} fill={saved ? "currentColor" : "none"} aria-hidden="true" />
      </button>
    </span>
  );
}
