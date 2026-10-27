import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateJson, hasAiProvider } from "@/lib/ai";
import { MEMORY_EXAMPLE, MEMORY_SYSTEM, memoryPrompt, normalizeMemory, readItems, shouldSummarize, type Signal } from "@/lib/memoria";

// Atualiza "o que o Gravaí entendeu sobre você" a partir dos sinais novos.
// Só chama a IA quando há novidade suficiente (ver shouldSummarize); no resto das vezes não gasta nada.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 });

  const [{ data: memory }, { data: profile }] = await Promise.all([
    supabase.from("creator_memory").select("items, insight, signals_seen, summarized_at").maybeSingle(),
    supabase.from("creator_profiles").select("niche").maybeSingle(),
  ]);

  let query = supabase.from("creator_signals").select("kind, detail, created_at, video_id").order("created_at", { ascending: false }).limit(40);
  if (memory?.summarized_at) query = query.gt("created_at", memory.summarized_at);
  const { data: fresh } = await query;
  const rows = ((fresh ?? []) as (Signal & { video_id: string | null })[]).reverse(); // do mais antigo para o mais novo

  const skip = NextResponse.json({ updated: false });
  if (!shouldSummarize({ newSignals: rows.length, summarizedAt: memory?.summarized_at ?? null })) return skip;
  if (!hasAiProvider()) return skip;
  const { data: allowed } = await supabase.rpc("consume_ai_call");
  if (!allowed) return skip;

  // Cada sinal leva o contexto do vídeo em que aconteceu: [objetivo · duração · plataformas].
  const ids = [...new Set(rows.map((r) => r.video_id).filter((id): id is string => !!id))];
  const { data: videos } = ids.length
    ? await supabase.from("videos").select("id, objective, duration_s, platforms, brief").in("id", ids)
    : { data: [] as { id: string; objective: string | null; duration_s: number | null; platforms: string[]; brief: string }[] };
  const byId = new Map((videos ?? []).map((v) => [v.id, v]));
  const signals: Signal[] = rows.map((r) => ({ kind: r.kind, detail: r.detail, video: r.video_id ? byId.get(r.video_id) ?? null : null }));

  const current = readItems(memory?.items);
  let next;
  try {
    next = normalizeMemory(
      await generateJson({
        system: MEMORY_SYSTEM,
        prompt: memoryPrompt({ niche: profile?.niche ?? null, current, signals }),
        schema: { type: "OBJECT", properties: { items: { type: "ARRAY", items: { type: "STRING" } }, insight: { type: "STRING" } }, required: ["items", "insight"] },
        example: MEMORY_EXAMPLE,
        thinking: "baixo",
        temperature: 0.4,
      }),
      current,
    );
  } catch {
    return skip;
  }

  const { error } = await supabase.from("creator_memory").upsert(
    {
      user_id: user.id,
      items: next.items,
      insight: next.insight ?? memory?.insight ?? null,
      signals_seen: (memory?.signals_seen ?? 0) + rows.length,
      summarized_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return skip;
  return NextResponse.json({ updated: true, insight: next.insight });
}
