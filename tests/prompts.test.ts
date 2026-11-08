import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { withExample } from "@/lib/ai";
import { findFormat } from "@/lib/formats";
import { normalizeIdeas } from "@/lib/ideas";
import { assembleBlocks, fallbackBlocks, sameWords, scriptFacts, segmentScript, speakersIn } from "@/lib/organizar";
import { normalizeShots } from "@/lib/planos";
import { HUMOR, MESTRE, SUBMESTRES, buildSystem, context, tag, usesHumor } from "@/lib/prompts/base";
import { draftRequest, ideasRequest, storyRequest } from "@/lib/prompts/montagem";
import {
  ANGLE_VALUES,
  FORMAT_VALUES,
  FRAMING_VALUES,
  KIND_VALUES,
  MOVEMENT_VALUES,
  OBJECTIVE_VALUES,
  organizerTask,
  postTask,
  shotsTask,
  castTag,
  videoTag,
} from "@/lib/prompts/tarefas";
import { normalizeDraft, normalizeStory } from "@/lib/roteiro";
import { completeItems } from "@/lib/stream-json";

// Um caso realista: a criadora de humor, com briefing próprio e memória.
const person = {
  niche: "humor",
  memory: ["Faz sketches com situações de família.", "Prefere vídeos de 30 s, gravados sozinha em casa.", "Parece evitar ganchos em forma de pergunta."],
};
const video = {
  objective: "crescer" as const,
  platforms: ["reels" as const, "tiktok" as const],
  durationS: 30,
  resources: ["sozinho" as const, "em_casa" as const],
  brief:
    "É pra reels do instagram. É sketch de comédia. De situações comuns com finais com quebra de expectativa, porém tem que ser relatable.",
};

describe("valores fechados: schema e normalização aceitam exatamente a mesma lista", () => {
  it("tipos de bloco, sem acento, como o banco e a normalização", () => {
    expect(KIND_VALUES).toEqual(["gancho", "contexto", "conteudo", "virada", "chamada"]);
    for (const kind of KIND_VALUES) expect(normalizeDraft({ blocks: [{ kind, speech: "x" }] })[0].kind).toBe(kind);
  });

  it("formatos, objetivos, enquadramentos, ângulos e movimentos", () => {
    for (const slug of FORMAT_VALUES) expect(findFormat(slug)).toBeTruthy();
    expect(OBJECTIVE_VALUES).toEqual(["crescer", "vender", "divertir", "ensinar"]);
    for (const slug of FORMAT_VALUES) expect(normalizeIdeas({ ideas: [{ title: "t", hook: "h", format_slug: slug }] })[0].format_slug).toBe(slug);
    for (const framing of FRAMING_VALUES)
      for (const angle of ANGLE_VALUES)
        for (const movement of MOVEMENT_VALUES) {
          const shots = normalizeShots({ shots: [{ block: 1, framing, angle, movement, orientation: "vertical", description: "d" }] }, ["b1"], { orientation: "vertical", max: 4, solo: false });
          expect(shots[0]).toMatchObject({ framing, angle });
        }
  });
});

describe("montagem do system", () => {
  it("mestre → submestre → humor → tarefa, nessa ordem", () => {
    const s = buildSystem({ objective: "vender", humor: true, task: "TAREFA: x" });
    expect(s.indexOf(MESTRE)).toBe(0);
    expect(s.indexOf("OBJETIVO DESTE VÍDEO: VENDER")).toBeGreaterThan(s.indexOf("QUANDO AS INFORMAÇÕES CONFLITAM"));
    expect(s.indexOf("ESTILO: HUMOR")).toBeGreaterThan(s.indexOf("OBJETIVO DESTE VÍDEO: VENDER"));
    expect(s.endsWith("TAREFA: x")).toBe(true);
  });

  it("o organizador não leva mestre nem submestre: ele só classifica", () => {
    const t = organizerTask();
    expect(t.system).not.toContain("Gere muito mais opções");
    expect(t.system).not.toContain("OBJETIVO DESTE VÍDEO");
    expect(t.temperature).toBe(0.2);
    expect(t.thinking).toBe("zero");
  });

  it("planos levam só a regra do objetivo; publicação libera até 2 emojis", () => {
    expect(shotsTask({ objective: "crescer" }).system).toContain("o gancho mostra a marca da pessoa");
    expect(shotsTask({ objective: "crescer" }).system).not.toContain("o produto aparece em close");
    expect(postTask({ objective: "divertir", platforms: ["reels"] }).system).toContain("no máximo 2 por texto");
  });

  it("o módulo de humor entra em Divertir ou quando a pessoa faz humor, em qualquer objetivo", () => {
    expect(usesHumor({ objective: "divertir", texts: [] })).toBe(true);
    expect(usesHumor({ objective: "crescer", texts: ["Humor"] })).toBe(true);
    expect(usesHumor({ objective: "vender", texts: ["faço esquetes de família"] })).toBe(true);
    expect(usesHumor({ objective: "ensinar", texts: ["receitas baratas", null] })).toBe(false);
    expect(HUMOR).toContain("se o briefing ou o pedido pedirem tom sério, ignore este bloco");
  });

  it("cada objetivo tem o próprio submestre", () => {
    expect(Object.keys(SUBMESTRES).sort()).toEqual([...OBJECTIVE_VALUES].sort());
  });
});

