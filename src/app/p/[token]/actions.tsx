"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Folha } from "@/components/gravai/folha";
import { createClient } from "@/lib/supabase/client";
import { CONSENT_VERSION, consentText, validConsentName } from "@/lib/pessoas";
import { cn } from "@/lib/utils";

// O que a pessoa faz pelo link, como uma lista curta: confirmar presença e, se aparece no vídeo,
// autorizar o uso de imagem (o termo abre numa folha que sobe).
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
  const [reading, setReading] = useState(false); // o termo aberto na folha

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
    else {
      setConsented(true);
      setReading(false);
    }
    setBusy(false);
  }

  const step = "flex min-h-12 items-center gap-3";
  const dot = (done: boolean) => (
    <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full", done ? "bg-foreground text-background" : "border-[1.5px] border-input")} aria-hidden="true">
      {done && <Check className="size-3.5" strokeWidth={3} />}
    </span>
  );

  return (
    <section aria-label="O que fazer" className="flex flex-col gap-1 rounded-2xl bg-card px-4 py-3">
      {when && <p className="pb-1 text-sm font-semibold first-letter:uppercase">{when}</p>}
      <div className={step}>
        {dot(confirmed)}
        <span className="flex-1">{confirmed ? "Presença confirmada" : "Confirmar presença"}</span>
        {!confirmed && (
          <button type="button" onClick={confirm} disabled={busy} className="min-h-11 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-40">
            Confirmar
          </button>
        )}
      </div>
      {needsConsent && (
        <div className={step}>
          {dot(consented)}
          <span className="flex-1">{consented ? "Uso de imagem autorizado" : "Autorizar uso de imagem"}</span>
          {!consented && creator && (
            <button type="button" onClick={() => setReading(true)} className="min-h-11 px-1 text-sm font-semibold underline">
              Ler e autorizar
            </button>
          )}
        </div>
      )}
      {needsConsent && !consented && !creator && (
        <p className="pb-1 text-sm leading-relaxed text-muted-foreground">Quem te convidou ainda precisa colocar o nome completo no app. Depois disso, a autorização aparece aqui.</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {/* O termo inteiro continua sendo lido antes de autorizar: só sai do meio da página. */}
      {reading && creator && (
        <Folha title="Autorização de uso de imagem" onClose={() => setReading(false)}>
          <form onSubmit={accept} className="flex flex-col gap-3 px-2 pb-2">
            <p className="text-sm leading-relaxed text-muted-foreground">Como você aparece no vídeo, {creator} precisa da sua autorização para publicar. Leia com calma:</p>
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
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || !adult || !validConsentName(name)}
              className="min-h-12 rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-40"
            >
              Autorizo
            </button>
          </form>
        </Folha>
      )}
    </section>
  );
}
