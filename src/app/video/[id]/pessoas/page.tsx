"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Link2Off, MessageCircle, Trash2 } from "lucide-react";
import { StepHeader } from "@/components/gravai/step-header";
import { nextReadyStage } from "@/components/gravai/trail";
import { createClient } from "@/lib/supabase/client";
import { BLOCK_KINDS, type ScriptBlock } from "@/lib/roteiro";
import { ROLES, inviteMessage, shareUrl, whatsappLink, type PersonRole } from "@/lib/pessoas";
import { cn } from "@/lib/utils";
import type { Video } from "@/types/database";

interface Person {
  id: string;
  name: string;
  role: PersonRole;
  share_token: string;
  share_enabled: boolean;
  confirmed_at: string | null;
}
type Block = ScriptBlock & { id: string; position: number; person_id: string | null };

const chip = "min-h-11 rounded-full border border-input bg-card px-4 text-sm font-semibold whitespace-nowrap";
const chipOn = "border-foreground bg-foreground text-background";
const field = "min-h-12 w-full rounded-xl border border-input bg-card px-3.5 text-base outline-none focus:border-foreground";

export default function PessoasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [video, setVideo] = useState<Video | null | undefined>(undefined);
  const [people, setPeople] = useState<Person[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [consents, setConsents] = useState<string[]>([]); // person_id de quem autorizou
  const [when, setWhen] = useState({ date: "", place: "" });
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<Exclude<PersonRole, "eu">>("ator");
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const creatingEu = useRef(false);
  // Nome completo do criador: vai no termo de imagem. Sem ele, os links não saem.
  const [myName, setMyName] = useState("");
  const [nameSaved, setNameSaved] = useState(true);

  useEffect(() => {
    const db = createClient();
    Promise.all([
      db.from("videos").select("*").eq("id", id).maybeSingle(),
      db.from("video_people").select("id, name, role, share_token, share_enabled, confirmed_at").eq("video_id", id).order("created_at"),
      db.from("script_blocks").select("*").eq("video_id", id).order("position"),
      db.from("image_consents").select("person_id").eq("video_id", id),
      db.from("creator_profiles").select("display_name").maybeSingle(),
    ]).then(async ([v, p, b, c, profile]) => {
      const vid = (v.data as (Video & { shoot_date: string | null; shoot_place: string | null }) | null) ?? null;
      setVideo(vid);
      setBlocks((b.data ?? []) as Block[]);
      setConsents(((c.data ?? []) as { person_id: string | null }[]).map((x) => x.person_id ?? ""));
      setWhen({ date: vid?.shoot_date ?? "", place: vid?.shoot_place ?? "" });
      setMyName(profile.data?.display_name ?? "");
      setNameSaved(Boolean(profile.data?.display_name?.trim()));
      let list = (p.data ?? []) as Person[];
      // Todo vídeo começa com você na lista.
      if (vid && !list.some((x) => x.role === "eu") && !creatingEu.current) {
        creatingEu.current = true;
        const { data } = await db
          .from("video_people")
          .insert({ video_id: id, name: profile.data?.display_name?.trim() || "Eu", role: "eu" })
          .select("id, name, role, share_token, share_enabled, confirmed_at")
          .single();
        if (data) list = [data as Person, ...list];
      }
      setPeople(list);
    });
  }, [id]);

  async function saveMyName(e: React.FormEvent) {
    e.preventDefault();
    const name = myName.trim();
    if (name.split(/\s+/).length < 2) {
      setError("Coloque nome e sobrenome: é o nome que vai no termo de imagem.");
      return;
    }
    setError(null);
    const db = createClient();
    const { error } = await db.from("creator_profiles").upsert({ display_name: name.slice(0, 80) }, { onConflict: "user_id" });
    if (error) {
      setError("Não deu para salvar seu nome.");
      return;
    }
    const eu = people.find((p) => p.role === "eu");
    if (eu && eu.name === "Eu") {
      await db.from("video_people").update({ name: name.slice(0, 80) }).eq("id", eu.id);
      setPeople((l) => l.map((p) => (p.id === eu.id ? { ...p, name: name.slice(0, 80) } : p)));
    }
    setNameSaved(true);
  }

  async function saveWhen(patch: { shoot_date?: string | null; shoot_place?: string | null }) {
    const { error } = await createClient().from("videos").update(patch).eq("id", id);
    if (error) setError("Não deu para salvar a data e o lugar.");
  }

  async function addPerson(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setError(null);
    const { data, error } = await createClient()
      .from("video_people")
      .insert({ video_id: id, name: newName.trim().slice(0, 80), role: newRole })
      .select("id, name, role, share_token, share_enabled, confirmed_at")
      .single();
    if (error) setError("Não deu para adicionar a pessoa.");
    else {
      setPeople((l) => [...l, data as Person]);
      setNewName("");
    }
  }

  async function toggleLink(person: Person) {
    const { error } = await createClient().from("video_people").update({ share_enabled: !person.share_enabled }).eq("id", person.id);
    if (error) setError("Não deu para mudar o link.");
    else setPeople((l) => l.map((x) => (x.id === person.id ? { ...x, share_enabled: !x.share_enabled } : x)));
  }

  async function removePerson(person: Person) {
    if (!window.confirm(`Tirar ${person.name} do vídeo? O link dela para de funcionar.`)) return;
    const { error } = await createClient().from("video_people").delete().eq("id", person.id);
    if (error) setError("Não deu para tirar a pessoa.");
    else {
      setPeople((l) => l.filter((x) => x.id !== person.id));
      setBlocks((l) => l.map((b) => (b.person_id === person.id ? { ...b, person_id: null } : b)));
    }
  }

  async function assign(block: Block, personId: string | null) {
    setBlocks((l) => l.map((b) => (b.id === block.id ? { ...b, person_id: personId } : b)));
    const { error } = await createClient().from("script_blocks").update({ person_id: personId }).eq("id", block.id);
    if (error) setError("Não deu para salvar quem aparece nesta parte.");
  }

  async function copy(person: Person) {
    await navigator.clipboard.writeText(shareUrl(window.location.origin, person.share_token)).catch(() => null);
    setCopied(person.id);
    setTimeout(() => setCopied(null), 2000);
  }

  async function finish() {
    if (video?.stage === "pessoas") {
      await createClient().from("videos").update({ stage: nextReadyStage("pessoas") }).eq("id", id);
    }
    router.push(`/video/${id}`);
  }

  const onCamera = people.filter((p) => p.role === "eu" || p.role === "ator");
  const title = video?.title ?? "o vídeo";

  return (
    <div className="flex min-h-dvh flex-col">
      <StepHeader step="pessoas" backHref={`/video/${id}`} />

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-5 pb-36 pt-5">
        {video === undefined && <p className="label-set text-muted-foreground">Carregando…</p>}
        {video === null && <p className="text-sm text-destructive">Não encontramos este vídeo.</p>}

        {video && (
          <>
            <p className="leading-relaxed text-muted-foreground">
              Quem aparece e quem ajuda. Cada pessoa recebe um link só com a parte dela, sem precisar criar conta: quem aparece
              treina as falas, quem filma vê os planos.
            </p>

            {!nameSaved && (
              <form onSubmit={saveMyName} className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-foreground p-4">
                <label htmlFor="meu-nome" className="font-bold">
                  Seu nome completo
                </label>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Ele vai no termo de uso de imagem que as pessoas autorizam pelo link. Sem ele, os links não saem.
                </p>
                <input id="meu-nome" value={myName} maxLength={80} autoComplete="name" onChange={(e) => setMyName(e.target.value)} className={field} />
                <button type="submit" disabled={!myName.trim()} className="min-h-12 rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-40">
                  Salvar meu nome
                </button>
              </form>
            )}

            <section aria-labelledby="quando" className="flex flex-col gap-3">
              <h2 id="quando" className="label-set">
                Quando e onde
              </h2>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold">Dia</span>
                  <input
                    type="date"
                    value={when.date}
                    onChange={(e) => {
                      setWhen((w) => ({ ...w, date: e.target.value }));
                      saveWhen({ shoot_date: e.target.value || null });
                    }}
                    className={field}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold">Lugar</span>
                  <input
                    value={when.place}
                    maxLength={120}
                    placeholder="Ex.: minha casa, 15h"
                    onChange={(e) => setWhen((w) => ({ ...w, place: e.target.value }))}
                    onBlur={() => saveWhen({ shoot_place: when.place.trim() || null })}
                    className={field}
                  />
                </label>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">Aparece no link de cada pessoa. Combine o endereço pelo WhatsApp se não quiser deixar aqui.</p>
            </section>

            <section aria-labelledby="time" className="flex flex-col gap-3">
              <h2 id="time" className="label-set">
                Quem está no vídeo
              </h2>
              {people.map((p) => (
                <article key={p.id} className="flex flex-col gap-3 rounded-2xl bg-card p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-lg font-bold">{p.role === "eu" ? `${p.name} (você)` : p.name}</h3>
                    <span className="label-set shrink-0 text-muted-foreground">{ROLES[p.role].label}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{ROLES[p.role].sees}</p>

                  {p.role !== "eu" && (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        <span className={cn("rounded-md px-2 py-1 font-mono text-xs uppercase", p.confirmed_at ? "bg-foreground text-background" : "bg-muted")}>
                          {p.confirmed_at ? "Confirmou" : "Não confirmou ainda"}
                        </span>
                        {p.role === "ator" && (
                          <span className={cn("rounded-md px-2 py-1 font-mono text-xs uppercase", consents.includes(p.id) ? "bg-foreground text-background" : "bg-muted")}>
                            {consents.includes(p.id) ? "Autorizou a imagem" : "Falta autorizar a imagem"}
                          </span>
                        )}
                        {!p.share_enabled && <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs uppercase text-destructive">Link desligado</span>}
                      </div>
                      {p.share_enabled && !nameSaved && <p className="text-sm text-muted-foreground">Salve seu nome completo lá em cima para liberar o link.</p>}
                      {p.share_enabled && nameSaved && (
                        <div className="flex gap-2">
                          <a
                            href={whatsappLink(inviteMessage(p.name, p.role, title, shareUrl(typeof window === "undefined" ? "" : window.location.origin, p.share_token)))}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary font-bold text-primary-foreground"
                          >
                            <MessageCircle className="size-5" strokeWidth={1.75} aria-hidden="true" />
                            Mandar no WhatsApp
                          </a>
                          <button type="button" onClick={() => copy(p)} aria-label={`Copiar o link de ${p.name}`} className="flex min-h-12 items-center gap-2 rounded-full border-[1.5px] border-foreground px-4 font-semibold">
                            {copied === p.id ? <Check className="size-5" strokeWidth={2} aria-hidden="true" /> : <Copy className="size-5" strokeWidth={1.75} aria-hidden="true" />}
                            {copied === p.id ? "Copiado" : "Link"}
                          </button>
                        </div>
                      )}
                      <div className="flex gap-4">
                        <button type="button" onClick={() => toggleLink(p)} className="flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                          <Link2Off className="size-4" strokeWidth={1.75} aria-hidden="true" />
                          {p.share_enabled ? "Desligar link" : "Religar link"}
                        </button>
                        <button type="button" onClick={() => removePerson(p)} className="flex min-h-11 items-center gap-1.5 text-sm font-semibold text-destructive">
                          <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
                          Tirar do vídeo
                        </button>
                      </div>
                    </>
                  )}
                </article>
              ))}

              <form onSubmit={addPerson} className="flex flex-col gap-3 rounded-2xl border border-border p-4">
                <span className="font-bold">Chamar alguém</span>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold">Nome</span>
                  <input value={newName} maxLength={80} onChange={(e) => setNewName(e.target.value)} placeholder="Como você chama a pessoa" className={field} />
                </label>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Função">
                  {(["ator", "filma", "equipe"] as const).map((r) => (
                    <button key={r} type="button" aria-pressed={newRole === r} onClick={() => setNewRole(r)} className={cn(chip, newRole === r && chipOn)}>
                      {ROLES[r].label}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">{ROLES[newRole].sees}</p>
                <button type="submit" disabled={!newName.trim()} className="min-h-12 rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-40">
                  Adicionar
                </button>
              </form>
            </section>

            {blocks.length > 0 && onCamera.length > 0 && (
              <section aria-labelledby="partes" className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <h2 id="partes" className="label-set">
                    Quem aparece em cada parte
                  </h2>
                  <p className="text-sm leading-relaxed text-muted-foreground">Quem aparece no vídeo recebe só as partes marcadas com o nome dela.</p>
                </div>
                {blocks.map((b, i) => (
                  <div key={b.id} className="flex flex-col gap-2.5 rounded-2xl bg-card p-4">
                    <span className="label-set text-muted-foreground">
                      Parte {String(i + 1).padStart(2, "0")} · {b.label || BLOCK_KINDS[b.kind].label}
                    </span>
                    {b.speech && <p className="line-clamp-2 text-sm leading-relaxed">“{b.speech}”</p>}
                    <div className="flex flex-wrap gap-2">
                      {onCamera.map((p) => (
                        <button key={p.id} type="button" aria-pressed={b.person_id === p.id} onClick={() => assign(b, b.person_id === p.id ? null : p.id)} className={cn(chip, b.person_id === p.id && chipOn)}>
                          {p.role === "eu" ? "Eu" : p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}

            <p className="rounded-2xl border border-border p-4 text-sm leading-relaxed">
              <strong>Direito de imagem:</strong> quem aparece no vídeo precisa autorizar o uso da imagem. O link já pede essa
              autorização, e ela fica guardada aqui. Para menores de 18 anos, a autorização é do responsável: combine direto com
              ele.
            </p>

            {error && (
              <p role="alert" className="rounded-2xl border border-destructive/40 bg-card p-4 text-sm text-destructive">
                {error}
              </p>
            )}
          </>
        )}
      </div>

      {video && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto max-w-lg px-4 py-3">
            <button type="button" onClick={finish} className="min-h-13 w-full rounded-full bg-primary font-bold text-primary-foreground">
              Pessoas prontas
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
