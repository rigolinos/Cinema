import { firstNameOf } from "./pessoas";
import { durationLabel } from "./ideas";

export type BlockKind = "gancho" | "contexto" | "conteudo" | "virada" | "chamada";

export const BLOCK_KINDS: Record<BlockKind, { label: string; hint: string }> = {
  gancho: { label: "Gancho", hint: "Os 3 primeiros segundos: é aqui que a pessoa decide se fica." },
  contexto: { label: "Contexto", hint: "Situa quem assiste em uma ou duas frases." },
  conteudo: { label: "Conteúdo", hint: "O que você prometeu no gancho." },
  virada: { label: "Virada", hint: "A surpresa, o resultado ou a lição que fecha a ideia." },
  chamada: { label: "Chamada final", hint: "Peça uma coisa só: seguir, comentar, salvar ou comprar." },
};

export interface ScriptBlock {
  id?: string;
  kind: BlockKind;
  label: string | null;
  speech: string; // o que a pessoa fala
  on_screen: string; // texto que aparece na tela
  action: string; // o que acontece em cena
}

// Fala em português, num vídeo curto: por volta de 2,6 palavras por segundo.
export const WORDS_PER_SECOND = 2.6;

// Limite de palavras de fala do roteiro todo, com 10% de folga para respirar.
export function maxWords(durationS: number): number {
  return Math.round(durationS * WORDS_PER_SECOND * 0.9);
}
// Bloco sem fala (só imagem ou texto na tela) ainda ocupa tempo.
const MIN_BLOCK_SECONDS = 1.5;
// Um gancho que cabe em 3 segundos tem até umas 12 palavras (o mesmo número em todos os prompts).
export const HOOK_MAX_WORDS = 12;

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function blockSeconds(b: Pick<ScriptBlock, "speech">): number {
  return Math.max(MIN_BLOCK_SECONDS, wordCount(b.speech) / WORDS_PER_SECOND);
}

// Início e fim de cada bloco, em segundos inteiros, para mostrar "0–3 s".
export function timeline(blocks: Pick<ScriptBlock, "speech">[]): { start: number; end: number }[] {
  let t = 0;
  return blocks.map((b) => {
    const start = t;
    t += blockSeconds(b);
    return { start: Math.round(start), end: Math.max(Math.round(t), Math.round(start) + 1) };
  });
}

export function totalSeconds(blocks: Pick<ScriptBlock, "speech">[]): number {
  return Math.round(blocks.reduce((sum, b) => sum + blockSeconds(b), 0));
}

export interface ScriptCheck {
  level: "ok" | "alerta";
  text: string;
}

// Avisos que ajudam sem travar: tempo, gancho e chamada final.
export function checkScript(blocks: ScriptBlock[], targetSeconds: number | null, objective?: string | null): ScriptCheck[] {
  const checks: ScriptCheck[] = [];
  const total = totalSeconds(blocks);

  if (targetSeconds) {
    if (total > targetSeconds * 1.2) {
      checks.push({ level: "alerta", text: `Passou do tempo: cerca de ${durationLabel(total)} para ${durationLabel(targetSeconds)}. Corte frases ou peça uma parte mais curta.` });
    } else if (total < targetSeconds * 0.5) {
      checks.push({ level: "alerta", text: `Está curto: cerca de ${durationLabel(total)} para ${durationLabel(targetSeconds)}. Dá para desenvolver mais o conteúdo.` });
    } else {
      checks.push({ level: "ok", text: `Cerca de ${durationLabel(total)}, dentro do tempo.` });
    }
  }

  const hook = blocks.find((b) => b.kind === "gancho");
  if (!hook) {
    checks.push({ level: "alerta", text: "Falta o gancho: sem ele, a pessoa rola o feed antes de entender o vídeo." });
  } else if (blocks[0]?.kind !== "gancho") {
    checks.push({ level: "alerta", text: "O gancho precisa ser a primeira cena." });
  } else if (wordCount(hook.speech) > HOOK_MAX_WORDS) {
    checks.push({ level: "alerta", text: `Gancho longo (${wordCount(hook.speech)} palavras). Para caber em 3 segundos, fique em até ${HOOK_MAX_WORDS}.` });
  }

  // Em Divertir a chamada é opcional: depois da virada, ela pode matar a risada.
  if (objective !== "divertir" && !blocks.some((b) => b.kind === "chamada")) {
    checks.push({ level: "alerta", text: "Sem chamada final: diga o que a pessoa faz depois de assistir." });
  }

  return checks;
}

