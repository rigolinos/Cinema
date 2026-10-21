import { describe, expect, it } from "vitest";
import { daysUntilNext, fortnightPrompt, periodEnd, periodLabel, periodStart, quickStartDefaults } from "@/lib/quinzena";

const day = (s: string) => new Date(`${s}T15:00:00`);

describe("quinzena", () => {
  it("todo mundo troca de ideias no mesmo dia, a cada 14 dias a partir de uma segunda", () => {
    expect(periodStart(day("2026-01-05"))).toBe("2026-01-05");
    expect(periodStart(day("2026-01-18"))).toBe("2026-01-05");
    expect(periodStart(day("2026-01-19"))).toBe("2026-01-19");
    expect(periodStart(day("2026-10-20"))).toBe("2026-10-12");
    expect(periodStart(day("2026-10-26"))).toBe("2026-10-26");
    expect(periodEnd("2026-10-12")).toBe("2026-10-25");
  });

  it("conta os dias até as ideias novas", () => {
    expect(daysUntilNext(day("2026-10-12"))).toBe(14);
    expect(daysUntilNext(day("2026-10-20"))).toBe(6);
    expect(daysUntilNext(day("2026-10-25"))).toBe(1);
  });

  it("mostra o período em letra de claquete", () => {
    expect(periodLabel("2026-10-26")).toBe("26 OUT – 8 NOV");
    expect(periodLabel("2026-12-28")).toBe("28 DEZ – 10 JAN");
  });
});

describe("começar com um toque", () => {
  it("preenche plataforma do perfil, duração do formato e recursos", () => {
    expect(quickStartDefaults("tres-erros", ["tiktok", "reels"])).toEqual({ objective: "crescer", platform: "tiktok", durationS: 30, resources: ["sozinho", "em_casa"] });
    expect(quickStartDefaults("storytime", [])).toMatchObject({ platform: "reels", durationS: 60 });
    expect(quickStartDefaults("dialogo", ["orkut"])).toMatchObject({ platform: "reels", resources: ["com_alguem", "em_casa"] });
    expect(quickStartDefaults(null, ["youtube"])).toMatchObject({ platform: "youtube", durationS: 30 });
  });
});

describe("pedido à IA", () => {
  it("leva nicho, plataformas, ideias já recebidas e trends", () => {
    const p = fortnightPrompt({ niche: "receitas baratas", platforms: ["tiktok"], trends: [{ title: "POV de segunda", what: "Sobre a segunda-feira." }], recentTitles: ["Arroz de 3 jeitos"] });
    expect(p).toContain("Nicho do criador: receitas baratas");
    expect(p).toContain("Onde posta: TikTok");
    expect(p).toContain("não repita): Arroz de 3 jeitos");
    expect(p).toContain("POV de segunda: Sobre a segunda-feira.");
    expect(p).toContain("Sugira 6 ideias");
  });
});
