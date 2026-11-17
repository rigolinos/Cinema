// Conferência do que a IA escreveu, sem gastar IA: o que dá para contar e reconhecer no texto.
// Cada problema traz a frase que volta para a IA quando o app pede uma correção.
import type { ScriptBlock, StoryParts } from "./roteiro";
import { wordCount } from "./roteiro";
import { contentWords, fold } from "./texto";

export interface Problem {
  code: string;
  fix: string;
}

// Palavras que prometem em vez de entregar: "um final inesperado" não diz qual é o final.
const VAGUE = [
  /\binesperad[oa]s?\b/i,
  /\bsurpreendentes?\b/i,
  /\bincr[íi]ve(l|is)\b/i,
  /\bhil[áa]ri[oa]s?\b/i,
  /\binusitad[oa]s?\b/i,
  /\bfaz(em)? uma piada\b/i,
  /\bde (forma|maneira|jeito) (criativ|divertid|engra[çc]ad|c[ôo]mic)\w*/i,
  /\b(algo|uma (situa[çc][ãa]o|cena|coisa)) (engra[çc]ad|c[ôo]mic|divertid|absurd)\w*/i,
  /\brea[çc][ãa]o (exagerada|c[ôo]mica|engra[çc]ada)\b/i,
  /\baqui entra\b/i,
];
// Sentimento no lugar da ação: "entra em pânico" não dá para filmar; o que ela faz em pânico, dá.
const FEELING = /\b(entra(m)? em p[âa]nico|fica(m)? (desesperad|confus|irritad|nervos|surpres|chocad|frustrad|indignad)\w*|se desespera(m)?|em (total )?desespero)\b/i;
const TECHNICAL = [/\bplanos?\b/i, /\bcorte\b/i, /\btakes?\b/i, /\bgancho\b/i, /\bblocos?\b/i];
const CLICHE = [/n[ãa]o vai acreditar/i, /\bningu[ée]m:/i, /\boi,? gente\b/i, /o segredo (que|para)/i, /mudou (a )?minha vida/i];
const GENERIC_CALL = [/curt[ae] e (siga|segue)/i, /deix[ae] (o )?seu like/i, /n[ãa]o esque[çc]a de seguir/i, /para mais (dicas|v[íi]deos)/i];
const CODES = /\b(A[1-9]|B[1-9]|Pessoa [1-9A-D]|Personagem [1-9A-D])\b/;
const QUOTED = /["“”«»'‘’]\s*[^"“”«»'‘’]{3,}?["“”«»'‘’]/g;

const hits = (list: RegExp[], text: string) => list.map((r) => text.match(r)?.[0]).filter((m): m is string => Boolean(m));
const quote = (words: string[]) => [...new Set(words.map((w) => `"${w.toLowerCase()}"`))].slice(0, 3).join(", ");

// Quantas falas ou frases prontas a história traz entre aspas.
export function quotedLines(text: string): number {
  return (text.match(QUOTED) ?? []).length;
}

// Os pontos que a pessoa escreveu aparecem na história? Um ponto conta quando a maior parte das palavras dele está lá.
export function coveredPoints(points: string[], text: string): { covered: string[]; missing: string[] } {
  const words = contentWords(text);
  const covered: string[] = [];
  const missing: string[] = [];
  for (const point of points) {
    const own = [...contentWords(point)];
    if (own.length === 0) continue;
    const found = own.filter((w) => words.has(w)).length;
    (found >= Math.max(1, Math.ceil(own.length * 0.6)) ? covered : missing).push(point);
  }
  return { covered, missing };
}

