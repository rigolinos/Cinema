import { describe, expect, it } from "vitest";
import {
  ANGLES,
  FRAMINGS,
  MOVEMENTS,
  castOf,
  defaultOrientation,
  isSolo,
  newestChange,
  plansOutdated,
  maxShots,
  normalizeShots,
  normalizeWardrobe,
  setupChanges,
  setupLabel,
  shootingOrder,
  shotPeople,
  shotPlainTags,
  shotTags,
  shotsPrompt,
} from "@/lib/planos";

const s = (position: number, location: string, wardrobe = "") => ({ position, location, wardrobe });

describe("quem está no plano", () => {
  const eu = { id: "p0", name: "Natasha Lima", role: "eu", roles: ["ator"] };
  const manu = { id: "p1", name: "manu", role: "ator", roles: ["ator"] };
  const filma = { id: "p2", name: "Caio", role: "filma", roles: ["filma"] };
  const opts = { orientation: "vertical" as const, max: 24, solo: false, people: [manu, filma, eu] };
  const names = (people: unknown) => normalizeShots({ shots: [{ block: 1, framing: "close", people }] }, ["b1"], opts)[0].person_ids;

  it("lista quem cria e quem aparece, sem quem só filma", () => {
    expect(castOf([manu, filma, eu])).toEqual([{ id: "p0", label: "Natasha" }, { id: "p1", label: "Manu" }]);
  });

  it("separa quem tem o mesmo primeiro nome", () => {
    const outra = { id: "p3", name: "Manu Alves", role: "ator", roles: ["ator"] };
    expect(castOf([eu, manu, outra]).map((c) => c.label)).toEqual(["Natasha", "manu", "Manu Alves"]);
  });

  it("mostra os nomes do plano e ignora quem saiu do vídeo", () => {
    expect(shotPeople({ person_ids: ["p1", "p0", "saiu"] }, [eu, manu])).toEqual(["Natasha", "Manu"]);
    expect(shotPeople({}, [eu, manu])).toEqual([]);
  });

  it("com uma pessoa só, não precisa dizer quem é", () => {
    expect(shotPeople({ person_ids: ["p0"] }, [eu])).toEqual([]);
  });

  it("transforma os nomes da IA nas pessoas do vídeo", () => {
    expect(names(["natasha", "Manu"])).toEqual(["p0", "p1"]);
    expect(names(["Você"])).toEqual(["p0"]);
  });

  it("ignora nome inventado, quem só filma e resposta torta", () => {
    expect(names(["Godofredo", "Caio"])).toEqual([]);
    expect(names("Manu")).toEqual([]);
    expect(names(undefined)).toEqual([]);
  });

  it("quem criou o vídeo e não aparece fica fora da lista", () => {
    const naoAparece = { ...eu, roles: ["filma"] };
    expect(castOf([naoAparece, manu])).toEqual([{ id: "p1", label: "Manu" }]);
    expect(castOf([{ ...eu, roles: [] }, manu]).map((c) => c.id)).toEqual(["p1"]);
  });

  it("sem as funções lidas do banco, quem criou o vídeo aparece", () => {
    expect(castOf([{ id: "p0", name: "Natasha", role: "eu" }, manu]).map((c) => c.id)).toEqual(["p0", "p1"]);
  });

  it("vídeo com uma pessoa só fica sem marcação", () => {
    const solo = normalizeShots({ shots: [{ block: 1, framing: "close", people: ["Natasha"] }] }, ["b1"], { ...opts, people: [eu] });
    expect(solo[0].person_ids).toEqual([]);
  });
});

describe("folha do vídeo", () => {
  it("diz o enquadramento em palavras simples e só mostra ângulo e movimento fora do padrão", () => {
    expect(shotPlainTags({ framing: "close", angle: "altura_olhos", movement: "parado" })).toEqual(["De perto"]);
    expect(shotPlainTags({ framing: "aberto", angle: "de_cima", movement: "acompanhando" })).toEqual(["De longe", "De cima", "Acompanhando"]);
  });
});

