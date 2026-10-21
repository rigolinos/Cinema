import { describe, expect, it } from "vitest";
import {
  blockSeconds,
  checkScript,
  draftPrompt,
  normalizeDraft,
  normalizeRewrite,
  rewritePrompt,
  scriptAsText,
  timeline,
  totalSeconds,
  wordCount,
  type ScriptBlock,
  type ScriptBrief,
} from "@/lib/roteiro";

const b = (kind: ScriptBlock["kind"], speech: string, extra: Partial<ScriptBlock> = {}): ScriptBlock => ({
  kind,
  label: null,
  speech,
  on_screen: "",
  action: "",
  ...extra,
});

const words = (n: number) => Array.from({ length: n }, () => "palavra").join(" ");

describe("tempo", () => {
  it("conta palavras sem pontuação solta", () => {
    expect(wordCount("  Você erra isso — e muito!  ")).toBe(5);
    expect(wordCount("")).toBe(0);
  });

  it("estima 2,6 palavras por segundo, com mínimo para bloco sem fala", () => {
    expect(blockSeconds(b("conteudo", words(26)))).toBe(10);
    expect(blockSeconds(b("conteudo", ""))).toBe(1.5);
  });

  it("monta a linha do tempo de cada bloco", () => {
    const blocks = [b("gancho", words(8)), b("conteudo", words(26)), b("chamada", "")];
    expect(timeline(blocks)).toEqual([
      { start: 0, end: 3 },
      { start: 3, end: 13 },
      { start: 13, end: 15 },
    ]);
    expect(totalSeconds(blocks)).toBe(15);
  });
});

describe("checkScript", () => {
  it("passa um roteiro no tempo, com gancho curto e chamada final", () => {
    const checks = checkScript([b("gancho", words(8)), b("conteudo", words(40)), b("chamada", words(8))], 30);
    expect(checks).toEqual([{ level: "ok", text: expect.stringContaining("dentro do tempo") }]);
  });

  it("avisa tempo estourado, gancho longo e falta de chamada", () => {
    const checks = checkScript([b("gancho", words(15)), b("conteudo", words(120))], 30);
    expect(checks.map((c) => c.text).join(" ")).toMatch(/Passou do tempo/);
    expect(checks.map((c) => c.text).join(" ")).toMatch(/Gancho longo \(15 palavras\)/);
    expect(checks.map((c) => c.text).join(" ")).toMatch(/Sem chamada final/);
  });

  it("avisa quando falta o gancho ou ele não é o primeiro", () => {
    expect(checkScript([b("conteudo", "x"), b("chamada", "y")], null)[0].text).toMatch(/Falta o gancho/);
    expect(checkScript([b("conteudo", "x"), b("gancho", "y"), b("chamada", "z")], null)[0].text).toMatch(/primeiro bloco/);
  });
});

describe("normalizeDraft", () => {
  it("corrige tipo desconhecido, descarta bloco vazio e põe o gancho primeiro", () => {
    const blocks = normalizeDraft({
      blocks: [
        { kind: "contexto", speech: "Contexto" },
        { kind: "gancho", speech: "Gancho", on_screen: "3 ERROS" },
        { kind: "monologo", speech: "Algo" },
        { kind: "conteudo" },
        { kind: "chamada", speech: "Segue", label: "  " },
      ],
    });
    expect(blocks.map((x) => x.kind)).toEqual(["gancho", "contexto", "conteudo", "chamada"]);
    expect(blocks[0]).toEqual({ kind: "gancho", label: null, speech: "Gancho", on_screen: "3 ERROS", action: "" });
    expect(normalizeDraft({ blocks: "não" })).toEqual([]);
    expect(normalizeDraft({ blocks: Array.from({ length: 20 }, () => ({ kind: "conteudo", speech: "x" })) })).toHaveLength(12);
  });

  it("aceita a reescrita de um bloco só com algum conteúdo", () => {
    expect(normalizeRewrite({ speech: " Mais curto. " })).toEqual({ speech: "Mais curto.", on_screen: "", action: "" });
    expect(normalizeRewrite({})).toBeNull();
  });
});

describe("prompts", () => {
  const brief: ScriptBrief = {
    niche: "treino em casa",
    title: "3 erros no treino",
    hook: "Você erra isso.",
    formatSlug: "tres-erros",
    objective: "crescer",
    platform: "reels",
    durationS: 30,
    resources: ["sozinho"],
  };

  it("o rascunho leva a ideia, a estrutura do formato e o orçamento de palavras", () => {
    const p = draftPrompt(brief);
    expect(p).toContain('Gancho escolhido: "Você erra isso."');
    expect(p).toContain("Erro 1 e a correção");
    expect(p).toContain("NO MÁXIMO 70 palavras");
  });

  it("a reescrita marca só o bloco pedido", () => {
    const p = rewritePrompt(brief, [b("gancho", "A"), b("conteudo", "B")], 1, "mais engraçado");
    expect(p).toContain(">>> 2. [conteudo]");
    expect(p).not.toContain(">>> 1.");
    expect(p).toContain("Pedido da pessoa: mais engraçado");
  });
});

describe("scriptAsText", () => {
  it("gera texto para copiar com tempo, fala, tela e cena", () => {
    const text = scriptAsText("3 erros", [b("gancho", words(8), { on_screen: "3 ERROS" }), b("chamada", "Segue", { label: "Final", action: "Aponta" })]);
    expect(text).toContain("3 ERROS\n\n[0–3 s] Gancho");
    expect(text).toContain("NA TELA: 3 ERROS");
    expect(text).toContain("[3–5 s] Final\nFALA: Segue\nCENA: Aponta");
  });
});
