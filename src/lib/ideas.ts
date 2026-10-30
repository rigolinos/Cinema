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
  sozinho: "Só eu",
  com_alguem: "Com mais gente",
  em_casa: "Em casa",
  na_rua: "Na rua",
} as const;

// "Com o que você conta" são duas escolhas únicas: quem grava e onde ("Nos dois" marca casa e rua).
export const WHO: Resource[] = ["sozinho", "com_alguem"];
export const PLACES = [
  { label: "Em casa", value: ["em_casa"] },
  { label: "Na rua", value: ["na_rua"] },
  { label: "Nos dois", value: ["em_casa", "na_rua"] },
] as const satisfies readonly { label: string; value: readonly Resource[] }[];

export function withWho(list: readonly Resource[], who: Resource): Resource[] {
  return [who, ...list.filter((r) => !WHO.includes(r))];
}

export function withPlaces(list: readonly Resource[], places: readonly Resource[]): Resource[] {
  return [...list.filter((r) => WHO.includes(r)), ...places];
}

export function samePlaces(list: readonly Resource[], places: readonly Resource[]): boolean {
  const mine = list.filter((r) => !WHO.includes(r));
  return mine.length === places.length && places.every((p) => mine.includes(p));
}

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

export type StartDoor = "zero" | "ideia" | "roteiro";

// Quem chega com o roteiro pronto só diz onde o vídeo sai (define em pé ou deitado e a publicação).
// Duração e quem aparece saem do próprio roteiro; o assunto, do perfil.
export function questionsFor(door: StartDoor): QuestionId[] {
  return door === "roteiro" ? ["platform"] : QUESTION_ORDER;
}

// A primeira pergunta ainda sem resposta; null quando dá para seguir.
// Quem vende conta o produto e o diferencial: sem isso, nenhum prompt faz anúncio bom.
export function nextQuestion(a: Answers, door: StartDoor = "zero"): QuestionId | null {
  if (door === "roteiro") return a.platforms.length === 0 ? "platform" : null;
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

// Sugestões de nicho que o app oferece (com maiúscula, porque aparecem como botões).
export const NICHE_EXAMPLES = [
  "Humor",
  "Treino em casa",
  "Receitas",
  "Maquiagem",
  "Moda",
  "Finanças",
  "Meu negócio",
  "Games",
  "Viagem",
  "Pets",
  "Maternidade",
  "Estudos",
  "Música",
  "Decoração",
  "Tecnologia",
  "Bem-estar",
];

// O nicho no meio de uma frase ("Para quem fala de humor"). Só baixa a inicial das sugestões do app;
// o que a pessoa digitou fica como ela escreveu (nomes como "TikTok" ou "Minecraft" não mudam).
export function nicheInSentence(niche: string): string {
  const n = niche.trim();
  return NICHE_EXAMPLES.includes(n) ? n.charAt(0).toLowerCase() + n.slice(1) : n;
}
