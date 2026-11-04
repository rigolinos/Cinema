"use client";

import { use, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useConfirm } from "@/components/gravai/confirm";
import { Check, MapPin, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { PlansOutdated } from "@/components/gravai/aviso-planos";
import { StepHeader } from "@/components/gravai/step-header";
import { useLeave } from "@/components/gravai/voltar";
import { Explain } from "@/components/gravai/explain";
import { FramingIcon } from "@/components/gravai/framing-icon";
import { Thinking } from "@/components/gravai/thinking";
import { logSignal } from "@/lib/sinais";
import { createClient } from "@/lib/supabase/client";
import {
  ANGLES,
  FRAMINGS,
  MOVEMENTS,
  castOf,
  defaultOrientation,
  isSolo,
  setupChanges,
  setupLabel,
  shootingOrder,
  shotPeople,
  shotTags,
  shotTerms,
  type Angle,
  type Framing,
  type Movement,
  type Shot,
  type Term,
} from "@/lib/planos";
import { type ScriptBlock } from "@/lib/roteiro";
import { cn } from "@/lib/utils";
import type { Video } from "@/types/database";

type Block = ScriptBlock & { id: string; position: number; updated_at?: string };
type SavedShot = Shot & { id: string; created_at?: string };
type Person = { id: string; name: string; role: string; roles: string[] | null };

// Nomes curtos para caber na régua; os outros usam o nome inteiro de FRAMINGS, ANGLES e MOVEMENTS.
const SHORT: Partial<Record<Framing | Angle | Movement, string>> = {
  medio: "Médio",
  americano: "Americano",
  altura_olhos: "Olhos",
  por_cima_ombro: "Ombro",
  aproximando: "Aproxima",
  afastando: "Afasta",
  acompanhando: "Acompanha",
};
const short = (k: Framing | Angle | Movement, term: Term) => SHORT[k] ?? term.label;

// Campo sublinhado: o rótulo em cima e só uma linha embaixo do texto.
const underlined = "w-full border-b border-input bg-transparent outline-none focus:border-foreground";

// Todas as opções à vista e um toque para trocar: a barra preta marca a escolhida.
// O peso da letra não muda, para a régua não pular de largura ao escolher.
function Ruler<K extends Framing | Angle | Movement>({
  title,
  terms,
  value,
  onChange,
  hint = false,
}: {
  title: string;
  terms: Record<K, Term>;
  value: K;
  onChange: (v: K) => void;
  hint?: boolean; // explica o que acabou de ser escolhido
}) {
  return (
    <fieldset className="-mb-2">
      <legend className="label-set mb-2 text-muted-foreground">{title}</legend>
      <div className="flex flex-wrap gap-x-[3px] gap-y-1">
        {(Object.keys(terms) as K[]).map((k) => {
          const on = value === k;
          return (
            <button key={k} type="button" aria-pressed={on} onClick={() => onChange(k)} className="flex min-h-11 flex-auto flex-col gap-1.5 text-center text-[11px] font-medium leading-tight">
              <span className={cn("h-[5px] rounded-full", on ? "bg-foreground" : "bg-input")} aria-hidden="true" />
              <span className={on ? "text-foreground" : "text-muted-foreground"}>{short(k, terms[k])}</span>
            </button>
          );
        })}
      </div>
      {hint && <p className="-mt-3 text-sm leading-relaxed text-muted-foreground">{terms[value].what}</p>}
    </fieldset>
  );
}

// Quem está no plano: um toque marca ou tira, e já salva.
function CastPicker({ cast, value, onChange }: { cast: { id: string; label: string }[]; value: string[]; onChange: (ids: string[]) => void }) {
  return (
    <fieldset className="-mb-2">
      <legend className="label-set mb-1 text-muted-foreground">Quem está no plano</legend>
      <div className="flex flex-wrap gap-x-5">
        {cast.map((c) => {
          const on = value.includes(c.id);
          return (
            <button key={c.id} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((id) => id !== c.id) : [...value, c.id])} className="flex min-h-11 min-w-0 items-center gap-2 text-left text-[15px]">
              <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full", on ? "bg-foreground text-background" : "border-[1.5px] border-input")} aria-hidden="true">
                {on && <Check className="size-3" strokeWidth={3} />}
              </span>
              <span className={cn("min-w-0 break-words", on ? "font-semibold" : "text-muted-foreground")}>{c.label}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function ShotCard({
  shot,
  number,
  setup,
  people,
  onChange,
  onDelete,
}: {
  shot: SavedShot;
  number: number;
  setup: string; // lugar e roupa, só quando mudam em relação ao plano anterior
  people: Person[];
  onChange: (patch: Partial<Shot>) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState<"angle" | "movement" | null>(null);
  const [text, setText] = useState({ description: shot.description, location: shot.location, wardrobe: shot.wardrobe });
  const saveText = (k: keyof typeof text) => {
    if (text[k] !== shot[k]) onChange({ [k]: text[k] });
  };
  const changeRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // O botão tocado some ao trocar de vista: o foco passa para o seu par, o que também traz a tela de volta ao plano ao fechar.
  const toggle = (next: boolean) => {
    flushSync(() => setOpen(next));
    (next ? closeRef : changeRef).current?.focus();
  };
  const planNumber = String(number).padStart(2, "0");
  const cast = castOf(people);
  const names = shotPeople(shot, people);
  const selected = (shot.person_ids ?? []).filter((id) => cast.some((c) => c.id === id));

  if (open) {
    return (
      <article className="flex flex-col overflow-hidden rounded-2xl bg-card" aria-label={`Plano ${number}`}>
        {/* O visor: o desenho e a explicação acompanham o enquadramento escolhido. */}
        <div className="dark bg-background px-4 pb-3.5 pt-1 text-foreground">
          <div className="flex items-center justify-between gap-3">
            <h3 className="label-set truncate text-muted-foreground">{`Plano ${planNumber} · ${short(shot.framing, FRAMINGS[shot.framing])}`}</h3>
            <button ref={closeRef} type="button" aria-expanded onClick={() => toggle(false)} className="label-set -mr-2 flex min-h-11 shrink-0 items-center gap-1.5 px-2 text-muted-foreground">
              <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Fechar
            </button>
          </div>
          <div className="relative flex h-[150px] items-center justify-center border border-border">
            <FramingIcon framing={shot.framing} orientation={shot.orientation} size="xl" />
            <span className="absolute left-1.5 top-1.5 size-3.5 border-l-[1.5px] border-t-[1.5px] border-foreground" aria-hidden="true" />
            <span className="absolute right-1.5 top-1.5 size-3.5 border-r-[1.5px] border-t-[1.5px] border-foreground" aria-hidden="true" />
            <span className="absolute bottom-1.5 left-1.5 size-3.5 border-b-[1.5px] border-l-[1.5px] border-foreground" aria-hidden="true" />
            <span className="absolute bottom-1.5 right-1.5 size-3.5 border-b-[1.5px] border-r-[1.5px] border-foreground" aria-hidden="true" />
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{FRAMINGS[shot.framing].what}</p>
        </div>

        <div className="flex flex-col gap-5 p-4">
          <label className="flex flex-col gap-1.5">
            <span className="label-set text-muted-foreground">O que aparece</span>
            <textarea rows={3} value={text.description} maxLength={300} onChange={(e) => setText((t) => ({ ...t, description: e.target.value }))} onBlur={() => saveText("description")} className={cn(underlined, "resize-none pb-2 text-[17px] font-semibold leading-snug field-sizing-content")} />
          </label>
          <Ruler title="Enquadramento" terms={FRAMINGS} value={shot.framing} onChange={(v) => onChange({ framing: v })} />
          <Ruler title="Ângulo" terms={ANGLES} value={shot.angle} hint={touched === "angle"} onChange={(v) => { setTouched("angle"); onChange({ angle: v }); }} />
          <Ruler title="Movimento" terms={MOVEMENTS} value={shot.movement} hint={touched === "movement"} onChange={(v) => { setTouched("movement"); onChange({ movement: v }); }} />
          {cast.length > 1 && <CastPicker cast={cast} value={selected} onChange={(ids) => onChange({ person_ids: ids })} />}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex min-w-0 flex-col gap-1">
              <span className="label-set text-muted-foreground">Lugar</span>
              <input value={text.location} maxLength={80} placeholder="Ex.: Sala" onChange={(e) => setText((t) => ({ ...t, location: e.target.value }))} onBlur={() => saveText("location")} className={cn(underlined, "min-h-11 text-base")} />
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="label-set text-muted-foreground">Roupa</span>
              <input value={text.wardrobe} maxLength={80} placeholder="Opcional" onChange={(e) => setText((t) => ({ ...t, wardrobe: e.target.value }))} onBlur={() => saveText("wardrobe")} className={cn(underlined, "min-h-11 text-base")} />
            </label>
          </div>
          <div className="-mb-1.5 flex items-start justify-between gap-3">
            {shot.why ? (
              <Explain id="plano-porque" question="Por que este plano?" closed className="min-w-0 flex-1 pt-1">
                {shot.why}
              </Explain>
            ) : (
              <span />
            )}
            <button type="button" onClick={onDelete} className="-mr-2 flex min-h-11 shrink-0 items-center gap-1.5 px-2 text-sm font-semibold text-destructive">
              <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Apagar
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="flex flex-col gap-3 rounded-2xl bg-card p-4" aria-label={`Plano ${number}`}>
      {/* Preto só na descrição, que é o que a pessoa vai filmar; o resto em cinza. */}
      <div className="flex items-start gap-3.5">
        <FramingIcon framing={shot.framing} orientation={shot.orientation} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="label-set text-muted-foreground">
            {[planNumber, ...shotTags(shot)].join(" · ")}
          </p>
          <h3 className="text-[17px] font-semibold leading-snug">{shot.description || FRAMINGS[shot.framing].label}</h3>
          {setup && (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              {setup}
            </p>
          )}
          {names.length > 0 && (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              {names.join(" · ")}
            </p>
          )}
        </div>
      </div>

      <div className="-mb-1.5 flex items-start justify-between gap-3 border-t border-border pt-1">
        {shot.why ? (
          <Explain id="plano-porque" question="Por quê?" closed className="min-w-0 flex-1 pt-1">
            {shot.why}
          </Explain>
        ) : (
          <span />
        )}
        <button ref={changeRef} type="button" aria-expanded={false} onClick={() => toggle(true)} className="-mr-2 flex min-h-11 shrink-0 scroll-mb-28 items-center gap-1.5 px-2 text-sm text-muted-foreground">
          <Pencil className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Mudar
        </button>
      </div>
    </article>
  );
}

export default function PlanosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const leave = useLeave();
  const [video, setVideo] = useState<Video | null | undefined>(undefined);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [shots, setShots] = useState<SavedShot[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [busy, setBusy] = useState<"decupar" | "seguir" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { confirm, sheet } = useConfirm();

  useEffect(() => {
    const db = createClient();
    Promise.all([
      db.from("videos").select("*").eq("id", id).maybeSingle(),
      db.from("script_blocks").select("*").eq("video_id", id).order("position"),
      db.from("shots").select("*").eq("video_id", id).order("position"),
      db.from("video_people").select("id, name, role, roles").eq("video_id", id).order("created_at"),
    ]).then(([v, b, s, p]) => {
      setVideo((v.data as Video | null) ?? null);
      setBlocks((b.data ?? []) as Block[]);
      setShots((s.data ?? []) as SavedShot[]);
      setPeople((p.data ?? []) as Person[]);
    });
  }, [id]);

  async function decupar() {
    if (shots.length > 0 && !(await confirm({ title: "Dividir em planos de novo?", text: "Isso troca todos os planos, inclusive o que você mudou.", action: "Dividir de novo" }))) return;
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
    if (!(await confirm({ title: "Apagar este plano?", text: "Não dá para desfazer.", action: "Apagar plano", danger: true }))) return;
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
        person_ids: last?.person_ids ?? [],
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
    leave(`/video/${id}`);
  }

  const blockIndex = new Map(blocks.map((b, i) => [b.id, i]));
  const byScript = [...shots].sort((a, b) => (blockIndex.get(a.block_id)! - blockIndex.get(b.block_id)!) || a.position - b.position);
  const number = new Map(byScript.map((s, i) => [s.id, i + 1]));
  const toShoot = shootingOrder(byScript.map((s, i) => ({ ...s, position: i })));
  const before = setupChanges(byScript);
  const after = setupChanges(toShoot);

  return (
    <div className="flex min-h-dvh flex-col">
      {sheet}
      <StepHeader step="planos" backHref={`/video/${id}/${video && isSolo(video.resources ?? []) ? "roteiro" : "pessoas"}`} videoId={id} />

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-5 pb-36 pt-5">
        {video === undefined && <p className="label-set text-muted-foreground">Carregando…</p>}
        {video === null && <p className="text-sm text-destructive">Não encontramos este vídeo.</p>}

        {video && <PlansOutdated videoId={id} blocks={blocks} shots={shots} onUpdated={setShots} />}

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
            <p className="leading-relaxed">Vou dividir seu roteiro nos pedaços que você vai gravar. Depois você muda o que quiser.</p>
            <Explain id="plano" question="O que é um plano?" learn="plano" className="-mt-2">
              Cada pedaço que você grava sem cortar: de perto ou de longe, de que ângulo, com a câmera parada ou andando. Fazer
              isso antes evita descobrir na edição que faltou um take.
            </Explain>
            <button type="button" onClick={decupar} disabled={busy !== null} className="min-h-13 rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-40">
              {busy === "decupar" ? <Thinking label="Dividindo em planos" /> : "Dividir em planos"}
            </button>
          </div>
        )}

        {shots.length > 0 && (
          <>
            {after < before && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                Na hora de gravar, eu junto os planos do mesmo lugar: você troca de cenário {after === 1 ? "1 vez" : `${after} vezes`} em vez de {before}.
              </p>
            )}

            {blocks.map((b, i) => (
                <section key={b.id} className="flex flex-col gap-3" aria-label={`Cena ${i + 1}`}>
                  <div className="flex flex-col gap-1">
                    <h2 className="label-set">
                      Cena {i + 1}
                    </h2>
                    {b.speech && <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">“{b.speech}”</p>}
                  </div>
                  {byScript
                    .filter((s) => s.block_id === b.id)
                    .map((s) => (
                      <ShotCard key={s.id} shot={s} number={number.get(s.id)!} setup={setupLabel(byScript, number.get(s.id)! - 1)} people={people} onChange={(p) => update(s, p)} onDelete={() => remove(s)} />
                    ))}
                  <button type="button" onClick={() => add(b)} className="flex min-h-11 items-center gap-2 self-start text-sm font-semibold">
                    <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
                    Adicionar plano nesta cena
                  </button>
                </section>
              ))}

            <button type="button" onClick={decupar} disabled={busy !== null} className="min-h-11 self-start text-sm font-semibold underline disabled:opacity-40">
              {busy === "decupar" ? <Thinking label="Dividindo" /> : "Dividir de novo"}
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
              {shots.length} planos
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
