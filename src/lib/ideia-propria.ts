// "Já tenho a ideia": a ideia da pessoa organizada, com opções para ela escolher.
import { findFormat } from "./formats";

export interface OwnIdea {
  title: string;
  situation: string;
  hooks: string[]; // 1º fiel ao que ela escreveu, 2º mais forte, 3º outro ângulo
  payoff: string; // o desfecho que ela escreveu; vazio quando vêm opções
  payoff_options: string[];
  format_slug: string | null;
  questions: string[];
  note: string;
}

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");
const texts = (v: unknown, max: number, count: number) =>
  (Array.isArray(v) ? v : [])
    .map((x) => clip(x, max).replace(/^["“]|["”]$/g, ""))
    .filter(Boolean)
    .slice(0, count);

// Sem título ou sem gancho, não há o que mostrar. O desfecho escrito tem prioridade sobre as opções.
export function normalizeOwnIdea(raw: unknown, original: string): OwnIdea | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const hooks = texts(r.hooks, 300, 3);
  const payoff = clip(r.payoff, 600);
  const slug = clip(r.format_slug, 60);
  const idea: OwnIdea = {
    title: clip(r.title, 140) || clip(original, 60),
    situation: clip(r.situation, 600),
    hooks,
    payoff,
    payoff_options: payoff ? [] : texts(r.payoff_options, 600, 2),
    format_slug: findFormat(slug) ? slug : null,
    questions: texts(r.questions, 200, 2),
    note: clip(r.note, 300),
  };
  return idea.title && idea.hooks.length ? idea : null;
}