describe("shootingOrder", () => {
  it("junta os planos do mesmo lugar e da mesma roupa, mantendo a ordem do roteiro dentro do grupo", () => {
    const shots = [s(0, "Sala"), s(1, "Rua", "Casaco"), s(2, "sala "), s(3, "Rua", "Regata"), s(4, "Rua", "Casaco"), s(5, "Sala")];
    expect(shootingOrder(shots).map((x) => x.position)).toEqual([0, 2, 5, 1, 4, 3]);
  });

  it("reduz as trocas de lugar e de roupa", () => {
    const shots = [s(0, "Sala"), s(1, "Rua"), s(2, "Sala"), s(3, "Rua"), s(4, "Sala")];
    expect(setupChanges(shots)).toBe(4);
    expect(setupChanges(shootingOrder(shots))).toBe(1);
  });
});

describe("planos desatualizados", () => {
  const at = (min: number) => `2026-11-04T10:${String(min).padStart(2, "0")}:00Z`;

  it("avisa só se o roteiro mudou depois de os planos serem feitos", () => {
    expect(plansOutdated([{ updated_at: at(5) }, { updated_at: at(1) }], [{ created_at: at(3) }])).toBe(true);
    expect(plansOutdated([{ updated_at: at(1) }], [{ created_at: at(3) }])).toBe(false);
  });

  it("um plano adicionado depois não esconde o aviso", () => {
    expect(plansOutdated([{ updated_at: at(5) }], [{ created_at: at(3) }, { created_at: at(9) }])).toBe(true);
  });

  it("sem planos ou sem datas não avisa", () => {
    expect(plansOutdated([{ updated_at: at(5) }], [])).toBe(false);
    expect(plansOutdated([], [{ created_at: at(3) }])).toBe(false);
    expect(plansOutdated([{}], [{}])).toBe(false);
  });

  it("acha a mudança mais recente", () => {
    expect(newestChange([{ updated_at: at(1) }, { updated_at: at(5) }, {}])).toBe(at(5));
  });
});

describe("quantos planos", () => {
  it("um a cada 3,5 segundos, entre 4 e 24", () => {
    expect(maxShots(15)).toBe(4);
    expect(maxShots(30)).toBe(9);
    expect(maxShots(60)).toBe(17);
    expect(maxShots(180)).toBe(24);
    expect(maxShots(null)).toBe(9);
  });

  it("sozinho é sozinho sem ninguém junto", () => {
    expect(isSolo(["sozinho", "em_casa"])).toBe(true);
    expect(isSolo(["sozinho", "com_alguem"])).toBe(false);
    expect(isSolo(["em_casa"])).toBe(false);
  });
});

describe("normalizeShots", () => {
  const blocks = ["b1", "b2"];
  const opts = { orientation: "vertical" as const, max: 24, solo: false };

  it("só aceita blocos que existem e valores do vocabulário", () => {
    const shots = normalizeShots(
      {
        shots: [
          { block: 2, framing: "aberto", angle: "lateral", movement: "parado", description: "Corpo inteiro", location: " Sala ", why: "Mostra o joelho" },
          { block: 1, framing: "CLOSE", angle: "drone", movement: "voando", orientation: "diagonal" },
          { block: 3, framing: "close" },
        ],
      },
      blocks,
      opts,
    );
    expect(shots).toHaveLength(2);
    expect(shots[0]).toMatchObject({ block_id: "b1", framing: "close", angle: "altura_olhos", movement: "parado", orientation: "vertical" });
    expect(shots[1]).toEqual({
      block_id: "b2",
      framing: "aberto",
      angle: "lateral",
      movement: "parado",
      orientation: "vertical",
      description: "Corpo inteiro",
      location: "Sala",
      wardrobe: "",
      why: "Mostra o joelho",
      person_ids: [],
    });
    expect(normalizeShots({ shots: "nada" }, blocks, opts)).toEqual([]);
  });

  it("respeita o limite de planos e garante pelo menos um por bloco", () => {
    const many = { shots: [...Array.from({ length: 6 }, () => ({ block: 1, framing: "detalhe" })), { block: 2, framing: "close" }] };
    const shots = normalizeShots(many, blocks, { ...opts, max: 3 });
    expect(shots).toHaveLength(3);
    expect(shots.filter((x) => x.block_id === "b2")).toHaveLength(1);
  });

  it("quem grava sozinho não recebe câmera acompanhando", () => {
    const raw = { shots: [{ block: 1, movement: "acompanhando" }, { block: 2, movement: "aproximando" }] };
    expect(normalizeShots(raw, blocks, { ...opts, solo: true }).map((x) => x.movement)).toEqual(["parado", "aproximando"]);
    expect(normalizeShots(raw, blocks, opts)[0].movement).toBe("acompanhando");
  });
});

