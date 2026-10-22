"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MAX_ITEMS, readItems, type MemoryItem } from "@/lib/memoria";

const SEEN_KEY = "gravai-insight-visto";

// Início: quando o Gravaí percebe algo novo, ele conta, do jeito de quem está aprendendo junto.
export function MemoryNote() {
  const [insight, setInsight] = useState<string | null>(null);

  useEffect(() => {
    // Primeiro deixa o servidor atualizar o resumo (só chama a IA se houver novidade), depois lê.
    fetch("/api/memoria", { method: "POST" })
      .catch(() => null)
      .then(() => createClient().from("creator_memory").select("insight").maybeSingle())
      .then(({ data }) => {
        const text = data?.insight?.trim();
        let seen: string | null = null;
        try {
          seen = localStorage.getItem(SEEN_KEY);
        } catch {}
        if (text && text !== seen) setInsight(text);
      });
  }, []);

  if (!insight) return null;

  function dismiss() {
    try {
      localStorage.setItem(SEEN_KEY, insight!);
    } catch {}
    setInsight(null);
  }

  return (
    <aside className="flex flex-col gap-2 rounded-2xl bg-card p-4" aria-label="Recado do Gravaí">
      <span className="label-set flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-rec" aria-hidden="true" />
        Gravaí
      </span>
      <p className="text-base leading-relaxed">{insight}</p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Quanto mais a gente cria junto, mais eu consigo te entender e te ajudar.
      </p>
      <div className="flex gap-4 text-sm font-semibold">
        <Link href="/perfil#memoria" className="flex min-h-11 items-center underline">
          Ver o que aprendi
        </Link>
        <button type="button" onClick={dismiss} className="flex min-h-11 items-center">
          Entendi
        </button>
      </div>
    </aside>
  );
}

// Perfil: o que o Gravaí entendeu sobre a pessoa. Ela vê, corrige, acrescenta e pode mandar esquecer tudo.
export function MemorySection() {
  const [items, setItems] = useState<MemoryItem[] | null>(null);
  const [draft, setDraft] = useState("");
  const [forgetting, setForgetting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .from("creator_memory")
      .select("items")
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError("Não foi possível carregar agora.");
        setItems(readItems(data?.items));
      });
  }, []);

  async function save(next: MemoryItem[]) {
    setBusy(true);
    setError(null);
    const db = createClient();
    const { data: { user } } = await db.auth.getUser();
    const { error } = user
      ? await db.from("creator_memory").upsert({ user_id: user.id, items: next }, { onConflict: "user_id" })
      : { error: true };
    setBusy(false);
    if (error) {
      setError("Não deu para salvar. Tente de novo.");
      return false;
    }
    setItems(next);
    return true;
  }

  async function add() {
    const text = draft.trim().replace(/\s+/g, " ").slice(0, 140);
    if (!text || !items) return;
    // Sem espaço, sai o item mais antigo que a IA tinha deduzido; o que a pessoa escreveu fica.
    let next = [...items, { text, source: "voce" as const }];
    if (next.length > MAX_ITEMS) {
      const firstAi = next.findIndex((i) => i.source === "ia");
      next = firstAi === -1 ? next.slice(1) : next.filter((_, i) => i !== firstAi);
    }
    if (await save(next)) setDraft("");
  }

  async function forget() {
    setBusy(true);
    setError(null);
    const { error } = await createClient().rpc("forget_my_memory");
    setBusy(false);
    if (error) {
      setError("Não deu para apagar agora. Tente de novo.");
      return;
    }
    setItems([]);
    setForgetting(false);
  }

  return (
    <section id="memoria" aria-labelledby="memoria-titulo" className="flex scroll-mt-6 flex-col gap-3 rounded-2xl border border-border p-4">
      <h2 id="memoria-titulo" className="font-bold">
        O que o Gravaí entendeu sobre você
      </h2>

      {items === null && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {items?.length === 0 && (
        <p className="text-sm leading-relaxed text-muted-foreground">
          Ainda estou te conhecendo. Quanto mais a gente cria junto, mais eu consigo te entender e sugerir coisas com a sua cara. O que eu
          for percebendo aparece aqui, e você corrige quando quiser.
        </p>
      )}

      {items && items.length > 0 && (
        <>
          <p className="text-sm leading-relaxed text-muted-foreground">
            É isso que eu levo em conta nas ideias, no roteiro, nos planos e na publicação. Se algo não for você, é só tirar.
          </p>
          <ul className="flex flex-col gap-2">
            {items.map((item, index) => (
              <li key={`${index}-${item.text}`} className="flex items-start gap-2 rounded-xl bg-card py-1 pl-3.5">
                <span className="flex flex-1 flex-col gap-0.5 py-2.5 text-[15px] leading-snug">
                  {item.text}
                  {item.source === "voce" && <span className="label-set text-muted-foreground">Você escreveu</span>}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => save(items.filter((_, i) => i !== index))}
                  aria-label={`Tirar: ${item.text}`}
                  className="flex size-11 shrink-0 items-center justify-center text-muted-foreground disabled:opacity-40"
                >
                  <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {items !== null && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <label htmlFor="memoria-novo" className="sr-only">
            Algo que o Gravaí deveria saber sobre você
          </label>
          <input
            id="memoria-novo"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={140}
            placeholder="Algo que eu deveria saber?"
            className="min-h-12 min-w-0 flex-1 rounded-full border border-input bg-background px-4 text-base outline-none focus:border-foreground"
          />
          <button
            type="submit"
            aria-label="Acrescentar"
            disabled={!draft.trim() || busy}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
          >
            <Plus className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {items && items.length > 0 && !forgetting && (
        <button type="button" onClick={() => setForgetting(true)} className="flex min-h-11 items-center self-start text-sm font-semibold text-destructive">
          Esquecer tudo
        </button>
      )}
      {forgetting && (
        <div className="flex flex-col gap-3 rounded-xl border border-destructive/40 p-3">
          <p className="text-sm leading-relaxed">
            Eu apago tudo o que aprendi sobre você e o histórico de escolhas que usei para aprender. Seus vídeos continuam aqui.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={forget} disabled={busy} className="min-h-12 flex-1 rounded-full bg-destructive font-bold text-white disabled:opacity-40">
              {busy ? "Apagando…" : "Esquecer tudo"}
            </button>
            <button type="button" onClick={() => setForgetting(false)} className="min-h-12 rounded-full px-4 font-semibold">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
