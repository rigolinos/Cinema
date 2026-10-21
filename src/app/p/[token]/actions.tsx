"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CONSENT_VERSION, consentText, validConsentName } from "@/lib/pessoas";

// O que a pessoa faz pelo link: confirmar presença e, se aparece no vídeo, autorizar o uso de imagem.
export function PartActions({
  token,
  creator,
  title,
  confirmed: initiallyConfirmed,
  consented: initiallyConsented,
  needsConsent,
}: {
  token: string;
  creator: string | null;
  title: string;
  confirmed: boolean;
  consented: boolean;
  needsConsent: boolean;
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

  return (
    <div className="flex flex-col gap-3">
      {confirmed ? (
        <p className="flex items-center gap-2 rounded-2xl bg-card p-4 font-semibold">
          <Check className="size-5 text-success" strokeWidth={2.5} aria-hidden="true" />
          Presença confirmada
        </p>
      ) : (
        <button type="button" onClick={confirm} disabled={busy} className="min-h-13 rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-40">
          Confirmar que vou
        </button>
      )}

      {needsConsent && !consented && !creator && (
        <p className="rounded-2xl bg-card p-4 text-sm leading-relaxed">
          <strong>Autorização de uso de imagem:</strong> quem te convidou ainda precisa colocar o nome completo no app. Assim que
          fizer isso, a autorização aparece aqui.
        </p>
      )}

      {needsConsent &&
        creator &&
        (consented ? (
          <p className="flex items-center gap-2 rounded-2xl bg-card p-4 font-semibold">
            <Check className="size-5 text-success" strokeWidth={2.5} aria-hidden="true" />
            Uso de imagem autorizado
          </p>
        ) : (
          <form onSubmit={accept} className="flex flex-col gap-3 rounded-2xl bg-card p-4">
            <h2 className="font-bold">Autorização de uso de imagem</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Como você aparece no vídeo, {creator} precisa da sua autorização para publicar. Leia com calma:
            </p>
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
        ))}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
