import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiError, generateJson, groqModel } from "@/lib/ai";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("generateJson", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "chave-gemini");
    vi.stubEnv("GROQ_API_KEY", "chave-groq");
    vi.stubEnv("GROQ_MODEL", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("quando o Gemini bate o limite, a resposta vem do Groq com o modelo atual", async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      calls.push({ url, body: JSON.parse(String(init?.body ?? "{}")) });
      if (url.includes("googleapis")) return json({ error: "quota" }, 429);
      return json({ choices: [{ message: { content: '{"ideas":[{"title":"Do Groq"}]}' } }] });
    });

    await expect(generateJson({ system: "s", prompt: "p" })).resolves.toEqual({ ideas: [{ title: "Do Groq" }] });
    expect(calls.map((c) => (c.url.includes("groq") ? "groq" : "gemini"))).toEqual(["gemini", "groq"]);
    expect(calls[1].body.model).toBe("openai/gpt-oss-120b");
  });

  it("o modelo do Groq muda pela variável GROQ_MODEL", () => {
    vi.stubEnv("GROQ_MODEL", "qwen/qwen3.8-27b");
    expect(groqModel()).toBe("qwen/qwen3.8-27b");
  });

  it("se os dois falham por limite, avisa limite", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => json({ error: "quota" }, 429));
    await expect(generateJson({ system: "s", prompt: "p" })).rejects.toMatchObject({ kind: "limit" });
  });

  it("sem nenhuma chave, avisa configuração", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "");
    await expect(generateJson({ system: "s", prompt: "p" })).rejects.toBeInstanceOf(AiError);
    await expect(generateJson({ system: "s", prompt: "p" })).rejects.toMatchObject({ kind: "config" });
  });
});
