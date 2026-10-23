"use client";

import { use, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowUp, Check, Copy, Sparkles } from "lucide-react";
import { Explain } from "@/components/gravai/explain";
import { StepHeader } from "@/components/gravai/step-header";
import { Thinking } from "@/components/gravai/thinking";
import { nextReadyStage } from "@/components/gravai/trail";
import { isSolo } from "@/lib/planos";
import { logSignal } from "@/lib/sinais";
import { createClient } from "@/lib/supabase/client";
import { findFormat } from "@/lib/formats";
import { durationLabel } from "@/lib/ideas";
import { BLOCK_KINDS, checkScript, scriptAsText, speakerOf, timeline, totalSeconds, type ScriptBlock } from "@/lib/roteiro";
import { cn } from "@/lib/utils";
import type { Video } from "@/types/database";

type Block = ScriptBlock & { id: string; position: number; person_id?: string | null };
type Person = { id: string; name: string; role: string };
type Field = "speech" | "on_screen" | "action";

const QUICK = ["Mais curto", "Mais engraçado", "Mais direto"];

const chip = "min-h-11 rounded-full border border-input bg-card px-4 text-sm font-semibold whitespace-nowrap";
const input =
  "w-full rounded-xl border border-input bg-background px-3.5 py-3 text-base leading-relaxed outline-none focus:border-foreground";

async function callApi(body: Record<string, unknown>) {
  const res = await fetch("/api/roteiro", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  const data = await res?.json().catch(() => null);
  if (!res?.ok) throw new Error(data?.error ?? "Sem conexão. Tente de novo.");
  return data;
}

// Caixa de texto que cresce com o que está escrito: nada fica escondido nem cortado.
function GrowingText(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [props.value]);
  return <textarea ref={ref} rows={1} {...props} className={cn(input, "resize-none overflow-hidden", props.className)} />;
}

