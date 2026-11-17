// Camada única de IA (só no servidor). Trocar de fornecedor ou de modelo é configuração.
// Cada tarefa diz o seu nível: "criar" (ideias, história, roteiro) usa o melhor modelo disponível;
// "rotina" (planos, publicação, organizar) usa o de cota maior. Quando um falha, o próximo assume.
// No plano gratuito os fornecedores podem usar o que é enviado: nunca mande contato de pessoas.

export class AiError extends Error {
  constructor(
    message: string,
    readonly kind: "config" | "limit" | "unavailable" | "format",
  ) {
    super(message);
  }
}

export type Thinking = "zero" | "baixo" | "medio";
export type Tier = "criar" | "rotina";

// Orçamento de pensamento do Gemini 2.5, por tarefa: as criativas pensam mais (geram muitas e escolhem).
// Os tokens de pensamento contam nos limites do plano gratuito.
export const THINKING_BUDGET: Record<Thinking, number> = { zero: 0, baixo: 512, medio: 2048 };

// Quem respondeu: fica no registro, para saber de qual modelo veio cada texto.
export interface AiMeta {
  task: string;
  provider: "gemini" | "groq";
  model: string;
  attempts: number; // quantos pedidos foram feitos até sair uma resposta válida
  ms: number;
}

export interface AiRequest {
  system: string;
  prompt: string;
  temperature?: number;
  schema?: object; // formato da resposta (no jeito do Gemini; a reserva recebe o mesmo, convertido)
  example?: string; // o mesmo formato em JSON de exemplo, para o modelo que não aceitar schema
  thinking?: Thinking;
  tier?: Tier;
  task?: string; // nome da tarefa, para o registro
  log?: (meta: AiMeta) => void | Promise<void>;
}

interface Step {
  provider: "gemini" | "groq";
  model: string;
}

function key(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v && !v.startsWith("your-") ? v : undefined;
}

const listOf = (name: string): string[] | undefined => {
  const v = key(name)?.split(",").map((m) => m.trim()).filter(Boolean);
  return v?.length ? v : undefined;
};

// Modelos trocáveis sem mexer no código (na Vercel ou no .env.local).
export function geminiModel(): string {
  return key("GEMINI_MODEL") ?? "gemini-2.5-flash";
}

// O modelo leve do Gemini tem cota gratuita bem maior que o principal.
export function geminiLightModel(): string {
  return key("GEMINI_MODEL_LEVE") ?? "gemini-3.5-flash-lite";
}

// O Groq aposenta modelos com frequência: o nome fica numa variável (GROQ_MODEL).
export function groqModel(): string {
  return key("GROQ_MODEL") ?? "openai/gpt-oss-120b";
}

// A ordem de quem tenta responder. "criar": o principal, depois o leve, depois a reserva.
// "rotina": o leve primeiro, para não gastar a cota pequena do principal com tarefa simples.
export function chainFor(tier: Tier = "criar"): Step[] {
  const steps: Step[] = [];
  if (key("GEMINI_API_KEY")) {
    const models = tier === "criar" ? (listOf("GEMINI_MODELOS_CRIAR") ?? [geminiModel(), geminiLightModel()]) : (listOf("GEMINI_MODELOS_ROTINA") ?? [geminiLightModel()]);
    for (const model of [...new Set(models)]) steps.push({ provider: "gemini", model });
  }
  if (key("GROQ_API_KEY")) steps.push({ provider: "groq", model: groqModel() });
  return steps;
}

// Modelo que acabou de bater o limite fica uns minutos de fora: não adianta fazer a pessoa esperar outro "não".
const resting = new Map<string, number>();
const REST_MS = 5 * 60 * 1000;
export function clearResting() {
  resting.clear();
}

async function failFrom(res: Response, step: Step): Promise<never> {
  const body = await res.text().catch(() => "");
  console.error(`${step.provider} ${step.model} respondeu ${res.status}:`, body.slice(0, 500));
  if (res.status === 429) resting.set(step.model, Date.now() + REST_MS);
  // Sobrecarga costuma passar logo: um minuto de fora já evita repetir a espera no pedido seguinte.
  if (res.status === 503) resting.set(step.model, Date.now() + 60_000);
  throw new AiError(`${step.provider} indisponível`, res.status === 429 ? "limit" : "unavailable");
}

