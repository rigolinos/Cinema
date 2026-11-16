import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiError, chainFor, clearResting, generateJson, groqModel, toJsonSchema, type AiMeta } from "@/lib/ai";

type Body = {
  model?: string;
  reasoning_effort?: string;
  response_format?: { type: string; json_schema?: { schema: unknown } };
  messages?: { content: string }[];
  generationConfig?: { thinkingConfig?: unknown };
};

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
const groqSays = (content: string) => json({ choices: [{ message: { content } }] });
const geminiSays = (text: string) => json({ candidates: [{ content: { parts: [{ text }] } }] });

describe("generateJson", () => {
  let calls: { url: string; body: Body }[];
  const mock = (answer: (url: string, body: Body, n: number) => Response) => {
    calls = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}")) as Body;
      calls.push({ url, body });
      return answer(url, body, calls.length);
    });
  };
  const who = () => calls.map((c) => (c.url.includes("groq") ? `groq:${c.body.model}` : `gemini:${/models\/([^:]+):/.exec(c.url)?.[1]}`));

  beforeEach(() => {
    clearResting();
    vi.stubEnv("GEMINI_API_KEY", "chave-gemini");
    vi.stubEnv("GROQ_API_KEY", "chave-groq");
    for (const name of ["GROQ_MODEL", "GEMINI_MODEL", "GEMINI_MODEL_LEVE", "GEMINI_MODELOS_CRIAR", "GEMINI_MODELOS_ROTINA"]) vi.stubEnv(name, "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("criar tenta o principal, depois o leve e por fim a reserva", async () => {
    mock((url) => (url.includes("googleapis") ? json({ error: "quota" }, 429) : groqSays('{"ideas":[{"title":"Do Groq"}]}')));
    await expect(generateJson({ system: "s", prompt: "p" })).resolves.toEqual({ ideas: [{ title: "Do Groq" }] });
    expect(who()).toEqual(["gemini:gemini-2.5-flash", "gemini:gemini-3.5-flash-lite", "groq:openai/gpt-oss-120b"]);
  });

  it("rotina começa pelo modelo leve e não gasta o principal", async () => {
    mock(() => geminiSays('{"ok":true}'));
    await generateJson({ system: "s", prompt: "p", tier: "rotina" });
    expect(who()).toEqual(["gemini:gemini-3.5-flash-lite"]);
    expect(chainFor("rotina").map((s) => s.model)).toEqual(["gemini-3.5-flash-lite", "openai/gpt-oss-120b"]);
  });

  it("a ordem dos modelos muda por variável", () => {
    vi.stubEnv("GEMINI_MODELOS_CRIAR", "gemini-3.8-flash, gemini-3.5-flash-lite");
    vi.stubEnv("GROQ_MODEL", "qwen/qwen3.8-27b");
    expect(groqModel()).toBe("qwen/qwen3.8-27b");
    expect(chainFor("criar").map((s) => s.model)).toEqual(["gemini-3.8-flash", "gemini-3.5-flash-lite", "qwen/qwen3.8-27b"]);
  });

  it("modelo que bateu o limite descansa e não é chamado no pedido seguinte", async () => {
    mock((url) => (url.includes("2.5-flash") ? json({ error: "quota" }, 429) : geminiSays('{"ok":true}')));
    await generateJson({ system: "s", prompt: "p" });
    await generateJson({ system: "s", prompt: "p" });
    expect(who()).toEqual(["gemini:gemini-2.5-flash", "gemini:gemini-3.5-flash-lite", "gemini:gemini-3.5-flash-lite"]);
  });

  it("resposta fora do formato ganha mais uma chance no mesmo modelo", async () => {
    mock((_, __, n) => geminiSays(n === 1 ? "isto não é JSON" : '{"ok":true}'));
    const seen: AiMeta[] = [];
    await expect(generateJson({ system: "s", prompt: "p", tier: "rotina", task: "planos", log: (m) => void seen.push(m) })).resolves.toEqual({ ok: true });
    expect(who()).toEqual(["gemini:gemini-3.5-flash-lite", "gemini:gemini-3.5-flash-lite"]);
    expect(seen).toMatchObject([{ task: "planos", provider: "gemini", model: "gemini-3.5-flash-lite", attempts: 2 }]);
  });

  it("o pensamento vai em tokens no 2.5 e em nível nos modelos novos", async () => {
    mock((url) => (url.includes("2.5-flash") ? json({ error: "x" }, 503) : geminiSays('{"ok":true}')));
    await generateJson({ system: "s", prompt: "p", thinking: "medio" });
    expect(calls[0].body.generationConfig?.thinkingConfig).toEqual({ thinkingBudget: 2048 });
    expect(calls[1].body.generationConfig?.thinkingConfig).toEqual({ thinkingLevel: "high" });
  });

  it("se o modelo recusar a configuração de pensamento, tenta sem ela", async () => {
    mock((_, body) => (body.generationConfig?.thinkingConfig ? json({ error: "invalid argument" }, 400) : geminiSays('{"ok":true}')));
    await expect(generateJson({ system: "s", prompt: "p", tier: "rotina", thinking: "baixo" })).resolves.toEqual({ ok: true });
    expect(calls).toHaveLength(2);
  });

  it("a reserva recebe o formato exato da resposta e pensa pouco em tarefa simples", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    mock(() => groqSays('{"cor":"azul"}'));
    await generateJson({ system: "s", prompt: "p", thinking: "baixo", schema: { type: "OBJECT", properties: { cor: { type: "STRING" } }, required: ["cor"] }, example: '{"cor":""}' });
    expect(calls[0].body.response_format?.type).toBe("json_schema");
    expect(calls[0].body.response_format?.json_schema?.schema).toEqual({ type: "object", properties: { cor: { type: "string" } }, required: ["cor"], additionalProperties: false });
    expect(calls[0].body.reasoning_effort).toBe("low");
    expect(calls[0].body.messages?.[1].content).toBe("p");
  });

  it("se a reserva recusar o formato exato, volta ao exemplo no texto", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    mock((_, body) => (body.response_format?.type === "json_schema" ? json({ error: "json_validate_failed" }, 400) : groqSays('{"cor":"azul"}')));
    await expect(generateJson({ system: "s", prompt: "p", schema: { type: "OBJECT", properties: { cor: { type: "STRING" } } }, example: '{"cor":""}' })).resolves.toEqual({ cor: "azul" });
    expect(calls[1].body.messages?.[1].content).toContain('Responda só com JSON: {"cor":""}');
  });

  it("limite por minuto da reserva: espera os segundos pedidos e tenta de novo", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.useFakeTimers();
    mock((_, __, n) => (n === 1 ? json({ error: "rate" }, 429, { "retry-after": "2" }) : groqSays('{"ok":true}')));
    const pending = generateJson({ system: "s", prompt: "p" });
    await vi.advanceTimersByTimeAsync(3000);
    await expect(pending).resolves.toEqual({ ok: true });
    vi.useRealTimers();
  });

  it("se todos falham por limite, avisa limite", async () => {
    mock(() => json({ error: "quota" }, 429));
    await expect(generateJson({ system: "s", prompt: "p" })).rejects.toMatchObject({ kind: "limit" });
  });

  it("sem nenhuma chave, avisa configuração", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "");
    await expect(generateJson({ system: "s", prompt: "p" })).rejects.toBeInstanceOf(AiError);
    await expect(generateJson({ system: "s", prompt: "p" })).rejects.toMatchObject({ kind: "config" });
  });
});

describe("toJsonSchema", () => {
  it("campo opcional passa a aceitar vazio, e lista de valores também", () => {
    const out = toJsonSchema({ type: "OBJECT", properties: { title: { type: "STRING" }, format: { type: "STRING", enum: ["a", "b"], nullable: true }, extra: { type: "INTEGER" } }, required: ["title"] });
    expect(out).toEqual({
      type: "object",
      properties: { title: { type: "string" }, format: { type: ["string", "null"], enum: ["a", "b", null] }, extra: { type: ["integer", "null"] } },
      required: ["title", "format", "extra"],
      additionalProperties: false,
    });
  });

  it("converte listas de objetos", () => {
    expect(toJsonSchema({ type: "ARRAY", items: { type: "OBJECT", properties: { n: { type: "INTEGER" } }, required: ["n"] } })).toEqual({
      type: "array",
      items: { type: "object", properties: { n: { type: "integer" } }, required: ["n"], additionalProperties: false },
    });
  });
});
