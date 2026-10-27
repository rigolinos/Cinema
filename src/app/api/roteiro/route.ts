import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AiError, generateJson, hasAiProvider } from "@/lib/ai";
import { videoPlatforms, type Objective, type Resource } from "@/lib/ideas";
import { memoryLines } from "@/lib/memoria";
import { PASTE_MAX_CHARS, assembleBlocks, fallbackBlocks, segmentScript, segmentsText } from "@/lib/organizar";
import { context, tag, usesHumor } from "@/lib/prompts/base";
import { draftRequest } from "@/lib/prompts/montagem";
import { organizerTask, personTag, productTag, rewriteTask, suggestionsTask, videoTag } from "@/lib/prompts/tarefas";
import { normalizeDraft, normalizeRewrite, normalizeSuggestions, scriptForPrompt, type ScriptBlock } from "@/lib/roteiro";
import type { Video } from "@/types/database";

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function aiFailure(err: unknown) {
  if (err instanceof AiError && err.kind === "limit") {
    return fail("A IA está no limite de uso agora. Tente de novo em alguns minutos.", 503);
  }
  return fail("A IA não respondeu direito desta vez. Tente de novo.", 502);
}

type Mode = "rascunho" | "bloco" | "sugestoes" | "organizar";

// O roteiro com a pessoa:
// - "rascunho": escreve o roteiro inteiro a partir da ideia escolhida;
// - "bloco": reescreve um bloco a pedido;
// - "sugestoes": revisa o roteiro e sugere mudanças por bloco (nada muda sem a pessoa tocar);
// - "organizar": a pessoa colou o próprio roteiro; o app divide em trechos e a IA só classifica.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Entre na sua conta para continuar.", 401);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const videoId = typeof body?.videoId === "string" ? body.videoId : "";
  const mode: Mode = (["bloco", "sugestoes", "organizar"] as const).find((m) => m === body?.mode) ?? "rascunho";
  const blockId = typeof body?.blockId === "string" ? body.blockId : "";
  const ask = typeof body?.request === "string" ? body.request.trim().slice(0, 300) : "";
  const pasted = typeof body?.text === "string" ? body.text.slice(0, PASTE_MAX_CHARS) : "";
  if (!videoId) return fail("Vídeo não informado.", 400);
  if (mode === "bloco" && (!blockId || !ask)) return fail("Diga o que mudar neste bloco.", 400);
  if (mode === "organizar" && !pasted.trim()) return fail("Cole o seu roteiro para eu organizar.", 400);

  const [{ data: video }, { data: profile }, { data: current }, { data: memory }] = await Promise.all([
    supabase.from("videos").select("*").eq("id", videoId).maybeSingle(),
    supabase.from("creator_profiles").select("niche, product, product_edge").maybeSingle(),
    supabase.from("script_blocks").select("*").eq("video_id", videoId).order("position"),
    supabase.from("creator_memory").select("items").maybeSingle(),
  ]);
  if (!video) return fail("Vídeo não encontrado.", 404);
  const v = video as Video & { situation: string; payoff: string; brief: string };
  if ((mode === "rascunho" || mode === "bloco") && (!v.title || !v.hook)) return fail("Escolha uma ideia antes de escrever o roteiro.", 400);

  if (!hasAiProvider() && mode !== "organizar") return fail("O roteirista ainda não está configurado no servidor.", 503);

  if (mode === "organizar") return organize(supabase, v, pasted);

  const { data: allowed, error: quotaErr } = await supabase.rpc("consume_ai_call");
  if (quotaErr) return fail("Não foi possível falar com a IA agora.", 500);
  if (!allowed) return fail("Você usou todas as chamadas da IA de hoje. Amanhã tem mais.", 429);

  const objective = (v.objective ?? "crescer") as Objective;
  const memoryText = memoryLines(memory?.items);
  const humor = usesHumor({ objective, texts: [profile?.niche, v.brief, ask, ...memoryText] });
  const shared = [
    videoTag({ objective, platforms: videoPlatforms(v), durationS: v.duration_s, resources: (v.resources ?? []) as Resource[] }),
    productTag(objective, { product: profile?.product, edge: profile?.product_edge }),
    personTag({ niche: profile?.niche, memory: memoryText }),
  ];

  if (mode === "rascunho") {
    const call = draftRequest({
      video: {
        objective,
        platforms: videoPlatforms(v),
        durationS: v.duration_s ?? 30,
        resources: (v.resources ?? []) as Resource[],
        brief: v.brief ?? "",
        title: v.title ?? "",
        hook: v.hook ?? "",
        situation: v.situation ?? "",
        payoff: v.payoff ?? "",
        formatSlug: v.format_slug,
      },
      person: { niche: profile?.niche ?? null, product: profile?.product, edge: profile?.product_edge, memory: memoryText },
    });
    let blocks: ScriptBlock[];
    try {
      blocks = normalizeDraft(await generateJson(call));
    } catch (err) {
      return aiFailure(err);
    }
    if (blocks.length === 0) return fail("A IA não trouxe um roteiro desta vez. Tente de novo.", 502);

    const { data: saved, error } = await supabase.rpc("replace_script", { p_video_id: videoId, p_blocks: blocks });
    if (error) return fail("Não foi possível guardar o roteiro.", 500);
    const ordered = [...((saved ?? []) as (ScriptBlock & { position: number })[])].sort((a, b) => a.position - b.position);
    return NextResponse.json({ blocks: ordered });
  }

  const blocks = (current ?? []) as (ScriptBlock & { id: string })[];
  if (blocks.length === 0) return fail("O roteiro ainda está vazio.", 400);

  if (mode === "sugestoes") {
    const prompt = context([tag("roteiro", scriptForPrompt(blocks)), tag("briefing", v.brief), ...shared]);
    try {
      const result = normalizeSuggestions(await generateJson({ ...suggestionsTask({ objective, humor }), prompt }), blocks);
      return NextResponse.json({
        note: result.note,
        suggestions: result.suggestions.map((s) => ({ ...s, blockId: blocks[s.block - 1].id })),
      });
    } catch (err) {
      return aiFailure(err);
    }
  }

  const index = blocks.findIndex((x) => x.id === blockId);
  if (index === -1) return fail("Bloco não encontrado.", 404);

  const prompt = context([tag("pedido_agora", ask), tag("roteiro", scriptForPrompt(blocks, index)), ...shared]);
  let rewrite;
  try {
    rewrite = normalizeRewrite(await generateJson({ ...rewriteTask({ objective, humor }), prompt }));
  } catch (err) {
    return aiFailure(err);
  }
  if (!rewrite) return fail("A IA não trouxe o bloco desta vez. Tente de novo.", 502);

  const { data: updated, error } = await supabase.from("script_blocks").update(rewrite).eq("id", blockId).select().single();
  if (error) return fail("Não foi possível guardar o bloco.", 500);
  await supabase.from("creator_signals").insert({ kind: "pedido_bloco", video_id: videoId, detail: { pedido: ask.slice(0, 160), bloco: (blocks[index].label ?? "").slice(0, 60) } });
  return NextResponse.json({ block: updated });
}