export function storyProblems(story: StoryParts, o: { humor?: boolean; points?: string[] } = {}): Problem[] {
  const text = [story.hook, story.situation, story.payoff].join("\n");
  const out: Problem[] = [];
  const vague = hits(VAGUE, text);
  if (vague.length) out.push({ code: "vago", fix: `Você escreveu ${quote(vague)} no lugar do que acontece. Troque por o acontecimento exato: o que se vê ou o que se ouve.` });
  if (story.payoff.trim().length < 15) out.push({ code: "sem_final", fix: "Falta o final. Escreva em payoff o último momento do vídeo: a virada, o resultado, a dica ou a oferta, com as palavras exatas." });
  const feeling = text.match(FEELING)?.[0];
  if (feeling && (o.humor || quotedLines(text) === 0)) out.push({ code: "sentimento_sem_acao", fix: `"${feeling}" é um sentimento, não uma cena. Escreva o que a pessoa faz ou diz nesse momento, de um jeito que dê para filmar.` });
  const technical = hits(TECHNICAL, text);
  if (technical.length) out.push({ code: "termo_tecnico", fix: `Tire as palavras técnicas ${quote(technical)}: conte o vídeo como para um amigo.` });
  if (o.points?.length) {
    const { missing } = coveredPoints(o.points, text);
    if (missing.length) out.push({ code: "ponto_faltando", fix: `A pessoa escreveu estes pontos e eles ficaram de fora: ${missing.map((m) => `"${m}"`).join("; ")}. Inclua cada um, na ordem em que ela escreveu, sem trocar por outra coisa.` });
  }
  return out;
}

export function draftProblems(blocks: Pick<ScriptBlock, "speech" | "on_screen" | "action">[], o: { maxWords: number }): Problem[] {
  const out: Problem[] = [];
  const speech = blocks.map((b) => b.speech).join("\n");
  const all = blocks.map((b) => [b.speech, b.on_screen, b.action].join("\n")).join("\n");
  const words = wordCount(speech);
  if (words > Math.round(o.maxWords * 1.15)) out.push({ code: "fala_longa", fix: `As falas somam ${words} palavras e o limite é ${o.maxWords}. Corte palavras, sem trocar as piadas nem a ordem das cenas.` });
  const vague = hits(VAGUE, all);
  if (vague.length) out.push({ code: "vago", fix: `Você escreveu ${quote(vague)} no lugar do conteúdo. Troque pela fala exata ou pela ação exata.` });
  const code = all.match(CODES)?.[0];
  if (code) out.push({ code: "codigo_de_pessoa", fix: `"${code}" não é nome. Use os nomes de <pessoas> ou um papel fácil de entender.` });
  const call = hits(GENERIC_CALL, speech);
  if (call.length) out.push({ code: "chamada_generica", fix: `A chamada ${quote(call)} serve para qualquer vídeo. Peça uma coisa só, ligada a este vídeo.` });
  if (blocks.length && !blocks.some((b) => b.action.trim())) out.push({ code: "sem_acao", fix: "Nenhuma cena diz o que acontece. Preencha action em cada cena com o que se vê." });
  return out;
}

export function ideaProblems(idea: { title: string; hook: string; situation?: string | null; payoff?: string | null }): Problem[] {
  const text = [idea.title, idea.hook, idea.situation, idea.payoff].filter(Boolean).join("\n");
  const out: Problem[] = [];
  const vague = hits(VAGUE, text);
  if (vague.length) out.push({ code: "vago", fix: `Você escreveu ${quote(vague)} no lugar do que acontece.` });
  if (!idea.payoff?.trim()) out.push({ code: "sem_final", fix: "Falta dizer como termina." });
  const cliche = hits(CLICHE, text);
  if (cliche.length) out.push({ code: "cliche", fix: `Clichê gasto: ${quote(cliche)}.` });
  return out;
}

// Ideias quase iguais na mesma leva: mesmo título ou a mesma cena com outras palavras.
export function sameIdea(a: { title: string; situation?: string | null }, b: { title: string; situation?: string | null }): boolean {
  if (fold(a.title).trim() === fold(b.title).trim()) return true;
  const x = contentWords(`${a.title} ${a.situation ?? ""}`);
  const y = contentWords(`${b.title} ${b.situation ?? ""}`);
  if (x.size < 3 || y.size < 3) return false;
  const shared = [...x].filter((w) => y.has(w)).length;
  return shared / new Set([...x, ...y]).size >= 0.6;
}
