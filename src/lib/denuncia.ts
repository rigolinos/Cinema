// Denunciar uma resposta da IA: os motivos que a pessoa escolhe e o que vai para o banco.

export type ReportArea = "ideia" | "roteiro" | "publicar" | "outro";
export type ReportReason = "ofensivo" | "perigoso" | "errado" | "outro";

export const REPORT_REASONS: [ReportReason, string][] = [
  ["ofensivo", "Ofensivo ou preconceituoso"],
  ["perigoso", "Perigoso ou ilegal"],
  ["errado", "Errado ou sem sentido"],
  ["outro", "Outro motivo"],
];

export interface ReportInput {
  area: ReportArea;
  reason: ReportReason;
  content: string;
  note: string;
  refId?: string | null;
}

// Corta nos limites da tabela; "outro" sem explicação não diz nada para quem revisa.
export function reportRow(input: ReportInput): { area: ReportArea; reason: ReportReason; content: string; note: string; ref_id: string | null } | null {
  const note = input.note.trim().slice(0, 500);
  if (input.reason === "outro" && !note) return null;
  return { area: input.area, reason: input.reason, content: input.content.trim().slice(0, 2000), note, ref_id: input.refId ?? null };
}
