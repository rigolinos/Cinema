import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AiError, generateJson, hasAiProvider } from "@/lib/ai";
import { IDEA_SYSTEM, normalizeIdeas } from "@/lib/ideas";
import { IDEAS_PER_PERIOD, fortnightPrompt, periodStart } from "@/lib/quinzena";
import { radarSince } from "@/lib/radar";

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

const COLUMNS = "id, period_start, position, title, format_slug, hook, why, video_id";

// Ideias da quinzena do criador: devolve as que já existem ou gera as da quinzena atual (1 chamada de IA).
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Entre na sua conta para continuar.", 401);

  const period = periodStart();
  const current = () => supabase.from("creator_ideas").select(COLUMNS).eq("period_start", period).order("position");

  const { data: existing, error: readErr } = await current();
  if (readErr) return fail("Não foi possível carregar suas ideias.", 500);
  if (existing && existing.length > 0) return NextResponse.json({ period, ideas: existing });

  const { data: profile } = await supabase.from("creator_profiles").select("niche, platforms").maybeSingle();
  if (!profile?.niche?.trim()) return fail("Conte sobre o que é o seu perfil para receber ideias.", 400);

  if (!hasAiProvider()) return fail("As ideias ainda não estão configuradas no servidor.", 503);
  const { data: allowed, error: quotaErr } = await supabase.rpc("consume_ai_call");
  if (quotaErr) return fail("Não foi possível falar com a IA agora.", 500);
  if (!allowed) return fail("Você usou todas as chamadas da IA de hoje. Amanhã tem mais.", 429);

  const [{ data: recent }, { data: radar }] = await Promise.all([
    supabase.from("creator_ideas").select("title").lt("period_start", period).order("period_start", { ascending: false }).limit(12),
    supabase.from("trend_radar").select("title, what").gte("week_start", radarSince()).limit(5),
  ]);

  let ideas;
  try {
    ideas = normalizeIdeas(
      await generateJson({
        system: IDEA_SYSTEM,
        prompt: fortnightPrompt({
          niche: profile.niche,
          platforms: profile.platforms ?? [],
          trends: (radar ?? []) as { title: string; what: string }[],
          recentTitles: (recent ?? []).map((r) => r.title),
        }),
      }),
      IDEAS_PER_PERIOD,
    );
  } catch (err) {
    if (err instanceof AiError && err.kind === "limit") {
      return fail("A IA está no limite de uso agora. Tente de novo em alguns minutos.", 503);
    }
    return fail("A IA não respondeu direito desta vez. Tente de novo.", 502);
  }
  if (ideas.length < 3) return fail("A IA não trouxe ideias suficientes desta vez. Tente de novo.", 502);

  const { error } = await supabase
    .from("creator_ideas")
    .insert(ideas.map((i, position) => ({ ...i, period_start: period, position })));
  // Se outra aba gerou ao mesmo tempo, o unique barra a segunda: devolve as que ficaram.
  if (error && error.code !== "23505") return fail("Não foi possível guardar suas ideias.", 500);

  const { data: saved } = await current();
  return NextResponse.json({ period, ideas: saved ?? [] });
}
