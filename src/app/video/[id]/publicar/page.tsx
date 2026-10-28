"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useConfirm } from "@/components/gravai/confirm";
import { ReportAi } from "@/components/gravai/denunciar";
import { Check, ChevronLeft, Copy } from "lucide-react";
import { useFirstTime } from "@/components/gravai/explain";
import { SlateTabs } from "@/components/gravai/slate-tabs";
import { STEPS, Thinking } from "@/components/gravai/thinking";
import { createClient } from "@/lib/supabase/client";
import { PLATFORMS, platformsLabel, videoPlatforms, type Platform } from "@/lib/ideas";
import { POST_PARTS, captionWithTags, cleanHashtags, needsTitle, type PlatformPost, type Post } from "@/lib/publicar";
import { cn } from "@/lib/utils";
import type { Video } from "@/types/database";

type VideoRow = Video & { published_at: string | null };

const field = "w-full rounded-xl border border-input bg-card px-3.5 py-3 text-base leading-relaxed outline-none focus:border-foreground";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      disabled={!text.trim()}
      aria-label={`Copiar ${label}`}
      onClick={async () => {
        await navigator.clipboard.writeText(text).catch(() => null);
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
      className="flex min-h-11 items-center gap-1.5 text-sm font-semibold disabled:opacity-40"
    >
      {done ? <Check className="size-4" strokeWidth={2.5} aria-hidden="true" /> : <Copy className="size-4" strokeWidth={1.75} aria-hidden="true" />}
      {done ? "Copiado" : "Copiar"}
    </button>
  );
}

