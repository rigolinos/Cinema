import { DURATIONS, PLATFORMS, type Objective, type Platform, type Resource } from "./ideas";
import { FORMATS, findFormat } from "./formats";

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

export function quickStartDefaults(formatSlug: string | null, platforms: string[]): QuickStart {
  const known = platforms.filter((p): p is Platform => p in PLATFORMS);
  const format = findFormat(formatSlug);
  const ideal = format ? (format.idealSeconds[0] + format.idealSeconds[1]) / 2 : 30;
  const durationS = [...DURATIONS].sort((a, b) => Math.abs(a - ideal) - Math.abs(b - ideal))[0];
  return {
    objective: "crescer",
    platforms: known.length ? known : ["reels"],
    durationS,
    resources: format?.needsSomeone ? ["com_alguem", "em_casa"] : ["sozinho", "em_casa"],
  };
}

export function fortnightPrompt(ctx: { niche: string; platforms: string[]; trends: { title: string; what: string }[]; recentTitles: string[] }): string {
  const formats = FORMATS.map((f) => `- ${f.slug}: ${f.name}. ${f.summary}`).join("\n");
  const where = ctx.platforms.filter((p): p is Platform => p in PLATFORMS).map((p) => PLATFORMS[p]);
  return `Nicho do criador: ${ctx.niche}
Onde posta: ${where.join(", ") || "Reels e TikTok"}
${ctx.recentTitles.length ? `Ideias que ele já recebeu (não repita): ${ctx.recentTitles.join(" | ")}\n` : ""}${ctx.trends.length ? `Trends desta semana (use no máximo duas, e só se combinarem com o nicho): ${ctx.trends.map((t) => `${t.title}: ${t.what}`).join(" | ")}\n` : ""}
Formatos que você pode usar (use o slug):
${formats}

Sugira ${IDEAS_PER_PERIOD} ideias de vídeo curto para as próximas duas semanas, variadas entre si e em formatos diferentes.
Misture ideias fáceis de gravar sozinho com uma ou duas mais elaboradas.
Responda só com JSON:
{"ideas":[{"title":"título curto da ideia","format_slug":"slug de um formato acima","hook":"a frase exata do gancho, até 10 palavras","why":"por que funciona, em uma frase; se houver virada ou final inesperado, conte qual é"}]}`;
}
