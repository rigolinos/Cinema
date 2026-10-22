"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { StepHeader } from "@/components/gravai/step-header";
import { logSignal } from "@/lib/sinais";
import { createClient } from "@/lib/supabase/client";
import {
  ANGLES,
  FRAMINGS,
  MOVEMENTS,
  defaultOrientation,
  setupChanges,
  shootingOrder,
  shotTerms,
  type Angle,
  type Framing,
  type Movement,
  type Orientation,
  type Shot,
  type Term,
} from "@/lib/planos";
import { BLOCK_KINDS, type ScriptBlock } from "@/lib/roteiro";
import { cn } from "@/lib/utils";
import type { Video } from "@/types/database";

type Block = ScriptBlock & { id: string; position: number };
type SavedShot = Shot & { id: string };
type View = "roteiro" | "gravar";

const ORIENTATIONS: Record<Orientation, Term> = {
  vertical: { label: "Vertical", what: "Celular em pé (9:16).", why: "É o formato de Reels, TikTok e Shorts: ocupa a tela toda." },
  horizontal: { label: "Horizontal", what: "Celular deitado (16:9).", why: "É o formato do YouTube e da TV." },
};

const chip = "min-h-11 rounded-full border border-input bg-card px-3.5 text-sm font-semibold whitespace-nowrap";
const chipOn = "border-foreground bg-foreground text-background";
const field = "min-h-12 w-full rounded-xl border border-input bg-background px-3.5 text-base outline-none focus:border-foreground";

function Choice<K extends string>({
  title,
  terms,
  value,
  onChange,
}: {
  title: string;
  terms: Record<K, Term>;
  value: K;
  onChange: (v: K) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold">{title}</legend>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(terms) as K[]).map((k) => (
          <button key={k} type="button" aria-pressed={value === k} className={cn(chip, value === k && chipOn)} onClick={() => onChange(k)}>
            {terms[k].label}
          </button>
        ))}
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {terms[value].what} <strong className="font-semibold text-foreground">Por quê:</strong> {terms[value].why}
      </p>
    </fieldset>
  );
}

