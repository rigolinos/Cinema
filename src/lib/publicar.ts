import type { Platform } from "./ideas";

export interface Post {
  caption: string; // legenda (Reels, TikTok, Shorts) ou descrição (YouTube)
  title: string; // título: obrigatório no YouTube e no Shorts; vazio nos outros
  hashtags: string[]; // sempre com "#", sem espaço
  cover_text: string; // texto curto para a capa
  cover_idea: string; // qual imagem usar na capa
}

export const EMPTY_POST: Post = { caption: "", title: "", hashtags: [], cover_text: "", cover_idea: "" };

// Explicações para quem está publicando pela primeira vez.
export const POST_PARTS = {
  caption: {
    label: "Legenda",
    what: "O texto que vai junto do vídeo.",
    why: "A primeira linha aparece antes do “mais”: ela precisa dar vontade de abrir.",
  },
  title: {
    label: "Título",
    what: "O nome do vídeo no YouTube e no Shorts.",
    why: "No YouTube, o título é o que faz alguém clicar. Diga o que a pessoa ganha assistindo.",
  },
  hashtags: {
    label: "Hashtags",
    what: "Palavras com # que dizem o assunto do vídeo.",
    why: "Poucas e certeiras: ajudam a plataforma a entender sobre o que é o vídeo.",
  },
  cover: {
    label: "Capa",
    what: "A imagem que aparece no seu perfil e na busca.",
    why: "É a vitrine do vídeo. Texto curto e um quadro com expressão forte.",
  },
} as const;

export function needsTitle(platform: Platform | null): boolean {
  return platform === "youtube" || platform === "shorts";
}

// Hashtag limpa: sem acento perdido no meio, sem espaço, sem "#" repetido, em minúsculas.
export function cleanHashtag(raw: string): string | null {
  const tag = raw
    .trim()
    .replace(/^#+/, "")
    .replace(/[\s.,;:!?'"()[\]{}]+/g, "")
    .toLowerCase()
    .slice(0, 30);
  return /^[\p{L}\p{N}_]{2,}$/u.test(tag) ? `#${tag}` : null;
}

export function cleanHashtags(list: unknown, max = 5): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const tag = cleanHashtag(item);
    if (tag && !out.includes(tag)) out.push(tag);
    if (out.length >= max) break;
  }
  return out;
}

// Texto pronto para colar: legenda e, embaixo, as hashtags.
export function captionWithTags(post: Pick<Post, "caption" | "hashtags">): string {
  return [post.caption.trim(), post.hashtags.join(" ")].filter(Boolean).join("\n\n");
}

// Limite de verdade de cada texto. O prompt pede uns 15% abaixo; se a IA passar daqui,
// o app corta na última frase completa, nunca no meio.
export const CAPTION_MAX: Record<Platform, number> = { reels: 300, tiktok: 150, shorts: 1000, youtube: 1000 };
const TITLE_MAX = 70;

export function cutAtSentence(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  const end = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "), head.lastIndexOf("\n"));
  if (end > max * 0.4) return head.slice(0, end + 1).trim();
  const space = head.lastIndexOf(" ");
  return (space > 0 ? head.slice(0, space) : head).trim();
}

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export type PlatformPost = Post & { platform: Platform };

// Uma publicação por plataforma; a capa é a mesma. Aceita também a resposta antiga, com um texto só.
export function normalizePosts(raw: unknown, platforms: Platform[]): PlatformPost[] {
  const r = (raw ?? {}) as Record<string, unknown>;
  const byPlatform = (r.posts ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const list: Platform[] = platforms.length ? platforms : ["reels"];
  return list.flatMap((platform) => {
    const p = byPlatform[platform] ?? r;
    const post: PlatformPost = {
      platform,
      caption: cutAtSentence(clip(p.caption, 2200), CAPTION_MAX[platform]),
      title: needsTitle(platform) ? cutAtSentence(clip(p.title, 100), TITLE_MAX) : "",
      hashtags: cleanHashtags(p.hashtags),
      cover_text: clip(r.cover_text, 60),
      cover_idea: clip(r.cover_idea, 300),
    };
    return post.caption ? [post] : [];
  });
}
