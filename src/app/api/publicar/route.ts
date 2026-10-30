import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AiError, generateJson, hasAiProvider } from "@/lib/ai";
import { videoPlatforms, type Objective, type Resource } from "@/lib/ideas";
import { memoryLines } from "@/lib/memoria";
import { context, tag } from "@/lib/prompts/base";
import { personTag, postTask, productTag, videoTag } from "@/lib/prompts/tarefas";
import { normalizePosts } from "@/lib/publicar";
import { scriptForPrompt, type ScriptBlock } from "@/lib/roteiro";
import type { Video } from "@/types/database";

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// Prepara legenda, título, hashtags e capa de cada plataforma a partir do roteiro e dos planos.
// Substitui o texto anterior. Uma chamada de IA para todas as plataformas.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Entre na sua conta para continuar.", 401);

  const body = (await request.json().catch(() => null)) as { videoId?: unknown } | null;
  const videoId = typeof body?.videoId === "string" ? body.videoId : "";
  if (!videoId) return fail("Vídeo não informado.", 400);

  const [{ data: video }, { data: profile }, { data: blocks }, { data: shots }, { data: memory }] = await Promise.all([
    supabase.from("videos").select("*").eq("id", videoId).maybeSingle(),
    supabase.from("creator_profiles").select("niche, product, product_edge").maybeSingle(),
    supabase.from("script_blocks").select("kind, label, speech, on_screen, action").eq("video_id", videoId).order("position"),
    supabase.from("shots").select("description").eq("video_id", videoId).order("position"),
    supabase.from("creator_memory").select("items").maybeSingle(),
  ]);
  if (!video) return fail("Vídeo não encontrado.", 404);
  const v = video as Video;
  if (!v.title || !v.hook || !blocks?.length) return fail("Escreva o roteiro antes de preparar a publicação.", 400);

  if (!hasAiProvider()) return fail("A publicação ainda não está configurada no servidor.", 503);
  const { data: allowed, error: quotaErr } = await supabase.rpc("consume_ai_call");
  if (quotaErr) return fail("Não foi possível falar com a IA agora.", 500);
  if (!allowed) return fail("Você usou todas as chamadas da IA de hoje. Amanhã tem mais.", 429);

  const objective = (v.objective ?? null) as Objective | null;
  const platforms = videoPlatforms(v);
  const script = blocks as Pick<ScriptBlock, "kind" | "label" | "speech" | "on_screen" | "action">[];
  const call = [...script].reverse().find((b) => b.kind === "chamada")?.speech;
  const prompt = context([
    tag("roteiro", scriptForPrompt(script)),
    tag("chamada_final", call),
    tag("planos", (shots ?? []).map((s, i) => `${i + 1}. ${s.description}`)),
    videoTag({ objective, platforms, durationS: v.duration_s, resources: (v.resources ?? []) as Resource[] }),
    productTag(objective, { product: profile?.product, edge: profile?.product_edge }),
    personTag({ niche: profile?.niche, memory: memoryLines(memory?.items) }),
  ]);

  let posts;
  try {
    const raw = await generateJson({ ...postTask({ objective, platforms }), prompt });
    posts = normalizePosts(raw, platforms);
  } catch (err) {
    if (err instanceof AiError && err.kind === "limit") {
      return fail("A IA está no limite de uso agora. Tente de novo em alguns minutos.", 503);
    }
    return fail("A IA não respondeu direito desta vez. Tente de novo.", 502);
  }
  if (posts.length === 0) return fail("A IA não trouxe a publicação desta vez. Tente de novo.", 502);

  // Plataforma que saiu do vídeo perde o texto; as outras são substituídas.
  await supabase.from("video_posts").delete().eq("video_id", videoId).not("platform", "in", `(${posts.map((p) => p.platform).join(",")})`);
  const { data: saved, error } = await supabase
    .from("video_posts")
    .upsert(
      posts.map((p) => ({ video_id: videoId, ...p })),
      { onConflict: "video_id,platform" },
    )
    .select();
  if (error) return fail("Não foi possível guardar a publicação.", 500);
  return NextResponse.json({ posts: saved });
}