function ShotCard({
  shot,
  number,
  onChange,
  onDelete,
}: {
  shot: SavedShot;
  number: number;
  onChange: (patch: Partial<Shot>) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState({ description: shot.description, location: shot.location, wardrobe: shot.wardrobe });
  const saveText = (k: keyof typeof text) => {
    if (text[k] !== shot[k]) onChange({ [k]: text[k] });
  };

  return (
    <article className="flex flex-col gap-3 rounded-2xl bg-card p-4" aria-label={`Plano ${number}`}>
      <div className="flex gap-3.5">
        <div className="relative flex h-[72px] w-12 shrink-0 items-center justify-center font-mono text-[15px] font-semibold" aria-hidden="true">
          <span className="absolute left-0 top-0 size-2.5 border-l-2 border-t-2 border-foreground" />
          <span className="absolute right-0 top-0 size-2.5 border-r-2 border-t-2 border-foreground" />
          <span className="absolute bottom-0 left-0 size-2.5 border-b-2 border-l-2 border-foreground" />
          <span className="absolute bottom-0 right-0 size-2.5 border-b-2 border-r-2 border-foreground" />
          {String(number).padStart(2, "0")}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h3 className="text-[17px] font-bold leading-snug">{shot.description || FRAMINGS[shot.framing].label}</h3>
          <div className="flex flex-wrap gap-1.5">
            {[FRAMINGS[shot.framing].label, ANGLES[shot.angle].label, MOVEMENTS[shot.movement].label, ORIENTATIONS[shot.orientation].label].map((t) => (
              <span key={t} className="rounded-md bg-muted px-2 py-1 font-mono text-xs uppercase">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
      {shot.why && (
        <p className="text-sm leading-relaxed text-muted-foreground">
          <strong className="font-semibold text-foreground">Por quê:</strong> {shot.why}
        </p>
      )}
      {(shot.location || shot.wardrobe) && (
        <p className="label-set text-muted-foreground">{[shot.location, shot.wardrobe].filter(Boolean).join(" · ")}</p>
      )}

      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="min-h-11 self-start text-sm font-semibold underline">
        {open ? "Fechar" : "Mudar este plano"}
      </button>

      {open && (
        <div className="flex flex-col gap-5 border-t border-border pt-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">O que aparece</span>
            <input value={text.description} maxLength={300} onChange={(e) => setText((t) => ({ ...t, description: e.target.value }))} onBlur={() => saveText("description")} className={field} />
          </label>
          <Choice title="Enquadramento" terms={FRAMINGS} value={shot.framing} onChange={(v: Framing) => onChange({ framing: v })} />
          <Choice title="Ângulo" terms={ANGLES} value={shot.angle} onChange={(v: Angle) => onChange({ angle: v })} />
          <Choice title="Movimento" terms={MOVEMENTS} value={shot.movement} onChange={(v: Movement) => onChange({ movement: v })} />
          <Choice title="Celular" terms={ORIENTATIONS} value={shot.orientation} onChange={(v: Orientation) => onChange({ orientation: v })} />
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">Lugar</span>
              <input value={text.location} maxLength={80} placeholder="Ex.: Sala" onChange={(e) => setText((t) => ({ ...t, location: e.target.value }))} onBlur={() => saveText("location")} className={field} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">Roupa</span>
              <input value={text.wardrobe} maxLength={80} placeholder="Opcional" onChange={(e) => setText((t) => ({ ...t, wardrobe: e.target.value }))} onBlur={() => saveText("wardrobe")} className={field} />
            </label>
          </div>
          <button type="button" onClick={onDelete} className="flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-destructive">
            <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Apagar este plano
          </button>
        </div>
      )}
    </article>
  );
}

export default function PlanosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [video, setVideo] = useState<Video | null | undefined>(undefined);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [shots, setShots] = useState<SavedShot[]>([]);
  const [view, setView] = useState<View>("roteiro");
  const [busy, setBusy] = useState<"decupar" | "seguir" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const db = createClient();
    Promise.all([
      db.from("videos").select("*").eq("id", id).maybeSingle(),
      db.from("script_blocks").select("*").eq("video_id", id).order("position"),
      db.from("shots").select("*").eq("video_id", id).order("position"),
    ]).then(([v, b, s]) => {
      setVideo((v.data as Video | null) ?? null);
      setBlocks((b.data ?? []) as Block[]);
      setShots((s.data ?? []) as SavedShot[]);
    });
  }, [id]);

  async function decupar() {
    if (shots.length > 0 && !window.confirm("Decupar de novo substitui todos os planos, inclusive o que você mudou. Continuar?")) return;
    setBusy("decupar");
    setError(null);
    const res = await fetch("/api/planos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: id }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) setError(data?.error ?? "Sem conexão. Tente de novo.");
    else setShots(data.shots as SavedShot[]);
    setBusy(null);
  }

  async function update(shot: SavedShot, patch: Partial<Shot>) {
    setShots((list) => list.map((s) => (s.id === shot.id ? { ...s, ...patch } : s)));
    const { error } = await createClient().from("shots").update(patch).eq("id", shot.id);
    if (error) setError("Não deu para salvar a última mudança. Confira a conexão.");
  }

  async function remove(shot: SavedShot) {
    const { error } = await createClient().from("shots").delete().eq("id", shot.id);
    if (error) {
      setError("Não deu para apagar o plano.");
      return;
    }
    setShots((list) => list.filter((s) => s.id !== shot.id));
    logSignal("plano_apagado", { plano: `(${shotTerms(shot)})` }, id);
  }

  async function add(block: Block) {
    const last = [...shots].reverse().find((s) => s.block_id === block.id);
    const { data, error } = await createClient()
      .from("shots")
      .insert({
        video_id: id,
        block_id: block.id,
        position: Math.max(-1, ...shots.map((s) => s.position)) + 1,
        framing: "medio",
        angle: "altura_olhos",
        movement: "parado",
        orientation: defaultOrientation(video?.platform ?? null),
        location: last?.location ?? "",
        wardrobe: last?.wardrobe ?? "",
      })
      .select()
      .single();
    if (error) {
      setError("Não deu para adicionar o plano.");
      return;
    }
    setShots((list) => [...list, data as SavedShot]);
    logSignal("plano_adicionado", { plano: `no bloco ${block.label}` }, id);
  }

  async function finish() {
    setBusy("seguir");
    setError(null);
    const db = createClient();
    const { error } = await db.rpc("set_shoot_order", { p_video_id: id, p_shot_ids: shootingOrder(shots).map((s) => s.id) });
    if (!error && video && ["ideia", "roteiro", "pessoas", "planos"].includes(video.stage)) {
      await db.from("videos").update({ stage: "gravar" }).eq("id", id);
    }
    if (error) {
      setBusy(null);
      setError("Não deu para salvar a ordem de gravação. Tente de novo.");
      return;
    }
    router.push(`/video/${id}`);
  }

  const blockIndex = new Map(blocks.map((b, i) => [b.id, i]));
  const byScript = [...shots].sort((a, b) => (blockIndex.get(a.block_id)! - blockIndex.get(b.block_id)!) || a.position - b.position);
  const number = new Map(byScript.map((s, i) => [s.id, i + 1]));
  const toShoot = shootingOrder(byScript.map((s, i) => ({ ...s, position: i })));
  const before = setupChanges(byScript);
  const after = setupChanges(toShoot);

  return (
    <div className="flex min-h-dvh flex-col">
      <StepHeader step="planos" backHref={`/video/${id}`} />

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-5 pb-36 pt-5">
        {video === undefined && <p className="label-set text-muted-foreground">Carregando…</p>}
        {video === null && <p className="text-sm text-destructive">Não encontramos este vídeo.</p>}

        {video && blocks.length === 0 && (
          <p className="rounded-2xl bg-card p-4 text-sm leading-relaxed">
            Os planos nascem do roteiro.{" "}
            <Link href={`/video/${id}/roteiro`} className="font-semibold underline">
              Escrever o roteiro
            </Link>
          </p>
        )}

        {video && blocks.length > 0 && shots.length === 0 && (
          <div className="flex flex-col gap-4 rounded-2xl bg-card p-4">
            <span className="label-set flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-rec" aria-hidden="true" />
              Gravaí
            </span>
            <p className="leading-relaxed">
              <strong>Plano</strong> é cada pedaço que você grava sem cortar. <strong>Decupar</strong> é dividir o roteiro nos
              planos que você vai gravar: de perto ou de longe, de que ângulo, com a câmera parada ou andando.
            </p>
            <p className="leading-relaxed">
              Fazer isso antes evita descobrir na edição que faltou um take. Eu sugiro os planos de cada bloco e explico o porquê
              de cada um; você muda o que quiser.
            </p>
            <button type="button" onClick={decupar} disabled={busy !== null} className="min-h-13 rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-40">
              {busy === "decupar" ? "Decupando…" : "Decupar o roteiro"}
            </button>
          </div>
        )}

        {shots.length > 0 && (
          <>
            <div role="tablist" aria-label="Como ver os planos" className="grid grid-cols-2 gap-1 rounded-full bg-card p-1">
              {(
                [
                  ["roteiro", "Pelo roteiro"],
                  ["gravar", "Ordem de gravação"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  role="tab"
                  type="button"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={cn("min-h-11 rounded-full text-sm font-semibold", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
                >
                  {label}
                </button>
              ))}
            </div>

            {view === "roteiro" &&
              blocks.map((b, i) => (
                <section key={b.id} className="flex flex-col gap-3" aria-label={`Bloco ${i + 1}`}>
                  <div className="flex flex-col gap-1">
                    <h2 className="label-set">
                      Bloco {String(i + 1).padStart(2, "0")} · {b.label || BLOCK_KINDS[b.kind].label}
                    </h2>
                    {b.speech && <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">“{b.speech}”</p>}
                  </div>
                  {byScript
                    .filter((s) => s.block_id === b.id)
                    .map((s) => (
                      <ShotCard key={s.id} shot={s} number={number.get(s.id)!} onChange={(p) => update(s, p)} onDelete={() => remove(s)} />
                    ))}
                  <button type="button" onClick={() => add(b)} className="flex min-h-11 items-center gap-2 self-start text-sm font-semibold">
                    <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
                    Adicionar plano neste bloco
                  </button>
                </section>
              ))}

            {view === "gravar" && (
              <>
                <p className="rounded-2xl border border-border p-4 text-sm leading-relaxed">
                  Você não precisa gravar na ordem do roteiro. Juntando os planos do mesmo lugar e da mesma roupa, você troca de
                  cenário {after === 1 ? "1 vez" : `${after} vezes`} em vez de {before}. Na edição, cada plano volta para o lugar
                  dele.
                </p>
                {toShoot.map((s, i) => {
                  const prev = toShoot[i - 1];
                  const newGroup = !prev || prev.location.trim().toLowerCase() !== s.location.trim().toLowerCase() || prev.wardrobe.trim().toLowerCase() !== s.wardrobe.trim().toLowerCase();
                  const shot = shots.find((x) => x.id === s.id)!;
                  return (
                    <div key={s.id} className="flex flex-col gap-3">
                      {newGroup && <h2 className="label-set mt-2">{[s.location || "Lugar não definido", s.wardrobe].filter(Boolean).join(" · ")}</h2>}
                      <ShotCard shot={shot} number={number.get(s.id)!} onChange={(p) => update(shot, p)} onDelete={() => remove(shot)} />
                    </div>
                  );
                })}
              </>
            )}

            <button type="button" onClick={decupar} disabled={busy !== null} className="min-h-11 self-start text-sm font-semibold underline disabled:opacity-40">
              {busy === "decupar" ? "Decupando…" : "Decupar de novo"}
            </button>
          </>
        )}

        {error && (
          <p role="alert" className="rounded-2xl border border-destructive/40 bg-card p-4 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      {shots.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto flex max-w-lg flex-col gap-1.5 px-4 py-3">
            <button type="button" onClick={finish} disabled={busy !== null} className="min-h-13 rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-40">
              {busy === "seguir" ? "Salvando…" : "Planos prontos"}
            </button>
            <p className="label-set text-center text-muted-foreground">
              {shots.length} planos · grava na ordem que junta lugar e roupa
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
