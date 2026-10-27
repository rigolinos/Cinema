import { describe, expect, it } from "vitest";
import {
  blockSeconds,
  checkScript,
  maxWords,
  normalizeSuggestions,
  scriptForPrompt,
  speakerOf,
  normalizeDraft,
  normalizeRewrite,
  scriptAsText,
  timeline,
  totalSeconds,
  wordCount,
  type ScriptBlock,
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

describe("sugestões e contexto", () => {
  const blocks = [b("gancho", "Oi gente, hoje vou falar"), b("conteudo", "Erro 1"), b("chamada", "Segue aí")];

  it("no máximo 4 sugestões, 1 por bloco, só em blocos que existem e só se mudarem algo", () => {
    const r = normalizeSuggestions(
      {
        note: " Bom roteiro ",
        suggestions: [
          { block: 1, speech: "Você erra isso todo dia", reason: "Prende antes." },
          { block: 1, speech: "Outra", reason: "Repetida." },
          { block: 9, speech: "Fora", reason: "Não existe." },
          { block: 2, speech: "Erro 1", reason: "Igual ao original." },
          { block: 3, speech: "Me segue para a parte 2", reason: "" },
        ],
      },
      blocks,
    );
    expect(r.note).toBe("Bom roteiro");
    expect(r.suggestions).toEqual([{ block: 1, speech: "Você erra isso todo dia", on_screen: "", action: "", reason: "Prende antes." }]);
  });

  it("o roteiro vai numerado a partir de 1, com o bloco a mudar marcado", () => {
    const text = scriptForPrompt(blocks, 1);
    expect(text).toContain("1. [gancho] FALA: Oi gente");
    expect(text).toContain(">>> 2. [conteudo]");
    expect(text).not.toContain(">>> 1.");
  });

  it("limite de palavras do rascunho pela duração", () => {
    expect(maxWords(30)).toBe(70);
    expect(maxWords(15)).toBe(35);
  });

  it("em Divertir a chamada final é opcional", () => {
    const checks = checkScript([b("gancho", words(8)), b("virada", words(30))], 15, "divertir");
    expect(checks.map((c) => c.text).join(" ")).not.toMatch(/Sem chamada final/);
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

describe("quem fala", () => {
  const people = [
    { id: "p1", name: "Natasha", role: "ator" },
    { id: "p2", name: "Rodrigo", role: "eu" },
  ];
  it("a pessoa marcada no bloco; você mesmo; ou você para a câmera quando grava sozinho", () => {
    expect(speakerOf({ person_id: "p1" }, people, false)).toBe("Natasha");
    expect(speakerOf({ person_id: "p2" }, people, false)).toBe("você");
    expect(speakerOf({ person_id: null }, people, true)).toBe("você, para a câmera");
    expect(speakerOf({}, people, false)).toBeNull();
  });
});
