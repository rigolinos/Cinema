"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Folha que sobe de baixo. Abre na metade da tela; puxando a alça para cima ocupa quase tudo,
// para baixo volta à metade e depois fecha. O gesto é atalho: fechar também funciona tocando fora,
// no X ou com Esc. Renderize só quando estiver aberta: ela sempre abre na metade.
// Entra subindo e sai descendo; com "reduzir movimento" no aparelho, aparece e some sem animar.
const PULL = 70; // px de arrasto que contam como gesto
const OUT_MS = 240;

export function Folha({ title, summary, onClose, children }: { title: string; summary?: string; onClose: () => void; children: React.ReactNode }) {
  const [full, setFull] = useState(false);
  const [drag, setDrag] = useState<number | null>(null); // px puxados (positivo = para baixo) enquanto o dedo está na alça
  const [leaving, setLeaving] = useState(false);
  const start = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  // Desce deslizando e só então avisa quem abriu.
  function close() {
    if (leaving) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return onClose();
    setDrag(null);
    setLeaving(true);
    setTimeout(onClose, OUT_MS);
  }

  function release() {
    const d = drag ?? 0;
    setDrag(null);
    if (d < -PULL) setFull(true);
    else if (d > PULL) {
      if (full) setFull(false);
      else close();
    }
  }

  return (
    <div
      className={cn("animate-fade-in fixed inset-0 z-[60] flex items-end justify-center bg-black/50 transition-opacity duration-200", leaving && "opacity-0")}
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="folha-titulo"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && close()}
        style={{
          height: full ? "92dvh" : "60dvh",
          transform: leaving ? "translateY(100%)" : drag && drag > 0 ? `translateY(${drag}px)` : undefined,
        }}
        className={cn(
          "folha-sobe flex w-full max-w-lg flex-col rounded-t-3xl bg-card text-foreground",
          drag === null && "transition-[height,transform] duration-[240ms] ease-[cubic-bezier(0.4,0,1,1)] motion-reduce:transition-none",
        )}
      >
        <div
          className="flex shrink-0 touch-none flex-col gap-2 px-5 pb-3 pt-2.5"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("button")) return; // o X continua sendo um toque comum
            start.current = e.clientY;
            setDrag(0);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => drag !== null && setDrag(e.clientY - start.current)}
          onPointerUp={release}
          onPointerCancel={() => setDrag(null)}
        >
          <span className="h-1 w-9 self-center rounded-full bg-input" aria-hidden="true" />
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <h2 id="folha-titulo" ref={heading} tabIndex={-1} className="text-base font-bold outline-none">
                {title}
              </h2>
              {summary && <p className="label-set text-muted-foreground">{summary}</p>}
            </div>
            <button type="button" onClick={close} aria-label="Fechar" className="-mr-2.5 flex size-11 shrink-0 items-center justify-center">
              <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}
