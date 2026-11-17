// Conferência do que a IA escreveu, sem gastar IA: o que dá para contar e reconhecer no texto.
// Cada problema traz a frase que volta para a IA quando o app pede uma correção.
import type { ScriptBlock, StoryParts } from "./roteiro";
import { wordCount } from "./roteiro";
import { isMe, speechLines } from "./convidado";
import { contentWords, fold, overlap } from "./texto";

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

// Os pontos que a IA listou só valem se vierem mesmo do texto da pessoa.
export function normalizePoints(raw: unknown, source: string): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is string => typeof p === "string")
    .map((p) => p.trim().slice(0, 160))
    .filter((p) => p && overlap(p, source) >= 0.6)
    .slice(0, 12);
}

// Quanto da história não está no que a pessoa escreveu, de 0 a 1, pelas palavras que contam.
export function inventedShare(story: StoryParts, source: string): number {
  return 1 - overlap([story.hook, story.situation, story.payoff].join(" "), source);
}

export function storyProblems(story: StoryParts, o: { humor?: boolean; points?: string[]; own?: string } = {}): Problem[] {
  const text = [story.hook, story.situation, story.payoff].join("\n");
  const out: Problem[] = [];
  // Ideia da própria pessoa: a história não pode trazer falas nem acontecimentos que ela não escreveu.
  if (o.own?.trim()) {
    // Fala entre aspas cujas palavras não estão no texto dela. "Elogia: nossa, que focada", sem aspas, conta como fala dela.
    const made = (text.match(QUOTED) ?? []).find((q) => overlap(q, o.own as string) < 0.6);
    if (made) out.push({ code: "fala_inventada", fix: `A fala ${made.trim()} não está no que a pessoa escreveu. Tire as falas que ela não escreveu; se ela não escreveu nenhuma, o vídeo é só de gestos e ações.` });
    if (inventedShare(story, o.own) > 0.75) out.push({ code: "inventou", fix: "A história traz muita coisa que a pessoa não escreveu. Tire personagens, animais, objetos, piadas e finais que não estão em <ideia_da_pessoa> e fique só com os acontecimentos dela, na ordem dela." });
  }
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

export function draftProblems(blocks: (Pick<ScriptBlock, "speech" | "on_screen" | "action"> & { heading?: string | null })[], o: { maxWords: number; cast?: string[]; story?: string }): Problem[] {
  const out: Problem[] = [];
  const lines = blocks.flatMap((b) => speechLines(b.speech));
  // A história aprovada não tem nenhuma fala: o roteiro não pode inventar uma em cada cena.
  if (o.story?.trim() && quotedLines(o.story) === 0 && !/\b(diz|fala|responde|grita|pergunta|sussurra|narra)\w*/i.test(o.story) && lines.length > 0) {
    out.push({ code: "fala_inventada", fix: "A história aprovada não tem nenhuma fala, e o roteiro tem. Deixe speech vazio em todas as cenas: o vídeo é só de gestos e ações." });
  }
  // Narração dentro da fala: "Lia segura a lâmpada: 'modo festa'".
  const narrated = lines.find((l) => /["“”'‘’][^"“”'‘’]{3,}["“”'‘’]/.test(l.raw) && /\S+\s+\S+.*:\s*["“'‘]/.test(l.raw));
  if (narrated) out.push({ code: "narracao_na_fala", fix: `A fala "${narrated.raw.slice(0, 80)}" mistura descrição com fala. Em speech fica só o que a pessoa diz; o gesto vai em action.` });
  const cast = o.cast ?? [];
  if (cast.length > 1) {
    const unnamed = lines.find((l) => !l.speaker || !cast.some((c) => isMe(l.speaker as string, c)));
    if (unnamed) out.push({ code: "fala_sem_nome", fix: `O vídeo tem mais de uma pessoa (${cast.join(", ")}), e a fala "${unnamed.raw.slice(0, 60)}" não diz de quem é. Comece cada fala com o nome de quem fala, uma fala por linha.` });
  }
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
  const noHeading = blocks.findIndex((b) => "heading" in b && !b.heading);
  if (noHeading >= 0) out.push({ code: "sem_cabecalho", fix: `A cena ${noHeading + 1} está sem cabeçalho. Toda cena começa com heading: INT. ou EXT., o lugar e DIA ou NOITE ("INT. COZINHA – DIA").` });
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

// Ideias da mesma leva: as repetidas saem (se ainda sobrarem pelo menos 3) e as que têm defeito vão para o fim.
export function tidyIdeas<T extends { title: string; hook: string; situation?: string | null; payoff?: string | null }>(ideas: T[]): T[] {
  const unique = ideas.filter((idea, i) => !ideas.slice(0, i).some((earlier) => sameIdea(earlier, idea)));
  const list = unique.length >= 3 ? unique : ideas;
  return list.map((idea, i) => ({ idea, i, bad: ideaProblems(idea).length })).sort((a, b) => a.bad - b.bad || a.i - b.i).map((x) => x.idea);
}
