"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// Uma coisa por vez: Falas, Roteiro e Gravação em abas, no lugar de uma página longa.
export function Abas({ tabs, initial }: { tabs: { id: string; label: string; content: React.ReactNode }[]; initial: string }) {
  const [active, setActive] = useState(tabs.some((t) => t.id === initial) ? initial : tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  if (!current) return null;

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="O que ver" className="grid gap-1 rounded-full bg-card p-1" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`aba-${t.id}`}
            aria-selected={t.id === current.id}
            aria-controls={`painel-${t.id}`}
            onClick={() => setActive(t.id)}
            className={cn("min-h-11 rounded-full text-sm font-semibold", t.id === current.id ? "bg-foreground text-background" : "text-muted-foreground")}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`painel-${current.id}`} aria-labelledby={`aba-${current.id}`}>
        {current.content}
      </div>
    </div>
  );
}
