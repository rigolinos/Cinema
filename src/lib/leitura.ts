// "Já tenho o roteiro", em duas chamadas. Na primeira, a IA lê o texto colado e faz para si mesma
// uma versão estruturada (a leitura): quem fala, o que é fala, tela, ação e indicação de câmera,
// com a ortografia corrigida e o jeito da pessoa mantido. Na segunda, monta as partes a partir dela.
// A leitura fica guardada no vídeo e ajuda os outros passos (sugestões, planos, publicação).
import { normalizeHeading, type BlockKind, type ScriptBlock } from "./roteiro";
import type { Segment } from "./organizar";

export type ReadingKind = "fala" | "tela" | "acao" | "camera";
export const READING_KINDS: ReadingKind[] = ["fala", "tela", "acao", "camera"];

export interface ReadingItem {
  n: number;
  kind: ReadingKind;
  speaker: string | null; // só em fala, quando o roteiro diz quem fala
  text: string;
  scene: number; // a cena que a pessoa marcou no texto (CENA 1, CENA 2…); 0 quando ela não marcou
}

export interface Reading {
  summary: string; // do que o vídeo trata, em 1 ou 2 frases
  tone: string; // ex.: "humor, fofoca de escola"
  people: string[]; // quem aparece ou fala, como a pessoa escreveu
  items: ReadingItem[]; // o roteiro inteiro, na ordem, uma coisa por item
  headings: (string | null)[]; // o cabeçalho de cada cena marcada, na ordem; null quando o lugar não está claro
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
    const scene = Number(x.scene);
    items.push({ n: items.length + 1, kind, speaker, text, scene: Number.isInteger(scene) && scene > 0 && scene <= 30 ? scene : 0 });
  }
  if (items.length === 0 || items.length > 80) return null;
  // As cenas marcadas só valem se vierem em ordem (nunca voltam para uma cena anterior).
  for (let i = 1; i < items.length; i++) if (items[i].scene < items[i - 1].scene) items.forEach((it) => (it.scene = 0));
  const people = (Array.isArray(r.people) ? r.people : []).map((p) => clip(p, 40)).filter(Boolean).slice(0, 12);
  // Cada cabeçalho vem com o número da cena: uma cena pulada fica sem cabeçalho, não desalinha as outras.
  const headings: (string | null)[] = [];
  for (const h of Array.isArray(r.headings) ? r.headings : []) {
    const x = (h ?? {}) as Record<string, unknown>;
    const scene = Number(x.scene);
    if (Number.isInteger(scene) && scene > 0 && scene <= 30 && headings[scene - 1] === undefined) headings[scene - 1] = normalizeHeading(x.heading);
  }
  for (let i = 0; i < headings.length; i++) headings[i] ??= null;
  return { summary: clip(r.summary, 400), tone: clip(r.tone, 120), people: [...new Set(people)], items, headings };
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
    .map((i) => `${i.n}. [${i.scene ? `cena ${i.scene} · ` : ""}${i.kind}${i.speaker ? ` · ${i.speaker}` : ""}] ${i.text}`)
    .join("\n");
}

const KINDS: BlockKind[] = ["gancho", "contexto", "conteudo", "virada", "chamada"];
const FIELD: Record<ReadingKind, "speech" | "on_screen" | "action"> = { fala: "speech", tela: "on_screen", acao: "action", camera: "action" };

// Remonta as partes: a IA diz a parte de cada item; o campo vem do tipo que a leitura já deu.
// Devolve null se a divisão não fecha (item faltando, repetido, valor desconhecido).
// As cenas que a pessoa marcou mandam: uma cena marcada nova sempre abre outra parte, a IA não junta duas.
// A ordem dela também manda: uma ação que vem depois da fala abre uma parte nova da mesma cena (mesmo
// cabeçalho), para não subir para antes da fala. Partes com o mesmo cabeçalho aparecem como uma cena só.
export function assembleFromReading(reading: Reading, raw: unknown): Omit<ScriptBlock, "id">[] | null {
  const list = (raw as { items?: unknown })?.items;
  const labels = (raw as { labels?: unknown })?.labels;
  const partHeadings = (raw as { headings?: unknown })?.headings;
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
  const marked = reading.items.some((i) => i.scene > 0);
  // O cabeçalho da cena: o da cena marcada ou o da parte que a IA montou. Sem lugar claro, "CENA n"
  // só para agrupar as partes da mesma cena; na tela ele vira o número da cena.
  const headingOf = (item: ReadingItem, block: number) =>
    marked
      ? reading.headings[item.scene - 1] || `CENA ${item.scene}`
      : (Array.isArray(partHeadings) ? normalizeHeading(partHeadings[block - 1]) : null) || `CENA ${block}`;
  const blocks: (Omit<ScriptBlock, "id"> & { key: string; heading: string; same_scene: boolean })[] = [];
  for (const item of reading.items) {
    const c = byN.get(item.n)!;
    const key = marked ? `${item.scene}:${c.block}` : String(c.block);
    const field = FIELD[item.kind];
    let current = blocks.at(-1);
    const actionAfterTalk = current !== undefined && current.key === key && field === "action" && Boolean(current.speech);
    if (!current || current.key !== key || actionAfterTalk) {
      const label = !actionAfterTalk && Array.isArray(labels) ? clip(labels[c.block - 1], 40) || null : null;
      const heading = headingOf(item, c.block);
      const prev = blocks.at(-1);
      // Continua a cena: a ação depois da fala, ou (sem cenas marcadas) a parte seguinte no mesmo lugar.
      const same = Boolean(prev) && (actionAfterTalk || (!marked && prev!.heading === heading && !/^CENA \d+$/.test(heading)));
      current = { key, kind: c.kind, label, speech: "", on_screen: "", action: "", heading, same_scene: same };
      blocks.push(current);
    }
    const text = itemText(item, named);
    current[field] = current[field] ? `${current[field]}${field === "action" ? " " : "\n"}${text}` : text;
  }
  if (blocks.length > 20) return null;
  return blocks.map((b) => ({ kind: b.kind, label: b.label, speech: b.speech, on_screen: b.on_screen, action: b.action, heading: b.heading, same_scene: b.same_scene }));
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
