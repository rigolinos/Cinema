"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CONSENT_VERSION, consentText, validConsentName } from "@/lib/pessoas";
import { cn } from "@/lib/utils";

// A chamada da pessoa, como no set: dia e lugar, e o que falta fazer (confirmar presença e,
// se aparece no vídeo, autorizar o uso de imagem, com o termo direto no cartão).
export function PartActions({
  token,
  creator,
  title,
  confirmed: initiallyConfirmed,
  consented: initiallyConsented,
  needsConsent,
  when,
}: {
  token: string;
  creator: string | null;
  title: string;
  confirmed: boolean;
  consented: boolean;
  needsConsent: boolean;
  when: string | null; // dia e lugar da gravação, numa linha
}) {
  const [confirmed, setConfirmed] = useState(initiallyConfirmed);
  const [consented, setConsented] = useState(initiallyConsented);
  const [name, setName] = useState("");
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    const { data, error } = await createClient().rpc("confirm_presence", { p_token: token });
    if (error || !data) setError("Não deu para confirmar. Tente de novo.");
    else setConfirmed(true);
    setBusy(false);
  }

  async function accept(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await createClient().rpc("accept_image_use", { p_token: token, p_name: name.trim(), p_version: CONSENT_VERSION });
    if (error || !data) setError("Não deu para registrar a autorização. Tente de novo.");
    else setConsented(true);
    setBusy(false);
  }

  const done = [confirmed, ...(needsConsent ? [consented] : [])];
  const row = "flex min-h-11 items-center gap-2.5";
  const dot = (ok: boolean) => <span className={cn("size-[9px] shrink-0 rounded-full border-[1.5px]", ok ? "border-foreground bg-foreground" : "border-muted-foreground")} aria-hidden="true" />;

  return (
    <section aria-label="Chamada" className="flex flex-col gap-1 rounded-2xl bg-card px-4 pb-2 pt-3.5">
      <p className="label-set text-muted-foreground">{["Chamada", when].filter(Boolean).join(" · ")}</p>
      {/* A trilha de passos do app: uma barra por coisa a fazer, preta quando está feita. */}
      <div className="flex gap-1 py-2" role="img" aria-label={`${done.filter(Boolean).length} de ${done.length} feitos`}>
        {done.map((ok, i) => (
          <span key={i} className={cn("h-[5px] flex-1 rounded-full", ok ? "bg-foreground" : "bg-input")} />
        ))}
      </div>

      <div className={row}>
        {dot(confirmed)}
        <span className="label-set">Presença</span>
        {confirmed ? (
          <span className="label-set ml-auto text-muted-foreground">Confirmada</span>
        ) : (
          <button type="button" onClick={confirm} disabled={busy} className="-mr-2 ml-auto min-h-11 px-2 text-sm font-bold disabled:opacity-40">
            Confirmar →
          </button>
        )}
      </div>

      {needsConsent && (
        <div className={row}>
          {dot(consented)}
          <span className="label-set">Uso de imagem</span>
          <span className="label-set ml-auto text-muted-foreground">{consented ? "Autorizado" : creator ? "Leia abaixo" : "Aguardando"}</span>
        </div>
      )}
      {needsConsent && !consented && !creator && (
        <p className="pb-2 text-sm leading-relaxed text-muted-foreground">Quem te convidou ainda precisa colocar o nome completo no app. Depois disso, a autorização aparece aqui.</p>
      )}

      {/* O termo aparece direto, enquanto falta autorizar; depois fica só a linha "Autorizado". */}
      {needsConsent && creator && !consented && (
        <form onSubmit={accept} className="flex flex-col gap-3 pb-2 pt-1">
          <div className="flex flex-col gap-2 rounded-xl bg-muted p-3.5 text-sm leading-relaxed">
            {consentText(creator, title).map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Seu nome completo</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              autoComplete="name"
              className="min-h-12 rounded-xl border border-input bg-background px-3.5 text-base outline-none focus:border-foreground"
            />
          </label>
          <label className="flex min-h-11 items-start gap-3 text-sm leading-relaxed">
            <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="mt-1 size-5 shrink-0 accent-foreground" />
            Tenho 18 anos ou mais. (Com menos de 18, a autorização precisa ser do seu responsável: fale com quem te convidou.)
          </label>
          <button
            type="submit"
            disabled={busy || !adult || !validConsentName(name)}
            className="min-h-12 rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-40"
          >
            Autorizo
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="pb-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
