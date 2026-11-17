import { afterEach, describe, expect, it, vi } from "vitest";
import { generateChecked } from "@/lib/ia-conferida";
import { mechanismsText, pickMechanisms } from "@/lib/prompts/mecanismos";
import { storyRequest } from "@/lib/prompts/montagem";
import { draftProblems, inventedShare, normalizePoints, storyProblems, tidyIdeas } from "@/lib/qualidade";
import { keepUnchanged, polishBlock } from "@/lib/roteiro";

const codes = (list: { code: string }[]) => list.map((p) => p.code);
const own = "Travar o carro e esquecer se travou. Aperto o controle na frente do carro, depois na esquina, depois na porta de casa, depois na janela e por último indo dormir.";

describe("conferência da história", () => {
  it("aponta final vago, sentimento sem ação e palavra técnica", () => {
    const p = storyProblems({ hook: "Ela abre a geladeira.", situation: "Ela entra em pânico e algo inesperado acontece. Corte para a sala.", payoff: "" }, { humor: true });
    expect(codes(p)).toEqual(["vago", "sem_final", "sentimento_sem_acao", "termo_tecnico"]);
    expect(p[0].fix).toContain('"inesperado"');
  });

  it("história limpa não tem problema", () => {
    expect(storyProblems({ hook: "Ela trava o carro e dá dois passos.", situation: "Na esquina, aperta o controle de novo.", payoff: "Na cama, levanta e aperta mais uma vez." }, { humor: true })).toEqual([]);
  });

  it("na ideia da pessoa, fala e acontecimento inventados são problema", () => {
    const invented = { hook: "Lia aperta o controle.", situation: "Um cachorro late e ela grita: “Tranquei ou não?!”. No sofá, abre o aplicativo e reclama do Wi-Fi.", payoff: "De manhã, o gato da vizinha dorme no volante do carro aberto." };
    expect(codes(storyProblems(invented, { own }))).toEqual(["fala_inventada", "inventou"]);
    expect(inventedShare(invented, own)).toBeGreaterThan(0.75);
    // Fala que ela escreveu sem aspas não é invenção.
    const said = "A Duda elogia: nossa, que focada. Eu só respondo obrigada.";
    expect(storyProblems({ hook: "Duda grita: “Nossa, que focada!”", situation: "Lia sorri.", payoff: "Ela responde “obrigada”." }, { own: said }).map((p) => p.code)).not.toContain("fala_inventada");
    const faithful = { hook: "Lia trava o carro com o controle na frente do carro.", situation: "Na esquina, aperta o controle de novo. Na porta de casa, aperta outra vez. Depois aparece na janela apertando.", payoff: "Por último, indo dormir, aperta o controle mais uma vez." };
    expect(storyProblems(faithful, { own })).toEqual([]);
  });

  it("ponto da pessoa que ficou de fora volta como correção", () => {
    const p = storyProblems({ hook: "Ela trava o carro.", situation: "Na esquina, aperta o controle.", payoff: "Vai dormir e aperta de novo." }, { points: ["aperta na esquina", "aparece na janela apertando"] });
    expect(codes(p)).toEqual(["ponto_faltando"]);
    expect(p[0].fix).toContain("aparece na janela apertando");
  });

  it("os pontos só valem se vierem do texto da pessoa", () => {
    expect(normalizePoints(["Aperta o controle na esquina", "Um gato dorme no volante", 3], own)).toEqual(["Aperta o controle na esquina"]);
  });
});

describe("conferência do roteiro", () => {
  const block = (speech: string, action = "Ela olha.") => ({ speech, on_screen: "", action });

  it("com duas pessoas, fala sem nome é problema", () => {
    expect(codes(draftProblems([block("Nossa, que focada!")], { maxWords: 70, cast: ["Lia", "Duda"] }))).toEqual(["fala_sem_nome"]);
    expect(draftProblems([block("Duda: Nossa, que focada!\nLia: Obrigada.")], { maxWords: 70, cast: ["Lia", "Duda"] })).toEqual([]);
    expect(draftProblems([block("Nossa, que focada!")], { maxWords: 70, cast: ["Lia"] })).toEqual([]);
  });

  it("história sem fala não vira roteiro com fala", () => {
    const story = "Lia trava o carro. Na esquina, aperta o controle de novo. Na cama, aperta mais uma vez.";
    expect(codes(draftProblems([block("Será que trancou?")], { maxWords: 70, story }))).toEqual(["fala_inventada"]);
    expect(draftProblems([block("")], { maxWords: 70, story })).toEqual([]);
    expect(draftProblems([block("Obrigada.")], { maxWords: 70, story: "Ela responde “obrigada”." })).toEqual([]);
  });

  it("narração dentro da fala e fala longa demais são problema", () => {
    expect(codes(draftProblems([block("Lia segura a lâmpada piscando: 'Modo festa, luz de balada!' Resultado: conta só sobe.")], { maxWords: 70 }))).toEqual(["narracao_na_fala"]);
    expect(codes(draftProblems([block(Array(90).fill("palavra").join(" "))], { maxWords: 70 }))).toEqual(["fala_longa"]);
  });

  it("texto da tela igual à fala some", () => {
    expect(polishBlock({ speech: "Nossa, que focada!", on_screen: "Nossa, que focada", action: "" }, { names: [], me: null }).on_screen).toBe("");
    expect(polishBlock({ speech: "Oi.", on_screen: "3 ERROS", action: "" }, { names: [], me: null }).on_screen).toBe("3 ERROS");
  });
});

