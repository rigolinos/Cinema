import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AiError, generateJson, hasAiProvider } from "@/lib/ai";
import { POST_SYSTEM, normalizePost, postPrompt } from "@/lib/publicar";
import type { ScriptBlock } from "@/lib/roteiro";
import { withMemory } from "@/lib/memoria";
import type { Video } from "@/types/database";

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// Prepara legenda, título, hashtags e capa a partir do roteiro e dos planos. Substitui o texto anterior.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Entre na sua conta para continuar.", 401);

  const body = (await request.json().catch(() => null)) as { videoId?: unknown } | null;
  const videoId = typeof body?.videoId === "string" ? body.videoId : "";
  if (!videoId) return fail("Vídeo não informado.", 400);

  const [{ data: video }, { data: profile }, { data: blocks }, { data: shots }, { data: memory }] = await Promise.all([
    supabase.from("videos").select("*").eq("id", videoId).maybeSingle(),
    supabase.from("creator_profiles").select("niche").maybeSingle(),
    supabase.from("script_blocks").select("kind, label, speech").eq("video_id", videoId).order("position"),
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

  let post;
  try {
    post = normalizePost(
      await generateJson({
        system: POST_SYSTEM,
        prompt: withMemory(postPrompt({
          niche: profile?.niche ?? "conteúdo",
          title: v.title,
          hook: v.hook,
          platform: v.platform,
          blocks: blocks as Pick<ScriptBlock, "kind" | "label" | "speech">[],
          shots: (shots ?? []) as { description: string }[],
        }), memory?.items),
        temperature: 0.8,
      }),
      v.platform,
    );
  } catch (err) {
    if (err instanceof AiError && err.kind === "limit") {
      return fail("A IA está no limite de uso agora. Tente de novo em alguns minutos.", 503);
    }
    return fail("A IA não respondeu direito desta vez. Tente de novo.", 502);
  }
  if (!post) return fail("A IA não trouxe a publicação desta vez. Tente de novo.", 502);

  const { data: saved, error } = await supabase
    .from("video_posts")
    .upsert({ video_id: videoId, ...post }, { onConflict: "video_id" })
    .select()
    .single();
  if (error) return fail("Não foi possível guardar a publicação.", 500);
  return NextResponse.json({ post: saved });
}