export default function PublicarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [video, setVideo] = useState<VideoRow | null | undefined>(undefined);
  const [posts, setPosts] = useState<PlatformPost[]>([]);
  const [active, setActive] = useState<Platform | null>(null);
  const [tagsText, setTagsText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, sheet } = useConfirm();
  const [copiedAll, setCopiedAll] = useState(false);
  // As dicas de cada campo aparecem só na primeira publicação.
  const tips = useFirstTime("publicar");

  useEffect(() => {
    const db = createClient();
    Promise.all([db.from("videos").select("*").eq("id", id).maybeSingle(), db.from("video_posts").select("*").eq("video_id", id)]).then(([v, p]) => {
      const row = (v.data as VideoRow | null) ?? null;
      setVideo(row);
      show(sortByVideo((p.data ?? []) as PlatformPost[], row));
    });
  }, [id]);

  // Na ordem em que a pessoa marcou as plataformas.
  function sortByVideo(list: PlatformPost[], v: VideoRow | null): PlatformPost[] {
    const order = v ? videoPlatforms(v) : [];
    return [...list].sort((a, b) => order.indexOf(a.platform) - order.indexOf(b.platform));
  }

  function show(list: PlatformPost[], platform?: Platform) {
    setPosts(list);
    const current = list.find((p) => p.platform === platform) ?? list[0];
    setActive(current?.platform ?? null);
    setTagsText(current?.hashtags.join(" ") ?? "");
  }

  async function prepare() {
    if (posts.length > 0 && !(await confirm({ title: "Preparar a publicação de novo?", text: "Isso substitui a legenda, o título, as hashtags e a capa, inclusive o que você mudou.", action: "Preparar de novo" }))) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/publicar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ videoId: id }) }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) setError(data?.error ?? "Sem conexão. Tente de novo.");
    else show(sortByVideo(data.posts as PlatformPost[], video ?? null), active ?? undefined);
    setBusy(false);
  }

  // Legenda, título e hashtags são de cada plataforma; a capa é uma só para todas.
  async function save(patch: Partial<Post>) {
    if (!post) return;
    const shared = "cover_text" in patch || "cover_idea" in patch;
    setPosts((list) => list.map((p) => (shared || p.platform === post.platform ? { ...p, ...patch } : p)));
    let query = createClient().from("video_posts").update(patch).eq("video_id", id);
    if (!shared) query = query.eq("platform", post.platform);
    const { error } = await query;
    if (error) setError("Não deu para salvar a última mudança.");
  }

  async function togglePublished() {
    if (!video) return;
    const published_at = video.published_at ? null : new Date().toISOString();
    const { error } = await createClient().from("videos").update({ published_at }).eq("id", id);
    if (error) setError("Não deu para marcar como publicado.");
    else setVideo({ ...video, published_at });
  }

  const post = posts.find((p) => p.platform === active) ?? null;
  const withTitle = needsTitle(post?.platform ?? video?.platform ?? null);
  const wanted = video ? videoPlatforms(video) : [];
  const missing = wanted.filter((p) => posts.length > 0 && !posts.some((x) => x.platform === p));

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-5 pb-16 pt-3">
      {sheet}
      <Link href={`/video/${id}`} aria-label="Voltar ao vídeo" className="-ml-3 flex size-11 items-center justify-center">
        <ChevronLeft className="size-6" strokeWidth={1.75} aria-hidden="true" />
      </Link>

      {video === undefined && <p className="label-set text-muted-foreground">Carregando…</p>}
      {video === null && <p className="text-sm text-destructive">Não encontramos este vídeo.</p>}

      {video && (
        <>
          <header className="flex flex-col gap-2">
            <p className="label-set text-muted-foreground">Publicar{wanted.length ? ` · ${platformsLabel(wanted)}` : ""}</p>
            <h1 className="font-display text-[28px]">{video.title}</h1>
          </header>

          {posts.length === 0 && (
            <div className="flex flex-col gap-4 rounded-2xl bg-card p-4">
              <span className="label-set flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-rec" aria-hidden="true" />
                Gravaí
              </span>
              <p className="leading-relaxed">
                Eu preparo a legenda, as hashtags{withTitle ? ", o título" : ""} e a capa a partir do seu roteiro. Você ajusta e copia.
              </p>
              <button type="button" onClick={prepare} disabled={busy} className="min-h-13 rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-40">
                {busy ? <Thinking label="Preparando" steps={STEPS.publicar} /> : "Preparar a publicação"}
              </button>
            </div>
          )}

          {missing.length > 0 && (
            <p className="rounded-2xl border border-border p-4 text-sm leading-relaxed">
              Ainda não preparei o texto para {platformsLabel(missing)}. Toque em <strong>Preparar de novo</strong>, lá embaixo.
            </p>
          )}

          {posts.length > 1 && (
            <SlateTabs
              label="Texto para"
              items={posts.map((p) => ({ id: p.platform, label: PLATFORMS[p.platform] }))}
              value={active ?? posts[0].platform}
              onChange={(platform) => {
                setActive(platform);
                setTagsText(posts.find((p) => p.platform === platform)?.hashtags.join(" ") ?? "");
              }}
            />
          )}

          {post && (
            <div key={post.platform} className="flex flex-col gap-6">
              {withTitle && (
                <section className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="titulo" className="label-set">
                      {POST_PARTS.title.label}
                    </label>
                    <CopyButton text={post.title} label="o título" />
                  </div>
                  <input id="titulo" defaultValue={post.title} maxLength={100} onBlur={(e) => e.target.value !== post.title && save({ title: e.target.value })} className={cn(field, "min-h-12 font-semibold")} />
                  {tips && <p className="text-sm text-muted-foreground">{POST_PARTS.title.why}</p>}
                </section>
              )}

              <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="legenda" className="label-set">
                    {POST_PARTS.caption.label}
                  </label>
                  <CopyButton text={post.caption} label="a legenda" />
                </div>
                <textarea
                  id="legenda"
                  defaultValue={post.caption}
                  maxLength={2200}
                  rows={6}
                  onBlur={(e) => e.target.value !== post.caption && save({ caption: e.target.value })}
                  className={cn(field, "resize-none")}
                />
                {tips && <p className="text-sm text-muted-foreground">{POST_PARTS.caption.why}</p>}
                <ReportAi area="publicar" content={post.caption} refId={id} label="Denunciar este texto" className="-mt-1" />
              </section>

              <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="hashtags" className="label-set">
                    {POST_PARTS.hashtags.label}
                  </label>
                  <CopyButton text={post.hashtags.join(" ")} label="as hashtags" />
                </div>
                <input
                  id="hashtags"
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  onBlur={() => {
                    const tags = cleanHashtags(tagsText.split(/[\s,]+/), 8);
                    setTagsText(tags.join(" "));
                    if (tags.join(" ") !== post.hashtags.join(" ")) save({ hashtags: tags });
                  }}
                  className={cn(field, "min-h-12 font-mono text-sm")}
                />
                {tips && <p className="text-sm text-muted-foreground">{POST_PARTS.hashtags.why}</p>}
              </section>

              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(captionWithTags(post)).catch(() => null);
                  setCopiedAll(true);
                  setTimeout(() => setCopiedAll(false), 2000);
                }}
                className="flex min-h-13 items-center justify-center gap-2 rounded-full border-[1.5px] border-foreground font-bold"
              >
                {copiedAll ? <Check className="size-5" strokeWidth={2.5} aria-hidden="true" /> : <Copy className="size-5" strokeWidth={1.75} aria-hidden="true" />}
                {copiedAll ? "Copiado" : posts.length > 1 ? `Copiar legenda do ${PLATFORMS[post.platform]}` : "Copiar legenda com hashtags"}
              </button>

              <section className="flex flex-col gap-3 rounded-2xl bg-card p-4">
                <span className="label-set">{POST_PARTS.cover.label}</span>
                {tips && <p className="text-sm text-muted-foreground">{POST_PARTS.cover.why}</p>}
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold">Texto da capa</span>
                  <input defaultValue={post.cover_text} maxLength={60} onBlur={(e) => e.target.value !== post.cover_text && save({ cover_text: e.target.value })} className={cn(field, "min-h-12 font-display text-xl")} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold">Qual imagem usar</span>
                  <textarea defaultValue={post.cover_idea} maxLength={300} rows={2} onBlur={(e) => e.target.value !== post.cover_idea && save({ cover_idea: e.target.value })} className={cn(field, "resize-none text-sm")} />
                </label>
              </section>

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={togglePublished}
                  className={cn("min-h-13 rounded-full font-bold", video.published_at ? "border-[1.5px] border-foreground" : "bg-primary text-primary-foreground")}
                >
                  {video.published_at ? `Publicado em ${new Date(video.published_at).toLocaleDateString("pt-BR")} · desfazer` : "Já publiquei"}
                </button>
                <button type="button" onClick={prepare} disabled={busy} className="min-h-11 self-center text-sm font-semibold underline disabled:opacity-40">
                  {busy ? <Thinking label="Preparando" steps={STEPS.publicar} /> : "Preparar de novo"}
                </button>
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-2xl border border-destructive/40 bg-card p-4 text-sm text-destructive">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
