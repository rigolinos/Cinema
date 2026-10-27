// Camada única de IA (só no servidor). Trocar de fornecedor é configuração:
// GEMINI_API_KEY é o principal; GROQ_API_KEY entra quando o Gemini falha ou bate o limite.
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

// Orçamento de pensamento do Gemini 2.5 Flash, por tarefa: as criativas pensam mais (geram muitas e escolhem).
// Os tokens de pensamento contam nos limites do plano gratuito.
export const THINKING_BUDGET: Record<Thinking, number> = { zero: 0, baixo: 512, medio: 2048 };

export interface AiRequest {
  system: string;
  prompt: string;
  temperature?: number;
  schema?: object; // formato da resposta, por configuração (Gemini)
  example?: string; // o mesmo formato em JSON de exemplo, só para quem não aceita schema (Groq)
  thinking?: Thinking;
}

type Provider = (req: AiRequest) => Promise<string>;

function key(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v && !v.startsWith("your-") ? v : undefined;
}

async function failFrom(res: Response, provider: string): Promise<never> {
  const body = await res.text().catch(() => "");
  console.error(`${provider} respondeu ${res.status}:`, body.slice(0, 500));
  throw new AiError(`${provider} indisponível`, res.status === 429 ? "limit" : "unavailable");
}

// Modelo trocável sem mexer no código (GEMINI_MODEL na Vercel ou no .env.local).
export function geminiModel(): string {
  return key("GEMINI_MODEL") ?? "gemini-2.5-flash";
}

const gemini: Provider = async ({ system, prompt, temperature = 0.9, schema, example, thinking }) => {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel()}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key("GEMINI_API_KEY")! },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        // Com schema, o formato vai por configuração e não se repete no texto.
        contents: [{ role: "user", parts: [{ text: schema ? prompt : withExample(prompt, example) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature,
          ...(schema ? { responseSchema: schema } : {}),
          ...(thinking ? { thinkingConfig: { thinkingBudget: THINKING_BUDGET[thinking] } } : {}),
        },
      }),
    },
  );
  if (!res.ok) await failFrom(res, "Gemini");
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
};

// O Groq aposenta modelos com frequência: o nome fica numa variável (GROQ_MODEL).
export function groqModel(): string {
  return key("GROQ_MODEL") ?? "openai/gpt-oss-120b";
}

const groq: Provider = async ({ system, prompt, temperature = 0.9, example }) => {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key("GROQ_API_KEY")}` },
    body: JSON.stringify({
      model: groqModel(),
      temperature,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: withExample(prompt, example) },
      ],
    }),
  });
  if (!res.ok) await failFrom(res, "Groq");
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
};

// O Groq não aceita schema: o formato vai como exemplo no fim do pedido.
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

// Pede JSON ao primeiro fornecedor disponível; se ele falhar, tenta o próximo.
export async function generateJson(req: AiRequest): Promise<unknown> {
  const providers: Provider[] = [];
  if (key("GEMINI_API_KEY")) providers.push(gemini);
  if (key("GROQ_API_KEY")) providers.push(groq);
  if (providers.length === 0) throw new AiError("Nenhuma chave de IA configurada no servidor.", "config");

  let last: unknown;
  for (const provider of providers) {
    try {
      return parseJson(await provider(req));
    } catch (err) {
      last = err;
    }
  }
  if (last instanceof AiError) throw last;
  console.error("Falha ao chamar a IA:", last);
  throw new AiError("IA indisponível", "unavailable");
}