// Roteiro em texto, para copiar e mandar para alguém.
export function scriptAsText(title: string, blocks: ScriptBlock[]): string {
  const times = timeline(blocks);
  const parts = blocks.map((b, i) => {
    const lines = [`[${times[i].start}–${times[i].end} s] ${b.label || BLOCK_KINDS[b.kind].label}`];
    if (b.speech.trim()) lines.push(`FALA: ${b.speech.trim()}`);
    if (b.on_screen.trim()) lines.push(`NA TELA: ${b.on_screen.trim()}`);
    if (b.action.trim()) lines.push(`O QUE ACONTECE: ${b.action.trim()}`);
    return lines.join("\n");
  });
  return [title.toUpperCase(), ...parts].join("\n\n");
}

// ── IA ──────────────────────────────────────────────────────────────────

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().replace(/[ \t]+/g, " ").slice(0, max) : "";
}

const KINDS = Object.keys(BLOCK_KINDS) as BlockKind[];

// Confere o rascunho da IA: tipos válidos, gancho primeiro, chamada no fim, no máximo 12 blocos.
export function normalizeDraft(raw: unknown): ScriptBlock[] {
  const list = (raw as { blocks?: unknown })?.blocks;
  if (!Array.isArray(list)) return [];
  const blocks = list
    .map((item) => {
      const i = (item ?? {}) as Record<string, unknown>;
      const kind = KINDS.includes(i.kind as BlockKind) ? (i.kind as BlockKind) : "conteudo";
      return {
        kind,
        label: clip(i.label, 80) || null,
        speech: clip(i.speech, 1500),
        on_screen: clip(i.on_screen, 300),
        action: clip(i.action, 500),
      };
    })
    .filter((b) => b.speech || b.on_screen || b.action)
    .slice(0, 12);

  if (blocks.length > 0 && blocks[0].kind !== "gancho") {
    const hookAt = blocks.findIndex((b) => b.kind === "gancho");
    if (hookAt > 0) blocks.unshift(...blocks.splice(hookAt, 1));
  }
  return blocks;
}

// ── Acabamento do que a IA escreveu ──────────────────────────────────────────
// Só no texto que a IA escreveu: o roteiro que a pessoa colou nunca passa por aqui.
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const word = (w: string, flags = "gu") => new RegExp(`(?<![\\p{L}])${w}(?![\\p{L}])`, flags);

// "natasha" vira "Natasha": o nome de quem está no vídeo com a maiúscula certa.
export function capitalizeNames(text: string, names: readonly string[]): string {
  return names.reduce((t, name) => {
    const lower = name.toLocaleLowerCase("pt-BR");
    return lower === name ? t : t.replace(word(escapeRe(lower)), name);
  }, text);
}

