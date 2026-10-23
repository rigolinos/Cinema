"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Explica uma vez só: na primeira vez que um conceito aparece, a explicação vem aberta.
// Depois fica recolhida num "o que é isso?", para quem já sabe passar direto.
// Fica guardado no aparelho (é só conforto: se o navegador apagar, explica de novo).
const KEY = "gravai-explicado";
let seen: string[] | null = null;

function readSeen(): string {
  if (seen === null) {
    try {
      seen = JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
    } catch {
      seen = [];
    }
  }
  return seen.join("|");
}

function markSeen(id: string) {
  readSeen();
  if (seen!.includes(id)) return;
  seen = [...seen!, id];
  try {
    localStorage.setItem(KEY, JSON.stringify(seen));
  } catch {}
}

const noop = () => () => {};

// true na primeira vez que o conceito aparece. A resposta fica fixa enquanto a tela está aberta,
// então a explicação não some no meio da leitura; na próxima visita, já vem recolhida.
export function useFirstTime(id: string): boolean {
  const snapshot = useSyncExternalStore(noop, readSeen, () => null);
  const [first, setFirst] = useState<boolean | null>(null);
  if (first === null && snapshot !== null) setFirst(!snapshot.split("|").includes(id));
  useEffect(() => {
    if (first !== null) markSeen(id);
  }, [first, id]);
  return first === true;
}

export function Explain({
  id,
  question,
  learn,
  closed,
  className,
  children,
}: {
  id: string;
  question: string; // "O que é um plano?"
  learn?: string; // âncora no Aprenda para quem quer saber mais
  closed?: boolean; // nunca abre sozinho (ex.: o porquê de cada plano, que se repete na lista)
  className?: string;
  children: React.ReactNode;
}) {
  const first = useFirstTime(id);
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? (first && !closed);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setToggled(!open)}
        className="flex min-h-9 items-center gap-1 self-start text-sm text-muted-foreground"
      >
        {question}
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} strokeWidth={1.75} aria-hidden="true" />
      </button>
      {open && (
        <div className="text-sm leading-relaxed text-muted-foreground">
          {children}
          {learn && (
            <>
              {" "}
              <Link href={`/aprenda#${learn}`} className="font-semibold text-foreground underline">
                Saber mais
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
