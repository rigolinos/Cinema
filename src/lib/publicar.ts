import { PLATFORMS, type Platform } from "./ideas";
import { BLOCK_KINDS, type ScriptBlock } from "./roteiro";

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

// ── IA ──────────────────────────────────────────────────────────────────

export const POST_SYSTEM = `Você é o Gravaí, e ajuda criadores de conteúdo brasileiros a publicar o vídeo que acabaram de gravar.
Escreva em português do Brasil, natural, sem exagero e sem emoji em excesso (no máximo dois na legenda).
Não prometa resultado, não invente números nem fatos e não use hashtags genéricas como #viral ou #fyp.`;

// Como cada plataforma pede o texto.
const PLATFORM_RULES: Record<Platform, string> = {
  reels: "legenda de até 300 caracteres; a primeira linha prende antes do “mais”; 3 a 5 hashtags; sem título",
  tiktok: "legenda curta, de até 150 caracteres, direta e no tom do TikTok; 3 a 5 hashtags; sem título",
  shorts: "título de até 70 caracteres e descrição curta de 1 ou 2 frases; 3 hashtags",
  youtube: "título de até 70 caracteres que diga o que a pessoa ganha assistindo e descrição de 2 ou 3 frases; 3 hashtags",
};

export function postPrompt(ctx: {
  niche: string;
  title: string;
  hook: string;
  platforms: Platform[];
  blocks: Pick<ScriptBlock, "kind" | "label" | "speech">[];
  shots: { description: string }[];
}): string {
  const roteiro = ctx.blocks.map((b) => `- ${b.label || BLOCK_KINDS[b.kind].label}: ${b.speech}`).join("\n");
  const planos = ctx.shots.map((s, i) => `${i + 1}. ${s.description}`).join("\n");
  const platforms: Platform[] = ctx.platforms.length ? ctx.platforms : ["reels"];
  const shape = platforms.map((p) => `"${p}":{"caption":"","title":"","hashtags":[]}`).join(",");
  return `Nicho: ${ctx.niche}
Vídeo: ${ctx.title}
Gancho: "${ctx.hook}"
Onde vai sair: ${platforms.map((p) => PLATFORMS[p]).join(", ")}

Roteiro:
${roteiro}

Planos gravados:
${planos || "(sem lista de planos)"}

Prepare a publicação de cada plataforma, com um texto próprio para cada uma (não copie a mesma legenda):
${platforms.map((p) => `- ${p} (${PLATFORMS[p]}): ${PLATFORM_RULES[p]}.`).join("\n")}
Em todas, a última frase repete a chamada final do roteiro. Hashtags específicas do nicho e do assunto, sem espaço. Onde não há título, deixe "title" vazio.
A capa é a mesma para todas:
- "cover_text": texto da capa com até 5 palavras.
- "cover_idea": qual dos planos gravados usar como capa e por quê, em uma frase.
Responda só com JSON:
{"cover_text":"","cover_idea":"","posts":{${shape}}}`;
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
      caption: clip(p.caption, 2200),
      title: needsTitle(platform) ? clip(p.title, 100) : "",
      hashtags: cleanHashtags(p.hashtags),
      cover_text: clip(r.cover_text, 60),
      cover_idea: clip(r.cover_idea, 300),
    };
    return post.caption ? [post] : [];
  });
}
