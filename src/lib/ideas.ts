import { FORMATS, findFormat } from "./formats";

export const OBJECTIVES = {
  crescer: "Crescer",
  vender: "Vender",
  divertir: "Divertir",
  ensinar: "Ensinar",
} as const;

export const PLATFORMS = {
  reels: "Reels",
  tiktok: "TikTok",
  shorts: "Shorts",
  youtube: "YouTube",
} as const;

export const RESOURCES = {
  sozinho: "Sozinho",
  com_alguem: "Com alguém",
  em_casa: "Em casa",
  na_rua: "Na rua",
} as const;

export const DURATIONS = [15, 30, 60, 180] as const;

export type Objective = keyof typeof OBJECTIVES;
export type Platform = keyof typeof PLATFORMS;
export type Resource = keyof typeof RESOURCES;

export interface IdeaBrief {
  niche: string;
  objective: Objective;
  platform: Platform;
  durationS: number;
  resources: Resource[];
  request?: string; // "outras", "mais engraçado" ou o que a pessoa escreveu
  previousTitles?: string[]; // para não repetir
  trends?: { title: string; what: string }[]; // radar da semana, escolhido pela equipe
}

export interface Idea {
  title: string;
  format_slug: string | null;
  hook: string;
  why: string;
}

export type QuestionId = "niche" | "objective" | "platform" | "duration" | "resources";

export const QUESTION_ORDER: QuestionId[] = ["niche", "objective", "platform", "duration", "resources"];

export interface Answers {
  niche: string | null;
  objective: Objective | null;
  platform: Platform | null;
  durationS: number | null;
  resources: Resource[];
}

// A primeira pergunta ainda sem resposta; null quando dá para pedir ideias.
export function nextQuestion(a: Answers): QuestionId | null {
  if (!a.niche?.trim()) return "niche";
  if (!a.objective) return "objective";
  if (!a.platform) return "platform";
  if (!a.durationS) return "duration";
  if (a.resources.length === 0) return "resources";
  return null;
}

export function durationLabel(seconds: number): string {
  return seconds < 60 ? `${seconds} s` : seconds % 60 === 0 ? `${seconds / 60} min` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

export const IDEA_SYSTEM = `Você é o Gravaí, um parceiro de set que ajuda criadores de conteúdo brasileiros a ter ideias de vídeos curtos.
Fale português do Brasil, direto e moderno, sem jargão solto e sem emoji.
Toda ideia precisa ser gravável com os recursos que a pessoa tem.
O gancho é o que a pessoa fala ou mostra nos 3 primeiros segundos: tem que prender quem está rolando o feed e ter no máximo 10 palavras.
Não invente números, estudos ou fatos sobre pessoas reais.`;

export function ideaPrompt(b: IdeaBrief): string {
  const sozinho = b.resources.includes("sozinho") && !b.resources.includes("com_alguem");
  const formats = FORMATS.filter((f) => !(sozinho && f.needsSomeone))
    .map((f) => `- ${f.slug}: ${f.name}. ${f.summary} Estrutura: ${f.structure.join(" → ")}.`)
    .join("\n");

  return `Nicho do criador: ${b.niche}
Objetivo do vídeo: ${OBJECTIVES[b.objective]}
Onde vai postar: ${PLATFORMS[b.platform]}, com cerca de ${durationLabel(b.durationS)}
Recursos: ${b.resources.map((r) => RESOURCES[r]).join(", ") || "não informado"}
${b.previousTitles?.length ? `Ideias que a pessoa já viu (não repita): ${b.previousTitles.join(" | ")}\n` : ""}${b.request ? `Pedido da pessoa: ${b.request}\n` : ""}${b.trends?.length ? `Trends desta semana (use no máximo uma, e só se combinar com o nicho): ${b.trends.map((t) => `${t.title}: ${t.what}`).join(" | ")}\n` : ""}
Formatos que você pode usar (use o slug):
${formats}

Sugira 3 ideias diferentes entre si, cada uma num formato. Responda só com JSON:
{"ideas":[{"title":"título curto da ideia","format_slug":"slug de um formato acima","hook":"a frase exata do gancho","why":"por que funciona, em uma frase"}]}`;
}

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

// Confere a resposta da IA: só ideias completas, formato conhecido, no máximo 5.
export function normalizeIdeas(raw: unknown, max = 5): Idea[] {
  const list = (raw as { ideas?: unknown })?.ideas;
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      const i = (item ?? {}) as Record<string, unknown>;
      const slug = clip(i.format_slug, 60);
      return {
        title: clip(i.title, 140),
        format_slug: findFormat(slug) ? slug : null,
        hook: clip(i.hook, 300).replace(/^["“]|["”]$/g, ""),
        why: clip(i.why, 400),
      };
    })
    .filter((i) => i.title && i.hook)
    .slice(0, max);
}
