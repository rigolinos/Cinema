"use client";

import { useCallback, useRef, useState } from "react";

// Confirmação do próprio Gravaí, no lugar do window.confirm: a janela do navegador é bloqueada
// no app instalado e no navegador de dentro de outros apps (aí ela responde "não" sozinha e nada acontece).
// Uso: const { confirm, sheet } = useConfirm(); if (!(await confirm({ … }))) return; e renderizar {sheet}.

export interface ConfirmOptions {
  title: string;
  text?: string;
  action: string; // "Apagar para sempre", "Escrever de novo"…
  danger?: boolean; // ação que apaga: botão vermelho
}

export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback(
    (next: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setOptions(next);
      }),
    [],
  );

  const close = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  };

  const sheet = options ? (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40" onClick={() => close(false)}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmar-titulo"
        aria-describedby={options.text ? "confirmar-texto" : undefined}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-lg flex-col gap-4 rounded-t-3xl bg-background p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-foreground"
      >
        <h2 id="confirmar-titulo" className="text-lg font-bold leading-snug">
          {options.title}
        </h2>
        {options.text && (
          <p id="confirmar-texto" className="leading-relaxed text-muted-foreground">
            {options.text}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            autoFocus
            onClick={() => close(true)}
            className={
              options.danger
                ? "min-h-13 rounded-full bg-destructive font-bold text-white"
                : "min-h-13 rounded-full bg-primary font-bold text-primary-foreground"
            }
          >
            {options.action}
          </button>
          <button type="button" onClick={() => close(false)} className="min-h-12 rounded-full font-semibold">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, sheet };
}
