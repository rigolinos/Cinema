import { describe, expect, it } from "vitest";
import { describeSignal, memoryLines, memoryPrompt, memorySlots, normalizeMemory, readItems, shouldSummarize, signalDetail } from "@/lib/memoria";
import { shotTerms } from "@/lib/planos";

describe("sinais", () => {
  it("o detalhe guarda só textos curtos, números e listas pequenas", () => {
    const d = signalDetail({ pedido: "  Mais   engraçado ", n: 3, obj: { a: 1 }, ignored: ["a", 2, "b", "c", "d", "e", "f"], longo: "x".repeat(500) });
    expect(d).toEqual({ pedido: "Mais engraçado", n: 3, ignored: ["a", "b", "c", "d", "e"], longo: "x".repeat(160) });
  });

  it("cada sinal vira uma frase clara, terminando com o contexto do vídeo", () => {
    const video = { objective: "divertir", duration_s: 30, platforms: ["reels", "tiktok"], brief: "sketch de família com virada no fim" };
    expect(describeSignal({ kind: "ideia_escolhida", detail: { title: "3 erros", format: "3 erros que…", ignored: ["POV do time"] }, video })).toBe(
      'Escolheu a ideia "3 erros" no formato 3 erros que… (deixou de lado: "POV do time"). Briefing: "sketch de família com virada no fim" [divertir · 30 s · Reels, TikTok]',
    );
    expect(describeSignal({ kind: "pedido_ideia", detail: { pedido: "Mais engraçado" } })).toBe('Pediu às ideias: "Mais engraçado".');
    expect(describeSignal({ kind: "roteiro_editado", detail: { campo: "speech", bloco: "Gancho", antes: "Olá pessoal", depois: "E aí" } })).toBe(
      'Reescreveu à mão a fala do bloco Gancho: de "Olá pessoal" para "E aí".',
    );
    expect(describeSignal({ kind: "plano_pulado", detail: { plano: "aberto, de baixo" } })).toBe("Pulou no set um plano aberto, de baixo.");
    expect(describeSignal({ kind: "ideia_guardada", detail: { title: "3 erros", format: "POV" } })).toBe('Guardou para depois a ideia "3 erros" (POV).');
  });

  it("os sinais novos da v3", () => {
    const video = { objective: "vender", duration_s: 60, platforms: ["shorts"] };
    expect(describeSignal({ kind: "roteiro_colado", detail: { inicio: "Mãe: já comeu?" }, video })).toBe('Colou o próprio roteiro, que começa assim: "Mãe: já comeu?". [vender · 1 min · Shorts]');
    expect(describeSignal({ kind: "sugestao_aceita", detail: { bloco: "Gancho", antes: "Oi", depois: "Pare" } })).toBe('Aceitou a sugestão no bloco Gancho: de "Oi" para "Pare".');
    expect(describeSignal({ kind: "sugestao_recusada", detail: { bloco: "Gancho", sugestao: "Pare" } })).toBe('Manteve o próprio texto no bloco Gancho e recusou: "Pare".');
    expect(describeSignal({ kind: "porta_entrada", detail: { porta: "Já tenho a ideia" } })).toBe('Começou o vídeo por "Já tenho a ideia".');
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
      { text: "Prefere 30 s", source: "ia" as const },
    ];
    const out = normalizeMemory({ items: ["meu público é avançado", "Usa humor", "", ...Array.from({ length: 12 }, (_, i) => `Item ${i}`)], insight: " Percebi o humor " }, current);
    expect(out.items[0]).toEqual({ text: "Meu público é avançado", source: "voce" });
    expect(out.items[1]).toEqual({ text: "Usa humor", source: "ia" });
    expect(out.items).toHaveLength(10);
    expect(out.insight).toBe("Percebi o humor");
    expect(normalizeMemory(null, current).items).toEqual([current[0]]);
  });

  it("a IA escreve no máximo 6 frases, e nunca mais que 10 menos as da pessoa", () => {
    expect(memorySlots([])).toBe(6);
    expect(memorySlots(Array.from({ length: 6 }, (_, i) => ({ text: `x${i}`, source: "voce" as const })))).toBe(4);
  });

  it("o pedido de resumo vem em blocos, com os sinais do mais antigo para o mais novo", () => {
    const p = memoryPrompt({
      niche: "treino em casa",
      current: [
        { text: "Meu público é avançado", source: "voce" },
        { text: "Prefere 30 s", source: "ia" },
      ],
      signals: [{ kind: "pedido_ideia", detail: { pedido: "Mais engraçado" } }],
    });
    expect(p).toContain("<nicho>treino em casa</nicho>");
    expect(p).toContain("<a_pessoa_escreveu>\n(verdade; não mude nem repita)\nMeu público é avançado\n</a_pessoa_escreveu>");
    expect(p).toContain("<retrato_anterior>\nPrefere 30 s\n</retrato_anterior>");
    expect(p).toContain('<sinais>\n(do mais antigo para o mais novo)\nPediu às ideias: "Mais engraçado".\n</sinais>');
    expect(p).toContain("no máximo 6 frases de até 120 caracteres");
    expect(memoryPrompt({ niche: null, current: [], signals: [] })).not.toContain("<nicho>");
  });

  it("a memória entra nos pedidos como lista de frases; o que não tiver formato certo sai", () => {
    expect(memoryLines([{ text: " Usa humor ", source: "ia" }, { text: 2, source: "ia" }])).toEqual(["Usa humor"]);
    expect(memoryLines(null)).toEqual([]);
    expect(readItems([{ text: "a", source: "voce", extra: 1 }, { text: 2, source: "ia" }])).toEqual([{ text: "a", source: "voce" }]);
  });

  it("um plano vira poucas palavras para a memória", () => {
    expect(shotTerms({ framing: "close", angle: "altura_olhos", movement: "parado", description: "" })).toMatch(/^Close, .+, .+$/);
    expect(shotTerms({ framing: "close", angle: "altura_olhos", movement: "parado", description: "Rosto" })).toMatch(/: Rosto$/);
  });
});
