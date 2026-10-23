import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AiError, generateJson, hasAiProvider } from "@/lib/ai";
import { radarSince } from "@/lib/radar";
import { withMemory } from "@/lib/memoria";
import { IDEA_SYSTEM, ideaPrompt, normalizeIdeas, videoPlatforms, type Objective, type Platform, type Resource } from "@/lib/ideas";

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// Gera uma rodada de ideias para um vídeo e guarda no banco.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Entre na sua conta para continuar.", 401);

  const body = (await request.json().catch(() => null)) as { videoId?: unknown; request?: unknown } | null;
  const videoId = typeof body?.videoId === "string" ? body.videoId : "";
  const ask = typeof body?.request === "string" ? body.request.trim().slice(0, 300) : "";
  if (!videoId) return fail("Vídeo não informado.", 400);

  const [{ data: video }, { data: profile }, { data: previous }, { data: memory }] = await Promise.all([
    supabase.from("videos").select("id, objective, platform, platforms, duration_s, resources").eq("id", videoId).maybeSingle(),
    supabase.from("creator_profiles").select("niche").maybeSingle(),
    supabase.from("video_ideas").select("title, round").eq("video_id", videoId).order("round", { ascending: false }),
    supabase.from("creator_memory").select("items").maybeSingle(),
  ]);
  const { data: radar } = await supabase.from("trend_radar").select("title, what").gte("week_start", radarSince()).limit(5);

  if (!video) return fail("Vídeo não encontrado.", 404);
  if (!profile?.niche || !video.objective || !video.platform || !video.duration_s) {
    return fail("Faltam respostas para sugerir ideias.", 400);
  }

  // Sem chave configurada não se gasta a cota de ninguém.
  if (!hasAiProvider()) return fail("As sugestões ainda não estão configuradas no servidor.", 503);

  const { data: allowed, error: quotaErr } = await supabase.rpc("consume_ai_call");
  if (quotaErr) return fail("Não foi possível falar com a IA agora.", 500);
  if (!allowed) return fail("Você usou todas as sugestões de hoje. Amanhã tem mais.", 429);

  let ideas;
  try {
    ideas = normalizeIdeas(
      await generateJson({
        system: IDEA_SYSTEM,
        prompt: withMemory(ideaPrompt({
          niche: profile.niche,
          objective: video.objective as Objective,
          platforms: videoPlatforms(video as { platform: Platform | null; platforms: Platform[] }),
          durationS: video.duration_s,
          resources: (video.resources ?? []) as Resource[],
          request: ask || undefined,
          previousTitles: (previous ?? []).slice(0, 15).map((p) => p.title),
          trends: (radar ?? []) as { title: string; what: string }[],
        }), memory?.items),
      }),
    );
  } catch (err) {
    if (err instanceof AiError && err.kind === "limit") {
      return fail("A IA está no limite de uso agora. Tente de novo em alguns minutos.", 503);
    }
    if (err instanceof AiError && err.kind === "config") {
      return fail("As sugestões ainda não estão configuradas no servidor.", 503);
    }
    return fail("A IA não respondeu direito desta vez. Tente de novo.", 502);
  }

  if (ideas.length === 0) return fail("A IA não trouxe ideias desta vez. Tente de novo.", 502);

  const round = (previous?.[0]?.round ?? 0) + 1;
  const { data: saved, error } = await supabase
    .from("video_ideas")
    .insert(ideas.map((i) => ({ ...i, video_id: videoId, round })))
    .select("id, round, title, format_slug, hook, why, chosen");
  if (error) return fail("Não foi possível guardar as ideias.", 500);
  if (ask) await supabase.from("creator_signals").insert({ kind: "pedido_ideia", video_id: videoId, detail: { pedido: ask.slice(0, 160) } });

  return NextResponse.json({ ideas: saved });
}
