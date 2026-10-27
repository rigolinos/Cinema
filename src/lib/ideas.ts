import { findFormat } from "./formats";

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

const VERTICAL: Platform[] = ["reels", "tiktok", "shorts"];

// O mesmo vídeo pode sair em várias plataformas. A principal decide o formato da gravação:
// se houver alguma vertical, grava em pé (no YouTube ele entra como Short).
export function mainPlatform(list: readonly Platform[]): Platform | null {
  return list.find((p) => VERTICAL.includes(p)) ?? list[0] ?? null;
}

// Junta YouTube (deitado) com plataformas em pé.
export function mixesOrientation(list: readonly Platform[]): boolean {
  return list.includes("youtube") && list.some((p) => VERTICAL.includes(p));
}

// "Reels", "Reels e TikTok", "Reels, TikTok e YouTube".
export function platformsLabel(list: readonly Platform[]): string {
  const names = list.map((p) => PLATFORMS[p]);
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

// Plataformas do vídeo, mesmo de vídeos antigos que só têm a principal.
export function videoPlatforms(v: { platform: Platform | null; platforms?: readonly Platform[] | null }): Platform[] {
  return v.platforms?.length ? [...v.platforms] : v.platform ? [v.platform] : [];
}

export interface Idea {
  title: string;
  format_slug: string | null;
  hook: string;
  situation: string; // a cena, em 1 ou 2 frases
  payoff: string; // o desfecho exato: a virada, o resultado, a dica ou a oferta
  why: string;
  objective?: Objective; // só nas ideias da quinzena, que misturam objetivos
}

export type QuestionId = "niche" | "objective" | "produto" | "platform" | "duration" | "resources";

export const QUESTION_ORDER: QuestionId[] = ["niche", "objective", "produto", "platform", "duration", "resources"];

export interface Answers {
  niche: string | null;
  objective: Objective | null;
  product?: string | null; // só no objetivo Vender: o que vende
  productEdge?: string | null; // e por que comprar dali
  platforms: Platform[];
  durationS: number | null;
  resources: Resource[];
}

// A primeira pergunta ainda sem resposta; null quando dá para pedir ideias.
// Quem vende conta o produto e o diferencial: sem isso, nenhum prompt faz anúncio bom.
export function nextQuestion(a: Answers): QuestionId | null {
  if (!a.niche?.trim()) return "niche";
  if (!a.objective) return "objective";
  if (a.objective === "vender" && (!a.product?.trim() || !a.productEdge?.trim())) return "produto";
  if (a.platforms.length === 0) return "platform";
  if (!a.durationS) return "duration";
  if (a.resources.length === 0) return "resources";
  return null;
}

export function durationLabel(seconds: number): string {
  return seconds < 60 ? `${seconds} s` : seconds % 60 === 0 ? `${seconds / 60} min` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

// Confere a resposta da IA: só ideias completas, formato conhecido, no máximo 5.
// Gancho que passa muito do limite (12 palavras) é sinal de resposta quebrada: a ideia sai.
export function normalizeIdeas(raw: unknown, max = 5): Idea[] {
  const list = (raw as { ideas?: unknown })?.ideas;
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      const i = (item ?? {}) as Record<string, unknown>;
      const slug = clip(i.format_slug, 60);
      const objective = typeof i.objective === "string" && i.objective in OBJECTIVES ? (i.objective as Objective) : undefined;
      return {
        title: clip(i.title, 140),
        format_slug: findFormat(slug) ? slug : null,
        hook: clip(i.hook, 300).replace(/^["“]|["”]$/g, ""),
        situation: clip(i.situation, 600),
        payoff: clip(i.payoff, 600),
        why: clip(i.why, 400),
        ...(objective ? { objective } : {}),
      };
    })
    .filter((i) => i.title && i.hook && i.hook.split(/\s+/).length <= 20)
    .slice(0, max);
}

// Botões rápidos: mudam conforme o objetivo ("Mais engraçado" não serve para quem vende).
export const QUICK_IDEAS: Record<Objective, string[]> = {
  divertir: ["Outras ideias", "Mais engraçado", "Mais absurdo", "Mais fácil de gravar"],
  vender: ["Outras ideias", "Mostrar o produto antes", "Com prova", "Mais fácil de gravar"],
  ensinar: ["Outras ideias", "Mais simples", "Com exemplo", "Mais fácil de gravar"],
  crescer: ["Outras ideias", "Virar série", "Mais polêmico", "Mais fácil de gravar"],
};

export const QUICK_BLOCK: Record<Objective, string[]> = {
  divertir: ["Mais curto", "Mais engraçado", "Virada mais forte"],
  vender: ["Mais curto", "Mais direto", "Chamada mais clara"],
  ensinar: ["Mais curto", "Mais simples", "Mostrar em vez de falar"],
  crescer: ["Mais curto", "Mais direto", "Puxar comentário"],
};
