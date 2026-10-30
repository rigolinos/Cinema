import { describe, expect, it } from "vitest";
import { cueParts, isMe, myLines, speechLines, splitAction, type GuestBlock } from "@/lib/convidado";

const blocks: GuestBlock[] = [
  {
    number: 2,
    label: "A fofoca",
    speech: "Natasha: Amiga, nem sabe o que eu vi agora!\nKira: O quê?\nNatasha: A Manu e o Lorenzo se pegando no pau lá na quadra...\nKira: Mentiraaa, kkkk!",
    mine: true,
    cue: "Como as notícias correm",
  },
  { number: 3, label: null, speech: "Kira: Juro que não conto pra ninguém.", mine: true, cue: "Kira: Mentiraaa, kkkk!" },
  { number: 4, label: null, speech: "Eu vou contar pra todo mundo.", mine: true, cue: "Kira: Juro que não conto pra ninguém." },
  { number: 5, label: null, speech: "Natasha: Fim.", mine: false, cue: null },
];

describe("falas do convidado", () => {
  it("separa quem fala do que é falado", () => {
    expect(speechLines("Kira: O quê?\nsem nome")).toEqual([
      { speaker: "Kira", text: "O quê?", raw: "Kira: O quê?" },
      { speaker: null, text: "sem nome", raw: "sem nome" },
    ]);
  });

  it("reconhece pelo primeiro nome, sem ligar para acento e maiúscula", () => {
    expect(isMe("kira", "Kira Souza")).toBe(true);
    expect(isMe("Tânia", "tania")).toBe(true);
    expect(isMe("Natasha", "Kira")).toBe(false);
  });

  it("cada fala dela vem com a deixa: a linha anterior, ou a última da parte anterior", () => {
    expect(myLines(blocks, "Kira")).toEqual([
      { block: 2, cue: "Natasha: Amiga, nem sabe o que eu vi agora!", text: "O quê?" },
      { block: 2, cue: "Natasha: A Manu e o Lorenzo se pegando no pau lá na quadra...", text: "Mentiraaa, kkkk!" },
      { block: 3, cue: "Kira: Mentiraaa, kkkk!", text: "Juro que não conto pra ninguém." },
      { block: 4, cue: "Kira: Juro que não conto pra ninguém.", text: "Eu vou contar pra todo mundo." },
    ]);
  });
});

describe("tela do convidado", () => {
  it("deixa curta: quem fala e as últimas palavras", () => {
    expect(cueParts("Natasha: Amiga, nem sabe o que eu vi agora!")).toEqual({ speaker: "Natasha", tail: "…nem sabe o que eu vi agora!" });
    expect(cueParts("Natasha: Oi!")).toEqual({ speaker: "Natasha", tail: "Oi!" });
    expect(cueParts("Como as notícias correm")).toEqual({ speaker: null, tail: "Como as notícias correm" });
  });

  it("separa a câmera da ação", () => {
    expect(splitAction("Manu e Lorenzo discutindo. (plano aberto) Natasha sai de trás de um banco.")).toEqual({
      text: "Manu e Lorenzo discutindo. Natasha sai de trás de um banco.",
      camera: ["plano aberto"],
    });
    expect(splitAction("Sem câmera.")).toEqual({ text: "Sem câmera.", camera: [] });
  });
});
