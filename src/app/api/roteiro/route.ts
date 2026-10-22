import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AiError, generateJson, hasAiProvider } from "@/lib/ai";
import {
  SCRIPT_SYSTEM,
  draftPrompt,
  normalizeDraft,
  normalizeRewrite,
  rewritePrompt,
  type ScriptBlock,
  type ScriptBrief,
} from "@/lib/roteiro";
import { withMemory } from "@/lib/memoria";
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

// Escreve o roteiro com a pessoa: o rascunho inteiro ("rascunho") ou um bloco ("bloco").
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Entre na sua conta para continuar.", 401);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const videoId = typeof body?.videoId === "string" ? body.videoId : "";
  const mode = body?.mode === "bloco" ? "bloco" : "rascunho";
  const blockId = typeof body?.blockId === "string" ? body.blockId : "";
  const ask = typeof body?.request === "string" ? body.request.trim().slice(0, 300) : "";
  if (!videoId) return fail("Vídeo não informado.", 400);
  if (mode === "bloco" && (!blockId || !ask)) return fail("Diga o que mudar neste bloco.", 400);

  const [{ data: video }, { data: profile }, { data: current }, { data: memory }] = await Promise.all([
    supabase.from("videos").select("*").eq("id", videoId).maybeSingle(),
    supabase.from("creator_profiles").select("niche").maybeSingle(),
    supabase.from("script_blocks").select("*").eq("video_id", videoId).order("position"),
    supabase.from("creator_memory").select("items").maybeSingle(),
  ]);
  if (!video) return fail("Vídeo não encontrado.", 404);
  const v = video as Video;
  if (!v.title || !v.hook) return fail("Escolha uma ideia antes de escrever o roteiro.", 400);

  if (!hasAiProvider()) return fail("O roteirista ainda não está configurado no servidor.", 503);
  const { data: allowed, error: quotaErr } = await supabase.rpc("consume_ai_call");
  if (quotaErr) return fail("Não foi possível falar com a IA agora.", 500);
  if (!allowed) return fail("Você usou todas as chamadas da IA de hoje. Amanhã tem mais.", 429);

  const brief: ScriptBrief = {
    niche: profile?.niche ?? "conteúdo",
    title: v.title,
    hook: v.hook,
    formatSlug: v.format_slug,
    objective: v.objective,
    platform: v.platform,
    durationS: v.duration_s ?? 30,
    resources: v.resources ?? [],
  };

  if (mode === "rascunho") {
    let blocks: ScriptBlock[];
    try {
      blocks = normalizeDraft(await generateJson({ system: SCRIPT_SYSTEM, prompt: withMemory(draftPrompt(brief), memory?.items), temperature: 0.8 }));
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
  const index = blocks.findIndex((x) => x.id === blockId);
  if (index === -1) return fail("Bloco não encontrado.", 404);

  let rewrite;
  try {
    rewrite = normalizeRewrite(
      await generateJson({ system: SCRIPT_SYSTEM, prompt: withMemory(rewritePrompt(brief, blocks, index, ask), memory?.items), temperature: 0.8 }),
    );
  } catch (err) {
    return aiFailure(err);
  }
  if (!rewrite) return fail("A IA não trouxe o bloco desta vez. Tente de novo.", 502);

  const { data: updated, error } = await supabase.from("script_blocks").update(rewrite).eq("id", blockId).select().single();
  if (error) return fail("Não foi possível guardar o bloco.", 500);
  await supabase.from("creator_signals").insert({ kind: "pedido_bloco", video_id: videoId, detail: { pedido: ask.slice(0, 160), bloco: (blocks[index].label ?? "").slice(0, 60) } });
  return NextResponse.json({ block: updated });
}
