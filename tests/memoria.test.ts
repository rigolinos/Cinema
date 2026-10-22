import { describe, expect, it } from "vitest";
import { describeSignal, memoryContext, memoryPrompt, normalizeMemory, readItems, shouldSummarize, signalDetail, withMemory } from "@/lib/memoria";
import { shotTerms } from "@/lib/planos";

describe("sinais", () => {
  it("o detalhe guarda só textos curtos, números e listas pequenas", () => {
    const d = signalDetail({ pedido: "  Mais   engraçado ", n: 3, obj: { a: 1 }, ignored: ["a", 2, "b", "c", "d", "e", "f"], longo: "x".repeat(500) });
    expect(d).toEqual({ pedido: "Mais engraçado", n: 3, ignored: ["a", "b", "c", "d", "e"], longo: "x".repeat(160) });
  });

  it("cada sinal vira uma frase clara para a IA", () => {
    expect(describeSignal({ kind: "ideia_escolhida", detail: { title: "3 erros", format: "3 erros que…", ignored: ["POV do time"] } })).toBe(
      'Escolheu a ideia "3 erros" no formato 3 erros que… (deixou de lado: "POV do time")',
    );
    expect(describeSignal({ kind: "pedido_ideia", detail: { pedido: "Mais engraçado" } })).toBe('Pediu às ideias: "Mais engraçado"');
    expect(describeSignal({ kind: "roteiro_editado", detail: { campo: "speech", bloco: "Gancho", antes: "Olá pessoal", depois: "E aí" } })).toBe(
      'Reescreveu à mão a fala do bloco Gancho: de "Olá pessoal" para "E aí"',
    );
    expect(describeSignal({ kind: "plano_pulado", detail: { plano: "aberto, de baixo" } })).toBe("Pulou no set um plano aberto, de baixo");
  });
});

describe("quando resumir", () => {
  const now = new Date("2026-10-22T12:00:00Z");
  it("só com 5 sinais novos e pelo menos 12 horas desde o último resumo", () => {
    expect(shouldSummarize({ newSignals: 4, summarizedAt: null, now })).toBe(false);
    expect(shouldSummarize({ newSignals: 5, summarizedAt: null, now })).toBe(true);
    expect(shouldSummarize({ newSignals: 9, summarizedAt: "2026-10-22T06:00:00Z", now })).toBe(false);
    expect(shouldSummarize({ newSignals: 9, summarizedAt: "2026-10-21T23:00:00Z", now })).toBe(true);
  });
});

describe("resumo", () => {
  it("o que a pessoa escreveu fica fixo; a IA não repete nem passa de 10 itens", () => {
    const current = [
      { text: "Meu público é avançado", source: "voce" as const },
      { text: "Você prefere 30 s", source: "ia" as const },
    ];
    const out = normalizeMemory({ items: ["meu público é avançado", "Você usa humor", "", ...Array.from({ length: 12 }, (_, i) => `Item ${i}`)], insight: " Percebi o humor " }, current);
    expect(out.items[0]).toEqual({ text: "Meu público é avançado", source: "voce" });
    expect(out.items[1]).toEqual({ text: "Você usa humor", source: "ia" });
    expect(out.items).toHaveLength(10);
    expect(out.insight).toBe("Percebi o humor");
    expect(normalizeMemory(null, current).items).toEqual([current[0]]);
  });

  it("o pedido de resumo separa o que é da pessoa do que a IA já tinha entendido", () => {
    const p = memoryPrompt({
      niche: "treino em casa",
      current: [
        { text: "Meu público é avançado", source: "voce" },
        { text: "Você prefere 30 s", source: "ia" },
      ],
      signals: [{ kind: "pedido_ideia", detail: { pedido: "Mais engraçado" } }],
    });
    expect(p).toContain("verdade, não mude nem repita):\n- Meu público é avançado");
    expect(p).toContain("atualize, corrija ou mantenha):\n- Você prefere 30 s");
    expect(p).toContain('- Pediu às ideias: "Mais engraçado"');
  });

  it("a memória entra nos pedidos só quando existe", () => {
    expect(memoryContext([])).toBe("");
    expect(memoryContext(null)).toBe("");
    expect(memoryContext([{ text: "Você prefere humor", source: "ia" }])).toBe(
      "O que já sabemos sobre este criador (use para personalizar; não repita estas frases):\n- Você prefere humor\n",
    );
  });

  it("sem memória o pedido não muda; com ela, vem antes, e a quinzena pede uma fora do padrão", () => {
    expect(withMemory("PEDIDO", null)).toBe("PEDIDO");
    expect(withMemory("PEDIDO", [{ text: "lixo" }, "x"])).toBe("PEDIDO");
    const items = [{ text: "Você prefere humor", source: "ia" }];
    expect(withMemory("PEDIDO", items)).toMatch(/- Você prefere humor\n\nPEDIDO$/);
    expect(withMemory("PEDIDO", items, { surprise: true })).toContain("UMA das sugestões fugir desse padrão");
    expect(readItems([{ text: "a", source: "voce", extra: 1 }, { text: 2, source: "ia" }])).toEqual([{ text: "a", source: "voce" }]);
  });

  it("um plano vira poucas palavras para a memória", () => {
    expect(shotTerms({ framing: "close", angle: "altura_olhos", movement: "parado", description: "" })).toMatch(/^Close, .+, .+$/);
    expect(shotTerms({ framing: "close", angle: "altura_olhos", movement: "parado", description: "Rosto" })).toMatch(/: Rosto$/);
  });
});
