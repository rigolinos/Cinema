import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiMeta } from "./ai";

// Guarda qual modelo respondeu, para saber de onde veio cada texto. Se a tabela ainda não existir
// ou o registro falhar, a resposta da IA segue normalmente.
export function aiLog(supabase: SupabaseClient): (meta: AiMeta) => Promise<void> {
  return async (meta) => {
    await supabase.from("ai_calls").insert({
      task: meta.task.slice(0, 40),
      provider: meta.provider,
      model: meta.model.slice(0, 80),
      attempts: Math.min(Math.max(meta.attempts, 1), 20),
      ms: Math.max(0, Math.round(meta.ms)),
    });
  };
}
