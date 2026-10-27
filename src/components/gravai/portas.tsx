"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { STEPS, Thinking } from "@/components/gravai/thinking";
import { createClient } from "@/lib/supabase/client";
import { findFormat } from "@/lib/formats";
import type { OwnIdea } from "@/lib/ideia-propria";
import { PASTE_MAX_CHARS } from "@/lib/organizar";
import { logSignal } from "@/lib/sinais";
import { cn } from "@/lib/utils";

const box = "w-full rounded-2xl border border-input bg-card px-4 py-3.5 text-base leading-relaxed outline-none focus:border-foreground";
const primary = "min-h-13 w-full rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-40";
const quiet = "flex min-h-11 items-center self-center text-sm font-semibold underline disabled:opacity-40";

function Gravai({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="label-set flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-rec" aria-hidden="true" />
        Gravaí
      </span>
      <div className="text-base leading-relaxed">{children}</div>
    </div>
  );
}

function Problem({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="rounded-2xl border border-destructive/40 bg-card p-4 text-sm text-destructive">
      {text}
    </p>
  ) : null;
}

// Porta "Do zero": antes da primeira rodada, a pessoa pode contar o que imagina (opcional).
// É o texto que ela colaria no GPT; vale só para este vídeo.
export function BriefBox({ videoId, initial, busy, onReady }: { videoId: string; initial: string; busy: boolean; onReady: () => void }) {
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function go() {
    setSaving(true);
    await createClient().from("videos").update({ brief: text.trim().slice(0, 4000) }).eq("id", videoId);
    setSaving(false);
    onReady();
  }

  return (
    <div className="flex flex-col gap-3">
      <Gravai>Quer me contar o que imagina para este vídeo? Se não, eu sugiro do zero.</Gravai>
      <label htmlFor="briefing" className="sr-only">
        O que você imagina para este vídeo
      </label>
      <textarea
        id="briefing"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        maxLength={4000}
        placeholder="Ex.: sketch de comédia com situações do dia a dia e um final que ninguém espera"
        className={cn(box, "resize-none")}
      />
      <button type="button" onClick={go} disabled={busy || saving} className={primary}>
        {text.trim() ? "Ver ideias com isso" : "Ver ideias"}
      </button>
    </div>
  );
}

