"use client";

import { cn } from "@/lib/utils";

// Abas no vocabulário do Gravaí: rótulo na fonte de claquete e, embaixo, a barra da trilha dos passos
// (preta na aba ativa, cinza nas outras). Para navegação e filtros; escolhas da conversa continuam em pílulas.
export function SlateTabs<T extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string; // nome do grupo, para leitor de tela
  items: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="tablist" aria-label={label} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((item) => {
        const on = item.id === value;
        return (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={on}
            onClick={() => onChange(item.id)}
            className="flex min-h-11 flex-col justify-end gap-2 text-left"
          >
            <span className={cn("label-set truncate", on ? "text-foreground" : "text-muted-foreground")}>
              {item.label}
              {/* Número com dois dígitos, como plano e take; vazio não mostra nada. */}
              {item.count ? ` ${String(item.count).padStart(2, "0")}` : ""}
            </span>
            <span className={cn("h-[5px] rounded-full", on ? "bg-foreground" : "bg-input")} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
