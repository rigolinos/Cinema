import { describe, expect, it } from "vitest";
import { FORMATS } from "@/lib/formats";
import { durationLabel, ideaPrompt, nextQuestion, normalizeIdeas, type Answers } from "@/lib/ideas";
import { parseJson } from "@/lib/ai";

const full: Answers = { niche: "treino em casa", objective: "crescer", platform: "reels", durationS: 30, resources: ["sozinho"] };

describe("nextQuestion", () => {
  it("pergunta na ordem e libera as ideias quando tudo foi respondido", () => {
    expect(nextQuestion({ ...full, niche: "  " })).toBe("niche");
    expect(nextQuestion({ ...full, objective: null })).toBe("objective");
    expect(nextQuestion({ ...full, platform: null })).toBe("platform");
    expect(nextQuestion({ ...full, durationS: null })).toBe("duration");
    expect(nextQuestion({ ...full, resources: [] })).toBe("resources");
    expect(nextQuestion(full)).toBeNull();
  });
});

describe("ideaPrompt", () => {
  it("leva o contexto da pessoa e não oferece formato que precisa de outra pessoa a quem grava sozinho", () => {
    const solo = ideaPrompt({ niche: "receitas", objective: "vender", platform: "tiktok", durationS: 60, resources: ["sozinho"], previousTitles: ["Ideia velha"], request: "Mais engraçado" });
    expect(solo).toContain("receitas");
    expect(solo).toContain("Vender");
    expect(solo).toContain("TikTok, com cerca de 1 min");
    expect(solo).toContain("Ideia velha");
    expect(solo).toContain("Mais engraçado");
    expect(solo).not.toContain("- dialogo:");

    const junto = ideaPrompt({ niche: "humor", objective: "divertir", platform: "reels", durationS: 30, resources: ["com_alguem"] });
    expect(junto).toContain("- dialogo:");
    expect(junto).not.toContain("Trends desta semana");

    const comRadar = ideaPrompt({ niche: "humor", objective: "divertir", platform: "reels", durationS: 30, resources: ["sozinho"], trends: [{ title: "POV de segunda", what: "Vídeos sobre a segunda-feira." }] });
    expect(comRadar).toContain("Trends desta semana (use no máximo uma, e só se combinar com o nicho): POV de segunda: Vídeos sobre a segunda-feira.");
  });
});

describe("normalizeIdeas", () => {
  it("guarda só ideias completas, com formato conhecido, no máximo 5", () => {
    const ideas = normalizeIdeas({
      ideas: [
        { title: " 3 erros  no treino ", format_slug: "tres-erros", hook: "“Você erra isso.”", why: "Lista curta." },
        { title: "Sem gancho", format_slug: "pov" },
        { title: "Formato inventado", format_slug: "danca-viral", hook: "Olha isso" },
        ...Array.from({ length: 6 }, (_, i) => ({ title: `Extra ${i}`, hook: "Gancho" })),
      ],
    });
    expect(ideas).toHaveLength(5);
    expect(ideas[0]).toEqual({ title: "3 erros no treino", format_slug: "tres-erros", hook: "Você erra isso.", why: "Lista curta." });
    expect(ideas[1].format_slug).toBeNull();
    expect(normalizeIdeas(null)).toEqual([]);
    expect(normalizeIdeas({ ideas: "nada" })).toEqual([]);
  });
});

describe("parseJson", () => {
  it("aceita JSON cercado por markdown e recusa texto solto", () => {
    expect(parseJson('```json\n{"ideas":[]}\n```')).toEqual({ ideas: [] });
    expect(() => parseJson("Claro! Aqui estão as ideias")).toThrow(/fora do formato/);
  });
});

describe("biblioteca de formatos", () => {
  it("cada formato tem slug único, estrutura e gancho de exemplo", () => {
    expect(new Set(FORMATS.map((f) => f.slug)).size).toBe(FORMATS.length);
    for (const f of FORMATS) {
      expect(f.structure.length).toBeGreaterThanOrEqual(3);
      expect(f.hookExample).toBeTruthy();
      expect(f.idealSeconds[0]).toBeLessThan(f.idealSeconds[1]);
    }
  });
});

describe("durationLabel", () => {
  it("mostra segundos e minutos", () => {
    expect(durationLabel(15)).toBe("15 s");
    expect(durationLabel(60)).toBe("1 min");
    expect(durationLabel(90)).toBe("1 min 30 s");
  });
});
