import { describe, expect, it } from "vitest";
import { SET_TIPS, firstPending, nextPending, progress, setOrder, setupChange, tipFor } from "@/lib/set";

const shot = (position: number, shoot_order: number | null, recorded = false, good_take = false) => ({ position, shoot_order, recorded, good_take });

describe("setOrder", () => {
  it("segue a ordem de gravação; sem ela, a do roteiro", () => {
    expect(setOrder([shot(0, 2), shot(1, 0), shot(2, 1)]).map((s) => s.position)).toEqual([1, 2, 0]);
    expect(setOrder([shot(2, null), shot(0, null), shot(1, null)]).map((s) => s.position)).toEqual([0, 1, 2]);
    expect(setOrder([shot(2, null), shot(0, 0)]).map((s) => s.position)).toEqual([0, 2]);
  });
});

describe("próximo plano", () => {
  it("vai para o próximo não gravado e volta para os pulados no fim", () => {
    const shots = [shot(0, 0, true), shot(1, 1), shot(2, 2, true), shot(3, 3)];
    expect(firstPending(shots)).toBe(1);
    expect(nextPending(shots, 1)).toBe(3);
    expect(nextPending(shots, 3)).toBe(1);
    expect(nextPending([shot(0, 0, true), shot(1, 1, true)], 0)).toBe(-1);
  });
});

describe("setupChange", () => {
  it("avisa troca de lugar ou de roupa, ignorando maiúsculas e espaços", () => {
    expect(setupChange(undefined, { location: "Sala", wardrobe: "" })).toBeNull();
    expect(setupChange({ location: "Sala", wardrobe: "" }, { location: " sala", wardrobe: "" })).toBeNull();
    expect(setupChange({ location: "Sala", wardrobe: "Regata" }, { location: "Quintal", wardrobe: "Casaco" })).toBe(
      "Troca de cenário: vá para Quintal e troque para Casaco.",
    );
  });
});

describe("progress", () => {
  it("conta gravados, bons e o que falta", () => {
    expect(progress([shot(0, 0, true, true), shot(1, 1, true), shot(2, 2)])).toEqual({ total: 3, recorded: 2, good: 1, missing: 1, done: false });
    expect(progress([shot(0, 0, true)]).done).toBe(true);
    expect(progress([]).done).toBe(false);
  });
});

describe("dica da abertura", () => {
  it("curta, e sempre a mesma para o mesmo vídeo", () => {
    for (const t of SET_TIPS) expect(t.length).toBeLessThanOrEqual(60);
    expect(tipFor("abc")).toBe(tipFor("abc"));
    expect(SET_TIPS).toContain(tipFor("fb68030d-21c1-4beb-96bb-ec0ac2ad0492"));
  });
});
