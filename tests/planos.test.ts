import { describe, expect, it } from "vitest";
import { ANGLES, FRAMINGS, MOVEMENTS, defaultOrientation, normalizeShots, setupChanges, shootingOrder, shotsPrompt } from "@/lib/planos";

const s = (position: number, location: string, wardrobe = "") => ({ position, location, wardrobe });

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

describe("normalizeShots", () => {
  const blocks = ["b1", "b2"];

  it("só aceita blocos que existem e valores do vocabulário, no máximo 4 por bloco", () => {
    const shots = normalizeShots(
      {
        shots: [
          { block: 2, framing: "aberto", angle: "lateral", movement: "parado", description: "Corpo inteiro", location: " Sala ", why: "Mostra o joelho" },
          { block: 1, framing: "CLOSE", angle: "drone", movement: "voando", orientation: "diagonal" },
          { block: 3, framing: "close" },
          ...Array.from({ length: 6 }, () => ({ block: 1, framing: "detalhe" })),
        ],
      },
      blocks,
      "vertical",
    );
    expect(shots.filter((x) => x.block_id === "b1")).toHaveLength(4);
    expect(shots[0]).toMatchObject({ block_id: "b1", framing: "close", angle: "altura_olhos", movement: "parado", orientation: "vertical" });
    expect(shots[shots.length - 1]).toEqual({
      block_id: "b2",
      framing: "aberto",
      angle: "lateral",
      movement: "parado",
      orientation: "vertical",
      description: "Corpo inteiro",
      location: "Sala",
      wardrobe: "",
      why: "Mostra o joelho",
    });
    expect(normalizeShots({ shots: "nada" }, blocks, "vertical")).toEqual([]);
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

  it("o prompt leva o roteiro numerado e os valores aceitos", () => {
    const p = shotsPrompt(
      [{ id: "b1", kind: "gancho", label: null, speech: "Você erra isso.", on_screen: "", action: "" }],
      { title: "3 erros", platform: "reels", resources: ["sozinho"] },
    );
    expect(p).toContain("1. [Gancho] FALA: Você erra isso.");
    expect(p).toContain("por_cima_ombro");
    expect(p).toContain("orientação padrão: vertical");
  });
});