describe("contexto", () => {
  it("bloco vazio não vai; linha sem valor não vai", () => {
    expect(tag("briefing", "")).toBe("");
    expect(tag("video", [null, "Duração: 30 s", "", false])).toBe("<video>\nDuração: 30 s\n</video>");
    expect(context(["", tag("a", "x"), ""])).toBe("<a>\nx\n</a>");
  });

  it("o pedido de ideias montado não tem buraco, marcador vazio nem valor perdido", () => {
    const { prompt, system } = ideasRequest({ video, person, seen: ["Ideia velha"], trends: [] });
    expect(prompt).not.toMatch(/undefined|null|NaN|\[object/);
    expect(prompt).not.toMatch(/<(\w+)>\s*<\/\1>/);
    expect(prompt).not.toMatch(/\n{3,}/);
    expect(prompt).not.toContain("<pedido_agora>");
    expect(prompt).not.toContain("<produto>");
    expect(prompt).not.toContain("<tendencias>");
    expect(prompt).not.toContain("dialogo:"); // grava sozinha: sem formato que precisa de outra pessoa
    expect(prompt).toContain("<briefing>\nÉ pra reels do instagram.");
    expect(system).toContain("ESTILO: HUMOR"); // nicho humor + objetivo Crescer: o caso da v1
    expect(system).toContain("OBJETIVO DESTE VÍDEO: CRESCER");
  });

  it("Groq recebe o formato como exemplo no fim; o Gemini, por schema", () => {
    expect(withExample("PEDIDO", '{"a":1}')).toBe('PEDIDO\n\nResponda só com JSON: {"a":1}');
    expect(withExample("PEDIDO")).toBe("PEDIDO");
  });
});

describe("organizador: o texto da pessoa sai igual", () => {
  const pasted = `Mãe: já comeu?
Eu: já, mãe [abre a geladeira vazia]
(tela: 3 horas depois)
Mãe: e agora, comeu?

Segue pra parte 2`;

  it("divide por linha e separa marcas de cena e de tela", () => {
    expect(segmentScript(pasted).map((s) => s.text)).toEqual([
      "Mãe: já comeu?",
      "Eu: já, mãe",
      "[abre a geladeira vazia]",
      "(tela: 3 horas depois)",
      "Mãe: e agora, comeu?",
      "Segue pra parte 2",
    ]);
  });

  it("remonta os blocos com o texto original e confere todas as palavras", () => {
    const segments = segmentScript(pasted);
    const blocks = assembleBlocks(segments, {
      segments: [
        { n: 1, block: 1, kind: "gancho", field: "speech" },
        { n: 2, block: 2, kind: "conteudo", field: "speech" },
        { n: 3, block: 2, kind: "conteudo", field: "action" },
        { n: 4, block: 3, kind: "virada", field: "on_screen" },
        { n: 5, block: 3, kind: "virada", field: "speech" },
        { n: 6, block: 4, kind: "chamada", field: "speech" },
      ],
    })!;
    expect(blocks.map((b) => b.kind)).toEqual(["gancho", "conteudo", "virada", "chamada"]);
    expect(blocks[1]).toMatchObject({ speech: "Eu: já, mãe", action: "abre a geladeira vazia" });
    expect(blocks[2]).toMatchObject({ speech: "Mãe: e agora, comeu?", on_screen: "3 horas depois" });
    expect(sameWords(pasted, blocks)).toBe(true);
  });

  it("classificação que não fecha cai na divisão simples, sem perder nada", () => {
    const segments = segmentScript(pasted);
    expect(assembleBlocks(segments, { segments: [{ n: 1, block: 1, kind: "gancho", field: "speech" }] })).toBeNull();
    expect(assembleBlocks(segments, { segments: segments.map((s) => ({ n: s.n, block: 1, kind: "conteúdo", field: "speech" })) })).toBeNull();
    const fallback = fallbackBlocks(segments);
    expect(fallback[0].kind).toBe("gancho");
    expect(sameWords(pasted, fallback)).toBe(true);
  });

  it("linha muito longa vira frases", () => {
    const long = `${"Essa é uma frase do roteiro que vai longe. ".repeat(8)}Fim.`;
    expect(segmentScript(long).length).toBeGreaterThan(5);
  });
});

// Pedido 3 do revisor: os prompts finais como saem para o Gemini, montados pelo mesmo código das rotas.
// Gera docs/prompts-montados.md quando a variável GRAVAI_DUMP=1 está definida.
describe("prompts montados", () => {
  it("ideias e rascunho saem completos", () => {
    const ideas = ideasRequest({ video, person, ask: "", seen: ["A playlist do foco", "Quando a mãe liga"], trends: [{ title: "Expectativa x realidade", what: "Antes e depois em cortes rápidos." }] });
    const draft = draftRequest({
      video: {
        ...video,
        title: "A mãe e o 'já comeu?'",
        hook: "Minha mãe pergunta se eu comi. De novo.",
        situation: "A mãe liga três vezes no mesmo dia perguntando se a filha comeu, e cada resposta piora a situação.",
        payoff: "Na terceira ligação, a mãe já está na porta com uma marmita.",
        formatSlug: "pov",
      },
      person,
    });
    for (const r of [ideas, draft]) {
      expect(r.prompt).not.toMatch(/undefined|null|NaN|\[object|\n{3,}/);
      expect(r.system.split("\n\n---\n\n").length).toBeGreaterThanOrEqual(3);
    }
    if (process.env.GRAVAI_DUMP) {
      const show = (name: string, r: typeof ideas) =>
        `## ${name}\n\nTemperatura ${r.temperature} · pensamento ${r.thinking} · formato por responseSchema (no Groq, o exemplo vai no fim do pedido).\n\n### System\n\n\`\`\`text\n${r.system}\n\`\`\`\n\n### Pedido\n\n\`\`\`text\n${r.prompt}\n\`\`\`\n\n### Schema\n\n\`\`\`json\n${JSON.stringify(r.schema, null, 2)}\n\`\`\`\n`;
      mkdirSync("docs", { recursive: true });
      writeFileSync(
        "docs/prompts-montados.md",
        `# Prompts montados (v3)\n\nGerado pelo teste tests/prompts.test.ts com o mesmo código das rotas. Caso: criadora de humor, objetivo Crescer, com briefing e memória.\n\n${show("Ideias do zero", ideas)}\n${show("Rascunho do roteiro", draft)}`,
      );
    }
  });
});

describe("a história antes do roteiro", () => {
  const ideia = { ...video, title: "A chave", hook: "Saio de casa assobiando.", situation: "Percebe na rua que esqueceu algo.", payoff: "Volta correndo.", formatSlug: "pov" };

  it("sem pedido, parte da ideia", () => {
    const r = storyRequest({ video: ideia, person });
    expect(r.prompt).toContain("<ideia>");
    expect(r.prompt).not.toContain("<pedido_agora>");
    expect(r.prompt).not.toMatch(/undefined|null|NaN|\[object|\n{3,}/);
    expect(r.system).toContain("duas piadas prontas");
  });

  it("com pedido, muda só o que foi pedido na história atual", () => {
    const r = storyRequest({ video: ideia, person, ask: "troca a piada do final" });
    expect(r.prompt).toContain("troca a piada do final");
    expect(r.prompt).toContain("<historia_atual>");
    expect(r.prompt.indexOf("<pedido_agora>")).toBeLessThan(r.prompt.indexOf("<historia_atual>"));
  });

  it("corta no limite das colunas e recusa história sem começo ou sem meio", () => {
    const story = normalizeStory({ hook: "a".repeat(400), situation: "b".repeat(700), payoff: "c".repeat(700) });
    expect([story?.hook.length, story?.situation.length, story?.payoff.length]).toEqual([300, 600, 600]);
    expect(normalizeStory({ hook: "x", situation: `Primeira frase. ${"b".repeat(700)}`, payoff: "y" })?.situation).toBe("Primeira frase.");
    expect(normalizeStory({ hook: "", situation: "x", payoff: "y" })).toBeNull();
    expect(normalizeStory({ hook: "x", situation: " ", payoff: "y" })).toBeNull();
    expect(normalizeStory(null)).toBeNull();
    expect(normalizeStory({ hook: "x", situation: "y" })?.payoff).toBe("");
  });
});

describe("regras do roteiro e dos planos", () => {
  it("o texto na tela é só o que está escrito, e cada plano tem uma ação", () => {
    const draft = draftRequest({ video: { ...video, title: "T", hook: "G", situation: "", payoff: "", formatSlug: null }, person });
    expect(draft.system).toContain("só o texto escrito");
    const shots = shotsTask({ objective: "divertir" }).system;
    expect(shots).toContain("uma ação só");
    expect(shots).toContain("Cada pessoa que fala aparece");
    expect(shots).toContain("Não é um resumo da cena");
    expect(shots).not.toContain("Bloco curto costuma ter 1 plano");
    expect(shots).toContain("detalhe mostra só um objeto");
  });
});

describe("POV e a ideia de quem escreveu", () => {
  it("as ideias conhecem os dois sentidos de POV e pedem variedade", () => {
    const r = ideasRequest({ video, person, seen: [], trends: [] });
    expect(r.system).toContain("linguagem da internet");
    expect(r.system).toContain("no máximo 1 ideia em cada 5");
  });

  it("a história fica com a ideia da pessoa, e só pede nome quando falta", () => {
    const base = { video: { ...video, title: "T", hook: "G", situation: "", payoff: "", formatSlug: null }, person };
    expect(storyRequest(base).system).toContain("não troque a ideia");
    expect(JSON.stringify(storyRequest(base).schema)).not.toContain("title");
    expect(JSON.stringify(storyRequest({ ...base, titled: true }).schema)).toContain("title");
    expect(storyRequest({ ...base, titled: true }).example).toContain("title");
  });
});

describe("quem aparece no vídeo", () => {
  it("leva os nomes para a IA, e quem só filma fica de fora", () => {
    const cast = castTag("Natasha Muraguti", [
      { name: "Natasha", role: "eu" },
      { name: "João", role: "ator", roles: ["ator"] },
      { name: "Bia", role: "filma", roles: ["filma"] },
      { name: "Duda", role: "filma", roles: ["filma", "ator"] },
    ]);
    expect(cast).toContain("Quem faz o vídeo e aparece: Natasha");
    expect(cast).toContain("Também aparecem: João, Duda");
    expect(cast).not.toContain("Bia");
  });

  it("quem criou o vídeo e não aparece fica fora das cenas", () => {
    const cast = castTag(null, [
      { name: "Natasha", role: "eu", roles: ["filma"] },
      { name: "Manu", role: "ator", roles: ["ator"] },
    ]);
    expect(cast).toContain("NÃO aparece em cena");
    expect(cast).toContain("Natasha");
    expect(cast).toContain("Quem aparece: Manu");
    expect(cast).not.toContain("Também aparecem");
  });

  it("sem nome nenhum, não manda nada", () => {
    expect(castTag(null, [])).toBe("");
    expect(castTag("Ana Lima", [])).toContain("Ana Lima");
  });

  it("os nomes chegam ao pedido da história, e a regra proíbe códigos", () => {
    const cast = castTag("Natasha", []);
    const r = storyRequest({ video: { ...video, title: "T", hook: "G", situation: "", payoff: "", formatSlug: null }, person, cast });
    expect(r.prompt).toContain("<pessoas>");
    expect(r.system).toContain("Nunca códigos como A1");
  });

  it("quem ainda não sabe quantas pessoas aparecem vira um aviso para a IA", () => {
    expect(videoTag({ objective: "crescer", platforms: ["reels"], durationS: 30, resources: ["em_casa"] })).toContain("ainda não sabe");
    expect(videoTag({ objective: "crescer", platforms: ["reels"], durationS: 30, resources: ["sozinho", "em_casa"] })).not.toContain("ainda não sabe");
  });
});

describe("ideias chegando aos poucos", () => {
  it("pega só os objetos completos da lista, mesmo com texto pela metade", () => {
    const partial = '{"ideas":[{"title":"Um {com chave} e \\"aspas\\"","hook":"g1"},{"title":"Dois","hook":"g2"},{"title":"Trê';
    expect(completeItems(partial, "ideas")).toEqual([
      { title: 'Um {com chave} e "aspas"', hook: "g1" },
      { title: "Dois", hook: "g2" },
    ]);
    expect(completeItems('{"ide', "ideas")).toEqual([]);
    expect(completeItems('{"ideas":[]}', "ideas")).toEqual([]);
  });
});

describe("roteiro colado: o que o texto já diz", () => {
  const dialog = [{ speech: "Natasha: amiga nem sabe o que eu vi\nKira: o quê?" }, { speech: "Natasha: a Manu e o Lorenzo brigando" }];

  it("acha quem fala pelo nome antes dos dois-pontos", () => {
    expect(speakersIn(dialog)).toEqual(["natasha", "kira"]);
    expect(speakersIn([{ speech: "Atenção time: inimigo na B" }])).toEqual(["atenção time"]);
  });

  it("duas pessoas falando: com mais gente; uma só não decide nada", () => {
    expect(scriptFacts(dialog).resources).toEqual(["com_alguem"]);
    expect(scriptFacts([{ speech: "Oi, hoje eu vou mostrar" }]).resources).toEqual([]);
  });

  it("a duração vem das falas e respeita os limites do banco", () => {
    expect(scriptFacts([{ speech: "" }]).durationS).toBeGreaterThanOrEqual(5);
    expect(scriptFacts([{ speech: "palavra ".repeat(26) }]).durationS).toBe(10);
  });
});
