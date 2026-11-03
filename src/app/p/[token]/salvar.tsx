"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { InviteState } from "@/lib/convites";

// Guardar o convite na conta, sempre por escolha da pessoa: abrir o link não salva nada.
export function SaveInvite({ token, state: initial, signup }: { token: string; state: InviteState | null; signup: string }) {
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!state || state === "owner") return null;

  async function save() {
    setBusy(true);
    setError(null);
    const { data, error } = await createClient().rpc("claim_invite", { p_token: token });
    if (error || !data) setError("Não deu para salvar. Tente de novo.");
    else setState(data as InviteState);
    setBusy(false);
  }

  if (state === "taken") {
    return <p className="rounded-2xl bg-card p-4 text-sm leading-relaxed text-muted-foreground">Este convite já foi salvo em outra conta. Se não foi você, avise quem te convidou.</p>;
  }

  if (state === "mine") {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3">
        <span className="flex-1 font-semibold">Salvo na sua conta</span>
        <Link href="/videos" className="flex min-h-11 shrink-0 items-center text-sm font-bold">
          Ver meus vídeos →
        </Link>
      </div>
    );
  }

  const action = "flex min-h-11 shrink-0 items-center rounded-full border-[1.5px] border-foreground px-4 text-sm font-bold disabled:opacity-40";
  return (
    <section aria-label="Salvar o convite" className="flex flex-col gap-1 rounded-2xl bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="font-semibold">Salvar na sua conta</span>
          <span className="text-sm leading-snug text-muted-foreground">Para voltar sem procurar o link. Quem te convidou vê o nome da sua conta.</span>
        </span>
        {state === "anon" ? (
          <Link href={signup} className={action}>
            Salvar
          </Link>
        ) : (
          <button type="button" onClick={save} disabled={busy} className={action}>
            Salvar
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
