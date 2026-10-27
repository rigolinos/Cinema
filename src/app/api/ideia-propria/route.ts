import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AiError, generateJson, hasAiProvider } from "@/lib/ai";
import { videoPlatforms, type Objective, type Resource } from "@/lib/ideas";
import { memoryLines } from "@/lib/memoria";
import { normalizeOwnIdea } from "@/lib/ideia-propria";
import { context, tag, usesHumor } from "@/lib/prompts/base";
import { formatsTag, ownIdeaTask, personTag, productTag, videoTag } from "@/lib/prompts/tarefas";
import type { Video } from "@/types/database";

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// "Já tenho a ideia": devolve a mesma ideia mais afiada (título, cena, 3 ganchos, desfecho, perguntas).
// Nada é guardado aqui: a pessoa escolhe o gancho e confirma na tela.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Entre na sua conta para continuar.", 401);

  const body = (await request.json().catch(() => null)) as { videoId?: unknown; text?: unknown } | null;
  const videoId = typeof body?.videoId === "string" ? body.videoId : "";
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 1500) : "";
  if (!videoId) return fail("Vídeo não informado.", 400);
  if (text.length < 8) return fail("Conte a sua ideia com um pouco mais de detalhe.", 400);

  const [{ data: video }, { data: profile }, { data: memory }] = await Promise.all([
    supabase.from("videos").select("*").eq("id", videoId).maybeSingle(),
    supabase.from("creator_profiles").select("niche, product, product_edge").maybeSingle(),
    supabase.from("creator_memory").select("items").maybeSingle(),
  ]);
  if (!video) return fail("Vídeo não encontrado.", 404);
  const v = video as Video;
  if (!v.objective || !v.platform || !v.duration_s) return fail("Faltam respostas sobre o vídeo.", 400);

  if (!hasAiProvider()) return fail("As sugestões ainda não estão configuradas no servidor.", 503);
  const { data: allowed, error: quotaErr } = await supabase.rpc("consume_ai_call");
  if (quotaErr) return fail("Não foi possível falar com a IA agora.", 500);
  if (!allowed) return fail("Você usou todas as chamadas da IA de hoje. Amanhã tem mais.", 429);

  const objective = v.objective as Objective;
  const resources = (v.resources ?? []) as Resource[];
  const memoryText = memoryLines(memory?.items);
  const task = ownIdeaTask({ objective, humor: usesHumor({ objective, texts: [profile?.niche, text, ...memoryText] }) });
  const prompt = context([
    tag("ideia_da_pessoa", text),
    videoTag({ objective, platforms: videoPlatforms(v), durationS: v.duration_s, resources }),
    productTag(objective, { product: profile?.product, edge: profile?.product_edge }),
    personTag({ niche: profile?.niche, memory: memoryText }),
    formatsTag(resources),
  ]);

  try {
    const idea = normalizeOwnIdea(await generateJson({ ...task, prompt }), text);
    if (!idea) return fail("A IA não respondeu direito desta vez. Tente de novo.", 502);
    return NextResponse.json({ idea });
  } catch (err) {
    if (err instanceof AiError && err.kind === "limit") {
      return fail("A IA está no limite de uso agora. Tente de novo em alguns minutos.", 503);
    }
    return fail("A IA não respondeu direito desta vez. Tente de novo.", 502);
  }
}
