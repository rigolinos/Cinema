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

export interface AiRequest {
  system: string;
  prompt: string;
  temperature?: number;
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

const gemini: Provider = async ({ system, prompt, temperature = 0.9 }) => {
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key("GEMINI_API_KEY")! },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature },
      }),
    },
  );
  if (!res.ok) await failFrom(res, "Gemini");
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
};

const groq: Provider = async ({ system, prompt, temperature = 0.9 }) => {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key("GROQ_API_KEY")}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) await failFrom(res, "Groq");
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
};

export function parseJson(text: string): unknown {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(clean);
  } catch {
    throw new AiError("A IA devolveu uma resposta fora do formato.", "format");
  }
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