// Porta "Já tenho a ideia": a pessoa conta do jeito dela; o Gravaí devolve a mesma ideia mais afiada.
export function OwnIdeaBox({ videoId, initial }: { videoId: string; initial: string }) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [idea, setIdea] = useState<OwnIdea | null>(null);
  const [hook, setHook] = useState(0); // índice do gancho escolhido; -1 = o que a pessoa escreveu
  const [ownHook, setOwnHook] = useState("");
  const [payoff, setPayoff] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [busy, setBusy] = useState<"ia" | "salvar" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sharpen() {
    setBusy("ia");
    setError(null);
    const res = await fetch("/api/ideia-propria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, text }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!res?.ok) setError(body?.error ?? "Sem conexão. Tente de novo.");
    else {
      const next = body.idea as OwnIdea;
      setIdea(next);
      setHook(0);
      setPayoff(0);
      setAnswers(next.questions.map(() => ""));
    }
    setBusy(null);
  }

  async function save(asWritten: boolean) {
    setBusy("salvar");
    setError(null);
    const written = text.trim().replace(/\s+/g, " ");
    const firstSentence = written.split(/(?<=[.!?…])\s/)[0] ?? written;
    const qa = idea?.questions.map((q, i) => (answers[i]?.trim() ? `${q} ${answers[i].trim()}` : "")).filter(Boolean) ?? [];
    const patch =
      asWritten || !idea
        ? { title: written.split(" ").slice(0, 6).join(" ").slice(0, 140), hook: firstSentence.slice(0, 300), situation: written.slice(0, 600), payoff: "" }
        : {
            title: idea.title,
            hook: (hook === -1 ? ownHook.trim() : idea.hooks[hook]).slice(0, 300),
            situation: idea.situation,
            payoff: idea.payoff || idea.payoff_options[payoff] || "",
            format_slug: idea.format_slug,
          };
    const { error } = await createClient()
      .from("videos")
      .update({ ...patch, brief: [text.trim(), ...qa].join("\n\n").slice(0, 4000), stage: "roteiro" })
      .eq("id", videoId);
    if (error) {
      setError("Não deu para salvar. Tente de novo.");
      setBusy(null);
      return;
    }
    logSignal("ideia_escolhida", { title: patch.title, format: findFormat("format_slug" in patch ? patch.format_slug : null)?.name }, videoId);
    router.push(`/video/${videoId}/roteiro`);
  }

  if (!idea) {
    return (
      <div className="flex flex-col gap-3">
        <Gravai>Me conta a sua ideia do seu jeito, do tamanho que vier. Eu não troco por outra: só deixo pronta para gravar.</Gravai>
        <label htmlFor="ideia-propria" className="sr-only">
          Sua ideia
        </label>
        <textarea
          id="ideia-propria"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          maxLength={1500}
          placeholder="Ex.: minha mãe ligando três vezes para saber se eu comi, e na última ela já está na porta"
          className={cn(box, "resize-none")}
        />
        <button type="button" onClick={sharpen} disabled={busy !== null || text.trim().length < 8} className={primary}>
          {busy === "ia" ? <Thinking label="Organizando a sua ideia" steps={STEPS.ideiaPropria} /> : "Organizar minha ideia"}
        </button>
        <button type="button" onClick={() => save(true)} disabled={busy !== null || text.trim().length < 8} className={quiet}>
          Usar exatamente como escrevi
        </button>
        <Problem text={error} />
      </div>
    );
  }

  const canSave = hook === -1 ? ownHook.trim().length > 0 : true;
  const format = findFormat(idea.format_slug);

  return (
    <div className="flex flex-col gap-4">
      {idea.note && <Gravai>{idea.note}</Gravai>}
      <article className="flex flex-col gap-3 rounded-2xl bg-card p-4">
        {format && <span className="label-set text-muted-foreground">Formato · {format.name}</span>}
        <h2 className="text-lg font-bold leading-snug">{idea.title}</h2>
        {idea.situation && <p className="text-[15px] leading-relaxed">{idea.situation}</p>}
        {idea.payoff && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            <strong className="font-semibold text-foreground">Desfecho:</strong> {idea.payoff}
          </p>
        )}
      </article>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">Escolha o gancho (os 3 primeiros segundos)</legend>
        {idea.hooks.map((h, i) => (
          <Choice key={h} on={hook === i} onClick={() => setHook(i)} hint={i === 0 ? "Fiel ao que você escreveu" : i === 1 ? "Mais forte" : "Outro ângulo"}>
            “{h}”
          </Choice>
        ))}
        <Choice on={hook === -1} onClick={() => setHook(-1)} hint="Escrever o meu">
          {hook === -1 ? (
            <input
              autoFocus
              value={ownHook}
              onChange={(e) => setOwnHook(e.target.value)}
              maxLength={300}
              placeholder="O seu gancho"
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-transparent text-base outline-none"
            />
          ) : (
            "Prefiro escrever o meu"
          )}
        </Choice>
      </fieldset>

      {!idea.payoff && idea.payoff_options.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">Qual desfecho?</legend>
          {idea.payoff_options.map((p, i) => (
            <Choice key={p} on={payoff === i} onClick={() => setPayoff(i)}>
              {p}
            </Choice>
          ))}
        </fieldset>
      )}

      {idea.questions.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="font-semibold">Duas coisas que só você sabe (opcional)</p>
          {idea.questions.map((q, i) => (
            <label key={q} className="flex flex-col gap-1.5 text-sm">
              <span>{q}</span>
              <input
                value={answers[i] ?? ""}
                onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
                maxLength={200}
                className="min-h-12 rounded-xl border border-input bg-card px-3.5 text-base outline-none focus:border-foreground"
              />
            </label>
          ))}
        </div>
      )}

      <button type="button" onClick={() => save(false)} disabled={busy !== null || !canSave} className={primary}>
        {busy === "salvar" ? "Salvando…" : "Seguir para o roteiro"}
      </button>
      <button type="button" onClick={() => setIdea(null)} disabled={busy !== null} className={quiet}>
        Mudar o que eu escrevi
      </button>
      <Problem text={error} />
    </div>
  );
}

function Choice({ on, onClick, hint, children }: { on: boolean; onClick: () => void; hint?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn("flex items-start gap-3 rounded-2xl border p-3.5 text-left", on ? "border-foreground bg-card" : "border-border")}
    >
      <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px]", on ? "border-foreground bg-foreground text-background" : "border-input")}>
        {on && <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />}
      </span>
      <span className="flex flex-1 flex-col gap-0.5">
        {hint && <span className="label-set text-muted-foreground">{hint}</span>}
        <span className="text-[15px] leading-snug">{children}</span>
      </span>
    </button>
  );
}

// Porta "Já tenho o roteiro": a pessoa cola o texto; o Gravaí organiza em blocos sem mudar uma palavra.
export function PasteBox({ videoId, initial }: { videoId: string; initial: string }) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function organize() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/roteiro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, mode: "organizar", text }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!res?.ok) {
      setError(body?.error ?? "Sem conexão. Tente de novo.");
      setBusy(false);
      return;
    }
    router.push(`/video/${videoId}/roteiro`);
  }

  return (
    <div className="flex flex-col gap-3">
      <Gravai>Cole o seu roteiro aqui, do jeito que está no bloco de notas. Eu só organizo em partes; não mudo nenhuma palavra.</Gravai>
      <label htmlFor="roteiro-colado" className="sr-only">
        Seu roteiro
      </label>
      <textarea
        id="roteiro-colado"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        maxLength={PASTE_MAX_CHARS}
        placeholder={"Cole aqui.\nDica: o que é cena pode ficar entre colchetes, [abre a porta]."}
        className={cn(box, "resize-y font-mono text-[15px]")}
      />
      <button type="button" onClick={organize} disabled={busy || !text.trim()} className={primary}>
        {busy ? <Thinking label="Organizando o seu roteiro" steps={STEPS.organizar} /> : "Organizar meu roteiro"}
      </button>
      <Problem text={error} />
    </div>
  );
}