function BlockCard({
  block,
  index,
  time,
  busy,
  repeated,
  speaker,
  onSave,
  onRewrite,
}: {
  block: Block;
  repeated: boolean; // outro bloco do mesmo tipo já veio antes: a explicação não abre de novo
  speaker: string | null;
  index: number;
  time: { start: number; end: number };
  busy: boolean;
  onSave: (field: Field, value: string) => Promise<void>;
  onRewrite: (request: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState({ speech: block.speech, on_screen: block.on_screen, action: block.action });
  const [synced, setSynced] = useState(block);
  const [asking, setAsking] = useState(false);
  const [ask, setAsk] = useState("");

  // Quando a IA reescreve o bloco, o formulário mostra o texto novo.
  if (synced !== block) {
    setSynced(block);
    setDraft({ speech: block.speech, on_screen: block.on_screen, action: block.action });
  }

  const kind = BLOCK_KINDS[block.kind];
  const save = (field: Field) => {
    if (draft[field] !== block[field]) onSave(field, draft[field]);
  };
  const rewrite = async (request: string) => {
    await onRewrite(request);
    setAsk("");
    setAsking(false);
  };

  return (
    <article className="flex flex-col gap-3 rounded-2xl bg-card p-4" aria-label={`Bloco ${index + 1}: ${block.label || kind.label}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="label-set">
          {String(index + 1).padStart(2, "0")} · {block.label || kind.label}
        </h2>
        <span className="font-mono text-sm text-muted-foreground">
          {time.start}–{time.end} s
        </span>
      </div>
      <Explain id={`bloco-${block.kind}`} question="Para que serve este bloco?" closed={repeated} className="-mt-1">
        {kind.hint}
      </Explain>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Fala{speaker ? ` · ${speaker}` : ""}</span>
        <GrowingText
          value={draft.speech}
          onChange={(e) => setDraft((d) => ({ ...d, speech: e.target.value }))}
          onBlur={() => save("speech")}
          maxLength={1500}
          placeholder="O que você fala neste trecho"
          className="min-h-20 font-medium"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Na tela</span>
        <GrowingText
          value={draft.on_screen}
          onChange={(e) => setDraft((d) => ({ ...d, on_screen: e.target.value }))}
          onBlur={() => save("on_screen")}
          maxLength={300}
          placeholder="Texto que aparece escrito (opcional)"
          className="min-h-12"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Cena</span>
        <GrowingText
          value={draft.action}
          onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))}
          onBlur={() => save("action")}
          maxLength={500}
          placeholder="O que acontece (opcional)"
          className="min-h-12"
        />
      </label>

      {!asking ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => setAsking(true)}
          className="flex min-h-11 items-center gap-2 self-start text-sm font-semibold disabled:opacity-40"
        >
          <Sparkles className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Pedir ajuste neste bloco
        </button>
      ) : (
        <form
          className="flex flex-col gap-2.5 rounded-xl bg-muted p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (ask.trim()) rewrite(ask.trim());
          }}
        >
          <div className="flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <button key={q} type="button" disabled={busy} className={chip} onClick={() => rewrite(q)}>
                {q}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <label htmlFor={`ajuste-${block.id}`} className="sr-only">
              O que mudar neste bloco
            </label>
            <input
              id={`ajuste-${block.id}`}
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              maxLength={300}
              placeholder="Ou escreva o que mudar"
              className="min-h-12 flex-1 rounded-full border border-input bg-card px-4 text-base outline-none focus:border-foreground"
            />
            <button
              type="submit"
              aria-label="Pedir ajuste"
              disabled={!ask.trim() || busy}
              className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
            >
              <ArrowUp className="size-5" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
          <button type="button" onClick={() => setAsking(false)} className="min-h-11 self-start text-sm text-muted-foreground">
            Cancelar
          </button>
        </form>
      )}
    </article>
  );
}

export default function RoteiroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [video, setVideo] = useState<Video | null | undefined>(undefined);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [busy, setBusy] = useState<string | null>(null); // "rascunho", id de um bloco ou "seguir"
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const db = createClient();
    Promise.all([
      db.from("videos").select("*").eq("id", id).maybeSingle(),
      db.from("script_blocks").select("*").eq("video_id", id).order("position"),
      db.from("video_people").select("id, name, role").eq("video_id", id),
    ]).then(([v, b, p]) => {
      setVideo((v.data as Video | null) ?? null);
      setBlocks((b.data ?? []) as Block[]);
      setPeople((p.data ?? []) as Person[]);
    });
  }, [id]);

  async function draft() {
    if (blocks.length > 0 && !window.confirm("Escrever um rascunho novo substitui o roteiro atual, inclusive o que você editou. Continuar?")) return;
    setBusy("rascunho");
    setError(null);
    try {
      const data = await callApi({ videoId: id, mode: "rascunho" });
      setBlocks(data.blocks as Block[]);
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(null);
  }

  async function saveField(block: Block, field: Field, value: string) {
    setError(null);
    const { error } = await createClient().from("script_blocks").update({ [field]: value }).eq("id", block.id);
    if (error) {
      setError("Não deu para salvar a última mudança. Confira a conexão.");
      return;
    }
    setBlocks((list) => list.map((b) => (b.id === block.id ? { ...b, [field]: value } : b)));
    // O que a pessoa reescreve à mão diz muito sobre o jeito dela de falar.
    const before = (block[field] ?? "").trim();
    if (before && value.trim() && before !== value.trim()) {
      logSignal("roteiro_editado", { campo: field, bloco: block.label, antes: before, depois: value }, id);
    }
  }

  async function rewrite(block: Block, request: string) {
    setBusy(block.id);
    setError(null);
    try {
      const data = await callApi({ videoId: id, mode: "bloco", blockId: block.id, request });
      setBlocks((list) => list.map((b) => (b.id === block.id ? (data.block as Block) : b)));
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(null);
  }

  async function copy() {
    if (!video) return;
    await navigator.clipboard.writeText(scriptAsText(video.title ?? "Roteiro", blocks)).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function finish() {
    if (!video) return;
    setBusy("seguir");
    // Quem grava sozinho não tem ninguém para chamar: pula o passo Pessoas.
    const next = isSolo(video.resources ?? []) ? nextReadyStage("pessoas") : nextReadyStage("roteiro");
    if (video.stage === "roteiro") {
      const { error } = await createClient().from("videos").update({ stage: next }).eq("id", id);
      if (error) {
        setBusy(null);
        setError("Não deu para avançar. Tente de novo.");
        return;
      }
    }
    router.push(`/video/${id}/${next}`);
  }

  const times = timeline(blocks);
  const checks = video ? checkScript(blocks, video.duration_s) : [];
  const format = findFormat(video?.format_slug);

  return (
    <div className="flex min-h-dvh flex-col">
      <StepHeader step="roteiro" backHref={`/video/${id}/ideia`} videoId={id} />

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-5 pb-40 pt-5">
        {video === undefined && <p className="label-set text-muted-foreground">Carregando…</p>}
        {video === null && <p className="text-sm text-destructive">Não encontramos este vídeo.</p>}

        {video && !video.hook && (
          <p className="rounded-2xl bg-card p-4 text-sm leading-relaxed">
            Primeiro escolha uma ideia: o roteiro nasce dela.{" "}
            <Link href={`/video/${id}/ideia`} className="font-semibold underline">
              Ir para a ideia
            </Link>
          </p>
        )}

        {video?.hook && (
          <>
            <div className="flex flex-col gap-1.5">
              <h2 className="font-display text-[26px]">{video.title}</h2>
              <p className="font-mono text-sm text-muted-foreground">
                {format ? `${format.name} · ` : ""}
                {blocks.length > 0 ? `${durationLabel(totalSeconds(blocks))} de ` : ""}
                {video.duration_s ? durationLabel(video.duration_s) : ""}
              </p>
            </div>

            {blocks.length === 0 && (
              <div className="flex flex-col gap-4 rounded-2xl bg-card p-4">
                <span className="label-set flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-rec" aria-hidden="true" />
                  Gravaí
                </span>
                <p className="leading-relaxed">
                  Escrevo um rascunho{format ? ` no formato “${format.name}”` : ""}, começando pelo seu gancho. Depois você muda o
                  que quiser.
                </p>
                <Explain id="roteiro" question="Por que escrever antes de gravar?" learn="roteiro" className="-mt-2">
                  O roteiro separa o que você fala, o que aparece escrito e o que acontece em cena. Com ele você grava mais rápido e
                  não esquece nada.
                </Explain>
                <button
                  type="button"
                  onClick={draft}
                  disabled={busy !== null}
                  className="min-h-13 rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-40"
                >
                  {busy === "rascunho" ? <Thinking label="Escrevendo o roteiro" /> : "Escrever o rascunho"}
                </button>
              </div>
            )}

            {blocks.length > 0 && (
              <ul className="flex flex-col gap-2 rounded-2xl border border-border p-4" aria-label="Revisão do roteiro">
                {checks.map((c) => (
                  <li key={c.text} className="flex gap-2.5 text-sm leading-relaxed">
                    {c.level === "ok" ? (
                      <Check className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2} aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" strokeWidth={1.75} aria-hidden="true" />
                    )}
                    {c.text}
                  </li>
                ))}
              </ul>
            )}

            {blocks.map((b, i) => (
              <BlockCard
                key={b.id}
                block={b}
                index={i}
                time={times[i]}
                busy={busy !== null}
                repeated={blocks.slice(0, i).some((x) => x.kind === b.kind)}
                speaker={speakerOf(b, people, isSolo(video.resources ?? []))}
                onSave={(field, value) => saveField(b, field, value)}
                onRewrite={(request) => rewrite(b, request)}
              />
            ))}

            {busy && busy !== "rascunho" && busy !== "seguir" && <p className="label-set text-muted-foreground"><Thinking label="Reescrevendo o bloco" /></p>}
            {error && (
              <p role="alert" className="rounded-2xl border border-destructive/40 bg-card p-4 text-sm text-destructive">
                {error}
              </p>
            )}

            {blocks.length > 0 && (
              <button type="button" onClick={draft} disabled={busy !== null} className="min-h-11 self-start text-sm font-semibold underline disabled:opacity-40">
                {busy === "rascunho" ? <Thinking label="Escrevendo" /> : "Escrever outro rascunho"}
              </button>
            )}
          </>
        )}
      </div>

      {blocks.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto flex max-w-lg gap-2.5 px-4 py-3">
            <button
              type="button"
              onClick={copy}
              className="flex min-h-13 items-center gap-2 rounded-full border-[1.5px] border-foreground px-5 font-semibold"
            >
              {copied ? <Check className="size-5" strokeWidth={2} aria-hidden="true" /> : <Copy className="size-5" strokeWidth={1.75} aria-hidden="true" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
            <button
              type="button"
              onClick={finish}
              disabled={busy !== null}
              className="min-h-13 flex-1 rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-40"
            >
              Roteiro pronto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
