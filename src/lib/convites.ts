import type { VideoStage } from "@/types/database";

// Convite salvo na conta: o vídeo de outra pessoa na lista de quem foi chamado.
export interface InviteRow {
  token: string;
  title: string;
  duration_s: number | null;
  stage: VideoStage;
  published_at: string | null;
  updated_at: string;
}

// Como o convite está para quem abriu o link. "owner" é quem criou o vídeo.
export type InviteState = "anon" | "free" | "mine" | "taken" | "owner";

export type MixedRow<V> = { kind: "video"; row: V } | { kind: "invite"; row: InviteRow };

// Vídeos e convites na mesma lista: o que mexeu por último vem primeiro.
export function withInvites<V extends { updated_at: string }>(videos: V[], invites: InviteRow[]): MixedRow<V>[] {
  const mixed: MixedRow<V>[] = [...videos.map((row) => ({ kind: "video" as const, row })), ...invites.map((row) => ({ kind: "invite" as const, row }))];
  return mixed.sort((a, b) => b.row.updated_at.localeCompare(a.row.updated_at));
}
