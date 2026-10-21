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
  caption: { label: "Legenda", why: "A primeira linha aparece antes do “mais”: ela precisa dar vontade de abrir." },
  title: { label: "Título", why: "No YouTube, o título é o que faz alguém clicar. Diga o que a pessoa ganha assistindo." },
  hashtags: { label: "Hashtags", why: "Poucas e certeiras: ajudam a plataforma a entender sobre o que é o vídeo." },
  cover: { label: "Capa", why: "É a imagem que aparece no seu perfil. Texto curto e um quadro com expressão forte." },
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

export function postPrompt(ctx: {
  niche: string;
  title: string;
  hook: string;
  platform: Platform | null;
  blocks: Pick<ScriptBlock, "kind" | "label" | "speech">[];
  shots: { description: string }[];
}): string {
  const roteiro = ctx.blocks.map((b) => `- ${b.label || BLOCK_KINDS[b.kind].label}: ${b.speech}`).join("\n");
  const planos = ctx.shots.map((s, i) => `${i + 1}. ${s.description}`).join("\n");
  return `Nicho: ${ctx.niche}
Vídeo: ${ctx.title}
Gancho: "${ctx.hook}"
Plataforma: ${ctx.platform ? PLATFORMS[ctx.platform] : "não informada"}

Roteiro:
${roteiro}

Planos gravados:
${planos || "(sem lista de planos)"}

Prepare a publicação:
- "caption": legenda curta (até 300 caracteres). A primeira linha prende, a última repete a chamada final do roteiro.
- "title": ${needsTitle(ctx.platform) ? "título de até 70 caracteres que diga o que a pessoa ganha assistindo" : "deixe vazio"}.
- "hashtags": de 3 a 5, específicas do nicho e do assunto, sem espaço.
- "cover_text": texto da capa com até 5 palavras.
- "cover_idea": qual dos planos gravados usar como capa e por quê, em uma frase.
Responda só com JSON:
{"caption":"","title":"","hashtags":[],"cover_text":"","cover_idea":""}`;
}

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function normalizePost(raw: unknown, platform: Platform | null): Post | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const post: Post = {
    caption: clip(r.caption, 2200),
    title: needsTitle(platform) ? clip(r.title, 100) : "",
    hashtags: cleanHashtags(r.hashtags),
    cover_text: clip(r.cover_text, 60),
    cover_idea: clip(r.cover_idea, 300),
  };
  return post.caption ? post : null;
}