// Texto da tela que na verdade descreve a cena ("Hambúrguer na mão"). Texto em maiúsculas,
// entre aspas ou começando com "POV" é texto de tela de verdade e fica onde está.
const STAGE = word("(n[ao]s? m[ãa]os?|close|c[âa]mera|em cena|aparece|mostra|segura|pega|olha|entra|sai|coloca|abre)", "iu");
export function isStageNote(text: string): boolean {
  const t = text.trim();
  if (!t || /^pov\b/i.test(t) || /["“”]/.test(t)) return false;
  const letters = t.replace(/[^\p{L}]/gu, "");
  if (letters && letters === letters.toLocaleUpperCase("pt-BR")) return false;
  return STAGE.test(t);
}

// Nomes com maiúscula, "você" na ação vira o nome de quem cria (quando aparece), e descrição de cena
// que caiu no texto da tela volta para a ação. Na fala, "você" fica: é com quem assiste que se fala.
export function polishBlock<B extends Pick<ScriptBlock, "speech" | "on_screen" | "action">>(block: B, cast: { names: readonly string[]; me: string | null }): B {
  let action = capitalizeNames(block.action, cast.names);
  if (cast.me) action = action.replace(word("[Vv]ocê"), cast.me);
  let onScreen = capitalizeNames(block.on_screen, cast.names);
  if (isStageNote(onScreen)) {
    action = [action.trim().replace(/[.\s]+$/, ""), onScreen.trim()].filter(Boolean).join(". ");
    onScreen = "";
  }
  return { ...block, speech: capitalizeNames(block.speech, cast.names), on_screen: onScreen, action };
}

// A história que a IA conta antes do roteiro. Os limites são os das colunas do vídeo.
export function normalizeStory(raw: unknown): { hook: string; situation: string; payoff: string } | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  // Passou do limite: corta na última frase inteira, para a história não terminar no meio de uma palavra.
  const whole = (value: unknown, max: number) => {
    const text = clip(value, max);
    if (typeof value !== "string" || value.trim().length <= max) return text;
    const end = Math.max(text.lastIndexOf(". "), text.lastIndexOf("! "), text.lastIndexOf("? "));
    return end > 0 ? text.slice(0, end + 1) : text;
  };
  const story = { hook: whole(r.hook, 300), situation: whole(r.situation, 600), payoff: whole(r.payoff, 600) };
  return story.hook && story.situation ? story : null;
}

// ── A história em texto corrido ────────────────────────────────────────────
// Na tela, a história é um texto só, sem títulos. Por dentro, o roteiro ainda usa começo, meio e fim:
// o primeiro parágrafo é o começo, o último é o fim e o que está no meio é o meio.
export type StoryParts = { hook: string; situation: string; payoff: string };
export const STORY_LIMITS = { hook: 300, situation: 600, payoff: 600 } as const;

export function storyText(story: StoryParts): string {
  return [story.hook, story.situation, story.payoff].map((p) => p.trim()).filter(Boolean).join("\n\n");
}

const sentences = (text: string) => text.match(/[^.!?…]+[.!?…]+["”»)]?|[^.!?…]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [text.trim()];

// Corta no fim de uma frase para caber no limite; o que sobra vai para a próxima parte.
function fit(text: string, max: number): [string, string] {
  if (text.length <= max) return [text, ""];
  let kept = "";
  for (const s of sentences(text)) {
    const next = kept ? `${kept} ${s}` : s;
    if (next.length > max) break;
    kept = next;
  }
  if (!kept) kept = text.slice(0, max).replace(/\s+\S*$/, "");
  return [kept, text.slice(kept.length).trim()];
}

export function storyFromText(text: string): StoryParts {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (paragraphs.length === 0) return { hook: "", situation: "", payoff: "" };
  let hook: string;
  let middle: string;
  let payoff = "";
  if (paragraphs.length === 1) {
    // Um parágrafo só: a primeira frase é o começo, e o resto segue junto.
    const [first, ...rest] = sentences(paragraphs[0]);
    hook = first;
    middle = rest.join(" ");
  } else if (paragraphs.length === 2) {
    [hook, middle] = paragraphs;
  } else {
    hook = paragraphs[0];
    middle = paragraphs.slice(1, -1).join("\n\n");
    payoff = paragraphs[paragraphs.length - 1];
  }
  const [h, hookRest] = fit(hook, STORY_LIMITS.hook);
  const [s, middleRest] = fit([hookRest, middle].filter(Boolean).join(" "), STORY_LIMITS.situation);
  const [p] = fit([middleRest, payoff].filter(Boolean).join(" "), STORY_LIMITS.payoff);
  return { hook: h, situation: s, payoff: p };
}

export function normalizeRewrite(raw: unknown): Pick<ScriptBlock, "speech" | "on_screen" | "action"> | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const block = { speech: clip(r.speech, 1500), on_screen: clip(r.on_screen, 300), action: clip(r.action, 500) };
  return block.speech || block.on_screen || block.action ? block : null;
}

// Quem fala neste bloco: a pessoa marcada em Pessoas; gravando sozinho, a própria pessoa. Pelo nome, sempre que o app souber.
export function speakerOf(
  block: { person_id?: string | null },
  people: { id: string; name: string; role: string }[],
  solo: boolean,
  creator?: string | null, // nome do perfil, para quando quem criou o vídeo ainda não está em Pessoas
): string | null {
  const person = people.find((p) => p.id === block.person_id);
  const named = (p: { name: string }) => (p.name.trim() && p.name !== "Eu" ? firstNameOf(p.name) : "você");
  if (person) return person.role === "eu" ? named(person) : person.name;
  if (!solo) return null;
  const me = people.find((p) => p.role === "eu");
  if (me) return named(me);
  return creator?.trim() ? firstNameOf(creator) : "você";
}

// ── Sugestões por bloco (no roteiro que a pessoa trouxe ou editou) ─────────
export interface Suggestion {
  block: number; // a partir de 1, como no pedido
  speech: string;
  on_screen: string;
  action: string;
  reason: string;
}

// No máximo 4 sugestões e 1 por bloco, só em blocos que existem e só se mudarem algo.
export function normalizeSuggestions(raw: unknown, blocks: Pick<ScriptBlock, "speech" | "on_screen" | "action">[]): { note: string; suggestions: Suggestion[] } {
  const r = (raw ?? {}) as { note?: unknown; suggestions?: unknown };
  const seen = new Set<number>();
  const suggestions: Suggestion[] = [];
  for (const item of Array.isArray(r.suggestions) ? r.suggestions : []) {
    const s = (item ?? {}) as Record<string, unknown>;
    const block = Number(s.block);
    const original = blocks[block - 1];
    if (!Number.isInteger(block) || !original || seen.has(block)) continue;
    const next = { speech: clip(s.speech, 1500), on_screen: clip(s.on_screen, 300), action: clip(s.action, 500) };
    const reason = clip(s.reason, 300);
    const changed = next.speech !== original.speech.trim() || next.on_screen !== original.on_screen.trim() || next.action !== original.action.trim();
    if (!reason || !(next.speech || next.on_screen || next.action) || !changed) continue;
    seen.add(block);
    suggestions.push({ block, ...next, reason });
    if (suggestions.length === 4) break;
  }
  return { note: clip(r.note, 400), suggestions };
}

// O roteiro com quem fala escrito na fala, para a IA saber quem precisa aparecer nos planos.
export function withSpeakers<B extends { speech: string; person_id?: string | null }>(blocks: B[], people: { id: string; name: string; role: string }[], solo: boolean, creator?: string | null): B[] {
  return blocks.map((b) => {
    const who = speakerOf(b, people, solo, creator);
    if (!who || !b.speech.trim() || /^[^\n:]{1,30}:/.test(b.speech.trim())) return b;
    return { ...b, speech: `${who}: ${b.speech}` };
  });
}

// O roteiro como vai no contexto: blocos numerados a partir de 1; o marcado com >>> é o que muda.
export function scriptForPrompt(blocks: Pick<ScriptBlock, "kind" | "label" | "speech" | "on_screen" | "action">[], marked?: number): string {
  return blocks
    .map((b, i) => `${i === marked ? ">>> " : ""}${i + 1}. [${b.kind}${b.label ? ` · ${b.label}` : ""}] FALA: ${b.speech} | TELA: ${b.on_screen} | CENA: ${b.action}`)
    .join("\n");
}
