import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AiError, generateJson, hasAiProvider } from "@/lib/ai";
import { normalizeIdeas, platformsLabel, type Objective, type Platform, type Resource } from "@/lib/ideas";
import { memoryLines } from "@/lib/memoria";
import { context, line, tag, usesHumor } from "@/lib/prompts/base";
import { formatsTag, fortnightTask, personTag, seenTag, trendsTag } from "@/lib/prompts/tarefas";
import { IDEAS_PER_PERIOD, fortnightMix, mixText, periodStart } from "@/lib/quinzena";
import { radarSince } from "@/lib/radar";

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

const COLUMNS = "id, period_start, position, title, format_slug, hook, situation, payoff, why, objective, video_id";

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

  const [{ data: recent }, { data: radar }, { data: memory }, { data: history }] = await Promise.all([
    supabase.from("creator_ideas").select("title").lt("period_start", period).order("period_start", { ascending: false }).limit(12),
    supabase.from("trend_radar").select("title, what").gte("week_start", radarSince()).limit(5),
    supabase.from("creator_memory").select("items").maybeSingle(),
    supabase.from("videos").select("objective, resources").not("objective", "is", null).order("created_at", { ascending: false }).limit(30),
  ]);

  // A mistura e os recursos de sempre saem do histórico, calculados aqui.
  const videos = (history ?? []) as { objective: Objective; resources: Resource[] | null }[];
  const mix = fortnightMix(videos.map((v) => v.objective));
  const usual = (videos[0]?.resources ?? ["sozinho", "em_casa"]) as Resource[];
  const memoryText = memoryLines(memory?.items);
  const platforms = ((profile.platforms ?? []) as string[]).filter((p): p is Platform => ["reels", "tiktok", "shorts", "youtube"].includes(p));

  const task = fortnightTask({ humor: usesHumor({ objective: mix.main, texts: [profile.niche, ...memoryText] }) });
  const prompt = context([
    tag("mistura", [mixText(mix), line("Recursos de sempre", usual.join(", ").replace(/_/g, " "))]),
    tag("video", [line("Plataformas", platformsLabel(platforms.length ? platforms : ["reels", "tiktok"]))]),
    personTag({ niche: profile.niche, memory: memoryText }),
    seenTag((recent ?? []).map((r) => r.title)),
    trendsTag((radar ?? []) as { title: string; what: string }[]),
    formatsTag(usual),
  ]);

  let ideas;
  try {
    ideas = normalizeIdeas(await generateJson({ ...task, prompt }), IDEAS_PER_PERIOD);
  } catch (err) {
    if (err instanceof AiError && err.kind === "limit") {
      return fail("A IA está no limite de uso agora. Tente de novo em alguns minutos.", 503);
    }
    return fail("A IA não respondeu direito desta vez. Tente de novo.", 502);
  }
  if (ideas.length < 3) return fail("A IA não trouxe ideias suficientes desta vez. Tente de novo.", 502);

  const { error } = await supabase.from("creator_ideas").insert(
    ideas.map((i, position) => ({
      title: i.title,
      format_slug: i.format_slug,
      hook: i.hook,
      situation: i.situation,
      payoff: i.payoff,
      why: i.why,
      objective: i.objective ?? mix.main,
      period_start: period,
      position,
    })),
  );
  // Se outra aba gerou ao mesmo tempo, o unique barra a segunda: devolve as que ficaram.
  if (error && error.code !== "23505") return fail("Não foi possível guardar suas ideias.", 500);

  const { data: saved } = await current();
  return NextResponse.json({ period, ideas: saved ?? [] });
}
