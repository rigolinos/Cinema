import { describe, expect, it } from "vitest";
import { assembleFromReading, faithful, normalizeReading, readingAsSegments, readingLines, readingSegments, type Reading } from "@/lib/leitura";
import { assembleTask, readingTask } from "@/lib/prompts/tarefas";

const pasted = `como as noticias correm na minha escola
manu e lorenzo discutindo (plano aberto) natasha sai de tras de um banco com cara de susto
Natasha: amiga nem sabe o q eu vi agora
Kira: oq?
Natasha: a Manu e o Lorenzo se pegando no pau la na quadra de basquete`;

const raw = {
  summary: "Natasha conta para a Kira a briga que viu na quadra.",
  tone: "humor, fofoca de escola",
  people: ["Natasha", "Kira", "Manu", "Lorenzo", "Natasha"],
  items: [
    { kind: "tela", speaker: "", text: "Como as notícias correm na minha escola" },
    { kind: "acao", speaker: "", text: "Manu e Lorenzo discutindo." },
    { kind: "camera", speaker: "", text: "plano aberto" },
    { kind: "acao", speaker: "", text: "Natasha sai de trás de um banco com cara de susto." },
    { kind: "fala", speaker: "Natasha", text: "Amiga, nem sabe o que eu vi agora." },
    { kind: "fala", speaker: "Kira", text: "O quê?" },
    { kind: "fala", speaker: "Natasha", text: "A Manu e o Lorenzo se pegando no pau lá na quadra de basquete." },
  ],
};

const reading = normalizeReading(raw) as Reading;

describe("leitura do roteiro colado", () => {
  it("numera os itens, tira quem fala de quem não fala e repetição de nomes", () => {
    expect(reading.items.map((i) => i.n)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(reading.items[0].speaker).toBeNull();
    expect(reading.people).toEqual(["Natasha", "Kira", "Manu", "Lorenzo"]);
    expect(normalizeReading({ items: [] })).toBeNull();
    expect(normalizeReading({ items: [{ kind: "xyz", text: "Oi" }] })?.items[0].kind).toBe("fala");
  });

  it("aceita correção de ortografia e recusa reescrita", () => {
    expect(faithful(reading, pasted)).toBe(true);
    const rewritten = normalizeReading({
      ...raw,
      items: [{ kind: "fala", speaker: "Natasha", text: "Gente, vocês não fazem ideia do escândalo que presenciei hoje no colégio durante o intervalo entre as aulas." }],
    }) as Reading;
    expect(faithful(rewritten, pasted)).toBe(false);
  });

  it("monta as partes: campo pelo tipo, nome na frente quando há conversa, câmera entre parênteses", () => {
    const blocks = assembleFromReading(reading, {
      labels: ["A notícia", "A fofoca"],
      items: [
        { n: 1, block: 1, kind: "gancho" },
        { n: 2, block: 1, kind: "gancho" },
        { n: 3, block: 1, kind: "gancho" },
        { n: 4, block: 1, kind: "gancho" },
        { n: 5, block: 2, kind: "contexto" },
        { n: 6, block: 2, kind: "contexto" },
        { n: 7, block: 2, kind: "contexto" },
      ],
    });
    expect(blocks).toEqual([
      {
        kind: "gancho",
        label: "A notícia",
        speech: "",
        on_screen: "Como as notícias correm na minha escola",
        action: "Manu e Lorenzo discutindo. (plano aberto) Natasha sai de trás de um banco com cara de susto.",
      },
      {
        kind: "contexto",
        label: "A fofoca",
        speech: "Natasha: Amiga, nem sabe o que eu vi agora.\nKira: O quê?\nNatasha: A Manu e o Lorenzo se pegando no pau lá na quadra de basquete.",
        on_screen: "",
        action: "",
      },
    ]);
  });

  it("divisão que não fecha volta null (item faltando ou repetido)", () => {
    expect(assembleFromReading(reading, { items: [{ n: 1, block: 1, kind: "gancho" }] })).toBeNull();
    expect(assembleFromReading(reading, { items: reading.items.map(() => ({ n: 1, block: 1, kind: "gancho" })) })).toBeNull();
  });

  it("sem a segunda chamada, os itens corrigidos viram trechos", () => {
    expect(readingAsSegments(reading)[5]).toEqual({ n: 6, text: "Kira: O quê?" });
    expect(readingSegments(reading).split("\n")[4]).toBe("5. [fala · Natasha] Amiga, nem sabe o que eu vi agora.");
  });

  it("o que os outros passos recebem: resumo, tom, quem aparece e a câmera da pessoa", () => {
    expect(readingLines(reading)).toEqual([
      "Do que trata: Natasha conta para a Kira a briga que viu na quadra.",
      "Tom: humor, fofoca de escola",
      "Quem aparece: Natasha, Kira, Manu, Lorenzo",
      "Indicações de câmera que a pessoa escreveu: plano aberto",
    ]);
    expect(readingLines(null)).toEqual([]);
  });

  it("as duas chamadas não levam mestre: uma lê, a outra só divide", () => {
    for (const t of [readingTask(), assembleTask()]) {
      expect(t.system).not.toContain("OBJETIVO DESTE VÍDEO");
      expect(t.temperature).toBe(0.2);
    }
    expect(readingTask().system).toContain("Corrija erro de ortografia");
    expect(readingTask().system).toContain("Mantenha o jeito dela");
  });
});