// Tempo máximo de espera: modelo sobrecarregado pode levar minutos para dizer que não vai responder.
const TIMEOUT_MS = { gemini: 45_000, groq: 30_000 };
async function post(url: string, init: RequestInit, step: Step): Promise<Response> {
  try {
    return await fetch(url, { ...init, method: "POST", signal: AbortSignal.timeout(TIMEOUT_MS[step.provider]) });
  } catch (err) {
    console.error(`${step.provider} ${step.model} não respondeu a tempo:`, (err as Error).name);
    throw new AiError(`${step.provider} demorou demais`, "unavailable");
  }
}

// ── Gemini ────────────────────────────────────────────────────────────────
// O 2.5 mede o pensamento em tokens; do 3 em diante, em níveis.
function thinkingConfig(model: string, thinking?: Thinking): object {
  if (!thinking) return {};
  if (/^gemini-2\./.test(model)) return { thinkingConfig: { thinkingBudget: THINKING_BUDGET[thinking] } };
  return thinking === "zero" ? {} : { thinkingConfig: { thinkingLevel: thinking === "baixo" ? "low" : "high" } };
}

function geminiBody(req: AiRequest, model: string, withThinking = true): string {
  const { system, prompt, temperature = 0.9, schema, example, thinking } = req;
  return JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    // Com schema, o formato vai por configuração e não se repete no texto.
    contents: [{ role: "user", parts: [{ text: schema ? prompt : withExample(prompt, example) }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature,
      ...(schema ? { responseSchema: schema } : {}),
      ...(withThinking ? thinkingConfig(model, thinking) : {}),
    },
  });
}

const geminiUrl = (model: string, method: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}`;
const geminiHeaders = () => ({ "Content-Type": "application/json", "x-goog-api-key": key("GEMINI_API_KEY")! });

async function geminiPost(req: AiRequest, step: Step, method: string): Promise<Response> {
  let res = await post(geminiUrl(step.model, method), { headers: geminiHeaders(), body: geminiBody(req, step.model) }, step);
  // Modelo novo pode não aceitar a configuração de pensamento: tenta de novo sem ela, em vez de perder o pedido.
  if (res.status === 400 && req.thinking) res = await post(geminiUrl(step.model, method), { headers: geminiHeaders(), body: geminiBody(req, step.model, false) }, step);
  if (!res.ok) await failFrom(res, step);
  return res;
}

async function gemini(req: AiRequest, step: Step): Promise<string> {
  const data = await (await geminiPost(req, step, "generateContent")).json();
  const parts = (data?.candidates?.[0]?.content?.parts ?? []) as { text?: string; thought?: boolean }[];
  return parts.filter((p) => !p.thought && p.text).map((p) => p.text).join("");
}

// Mesmo pedido, mas a resposta chega aos poucos: onText recebe o texto acumulado a cada pedaço.
async function geminiStream(req: AiRequest, step: Step, onText: (sofar: string) => void): Promise<string> {
  const res = await geminiPost(req, step, "streamGenerateContent?alt=sse");
  if (!res.body) throw new AiError("gemini sem resposta", "unavailable");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.replace(/\r\n/g, "\n").split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      const line = event.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      try {
        const data = JSON.parse(line.slice(5));
        const parts = (data?.candidates?.[0]?.content?.parts ?? []) as { text?: string; thought?: boolean }[];
        const piece = parts.filter((p) => !p.thought && p.text).map((p) => p.text).join("");
        if (piece) {
          text += piece;
          onText(text);
        }
      } catch {
        // pedaço incompleto ou de controle: ignora
      }
    }
  }
  return text;
}

// ── Groq ──────────────────────────────────────────────────────────────────
// O schema do Gemini convertido para o formato estrito do Groq: todo campo é obrigatório,
// e o que era opcional passa a aceitar vazio (null).
type GeminiSchema = { type?: string; properties?: Record<string, GeminiSchema>; required?: string[]; items?: GeminiSchema; enum?: string[]; nullable?: boolean };
export function toJsonSchema(s: GeminiSchema, optional = false): Record<string, unknown> {
  const type = String(s.type ?? "string").toLowerCase();
  const maybe = optional || s.nullable === true;
  if (type === "object") {
    const required = s.required ?? Object.keys(s.properties ?? {});
    const properties = Object.fromEntries(Object.entries(s.properties ?? {}).map(([k, v]) => [k, toJsonSchema(v, !required.includes(k))]));
    return { type: maybe ? ["object", "null"] : "object", properties, required: Object.keys(properties), additionalProperties: false };
  }
  if (type === "array") return { type: maybe ? ["array", "null"] : "array", items: toJsonSchema(s.items ?? {}) };
  return { type: maybe ? [type, "null"] : type, ...(s.enum ? { enum: maybe ? [...s.enum, null] : s.enum } : {}) };
}

function groqBody(req: AiRequest, model: string, strict: boolean): string {
  const { system, prompt, temperature = 0.9, schema, example, thinking } = req;
  const useSchema = strict && schema;
  return JSON.stringify({
    model,
    temperature,
    // Os modelos gpt-oss pensam antes de responder; as tarefas simples pensam pouco, para caber no limite por minuto.
    ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: thinking === "medio" ? "medium" : "low" } : {}),
    response_format: useSchema ? { type: "json_schema", json_schema: { name: "resposta", strict: true, schema: toJsonSchema(schema as GeminiSchema) } } : { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: useSchema ? prompt : withExample(prompt, example) },
    ],
  });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function groq(req: AiRequest, step: Step): Promise<string> {
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${key("GROQ_API_KEY")}` };
  const url = "https://api.groq.com/openai/v1/chat/completions";
  let res = await post(url, { headers, body: groqBody(req, step.model, true) }, step);
  // Limite por minuto: se faltam poucos segundos para liberar, espera e tenta uma vez.
  if (res.status === 429) {
    const seconds = Number(res.headers.get("retry-after"));
    if (Number.isFinite(seconds) && seconds > 0 && seconds <= 12) {
      await wait(seconds * 1000 + 250);
      res = await post(url, { headers, body: groqBody(req, step.model, true) }, step);
    }
  }
  // Modelo que não aceita o formato estrito, ou que se perdeu nele: volta ao jeito antigo, com o exemplo no texto.
  if (res.status === 400 && req.schema) res = await post(url, { headers, body: groqBody(req, step.model, false) }, step);
  if (!res.ok) await failFrom(res, step);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

