"use client";

import { useState } from "react";
import { SlateTabs } from "@/components/gravai/slate-tabs";

// Uma coisa por vez: Falas, Roteiro e Gravação nas abas de claquete do app, no lugar de uma página longa.
export function Abas({ tabs, initial }: { tabs: { id: string; label: string; count?: number; content: React.ReactNode }[]; initial: string }) {
  const [active, setActive] = useState(tabs.some((t) => t.id === initial) ? initial : tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  if (!current) return null;

  return (
    <div className="flex flex-col gap-4">
      <SlateTabs label="O que ver" items={tabs.map(({ id, label, count }) => ({ id, label, count }))} value={current.id} onChange={setActive} />
      <div role="tabpanel" aria-label={current.label}>
        {current.content}
      </div>
    </div>
  );
}
