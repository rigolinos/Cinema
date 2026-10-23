import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Baixar meus dados (LGPD, art. 18): uma cópia em JSON de tudo o que é da pessoa.
// Cada consulta passa pelas regras do banco, então só volta o que é dela.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta para baixar seus dados." }, { status: 401 });

  const [profile, videos, ideas, blocks, shots, people, posts, consents, fortnight, acceptances, usage, memory, signals] = await Promise.all([
    supabase.from("creator_profiles").select("*").maybeSingle(),
    supabase.from("videos").select("*").order("created_at"),
    supabase.from("video_ideas").select("*"),
    supabase.from("script_blocks").select("*").order("position"),
    supabase.from("shots").select("*").order("position"),
    supabase.from("video_people").select("id, video_id, name, role, share_enabled, confirmed_at, created_at"),
    supabase.from("video_posts").select("*"),
    supabase.from("image_consents").select("*"),
    supabase.from("creator_ideas").select("*").order("period_start"),
    supabase.from("legal_acceptances").select("document, version, accepted_at"),
    supabase.from("ai_usage").select("day, calls").order("day"),
    supabase.from("creator_memory").select("items, insight, summarized_at").maybeSingle(),
    supabase.from("creator_signals").select("kind, detail, video_id, created_at").order("created_at"),
  ]);

  const failed = [profile, videos, ideas, blocks, shots, people, posts, consents, fortnight, acceptances, usage, memory, signals].find((r) => r.error);
  if (failed?.error) return NextResponse.json({ error: "Não foi possível montar a cópia agora. Tente de novo." }, { status: 500 });

  const byVideo = <T extends { video_id: string }>(rows: T[] | null, id: string) => (rows ?? []).filter((r) => r.video_id === id);

  const body = {
    gerado_em: new Date().toISOString(),
    conta: { id: user.id, email: user.email, criada_em: user.created_at, nome: user.user_metadata?.full_name ?? null },
    perfil: profile.data,
    videos: (videos.data ?? []).map((v) => ({
      ...v,
      ideias: byVideo(ideas.data, v.id),
      roteiro: byVideo(blocks.data, v.id),
      planos: byVideo(shots.data, v.id),
      pessoas: byVideo(people.data, v.id),
      publicacao: byVideo(posts.data, v.id),
    })),
    autorizacoes_de_imagem_recebidas: consents.data,
    ideias_da_quinzena: fortnight.data,
    aceites_legais: acceptances.data,
    uso_da_ia_por_dia: usage.data,
    memoria: { o_que_o_gravai_entendeu: memory.data, sinais_do_uso: signals.data },
  };

  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="gravai-meus-dados-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