// Para o modelo que não aceita schema: o formato vai como exemplo no fim do pedido.
export function withExample(prompt: string, example?: string): string {
  return example ? `${prompt}\n\nResponda só com JSON: ${example}` : prompt;
}

export function parseJson(text: string): unknown {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(clean);
  } catch {
    throw new AiError("A IA devolveu uma resposta fora do formato.", "format");
  }
}

export function hasAiProvider(): boolean {
  return Boolean(key("GEMINI_API_KEY") || key("GROQ_API_KEY"));
}

async function report(req: AiRequest, step: Step, attempts: number, started: number) {
  const meta: AiMeta = { task: req.task ?? "sem-nome", provider: step.provider, model: step.model, attempts, ms: Date.now() - started };
  console.info(`ia ${JSON.stringify(meta)}`);
  try {
    await req.log?.(meta);
  } catch {
    // o registro nunca derruba a resposta
  }
}

// Percorre a ordem de modelos da tarefa. Resposta fora do formato ganha mais uma chance no mesmo modelo.
async function run(req: AiRequest, call: (step: Step) => Promise<string>): Promise<unknown> {
  const steps = chainFor(req.tier);
  if (steps.length === 0) throw new AiError("Nenhuma chave de IA configurada no servidor.", "config");
  const awake = steps.filter((s) => (resting.get(s.model) ?? 0) < Date.now());
  const started = Date.now();
  let attempts = 0;
  let last: unknown;
  // Se todos estão descansando, tenta todos mesmo assim: melhor um "não" de verdade do que desistir sem pedir.
  for (const step of awake.length ? awake : steps) {
    for (let again = 0; again < 2; again++) {
      attempts += 1;
      try {
        const data = parseJson(await call(step));
        await report(req, step, attempts, started);
        return data;
      } catch (err) {
        last = err;
        if (!(err instanceof AiError && err.kind === "format")) break;
      }
    }
  }
  if (last instanceof AiError) throw last;
  console.error("Falha ao chamar a IA:", last);
  throw new AiError("IA indisponível", "unavailable");
}

// Pede JSON ao primeiro modelo disponível da tarefa; se ele falhar, tenta o próximo.
export async function generateJson(req: AiRequest): Promise<unknown> {
  return run(req, (step) => (step.provider === "gemini" ? gemini(req, step) : groq(req, step)));
}

// Igual a generateJson, mas mostra o texto chegando (Gemini). O Groq responde de uma vez.
export async function generateJsonStream(req: AiRequest, onText: (sofar: string) => void): Promise<unknown> {
  return run(req, async (step) => {
    if (step.provider === "gemini") return geminiStream(req, step, onText);
    const text = await groq(req, step);
    onText(text);
    return text;
  });
}
