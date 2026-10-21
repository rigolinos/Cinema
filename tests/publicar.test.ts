import { describe, expect, it } from "vitest";
import { captionWithTags, cleanHashtag, cleanHashtags, needsTitle, normalizePost, postPrompt } from "@/lib/publicar";

describe("hashtags", () => {
  it("limpa, põe # e descarta o que não serve", () => {
    expect(cleanHashtag(" ##Treino Em Casa ")).toBe("#treinoemcasa");
    expect(cleanHashtag("saúde!")).toBe("#saúde");
    expect(cleanHashtag("#")).toBeNull();
    expect(cleanHashtag("a")).toBeNull();
  });

  it("tira repetidas e para em 5", () => {
    expect(cleanHashtags(["treino", "#Treino", "casa", 3, "a", "x1", "x2", "x3", "x4"])).toEqual(["#treino", "#casa", "#x1", "#x2", "#x3"]);
    expect(cleanHashtags("treino")).toEqual([]);
  });
});

describe("publicação", () => {
  it("título só no YouTube e no Shorts", () => {
    expect(needsTitle("youtube")).toBe(true);
    expect(needsTitle("shorts")).toBe(true);
    expect(needsTitle("reels")).toBe(false);
    expect(normalizePost({ caption: "Oi", title: "Título" }, "reels")?.title).toBe("");
    expect(normalizePost({ caption: "Oi", title: "Título" }, "youtube")?.title).toBe("Título");
  });

  it("sem legenda, não há publicação", () => {
    expect(normalizePost({ caption: "  ", hashtags: ["x1"] }, "reels")).toBeNull();
    expect(normalizePost(null, "reels")).toBeNull();
  });

  it("junta legenda e hashtags para colar", () => {
    expect(captionWithTags({ caption: "Legenda.", hashtags: ["#a1", "#b2"] })).toBe("Legenda.\n\n#a1 #b2");
    expect(captionWithTags({ caption: "Só legenda", hashtags: [] })).toBe("Só legenda");
  });

  it("o prompt leva roteiro, planos e a regra do título da plataforma", () => {
    const base = { niche: "treino", title: "3 erros", hook: "Você erra isso.", blocks: [{ kind: "gancho" as const, label: null, speech: "Você erra isso." }], shots: [{ description: "Close no rosto" }] };
    expect(postPrompt({ ...base, platform: "reels" })).toContain('"title": deixe vazio');
    expect(postPrompt({ ...base, platform: "youtube" })).toContain("título de até 70 caracteres");
    expect(postPrompt({ ...base, platform: "reels" })).toContain("1. Close no rosto");
  });
});