describe("pedido de mudança na história", () => {
  it("o que a IA só reescreveu com outras palavras volta ao original; o que mudou de verdade fica", () => {
    const before = { hook: "Ela trava o carro e dá dois passos.", situation: "Na esquina, ela para e aperta o controle de novo. Na porta de casa, estica o braço e aperta outra vez.", payoff: "Na cama, levanta e aperta." };
    const after = { hook: "Ela trava o carro e dá dois passos!", situation: "Na esquina, ela para e aperta de novo o controle. Na porta de casa, estica o braço e aperta outra vez.", payoff: "No banheiro, escovando os dentes, ela aperta com a boca cheia de espuma." };
    expect(keepUnchanged(before, after)).toEqual({ hook: before.hook, situation: before.situation, payoff: after.payoff });
  });
});

describe("ideias da mesma leva", () => {
  it("tira a repetida e manda a que tem defeito para o fim", () => {
    const a = { title: "A porta trancada", hook: "h", situation: "Ela confere a porta três vezes antes de sair de casa", payoff: "Pede foto da maçaneta para a vizinha." };
    const b = { title: "Final inesperado", hook: "h", situation: "Algo acontece", payoff: "" };
    const c = { title: "A porta trancada de novo", hook: "h", situation: "Ela confere a porta três vezes antes de sair de casa", payoff: "Volta do elevador." };
    const d = { title: "O grupo errado", hook: "h", situation: "Manda o áudio do chefe no grupo da empresa", payoff: "Vira o celular para baixo e sai da sala." };
    const e = { title: "A playlist", hook: "h", situation: "Arruma a mesa para estudar", payoff: "Passa 40 minutos escolhendo a playlist." };
    expect(tidyIdeas([b, a, c, d, e]).map((i) => i.title)).toEqual(["A porta trancada", "O grupo errado", "A playlist", "Final inesperado"]);
  });
});

describe("mecanismos de humor", () => {
  it("escolhe pelo assunto e é estável para o mesmo vídeo", () => {
    const first = pickMechanisms("video-1", ["Humor sobre dieta e vida fitness"]);
    expect(first).toHaveLength(3);
    expect(first.map((m) => m.id)).toEqual(pickMechanisms("video-1", ["Humor sobre dieta e vida fitness"]).map((m) => m.id));
    expect(first.some((m) => m.tags.includes("dieta"))).toBe(true);
    expect(mechanismsText(first)).toContain("Forte:");
  });
});

describe("história a partir da ideia da própria pessoa", () => {
  const base = { video: { objective: "divertir" as const, platforms: ["reels" as const], durationS: 30, resources: ["sozinho" as const], brief: own, title: "Travar o carro e esquecer", hook: "Travar o carro e esquecer se travou.", situation: own, payoff: "", formatSlug: null }, person: { niche: "Humor", memory: [] } };

  it("o texto dela vai por último, sem o começo escolhido, e a IA lista os pontos", () => {
    const r = storyRequest({ ...base, titled: true, own: true });
    expect(r.prompt.trim().endsWith("</ideia_da_pessoa>")).toBe(true);
    expect(r.prompt).not.toContain("<ideia>");
    expect(r.prompt).not.toContain("Como começa:");
    expect(r.system).toContain("não acrescente personagem, animal, objeto, fala, piada nem lugar");
    expect(r.system).not.toContain("ESTILO: HUMOR");
    expect(JSON.stringify(r.schema)).toContain("pontos");
    expect(r.temperature).toBe(0.4);
  });

  it("com pedido de mudança, volta ao caminho da história atual", () => {
    const r = storyRequest({ ...base, own: true, ask: "troca o final" });
    expect(r.prompt).toContain("<historia_atual>");
    expect(r.prompt).not.toContain("<ideia_da_pessoa>");
  });
});

describe("pedir de novo quando a resposta vem com defeito", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
  const setup = (answers: string[]) => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "chave");
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const bodies: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_, init) => {
      bodies.push(String(init?.body));
      const content = answers[Math.min(bodies.length - 1, answers.length - 1)];
      return content === "FALHA" ? new Response("{}", { status: 500 }) : new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
    });
    return bodies;
  };
  const check = { parse: (r: unknown) => (r as { texto?: string }).texto ?? null, problems: (t: string) => (t.includes("inesperado") ? [{ code: "vago", fix: "Diga o que acontece." }] : []) };

  it("resposta boa não gasta segunda chamada", async () => {
    const bodies = setup(['{"texto":"Ela aperta o controle."}']);
    await expect(generateChecked({ system: "s", prompt: "p" }, check)).resolves.toMatchObject({ value: "Ela aperta o controle.", retried: false });
    expect(bodies).toHaveLength(1);
  });

  it("resposta com defeito volta para a IA com o defeito escrito, e fica a melhor", async () => {
    const bodies = setup(['{"texto":"Algo inesperado."}', '{"texto":"O gato derruba o copo."}']);
    await expect(generateChecked({ system: "s", prompt: "p" }, check)).resolves.toMatchObject({ value: "O gato derruba o copo.", problems: [], retried: true });
    expect(bodies[1]).toContain("Diga o que acontece.");
    expect(bodies[1]).toContain("sua_resposta_anterior");
  });

  it("se a segunda chamada falhar, a primeira continua valendo", async () => {
    setup(['{"texto":"Algo inesperado."}', "FALHA"]);
    await expect(generateChecked({ system: "s", prompt: "p" }, check)).resolves.toMatchObject({ value: "Algo inesperado.", retried: true });
  });
});