describe("normalizeWardrobe", () => {
  const w = (wardrobe: string) => ({ wardrobe });

  it("um visual só (ou nenhum) não vira troca de cenário", () => {
    expect(normalizeWardrobe([w("Camisa casual"), w(""), w("camisa casual "), w("")]).map((x) => x.wardrobe)).toEqual(["", "", "", ""]);
  });

  it("com troca de roupa, quem ficou em branco herda a do plano anterior", () => {
    expect(normalizeWardrobe([w(""), w("Regata"), w(""), w("Casaco"), w("")]).map((x) => x.wardrobe)).toEqual(["Regata", "Regata", "Regata", "Casaco", "Casaco"]);
  });
});

describe("vocabulário e prompt", () => {
  it("todo termo explica o que é e por quê", () => {
    for (const terms of [FRAMINGS, ANGLES, MOVEMENTS]) {
      for (const t of Object.values(terms)) {
        expect(t.what.length).toBeGreaterThan(10);
        expect(t.why.length).toBeGreaterThan(10);
      }
    }
  });

  it("YouTube é horizontal; o resto, vertical", () => {
    expect(defaultOrientation("youtube")).toBe("horizontal");
    expect(defaultOrientation("reels")).toBe("vertical");
    expect(defaultOrientation(null)).toBe("vertical");
  });

  it("o prompt leva o roteiro, o limite de planos e a regra de quem grava sozinho", () => {
    const blocks = [{ id: "b1", kind: "gancho" as const, label: null, speech: "Você erra isso.", on_screen: "", action: "" }];
    const solo = shotsPrompt(blocks, { title: "3 erros", platform: "reels", resources: ["sozinho"], durationS: 30 });
    expect(solo).toContain("1. [Gancho] FALA: Você erra isso.");
    expect(solo).toContain("NO MÁXIMO 9 planos");
    expect(solo).toContain("grava SOZINHA");
    expect(solo).toContain("por_cima_ombro");
    expect(shotsPrompt(blocks, { title: "x", platform: "reels", resources: ["com_alguem"], durationS: 60 })).not.toContain("SOZINHA");
  });
});

describe("cartão do plano", () => {
  it("mostra o enquadramento e só o que foge do padrão", () => {
    expect(shotTags({ framing: "close", angle: "altura_olhos", movement: "parado" })).toEqual(["Close"]);
    expect(shotTags({ framing: "detalhe", angle: "de_cima", movement: "aproximando" })).toEqual(["Detalhe", "De cima", "Aproximando"]);
  });

  it("lugar e roupa só quando mudam, e sempre no primeiro", () => {
    const list = [
      { location: "Quarto", wardrobe: "" },
      { location: " quarto ", wardrobe: "" },
      { location: "Sala", wardrobe: "Camiseta" },
      { location: "", wardrobe: "" },
    ];
    expect([0, 1, 2, 3].map((i) => setupLabel(list, i))).toEqual(["Quarto", "", "Sala · Camiseta", ""]);
  });
});
