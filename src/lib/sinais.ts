import { createClient } from "@/lib/supabase/client";
import { signalDetail, type SignalKind } from "@/lib/memoria";

// Guarda um sinal do uso para a memória do criador. Nunca trava a tela: se falhar, segue a vida.
export function logSignal(kind: SignalKind, detail: Record<string, unknown> = {}, videoId?: string | null) {
  createClient()
    .from("creator_signals")
    .insert({ kind, detail: signalDetail(detail), video_id: videoId ?? null })
    .then(
      () => undefined,
      () => undefined,
    );
}
