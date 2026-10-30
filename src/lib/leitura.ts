// "Já tenho o roteiro", em duas chamadas. Na primeira, a IA lê o texto colado e faz para si mesma
// uma versão estruturada (a leitura): quem fala, o que é fala, tela, ação e indicação de câmera,
// com a ortografia corrigida e o jeito da pessoa mantido. Na segunda, monta as partes a partir dela.
// A leitura fica guardada no vídeo e ajuda os outros passos (sugestões, planos, publicação).
import type { BlockKind, ScriptBlock } from "./roteiro";
import type { Segment } from "./organizar";

export type ReadingKind = "fala" | "tela" | "acao" | "camera";
export const READING_KINDS: ReadingKind[] = ["fala", "tela", "acao", "camera"];

export interface ReadingItem {
  n: number;
  kind: ReadingKind;
  speaker: string | null; // só em fala, quando o roteiro diz quem fala
  text: string;
}

export interface Reading {
  summary: string; // do que o vídeo trata, em 1 ou 2 frases
  tone: string; // ex.: "humor, fofoca de escola"
  people: string[]; // quem aparece ou fala, como a pessoa escreveu
  items: ReadingItem[]; // o roteiro inteiro, na ordem, uma coisa por item
}

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/[ \t]+/g, " ").slice(0, max) : "");

export function normalizeReading(raw: unknown): Reading | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const items: ReadingItem[] = [];
  for (const it of Array.isArray(r.items) ? r.items : []) {
    const x = (it ?? {}) as Record<string, unknown>;
    const kind = READING_KINDS.includes(x.kind as ReadingKind) ? (x.kind as ReadingKind) : "fala";
    const text = clip(x.text, 1200);
    if (!text) continue;
    const speaker = kind === "fala" ? clip(x.speaker, 40) || null : null;
    items.push({ n: items.length + 1, kind, speaker, text });
  }
  if (items.length === 0 || items.length > 80) return null;
  const people = (Array.isArray(r.people) ? r.people : []).map((p) => clip(p, 40)).filter(Boolean).slice(0, 12);
  return { summary: clip(r.summary, 400), tone: clip(r.tone, 120), people: [...new Set(people)], items };
}

// Corrigir é trocar poucas letras; reescrever é trocar o texto. A leitura só vale se as palavras
// dela vêm quase todas do texto colado (ou são parecidas com alguma de lá) e o tamanho bate.
const plain = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .match(/[\p{L}\p{N}]+/gu) ?? [];

function close(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 2) return false;
  // distância de edição até 2, o bastante para "q"→"que", "voce"→"você", letra trocada
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev.splice(0, prev.length, ...cur);
  }
  return prev[b.length] <= 2;
}

export function faithful(reading: Reading, pasted: string): boolean {
  const source = plain(pasted);
  const known = new Set(source);
  const words = reading.items.flatMap((i) => plain(`${i.speaker ?? ""} ${i.text}`));
  if (source.length === 0 || words.length < source.length * 0.75 || words.length > source.length * 1.3) return false;
  const strange = words.filter((w) => !known.has(w) && !source.some((s) => close(w, s))).length;
  return strange <= Math.max(2, words.length * 0.12);
}

// Mais de uma pessoa falando: cada fala leva o nome na frente, como o resto do app já espera.
function talkers(reading: Reading): number {
  return new Set(reading.items.filter((i) => i.kind === "fala" && i.speaker).map((i) => i.speaker!.toLowerCase())).size;
}

function itemText(item: ReadingItem, named: boolean): string {
  if (item.kind === "camera") return `(${item.text})`;
  return item.kind === "fala" && named && item.speaker ? `${item.speaker}: ${item.text}` : item.text;
}

// O que a segunda chamada recebe: os itens numerados, com o tipo e quem fala.
export function readingSegments(reading: Reading): string {
  return reading.items
    .map((i) => `${i.n}. [${i.kind}${i.speaker ? ` · ${i.speaker}` : ""}] ${i.text}`)
    .join("\n");
}

const KINDS: BlockKind[] = ["gancho", "contexto", "conteudo", "virada", "chamada"];
const FIELD: Record<ReadingKind, "speech" | "on_screen" | "action"> = { fala: "speech", tela: "on_screen", acao: "action", camera: "action" };

// Remonta as partes: a IA diz a parte de cada item; o campo vem do tipo que a leitura já deu.
// Devolve null se a divisão não fecha (item faltando, repetido, valor desconhecido).
export function assembleFromReading(reading: Reading, raw: unknown): Omit<ScriptBlock, "id">[] | null {
  const list = (raw as { items?: unknown })?.items;
  const labels = (raw as { labels?: unknown })?.labels;
  if (!Array.isArray(list)) return null;
  const byN = new Map<number, { block: number; kind: BlockKind }>();
  for (const it of list) {
    const x = (it ?? {}) as Record<string, unknown>;
    const n = Number(x.n);
    const block = Number(x.block);
    if (!Number.isInteger(n) || !Number.isInteger(block) || block < 1 || byN.has(n) || !KINDS.includes(x.kind as BlockKind)) return null;
    byN.set(n, { block, kind: x.kind as BlockKind });
  }
  if (byN.size !== reading.items.length || reading.items.some((i) => !byN.has(i.n))) return null;

  const named = talkers(reading) > 1;
  const blocks: (Omit<ScriptBlock, "id"> & { key: number })[] = [];
  for (const item of reading.items) {
    const c = byN.get(item.n)!;
    let current = blocks.at(-1);
    if (!current || current.key !== c.block) {
      const label = Array.isArray(labels) ? clip(labels[c.block - 1], 40) || null : null;
      current = { key: c.block, kind: c.kind, label, speech: "", on_screen: "", action: "" };
      blocks.push(current);
    }
    const field = FIELD[item.kind];
    const text = itemText(item, named);
    current[field] = current[field] ? `${current[field]}${field === "action" ? " " : "\n"}${text}` : text;
  }
  if (blocks.length > 12) return null;
  return blocks.map((b) => ({ kind: b.kind, label: b.label, speech: b.speech, on_screen: b.on_screen, action: b.action }));
}

// Sem a segunda chamada: os itens da leitura, já corrigidos, entram como trechos na divisão simples.
export function readingAsSegments(reading: Reading): Segment[] {
  const named = talkers(reading) > 1;
  return reading.items.map((i) => ({ n: i.n, text: itemText(i, named) }));
}

// O que os outros passos recebem: o resumo, o tom, quem aparece e as indicações de câmera da própria pessoa.
export function readingLines(reading: Reading | null | undefined): string[] {
  if (!reading) return [];
  const camera = reading.items.filter((i) => i.kind === "camera").map((i) => i.text);
  return [
    reading.summary && `Do que trata: ${reading.summary}`,
    reading.tone && `Tom: ${reading.tone}`,
    reading.people.length > 0 && `Quem aparece: ${reading.people.join(", ")}`,
    camera.length > 0 && `Indicações de câmera que a pessoa escreveu: ${camera.join("; ")}`,
  ].filter((l): l is string => typeof l === "string");
}
