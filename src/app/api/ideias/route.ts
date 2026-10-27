import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AiError, generateJsonStream, hasAiProvider } from "@/lib/ai";
import { radarSince } from "@/lib/radar";
import { normalizeIdeas, videoPlatforms, type Objective, type Platform, type Resource } from "@/lib/ideas";
import { memoryLines } from "@/lib/memoria";
import { completeItems } from "@/lib/stream-json";
import { ideasRequest } from "@/lib/prompts/montagem";

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// Gera uma rodada de ideias para um vídeo e guarda no banco.
// Pedido: "outras ideias", um botão rápido, um pedido escrito ou "mais assim" sobre uma ideia.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Entre na sua conta para continuar.", 401);

  const body = (await request.json().catch(() => null)) as { videoId?: unknown; request?: unknown; like?: unknown } | null;
  const videoId = typeof body?.videoId === "string" ? body.videoId : "";
  const ask = typeof body?.request === "string" ? body.request.trim().slice(0, 300) : "";
  const like = typeof body?.like === "string" ? body.like.trim().slice(0, 200) : ""; // título da ideia em "Mais assim"
  if (!videoId) return fail("Vídeo não informado.", 400);

  const [{ data: video }, { data: profile }, { data: previous }, { data: memory }] = await Promise.all([
    supabase.from("videos").select("id, objective, platform, platforms, duration_s, resources, brief").eq("id", videoId).maybeSingle(),
    supabase.from("creator_profiles").select("niche, product, product_edge").maybeSingle(),
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

  const call = ideasRequest({
    video: {
      objective: video.objective as Objective,
      platforms: videoPlatforms(video as { platform: Platform | null; platforms: Platform[] }),
      durationS: video.duration_s,
      resources: (video.resources ?? []) as Resource[],
      brief: video.brief ?? "",
    },
    person: { niche: profile.niche, product: profile.product, edge: profile.product_edge, memory: memoryLines(memory?.items) },
    ask,
    like,
    seen: (previous ?? []).slice(0, 15).map((p) => p.title),
    trends: (radar ?? []) as { title: string; what: string }[],
  });

  const round = (previous?.[0]?.round ?? 0) + 1;
  const signal = like ? `mais assim: ${like}` : ask;

  // Resposta em linhas de JSON: cada ideia vai para a tela assim que fica completa ("idea"),
  // e no fim chegam as ideias guardadas, com id ("done"), ou o erro ("error").
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      let shown = 0;
      try {
        const raw = await generateJsonStream(call, (sofar) => {
          const ready = normalizeIdeas({ ideas: completeItems(sofar, "ideas") });
          for (const idea of ready.slice(shown)) send({ type: "idea", idea });
          shown = Math.max(shown, ready.length);
        });
        const ideas = normalizeIdeas(raw);
        if (ideas.length === 0) throw new AiError("A IA não trouxe ideias desta vez. Tente de novo.", "format");
        const { data: saved, error } = await supabase
          .from("video_ideas")
          .insert(ideas.map((i) => ({ title: i.title, format_slug: i.format_slug, hook: i.hook, situation: i.situation, payoff: i.payoff, why: i.why, video_id: videoId, round })))
          .select("id, round, title, format_slug, hook, situation, payoff, why, chosen");
        if (error) throw new Error("Não foi possível guardar as ideias.");
        if (signal) await supabase.from("creator_signals").insert({ kind: "pedido_ideia", video_id: videoId, detail: { pedido: signal.slice(0, 160) } });
        send({ type: "done", ideas: saved });
      } catch (err) {
        const message =
          err instanceof AiError && err.kind === "limit"
            ? "A IA está no limite de uso agora. Tente de novo em alguns minutos."
            : err instanceof AiError && err.kind === "config"
              ? "As sugestões ainda não estão configuradas no servidor."
              : "A IA não respondeu direito desta vez. Tente de novo.";
        send({ type: "error", error: message });
      }
      controller.close();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
