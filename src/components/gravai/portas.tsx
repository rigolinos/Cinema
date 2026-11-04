"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STEPS, Thinking } from "@/components/gravai/thinking";
import { createClient } from "@/lib/supabase/client";
import { PASTE_MAX_CHARS } from "@/lib/organizar";
import { logSignal } from "@/lib/sinais";
import { cn } from "@/lib/utils";

const box = "w-full rounded-2xl border border-input bg-card px-4 py-3.5 text-base leading-relaxed outline-none focus:border-foreground";
const primary = "min-h-13 w-full rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-40";

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

// Porta "Já tenho a ideia": a pessoa conta do jeito dela e a IA conta o vídeo inteiro na tela seguinte,
// onde o texto dela continua à vista para corrigir.
export function OwnIdeaBox({ videoId, initial }: { videoId: string; initial: string }) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    const written = text.trim().replace(/\s+/g, " ");
    const title = written.split(" ").slice(0, 6).join(" ").slice(0, 140);
    const { error } = await createClient()
      .from("videos")
      .update({ title, hook: (written.split(/(?<=[.!?…])\s/)[0] ?? written).slice(0, 300), situation: written.slice(0, 600), payoff: "", brief: text.trim().slice(0, 4000), stage: "roteiro" })
      .eq("id", videoId);
    if (error) {
      setError("Não deu para salvar. Tente de novo.");
      setBusy(false);
      return;
    }
    logSignal("ideia_escolhida", { title }, videoId);
    router.push(`/video/${videoId}/roteiro?historia=1`);
  }

  return (
    <div className="flex flex-col gap-3">
      <Gravai>Me conta a sua ideia do seu jeito, do tamanho que vier. Se ainda não sabe o final, tudo bem.</Gravai>
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
      <button type="button" onClick={go} disabled={busy || text.trim().length < 8} className={primary}>
        {busy ? "Salvando…" : "Contar a história"}
      </button>
      <Problem text={error} />
    </div>
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
      <Gravai>Cole o seu roteiro aqui, do jeito que está no bloco de notas. Eu só organizo em cenas; não mudo nenhuma palavra.</Gravai>
      <label htmlFor="roteiro-colado" className="sr-only">
        Seu roteiro
      </label>
      <textarea
        id="roteiro-colado"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        maxLength={PASTE_MAX_CHARS}
        placeholder={"Cole aqui.\nDica: o que é ação pode ficar entre colchetes, [abre a porta]."}
        className={cn(box, "resize-y font-mono text-[15px]")}
      />
      <button type="button" onClick={organize} disabled={busy || !text.trim()} className={primary}>
        {busy ? <Thinking label="Organizando o seu roteiro" steps={STEPS.organizar} /> : "Organizar meu roteiro"}
      </button>
      <Problem text={error} />
    </div>
  );
}