// "Já tenho o roteiro": divide em trechos, a IA classifica e o app remonta com o texto original.
// Se a IA falhar, não houver chave ou a cota acabar, a divisão simples (sem IA) assume: o roteiro nunca se perde.
async function organize(supabase: Awaited<ReturnType<typeof createClient>>, v: Video & { brief: string }, pasted: string) {
  const segments = segmentScript(pasted);
  if (segments.length === 0) return fail("Cole o seu roteiro para eu organizar.", 400);

  let blocks: Omit<ScriptBlock, "id">[] | null = null;
  let title = "";
  if (hasAiProvider()) {
    const { data: allowed } = await supabase.rpc("consume_ai_call");
    if (allowed) {
      try {
        const raw = await generateJson({ ...organizerTask(), prompt: tag("trechos", segmentsText(segments)) });
        blocks = assembleBlocks(segments, raw);
        const t = (raw as { title?: unknown })?.title;
        title = typeof t === "string" ? t.trim().slice(0, 140) : "";
      } catch {
        blocks = null;
      }
    }
  }
  const final = blocks ?? fallbackBlocks(segments);

  const { data: saved, error } = await supabase.rpc("replace_script", { p_video_id: v.id, p_blocks: final });
  if (error) return fail("Não foi possível guardar o roteiro.", 500);

  // O vídeo ganha título e gancho a partir do próprio roteiro, para seguir pelos passos.
  const firstWords = (final[0].speech || final[0].on_screen || final[0].action).replace(/\s+/g, " ").trim();
  await supabase
    .from("videos")
    .update({
      title: v.title || title || firstWords.split(" ").slice(0, 6).join(" "),
      hook: v.hook || firstWords.slice(0, 300),
      brief: pasted,
      start_door: "roteiro",
      stage: v.stage === "ideia" ? "roteiro" : v.stage,
    })
    .eq("id", v.id);
  await supabase.from("creator_signals").insert({ kind: "roteiro_colado", video_id: v.id, detail: { inicio: pasted.replace(/\s+/g, " ").trim().slice(0, 300) } });

  const ordered = [...((saved ?? []) as (ScriptBlock & { position: number })[])].sort((a, b) => a.position - b.position);
  return NextResponse.json({ blocks: ordered, organized: blocks !== null });
}
