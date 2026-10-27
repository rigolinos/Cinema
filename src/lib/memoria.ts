// Memória do criador: sinais do uso viram poucas linhas de "o que já entendi sobre você",
// que acompanham todos os pedidos à IA.

export type SignalKind =
  | "ideia_escolhida"
  | "pedido_ideia"
  | "pedido_bloco"
  | "roteiro_editado"
  | "plano_apagado"
  | "plano_adicionado"
  | "plano_pulado"
  | "ideia_quinzena_usada"
  | "formato_usado"
  | "ideia_guardada"
  | "roteiro_colado"
  | "sugestao_aceita"
  | "sugestao_recusada"
  | "porta_entrada";

export interface Signal {
  kind: SignalKind;
  detail: Record<string, unknown>;
  created_at?: string;
  // Do vídeo em que aconteceu: entra no fim da frase do sinal, [objetivo · duração · plataformas].
  video?: { objective?: string | null; duration_s?: number | null; platforms?: string[] | null; brief?: string | null } | null;
}

export interface MemoryItem {
  text: string;
  source: "ia" | "voce"; // "voce" = escrito ou corrigido pela própria pessoa; a IA não mexe
}

export const MAX_ITEMS = 10;
// Resumir só quando houver novidade de verdade, para gastar pouca IA.
export const MIN_NEW_SIGNALS = 5;
export const MIN_HOURS_BETWEEN = 12;

const clip = (v: unknown, max = 160) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

// Detalhe do sinal sempre pequeno: só textos curtos e números.
export function signalDetail(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (typeof v === "string") out[k] = clip(v);
    else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (Array.isArray(v)) out[k] = v.filter((x) => typeof x === "string").slice(0, 5).map((x) => clip(x, 80));
  }
  return out;
}

// Uma frase por sinal, para a IA entender o que aconteceu, terminando com o contexto do vídeo.
export function describeSignal(s: Signal): string {
  const d = s.detail as Record<string, string | string[] | undefined>;
  const list = (v: unknown) => (Array.isArray(v) && v.length ? ` (deixou de lado: ${v.map((x) => `"${x}"`).join(", ")})` : "");
  const brief = s.kind === "ideia_escolhida" && s.video?.brief ? ` Briefing: "${clip(s.video.brief, 100)}"` : "";
  return `${signalText(s.kind, d, list)}${brief}${signalContext(s.video)}`;
}

function signalText(kind: SignalKind, d: Record<string, string | string[] | undefined>, list: (v: unknown) => string): string {
  switch (kind) {
    case "ideia_escolhida":
      return `Escolheu a ideia "${d.title}"${d.format ? ` no formato ${d.format}` : ""}${list(d.ignored)}.`;
    case "pedido_ideia":
      return `Pediu às ideias: "${d.pedido}".`;
    case "pedido_bloco":
      return `Pediu num bloco do roteiro${d.bloco ? ` (${d.bloco})` : ""}: "${d.pedido}".`;
    case "roteiro_editado":
      return `Reescreveu à mão ${d.campo === "speech" ? "a fala" : d.campo === "on_screen" ? "o texto da tela" : "a cena"}${d.bloco ? ` do bloco ${d.bloco}` : ""}: de "${d.antes}" para "${d.depois}".`;
    case "plano_apagado":
      return `Apagou um plano ${d.plano ?? ""}`.trim() + ".";
    case "plano_adicionado":
      return `Adicionou um plano ${d.plano ?? ""}`.trim() + ".";
    case "plano_pulado":
      return `Pulou no set um plano ${d.plano ?? ""}`.trim() + ".";
    case "ideia_quinzena_usada":
      return `Começou um vídeo com a ideia da quinzena "${d.title}"${d.format ? ` (${d.format})` : ""}.`;
    case "formato_usado":
      return `Quis criar no formato ${d.format}.`;
    case "ideia_guardada":
      return `Guardou para depois a ideia "${d.title}"${d.format ? ` (${d.format})` : ""}.`;
    case "roteiro_colado":
      return `Colou o próprio roteiro, que começa assim: "${d.inicio}".`;
    case "sugestao_aceita":
      return `Aceitou a sugestão no bloco ${d.bloco}: de "${d.antes}" para "${d.depois}".`;
    case "sugestao_recusada":
      return `Manteve o próprio texto no bloco ${d.bloco} e recusou: "${d.sugestao}".`;
    case "porta_entrada":
      return `Começou o vídeo por "${d.porta}".`;
  }
}

const DOORS: Record<string, string> = { zero: "Do zero", ideia: "Já tenho a ideia", roteiro: "Já tenho o roteiro" };
export const doorLabel = (door: string) => DOORS[door] ?? door;

function signalContext(v: Signal["video"]): string {
  if (!v) return "";
  const parts = [
    v.objective ?? "",
    v.duration_s ? (v.duration_s < 60 ? `${v.duration_s} s` : `${Math.round(v.duration_s / 60)} min`) : "",
    (v.platforms ?? []).map((p) => ({ reels: "Reels", tiktok: "TikTok", shorts: "Shorts", youtube: "YouTube" })[p] ?? p).join(", "),
  ].filter(Boolean);
  return parts.length ? ` [${parts.join(" · ")}]` : "";
}

