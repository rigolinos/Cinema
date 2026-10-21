import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AiError, generateJson, hasAiProvider } from "@/lib/ai";
import { SHOTS_SYSTEM, defaultOrientation, isSolo, maxShots, normalizeShots, shotsPrompt } from "@/lib/planos";
import type { ScriptBlock } from "@/lib/roteiro";
import type { Video } from "@/types/database";

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// Decupa o roteiro inteiro: cada bloco vira 1 ou 2 planos, dentro do limite da duração. Substitui a decupagem anterior.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Entre na sua conta para continuar.", 401);

  const body = (await request.json().catch(() => null)) as { videoId?: unknown } | null;
  const videoId = typeof body?.videoId === "string" ? body.videoId : "";
  if (!videoId) return fail("Vídeo não informado.", 400);

  const [{ data: video }, { data: blocks }] = await Promise.all([
    supabase.from("videos").select("*").eq("id", videoId).maybeSingle(),
    supabase.from("script_blocks").select("*").eq("video_id", videoId).order("position"),
  ]);
  if (!video) return fail("Vídeo não encontrado.", 404);
  const v = video as Video;
  const script = (blocks ?? []) as (ScriptBlock & { id: string })[];
  if (script.length === 0) return fail("Escreva o roteiro antes de decupar.", 400);

  if (!hasAiProvider()) return fail("A decupagem ainda não está configurada no servidor.", 503);
  const { data: allowed, error: quotaErr } = await supabase.rpc("consume_ai_call");
  if (quotaErr) return fail("Não foi possível falar com a IA agora.", 500);
  if (!allowed) return fail("Você usou todas as chamadas da IA de hoje. Amanhã tem mais.", 429);

  let shots;
  try {
    shots = normalizeShots(
      await generateJson({
        system: SHOTS_SYSTEM,
        prompt: shotsPrompt(script, { title: v.title ?? "Vídeo", platform: v.platform, resources: v.resources ?? [], durationS: v.duration_s }),
        temperature: 0.6,
      }),
      script.map((b) => b.id),
      { orientation: defaultOrientation(v.platform), max: maxShots(v.duration_s), solo: isSolo(v.resources ?? []) },
    );
  } catch (err) {
    if (err instanceof AiError && err.kind === "limit") {
      return fail("A IA está no limite de uso agora. Tente de novo em alguns minutos.", 503);
    }
    return fail("A IA não respondeu direito desta vez. Tente de novo.", 502);
  }
  if (shots.length === 0) return fail("A IA não trouxe os planos desta vez. Tente de novo.", 502);

  const { data: saved, error } = await supabase.rpc("replace_shots", { p_video_id: videoId, p_shots: shots });
  if (error) return fail("Não foi possível guardar os planos.", 500);
  const ordered = [...((saved ?? []) as { position: number }[])].sort((a, b) => a.position - b.position);
  return NextResponse.json({ shots: ordered });
}
