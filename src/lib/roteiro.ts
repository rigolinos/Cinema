import { findFormat } from "./formats";
import { OBJECTIVES, PLATFORMS, RESOURCES, durationLabel, type Objective, type Platform, type Resource } from "./ideas";

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
// Bloco sem fala (só imagem ou texto na tela) ainda ocupa tempo.
const MIN_BLOCK_SECONDS = 1.5;
// Um gancho que cabe em 3 segundos tem até umas 10 palavras.
export const HOOK_MAX_WORDS = 10;

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
export function checkScript(blocks: ScriptBlock[], targetSeconds: number | null): ScriptCheck[] {
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

  if (!blocks.some((b) => b.kind === "chamada")) {
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

export const SCRIPT_SYSTEM = `Você é o Gravaí, um roteirista que escreve junto com criadores de conteúdo brasileiros.
Escreva em português do Brasil, falado, natural, como a pessoa falaria olhando para a câmera.
Frases curtas. Nada de emoji, hashtag ou jargão solto.
Cada bloco separa: "speech" (o que a pessoa fala), "on_screen" (texto curto que aparece na tela, pode ficar vazio) e "action" (o que acontece em cena, em uma frase, pode ficar vazio).
Tudo precisa ser gravável com os recursos da pessoa. Não invente números, estudos ou fatos.
Escreva a cena de verdade, nunca uma descrição dela: se há virada, piada ou final inesperado, o roteiro traz a fala e a ação exatas da virada, não "aqui entra o final inesperado".`;

export interface ScriptBrief {
  niche: string;
  title: string;
  hook: string;
  formatSlug: string | null;
  objective: Objective | null;
  platform: Platform | null;
  durationS: number;
  resources: Resource[];
}

function briefText(b: ScriptBrief): string {
  const format = findFormat(b.formatSlug);
  return [
    `Nicho: ${b.niche}`,
    `Ideia: ${b.title}`,
    `Gancho escolhido: "${b.hook}"`,
    format ? `Formato: ${format.name}. Estrutura: ${format.structure.join(" → ")}` : "",
    b.objective ? `Objetivo: ${OBJECTIVES[b.objective]}` : "",
    b.platform ? `Plataforma: ${PLATFORMS[b.platform]}` : "",
    `Duração: cerca de ${durationLabel(b.durationS)}`,
    `Recursos: ${b.resources.map((r) => RESOURCES[r]).join(", ") || "não informado"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// Orçamento de palavras faladas: um pouco abaixo do tempo, porque pausa e cena também contam.
export function maxWords(durationS: number): number {
  return Math.round(durationS * WORDS_PER_SECOND * 0.9);
}

export function draftPrompt(b: ScriptBrief): string {
  return `${briefText(b)}

Escreva o roteiro completo em blocos, seguindo a estrutura do formato.
Limite rígido: somando todas as falas, NO MÁXIMO ${maxWords(b.durationS)} palavras. Conte antes de responder; se passar, corte.
O primeiro bloco é o gancho (kind "gancho") e usa o gancho escolhido, com até ${HOOK_MAX_WORDS} palavras (se ele for maior, encurte sem perder a ideia).
O último bloco é a chamada final (kind "chamada"), pedindo uma coisa só.
Os blocos do meio usam kind "contexto", "conteudo" ou "virada", com um "label" curto (ex.: "Erro 1").
Responda só com JSON:
{"blocks":[{"kind":"gancho","label":"","speech":"","on_screen":"","action":""}]}`;
}

export function rewritePrompt(b: ScriptBrief, blocks: ScriptBlock[], index: number, request: string): string {
  const roteiro = blocks
    .map((x, i) => `${i === index ? ">>> " : ""}${i + 1}. [${x.kind}${x.label ? " · " + x.label : ""}] FALA: ${x.speech} | TELA: ${x.on_screen} | CENA: ${x.action}`)
    .join("\n");
  return `${briefText(b)}

Roteiro atual (o bloco marcado com >>> é o que vai mudar):
${roteiro}

Reescreva só o bloco ${index + 1}. Pedido da pessoa: ${request}
Mantenha o papel do bloco no roteiro e o tom dos outros blocos.
Responda só com JSON: {"speech":"","on_screen":"","action":""}`;
}

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