export function shouldSummarize(input: { newSignals: number; summarizedAt: string | null; now?: Date }): boolean {
  if (input.newSignals < MIN_NEW_SIGNALS) return false;
  if (!input.summarizedAt) return true;
  const hours = ((input.now ?? new Date()).getTime() - new Date(input.summarizedAt).getTime()) / 3_600_000;
  return hours >= MIN_HOURS_BETWEEN;
}

// As frases da memória como vão no contexto dos pedidos (bloco <a_pessoa>).
export function memoryLines(raw: unknown): string[] {
  return readItems(raw)
    .map((i) => i.text.trim())
    .filter(Boolean);
}

// Lê os itens como vieram do banco, descartando o que não tiver o formato certo.
export function readItems(raw: unknown): MemoryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((i): i is MemoryItem => typeof i?.text === "string" && (i.source === "ia" || i.source === "voce"))
    .map((i) => ({ text: i.text, source: i.source }));
}

export const MEMORY_SYSTEM = `Você monta um retrato curto de como um criador de conteúdo trabalha, a partir do que ele faz no app. O retrato é lido pela própria pessoa, no Perfil, e pelo Gravaí, antes de sugerir ideias e roteiros.

Cada frase é sobre o jeito de criar, sem sujeito, começando pelo verbo: "Faz sketches com situações de família." "Prefere vídeos de 30 s, gravados sozinha em casa." Português do Brasil, frases curtas, sem julgamento.

O QUE ENTRA
- Tom e jeito de falar, incluindo palavras e expressões que a pessoa usa ou troca quando reescreve.
- Objetivos, formatos e assuntos que ela mais usa.
- Duração e plataformas.
- Como ela grava: sozinha ou com alguém, onde, se mostra o rosto.
- O que ela costuma mudar, pedir ou recusar.

O QUE NÃO ENTRA
- Nada sobre a vida pessoal.
- Dados sensíveis (saúde, religião, política, orientação sexual e parecidos), mesmo que apareçam nos sinais.
- Traço de personalidade ou julgamento.
- Público, a não ser que a própria pessoa tenha escrito sobre isso.

QUANDO AFIRMAR
- Afirme o que aparece em 2 ou mais sinais, ou num ato explícito: reescreveu à mão, recusou uma sugestão, pediu algo.
- Um indício só vira uma frase com "Parece…".
- Os sinais estão do mais antigo para o mais novo, e o mais novo vale mais. Se os sinais novos contradizem uma frase do retrato anterior, troque a frase. Se a frase era um "Parece…" e os sinais novos a contradizem, tire.
- Nunca repita nem contradiga o que a própria pessoa escreveu sobre si.`;

export const MEMORY_EXAMPLE = `{"items":[""],"insight":""}`;
export const ITEM_MAX_CHARS = 120;

// Quantas frases a IA pode escrever: no máximo 6, e nunca mais que 10 menos as frases da pessoa.
export function memorySlots(current: MemoryItem[]): number {
  return Math.max(0, Math.min(6, MAX_ITEMS - current.filter((i) => i.source === "voce").length));
}

export function memoryPrompt(input: { niche: string | null; current: MemoryItem[]; signals: Signal[] }): string {
  const fixed = input.current.filter((i) => i.source === "voce").map((i) => i.text);
  const ia = input.current.filter((i) => i.source === "ia").map((i) => i.text);
  const blocks = [
    input.niche?.trim() ? `<nicho>${input.niche.trim()}</nicho>` : "",
    fixed.length ? `<a_pessoa_escreveu>\n(verdade; não mude nem repita)\n${fixed.join("\n")}\n</a_pessoa_escreveu>` : "",
    ia.length ? `<retrato_anterior>\n${ia.join("\n")}\n</retrato_anterior>` : "",
    `<sinais>\n(do mais antigo para o mais novo)\n${input.signals.map(describeSignal).join("\n")}\n</sinais>`,
  ].filter(Boolean);
  return `${blocks.join("\n\n")}

TAREFA: devolva o retrato completo e atualizado, não só as mudanças, com no máximo ${memorySlots(input.current)} frases de até ${ITEM_MAX_CHARS} caracteres.
insight: uma frase curta e calorosa, falando com a pessoa ("você"), sobre o que mudou neste retrato. Vazio se nada mudou. Fale do gosto, nunca de um ato isolado: "Percebi que você curte um tom mais leve. Vou puxar para esse lado." e não "Vi que você apagou 3 planos."`;
}

export function normalizeMemory(raw: unknown, current: MemoryItem[]): { items: MemoryItem[]; insight: string | null } {
  const r = (raw ?? {}) as { items?: unknown; insight?: unknown };
  const fixed = current.filter((i) => i.source === "voce");
  const seen = new Set(fixed.map((i) => i.text.toLowerCase()));
  const fromAi: MemoryItem[] = [];
  for (const t of Array.isArray(r.items) ? r.items : []) {
    const text = clip(t, 140);
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    fromAi.push({ text, source: "ia" });
  }
  const insight = clip(r.insight, 200) || null;
  return { items: [...fixed, ...fromAi].slice(0, MAX_ITEMS), insight };
}
