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
      checks.push({ level: "alerta", text: `Passou do tempo: cerca de ${durationLabel(total)} para ${durationLabel(targetSeconds)}. Corte frases ou peça um bloco mais curto.` });
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
    checks.push({ level: "alerta", text: "O gancho precisa ser o primeiro bloco." });
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
    if (b.action.trim()) lines.push(`CENA: ${b.action.trim()}`);
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

export function normalizeRewrite(raw: unknown): Pick<ScriptBlock, "speech" | "on_screen" | "action"> | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const block = { speech: clip(r.speech, 1500), on_screen: clip(r.on_screen, 300), action: clip(r.action, 500) };
  return block.speech || block.on_screen || block.action ? block : null;
}

// Quem fala neste bloco: a pessoa marcada em Pessoas; gravando sozinho, você para a câmera.
export function speakerOf(
  block: { person_id?: string | null },
  people: { id: string; name: string; role: string }[],
  solo: boolean,
): string | null {
  const person = people.find((p) => p.id === block.person_id);
  if (person) return person.role === "eu" ? "você" : person.name;
  return solo ? "você, para a câmera" : null;
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

// O roteiro como vai no contexto: blocos numerados a partir de 1; o marcado com >>> é o que muda.
export function scriptForPrompt(blocks: Pick<ScriptBlock, "kind" | "label" | "speech" | "on_screen" | "action">[], marked?: number): string {
  return blocks
    .map((b, i) => `${i === marked ? ">>> " : ""}${i + 1}. [${b.kind}${b.label ? ` · ${b.label}` : ""}] FALA: ${b.speech} | TELA: ${b.on_screen} | CENA: ${b.action}`)
    .join("\n");
}
