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
  | "ideia_guardada";

export interface Signal {
  kind: SignalKind;
  detail: Record<string, unknown>;
  created_at?: string;
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

// Uma frase por sinal, para a IA entender o que aconteceu.
export function describeSignal(s: Signal): string {
  const d = s.detail as Record<string, string | string[] | undefined>;
  const list = (v: unknown) => (Array.isArray(v) && v.length ? ` (deixou de lado: ${v.map((x) => `"${x}"`).join(", ")})` : "");
  switch (s.kind) {
    case "ideia_escolhida":
      return `Escolheu a ideia "${d.title}"${d.format ? ` no formato ${d.format}` : ""}${list(d.ignored)}`;
    case "pedido_ideia":
      return `Pediu às ideias: "${d.pedido}"`;
    case "pedido_bloco":
      return `Pediu num bloco do roteiro${d.bloco ? ` (${d.bloco})` : ""}: "${d.pedido}"`;
    case "roteiro_editado":
      return `Reescreveu à mão ${d.campo === "speech" ? "a fala" : d.campo === "on_screen" ? "o texto da tela" : "a cena"}${d.bloco ? ` do bloco ${d.bloco}` : ""}: de "${d.antes}" para "${d.depois}"`;
    case "plano_apagado":
      return `Apagou um plano ${d.plano ?? ""}`.trim();
    case "plano_adicionado":
      return `Adicionou um plano ${d.plano ?? ""}`.trim();
    case "plano_pulado":
      return `Pulou no set um plano ${d.plano ?? ""}`.trim();
    case "ideia_quinzena_usada":
      return `Começou um vídeo com a ideia da quinzena "${d.title}"${d.format ? ` (${d.format})` : ""}`;
    case "formato_usado":
      return `Quis criar no formato ${d.format}`;
    case "ideia_guardada":
      return `Guardou para depois a ideia "${d.title}"${d.format ? ` (${d.format})` : ""}`;
  }
}

export function shouldSummarize(input: { newSignals: number; summarizedAt: string | null; now?: Date }): boolean {
  if (input.newSignals < MIN_NEW_SIGNALS) return false;
  if (!input.summarizedAt) return true;
  const hours = ((input.now ?? new Date()).getTime() - new Date(input.summarizedAt).getTime()) / 3_600_000;
  return hours >= MIN_HOURS_BETWEEN;
}

// Bloco que entra em todos os pedidos à IA.
export function memoryContext(items: MemoryItem[] | null | undefined): string {
  const lines = (items ?? []).map((i) => i.text.trim()).filter(Boolean);
  if (!lines.length) return "";
  return `O que já sabemos sobre este criador (use para personalizar; não repita estas frases):\n${lines.map((l) => `- ${l}`).join("\n")}\n`;
}

// Junta a memória ao pedido. "surprise" pede uma sugestão fora do padrão, para a pessoa não ficar presa no mesmo.
export function withMemory(prompt: string, raw: unknown, opts: { surprise?: boolean } = {}): string {
  const ctx = memoryContext(readItems(raw));
  if (!ctx) return prompt;
  const extra = opts.surprise ? "Mesmo assim, faça UMA das sugestões fugir desse padrão, para ela experimentar algo novo.\n" : "";
  return `${ctx}${extra}\n${prompt}`;
}

// Lê os itens como vieram do banco, descartando o que não tiver o formato certo.
export function readItems(raw: unknown): MemoryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((i): i is MemoryItem => typeof i?.text === "string" && (i.source === "ia" || i.source === "voce"))
    .map((i) => ({ text: i.text, source: i.source }));
}

export const MEMORY_SYSTEM = `Você é o Gravaí e está montando, para você mesmo, um retrato curto de um criador de conteúdo a partir do que ele faz no app.
Escreva em português do Brasil, frases curtas, na segunda pessoa ("Você..."), sem julgamento e sem inventar.
Só afirme o que os sinais mostram de forma repetida ou clara. Se algo for só um indício, diga "parece que".
Não registre dados pessoais sensíveis (saúde, religião, política, orientação sexual etc.), mesmo que apareçam.`;

export function memoryPrompt(input: { niche: string | null; current: MemoryItem[]; signals: Signal[] }): string {
  const fixed = input.current.filter((i) => i.source === "voce").map((i) => `- ${i.text}`);
  const ia = input.current.filter((i) => i.source === "ia").map((i) => `- ${i.text}`);
  return `Nicho informado: ${input.niche || "não informado"}
${fixed.length ? `O que a própria pessoa escreveu sobre si (verdade, não mude nem repita):\n${fixed.join("\n")}\n` : ""}${ia.length ? `O que você já tinha entendido (atualize, corrija ou mantenha):\n${ia.join("\n")}\n` : ""}
O que ela fez desde o último resumo:
${input.signals.map((s) => `- ${describeSignal(s)}`).join("\n")}

Atualize o retrato em até 6 frases curtas sobre: público, tom, formatos e assuntos preferidos, duração, jeito de gravar e o que ela costuma mudar.
"insight" é UMA frase curta e calorosa, falando com a pessoa, sobre algo novo que você percebeu agora (ou vazio se não houver nada novo). Ex.: "Percebi que você curte um tom mais leve. Vou puxar para esse lado."
Responda só com JSON: {"items":["..."],"insight":""}`;
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
