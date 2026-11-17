import { describe, expect, it } from "vitest";
import {
  blockSeconds,
  checkScript,
  maxWords,
  normalizeSuggestions,
  scriptForPrompt,
  speakerOf,
  capitalizeNames,
  isStageNote,
  polishBlock,
  storyFromText,
  storyText,
  withSpeakers,
  normalizeDraft,
  normalizeRewrite,
  scriptAsText,
  normalizeHeading,
  sceneHeading,
  sceneGroups,
  hasCut,
  splitCuts,
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
    // Só ação, sem fala: a cena dura o tempo da ação.
    expect(blockSeconds({ speech: "", action: words(24) })).toBe(8);
    expect(blockSeconds({ speech: words(26), action: words(6) })).toBe(10);
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
  it("roteiro com gancho curto e chamada final não tem aviso, curto ou no tempo", () => {
    expect(checkScript([b("gancho", words(8)), b("conteudo", words(40)), b("chamada", words(8))], 30)).toEqual([]);
    expect(checkScript([b("gancho", words(5)), b("chamada", words(3))], 60)).toEqual([]);
  });

  it("avisa tempo estourado, gancho longo e falta de chamada", () => {
    const checks = checkScript([b("gancho", words(15)), b("conteudo", words(120))], 30);
    expect(checks.map((c) => c.text).join(" ")).toMatch(/Passou bastante do tempo/);
    expect(checks.map((c) => c.text).join(" ")).toMatch(/Gancho longo \(15 palavras\)/);
    expect(checks.map((c) => c.text).join(" ")).toMatch(/Sem chamada final/);
  });

  it("avisa quando falta o gancho ou ele não é o primeiro", () => {
    expect(checkScript([b("conteudo", "x"), b("chamada", "y")], null)[0].text).toMatch(/Falta o gancho/);
    expect(checkScript([b("conteudo", "x"), b("gancho", "y"), b("chamada", "z")], null)[0].text).toMatch(/primeira cena/);
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
    expect(blocks[0]).toEqual({ kind: "gancho", label: null, speech: "Gancho", on_screen: "3 ERROS", action: "", heading: null });
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
  it("copia no formato de roteiro: cabeçalho, ação, NOME e fala, texto na tela", () => {
    const text = scriptAsText(
      "3 erros",
      [b("gancho", "Rafa: Amor, olha isso.\nNatasha: De novo?", { action: "Ele mostra o celular.", on_screen: "5 APPS DEPOIS" }), b("chamada", "Segue", { action: "Aponta" })],
      { places: ["Sala", null], speakers: [null, "Rafa"], cast: ["Rafa", "Natasha"] },
    );
    expect(text).toContain("3 ERROS\n\n\n1. SALA\n\nEle mostra o celular.\n\nRAFA\nAmor, olha isso.\n\nNATASHA\nDe novo?\n\nNA TELA: 5 APPS DEPOIS");
    expect(text).toContain("CENA 2\n\nAponta\n\nRAFA\nSegue");
    expect(text).not.toMatch(/FALA:|O QUE ACONTECE:|\[\d/);
  });

  it("só é nome quem está no vídeo; sem ninguém na cena, a fala fica inteira", () => {
    expect(scriptAsText("x", [b("gancho", "Primeiro erro: pouca água")], { cast: ["Rafa"] })).toContain("CENA 1\n\nPrimeiro erro: pouca água");
  });
});

describe("quem fala", () => {
  const people = [
    { id: "p1", name: "Natasha", role: "ator" },
    { id: "p2", name: "Rodrigo", role: "eu" },
  ];
  it("escreve quem fala na fala, para a IA dos planos, sem repetir nem inventar", () => {
    const blocks = [{ speech: "Oi", person_id: "p1" }, { speech: "Bia: tudo?", person_id: "p1" }, { speech: "", person_id: "p1" }, { speech: "Tchau", person_id: null }];
    expect(withSpeakers(blocks, people, false).map((b) => b.speech)).toEqual(["Natasha: Oi", "Bia: tudo?", "", "Tchau"]);
    expect(withSpeakers(blocks, people, true)[3].speech).toBe("Rodrigo: Tchau");
  });

  it("a pessoa marcada no bloco; você mesmo; ou você para a câmera quando grava sozinho", () => {
    expect(speakerOf({ person_id: "p1" }, people, false)).toBe("Natasha");
    expect(speakerOf({ person_id: "p2" }, people, false)).toBe("Rodrigo");
    expect(speakerOf({ person_id: null }, people, true)).toBe("Rodrigo");
    expect(speakerOf({ person_id: null }, [], true)).toBe("você");
    expect(speakerOf({ person_id: null }, [], true, "natasha lima")).toBe("Natasha");
    expect(speakerOf({ person_id: "x" }, [{ id: "x", name: "Eu", role: "eu" }], false)).toBe("você");
    expect(speakerOf({}, people, false)).toBeNull();
  });
});

describe("história em texto corrido", () => {
  const parts = { hook: "Ela sai de casa assobiando.", situation: "Na esquina, apalpa os bolsos.\n\nVolta correndo.", payoff: "A chave estava na porta." };

  it("junta as partes em parágrafos e separa de volta", () => {
    const text = storyText(parts);
    expect(text).toBe("Ela sai de casa assobiando.\n\nNa esquina, apalpa os bolsos.\n\nVolta correndo.\n\nA chave estava na porta.");
    expect(storyFromText(text)).toEqual(parts);
  });

  it("com dois parágrafos, o segundo é o meio", () => {
    expect(storyFromText("Começa assim.\n\nE segue assado.")).toEqual({ hook: "Começa assim.", situation: "E segue assado.", payoff: "" });
  });

  it("com um parágrafo só, a primeira frase é o começo", () => {
    expect(storyFromText("Ela sai feliz. Esquece a chave. Volta correndo.")).toEqual({ hook: "Ela sai feliz.", situation: "Esquece a chave. Volta correndo.", payoff: "" });
  });

  it("nada passa do limite de cada parte e nenhuma frase se perde no meio", () => {
    const longo = Array.from({ length: 40 }, (_, i) => `Frase número ${i + 1} da história.`).join(" ");
    const out = storyFromText(`${longo}\n\nMeio.\n\nFim.`);
    expect(out.hook.length).toBeLessThanOrEqual(300);
    expect(out.situation.length).toBeLessThanOrEqual(600);
    expect(out.payoff.length).toBeLessThanOrEqual(600);
    expect(out.hook.endsWith(".")).toBe(true);
    expect(out.situation.startsWith("Frase número")).toBe(true);
  });

  it("texto vazio fica vazio", () => {
    expect(storyFromText("  \n\n ")).toEqual({ hook: "", situation: "", payoff: "" });
  });
});

describe("acabamento do que a IA escreveu", () => {
  const cast = { names: ["Natasha", "Manu"], me: "Natasha" };

  it("põe maiúscula nos nomes de quem está no vídeo", () => {
    expect(capitalizeNames("natasha comendo sorvete com manu", ["Natasha", "Manu"])).toBe("Natasha comendo sorvete com Manu");
    expect(capitalizeNames("manualmente", ["Manu"])).toBe("manualmente");
  });

  it("troca o você da ação pelo nome, mas não o da fala", () => {
    const b = polishBlock({ speech: "Você já fez isso?", on_screen: "", action: "Lembrança 3: você na mesa, mordendo um hambúrguer" }, cast);
    expect(b.action).toBe("Lembrança 3: Natasha na mesa, mordendo um hambúrguer");
    expect(b.speech).toBe("Você já fez isso?");
  });

  it("quem cria e não aparece não vira o você da ação", () => {
    expect(polishBlock({ speech: "", on_screen: "", action: "você olha" }, { names: ["Manu"], me: null }).action).toBe("você olha");
  });

  it("descrição de cena no texto da tela volta para a ação", () => {
    const b = polishBlock({ speech: "", on_screen: "Hambúrguer na mão", action: "Ela olha para a câmera." }, cast);
    expect(b.on_screen).toBe("");
    expect(b.action).toBe("Ela olha para a câmera. Hambúrguer na mão");
  });

  it("texto de tela de verdade fica onde está", () => {
    for (const t of ["3 ERROS", "POV: o cliente que nunca aceita o corte", "Eu, de verdade", "“Mostra pra ele”"]) {
      expect(isStageNote(t)).toBe(false);
    }
    expect(isStageNote("Close no pote de sorvete")).toBe(true);
  });
});

describe("uma cena por bloco", () => {
  const draft = (blocks: Record<string, string>[]) => normalizeDraft({ blocks });

  it("corte no meio da ação vira duas cenas, e a fala fica na primeira", () => {
    const out = draft([
      { kind: "gancho", speech: "Será que tranquei?", on_screen: "O alarme", action: "Natasha trava o carro e aperta o botão de novo. CORTE. Natasha está na esquina e aperta o controle." },
      { kind: "chamada", speech: "Segue aí.", on_screen: "", action: "Ela olha para a câmera." },
    ]);
    expect(out.map((b) => b.action)).toEqual(["Natasha trava o carro e aperta o botão de novo.", "Natasha está na esquina e aperta o controle.", "Ela olha para a câmera."]);
    expect(out[0]).toMatchObject({ kind: "gancho", speech: "Será que tranquei?", on_screen: "O alarme" });
    expect(out[1]).toMatchObject({ kind: "conteudo", speech: "", on_screen: "", label: null });
  });

  it("entende \"corta para\" e põe maiúscula no começo da cena nova", () => {
    const out = draft([{ kind: "conteudo", speech: "", on_screen: "", action: "Ela sai de casa, corta para: a janela do apartamento." }]);
    expect(out.map((b) => b.action)).toEqual(["Ela sai de casa,", "A janela do apartamento."]);
  });

  it("\"corte de cabelo\" não é corte de cena", () => {
    const out = draft([{ kind: "conteudo", speech: "", on_screen: "", action: "Ela mostra o corte de cabelo novo." }]);
    expect(out).toHaveLength(1);
  });

  it("não passa de 16 cenas", () => {
    const muitas = Array.from({ length: 12 }, () => ({ kind: "conteudo", speech: "", on_screen: "", action: "A. CORTE. B." }));
    expect(draft(muitas)).toHaveLength(12);
  });
});

describe("cabeçalho da cena", () => {
  it("padroniza como num roteiro de filme", () => {
    expect(normalizeHeading("int cozinha - dia")).toBe("INT. COZINHA – DIA");
    expect(normalizeHeading("EXT. RUA—NOITE.")).toBe("EXT. RUA – NOITE");
    expect(normalizeHeading("int/ext carro - dia")).toBe("INT./EXT. CARRO – DIA");
    expect(normalizeHeading("Interior do carro")).toBe("INTERIOR DO CARRO");
    expect(normalizeHeading("  ")).toBeNull();
  });
  it("o rascunho guarda o cabeçalho; a parte depois de um CORTE fica sem", () => {
    const blocks = normalizeDraft({ blocks: [{ kind: "gancho", heading: "ext estacionamento - dia", action: "Ela trava o carro. CORTE. Ela está na esquina." }] });
    expect(blocks.map((b) => b.heading)).toEqual(["EXT. ESTACIONAMENTO – DIA", null]);
  });
  it("partes seguidas no mesmo lugar são uma cena só: o cabeçalho aparece uma vez", () => {
    expect(sceneGroups(["INT. COZINHA – DIA", "int. cozinha – dia", "EXT. RUA – DIA", null, null, "EXT. RUA – DIA"])).toEqual([
      { show: true, number: 1 },
      { show: false, number: 1 },
      { show: true, number: 2 },
      { show: true, number: 3 },
      { show: true, number: 4 },
      { show: true, number: 5 },
    ]);
    const text = scriptAsText("x", [b("gancho", "", { action: "Abre a geladeira." }), b("conteudo", "", { action: "Pega a pizza." }), b("chamada", "", { action: "Sai." })], {
      places: ["INT. COZINHA – NOITE", "INT. COZINHA – NOITE", "INT. SALA – NOITE"],
    });
    expect(text).toBe("X\n\n\n1. INT. COZINHA – NOITE\n\nAbre a geladeira.\n\nPega a pizza.\n\n\n2. INT. SALA – NOITE\n\nSai.");
  });

  it("o cabeçalho aparece no lugar do número e vai para a IA dos planos", () => {
    expect(sceneHeading(2, "INT. COZINHA – DIA")).toBe("2. INT. COZINHA – DIA");
    expect(scriptForPrompt([b("gancho", "Oi", { heading: "INT. SALA – DIA" })])).toContain("[gancho] INT. SALA – DIA FALA: Oi");
  });
});

describe("CORTE dentro de uma cena", () => {
  const acao = "Natasha sai do carro e trava ele. CORTE. Natasha está na esquina e aperta o controle de novo.";
  it("acha a cena com duas cenas dentro, mas não o corte de cabelo", () => {
    expect(hasCut(acao)).toBe(true);
    expect(hasCut("Ela mostra o corte de cabelo novo.")).toBe(false);
    expect(hasCut("Corta para a cozinha.")).toBe(false);
  });
  it("separa em cenas, com a fala na primeira", () => {
    const partes = splitCuts([b("gancho", "Oi", { action: acao, on_screen: "POV" })]);
    expect(partes.map((p) => [p.kind, p.action, p.speech, p.on_screen])).toEqual([
      ["gancho", "Natasha sai do carro e trava ele.", "Oi", "POV"],
      ["conteudo", "Natasha está na esquina e aperta o controle de novo.", "", ""],
    ]);
  });
});
