import { describe, expect, it } from "vitest";
import { normalizeAiScript, parseFdx, sizeFor } from "@/lib/script";

const fdx = `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft><Content>
  <Paragraph Type="Scene Heading"><Text>EXT. PRAIA - AMANHECER</Text></Paragraph>
  <Paragraph Type="Action"><Text>Lucas caminha &amp; olha o mar.</Text></Paragraph>
  <Paragraph Type="Character"><Text>LUCAS</Text></Paragraph>
  <Paragraph Type="Dialogue"><Text>Cheguei.</Text></Paragraph>
  <Paragraph Type="Character"><Text>MARINA (V.O.)</Text></Paragraph>
  <Paragraph Type="Scene Heading"><Text>INT. CASA DE LUCAS - NOITE</Text></Paragraph>
  <Paragraph Type="Character"><Text>LUCAS</Text></Paragraph>
</Content></FinalDraft>`;

describe("parseFdx", () => {
  it("lê cenas, personagens e locações do Final Draft", () => {
    const r = parseFdx(fdx)!;
    expect(r.scenes).toHaveLength(2);
    expect(r.scenes[0]).toMatchObject({
      number: "1",
      int_ext: "EXT",
      location_name: "PRAIA",
      time_of_day: "AMANHECER",
      characters: ["LUCAS", "MARINA"],
      synopsis: "Lucas caminha & olha o mar.",
      weather_requirement: "sun",
    });
    expect(r.scenes[1]).toMatchObject({ int_ext: "INT", location_name: "CASA DE LUCAS", time_of_day: "NOITE" });
    expect(r.characters).toEqual([
      { name: "LUCAS", totalScenes: 2, size: "supporting" },
      { name: "MARINA", totalScenes: 1, size: "small" },
    ]);
    expect(r.locations).toEqual([
      { name: "PRAIA", isCovered: false, weatherRisk: "medium" },
      { name: "CASA DE LUCAS", isCovered: true, weatherRisk: "low" },
    ]);
  });

  it("devolve null quando não há cena", () => {
    expect(parseFdx("<FinalDraft></FinalDraft>")).toBeNull();
  });
});

describe("normalizeAiScript", () => {
  it("corrige valores fora do que o banco aceita", () => {
    const r = normalizeAiScript({
      scenes: [
        { number: "1", int_ext: "ext", location_name: "praia", time_of_day: "tarde", characters: ["Lucas", 3, "lucas"], pages: "2", weather_requirement: "tempestade" },
        { number: "1", int_ext: "INT", location_name: "", time_of_day: "NOITE", pages: -4 },
      ],
    });
    expect(r.scenes[0]).toMatchObject({
      int_ext: "EXT",
      location_name: "PRAIA",
      time_of_day: "DIA",
      characters: ["LUCAS"],
      pages: 2,
      weather_requirement: "any",
    });
    expect(r.scenes[1]).toMatchObject({ number: "1-2", location_name: "LOCAÇÃO SEM NOME", pages: 8, characters: [] });
    expect(r.characters).toEqual([{ name: "LUCAS", totalScenes: 1, size: "small" }]);
  });

  it("recusa resposta sem cenas, em vez de inventar um roteiro", () => {
    expect(() => normalizeAiScript({ scenes: [] })).toThrow(/não encontrou cenas/);
    expect(() => normalizeAiScript(null)).toThrow();
  });
});

describe("sizeFor", () => {
  it("classifica pelo número de cenas", () => {
    expect(sizeFor(1)).toBe("small");
    expect(sizeFor(2)).toBe("supporting");
    expect(sizeFor(5)).toBe("supporting");
    expect(sizeFor(6)).toBe("protagonist");
  });
});
