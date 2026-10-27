import { DURATIONS, PLATFORMS, type Objective, type Platform, type Resource } from "./ideas";
import { findFormat } from "./formats";

// Ideias da quinzena: a cada 15 dias, ideias novas para o nicho de cada criador.

// As quinzenas contam a partir de uma segunda-feira fixa, para todo mundo trocar no mesmo dia.
const ANCHOR = Date.UTC(2026, 0, 5); // 05/01/2026, segunda-feira
const DAY = 24 * 60 * 60 * 1000;
export const PERIOD_DAYS = 14;
export const IDEAS_PER_PERIOD = 6;

function utcDay(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function periodStart(date = new Date()): string {
  const days = Math.floor((utcDay(date) - ANCHOR) / DAY);
  return iso(ANCHOR + Math.floor(days / PERIOD_DAYS) * PERIOD_DAYS * DAY);
}

// Último dia da quinzena (inclusivo).
export function periodEnd(start: string): string {
  return iso(Date.parse(`${start}T00:00:00Z`) + (PERIOD_DAYS - 1) * DAY);
}

// Dias até as ideias novas chegarem (1 = amanhã).
export function daysUntilNext(date = new Date()): number {
  const start = Date.parse(`${periodStart(date)}T00:00:00Z`);
  return Math.round((start + PERIOD_DAYS * DAY - utcDay(date)) / DAY);
}

const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

// "20 OUT – 2 NOV", no estilo de claquete do app.
export function periodLabel(start: string): string {
  const fmt = (d: string) => {
    const [, m, day] = d.split("-").map(Number);
    return `${day} ${MONTHS[m - 1]}`;
  };
  return `${fmt(start)} – ${fmt(periodEnd(start))}`;
}

// Respostas já preenchidas para começar o vídeo com um toque.
export interface QuickStart {
  objective: Objective;
  platforms: Platform[];
  durationS: number;
  resources: Resource[];
}

export function quickStartDefaults(formatSlug: string | null, platforms: string[], objective: Objective = "crescer"): QuickStart {
  const known = platforms.filter((p): p is Platform => p in PLATFORMS);
  const format = findFormat(formatSlug);
  const ideal = format ? (format.idealSeconds[0] + format.idealSeconds[1]) / 2 : 30;
  const durationS = [...DURATIONS].sort((a, b) => Math.abs(a - ideal) - Math.abs(b - ideal))[0];
  return {
    objective,
    platforms: known.length ? known : ["reels"],
    durationS,
    resources: format?.needsSomeone ? ["com_alguem", "em_casa"] : ["sozinho", "em_casa"],
  };
}

// A mistura da quinzena, calculada pelo app (o modelo deduz mal números a partir de frases soltas).
// objectives = objetivos dos vídeos da pessoa, do mais recente para o mais antigo.
// Sem vídeo: Crescer e Divertir. Com 1 ou 2: o principal é o do mais recente. Com 3 ou mais: o mais usado.
export function fortnightMix(objectives: Objective[]): { main: Objective; second: Objective } {
  const fallback = (not: Objective): Objective => (not === "divertir" ? "crescer" : "divertir");
  if (objectives.length === 0) return { main: "crescer", second: "divertir" };
  const counts = new Map<Objective, number>();
  objectives.forEach((o) => counts.set(o, (counts.get(o) ?? 0) + 1));
  // Empate: ganha o que apareceu mais recentemente (a ordem da lista já é do mais recente).
  const ranked = [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)! || objectives.indexOf(a) - objectives.indexOf(b));
  const main = objectives.length < 3 ? objectives[0] : ranked[0];
  const second = ranked.find((o) => o !== main) ?? fallback(main);
  return { main, second };
}

export function mixText(mix: { main: Objective; second: Objective }): string {
  return `${IDEAS_PER_PERIOD - 2} ideias de ${mix.main}, 1 de ${mix.second} e 1 fora do padrão.`;
}
