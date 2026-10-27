// "Já tenho o roteiro": o app divide o texto colado em trechos numerados e a IA só diz onde cada um fica.
// Os blocos são remontados com o texto original, então nenhuma palavra muda: garantido por construção.
import type { BlockKind, ScriptBlock } from "./roteiro";

export const PASTE_MAX_CHARS = 4000;
const LONG_LINE = 220;

export type Field = "speech" | "on_screen" | "action";
export interface Segment {
  n: number;
  text: string;
}

// Marca de cena ou de tela dentro da linha: [abre a porta], (cena: …), (tela: …), (texto: …).
const MARK = /(\[[^\]\n]+\]|\((?:cena|a[cç][aã]o|tela|texto|legenda)\s*:[^)\n]*\))/i;

// Uma linha por trecho; marcas viram trechos próprios; linha longa vira frases.
export function segmentScript(raw: string): Segment[] {
  const pieces: string[] = [];
  for (const rawLine of raw.slice(0, PASTE_MAX_CHARS).split(/\r?\n/)) {
    const lineText = rawLine.trim();
    if (!lineText) continue;
    for (const part of lineText.split(MARK)) {
      const p = part.trim();
      if (!p) continue;
      if (p.length > LONG_LINE && !MARK.test(p)) pieces.push(...splitSentences(p));
      else pieces.push(p);
    }
  }
  return pieces.map((text, i) => ({ n: i + 1, text }));
}

function splitSentences(text: string): string[] {
  return (text.match(/[^.!?…]+(?:[.!?…]+["”']?|$)/g) ?? [text]).map((s) => s.trim()).filter(Boolean);
}

// A marca em volta do trecho sai; as palavras ficam.
function unwrap(text: string): string {
  const bracket = text.match(/^\[([\s\S]*)\]$/);
  if (bracket) return bracket[1].trim();
  const paren = text.match(/^\((?:cena|a[cç][aã]o|tela|texto|legenda)\s*:\s*([\s\S]*)\)$/i);
  return paren ? paren[1].trim() : text;
}

const KINDS: BlockKind[] = ["gancho", "contexto", "conteudo", "virada", "chamada"];
const FIELDS: Field[] = ["speech", "on_screen", "action"];

// Remonta os blocos a partir da classificação. Devolve null se a classificação não fecha
// (trecho faltando, repetido ou valor desconhecido): aí entra a divisão simples, sem IA.
export function assembleBlocks(segments: Segment[], raw: unknown): Omit<ScriptBlock, "id">[] | null {
  const list = (raw as { segments?: unknown })?.segments;
  if (!Array.isArray(list) || segments.length === 0) return null;
  const byN = new Map<number, { block: number; kind: BlockKind; field: Field }>();
  for (const item of list) {
    const s = (item ?? {}) as Record<string, unknown>;
    const n = Number(s.n);
    const block = Number(s.block);
    if (!Number.isInteger(n) || !Number.isInteger(block) || block < 1 || byN.has(n)) return null;
    if (!KINDS.includes(s.kind as BlockKind) || !FIELDS.includes(s.field as Field)) return null;
    byN.set(n, { block, kind: s.kind as BlockKind, field: s.field as Field });
  }
  if (segments.some((s) => !byN.has(s.n)) || byN.size !== segments.length) return null;

  const blocks: (Omit<ScriptBlock, "id"> & { key: number })[] = [];
  for (const seg of segments) {
    const c = byN.get(seg.n)!;
    let current = blocks.at(-1);
    if (!current || current.key !== c.block) {
      current = { key: c.block, kind: c.kind, label: null, speech: "", on_screen: "", action: "" };
      blocks.push(current);
    }
    const text = c.field === "speech" ? seg.text : unwrap(seg.text);
    current[c.field] = current[c.field] ? `${current[c.field]}\n${text}` : text;
  }
  if (blocks.length > 12) return null;
  return blocks.map((b) => ({ kind: b.kind, label: b.label, speech: b.speech, on_screen: b.on_screen, action: b.action }));
}

// Sem IA (ou quando a classificação não fecha): parágrafos viram blocos, o primeiro é o gancho.
export function fallbackBlocks(segments: Segment[]): Omit<ScriptBlock, "id">[] {
  const groups: string[][] = [];
  const size = Math.max(1, Math.ceil(segments.length / 6));
  for (let i = 0; i < segments.length; i += i === 0 ? 1 : size) {
    groups.push(segments.slice(i, i === 0 ? 1 : i + size).map((s) => s.text));
  }
  return groups.map((texts, i) => ({
    kind: i === 0 ? "gancho" : "conteudo",
    label: null,
    speech: texts.join("\n"),
    on_screen: "",
    action: "",
  }));
}

// Todas as palavras do texto colado continuam nos blocos, nenhuma a mais? (checagem de sanidade;
// a ordem pode mudar só porque fala, tela e cena ficam em campos separados de cada bloco)
export function sameWords(raw: string, blocks: Pick<ScriptBlock, "speech" | "on_screen" | "action">[]): boolean {
  const words = (t: string) =>
    t
      .replace(/[[\]()]/g, " ")
      .replace(/(cena|a[cç][aã]o|tela|texto|legenda)\s*:/gi, " ")
      .split(/\s+/)
      .filter(Boolean)
      .sort()
      .join(" ");
  return words(raw.slice(0, PASTE_MAX_CHARS)) === words(blocks.map((b) => [b.speech, b.on_screen, b.action].join(" ")).join(" "));
}

export function segmentsText(segments: Segment[]): string {
  return segments.map((s) => `${s.n}. ${s.text}`).join("\n");
}
