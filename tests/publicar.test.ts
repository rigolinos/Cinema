import { describe, expect, it } from "vitest";
import { captionWithTags, cleanHashtag, cleanHashtags, needsTitle, normalizePosts, postPrompt } from "@/lib/publicar";

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
    expect(normalizePosts({ caption: "Oi", title: "Título" }, ["reels"])[0].title).toBe("");
    expect(normalizePosts({ caption: "Oi", title: "Título" }, ["youtube"])[0].title).toBe("Título");
  });

  it("sem legenda, não há publicação", () => {
    expect(normalizePosts({ caption: "  ", hashtags: ["x1"] }, ["reels"])).toEqual([]);
    expect(normalizePosts(null, ["reels"])).toEqual([]);
  });

  it("junta legenda e hashtags para colar", () => {
    expect(captionWithTags({ caption: "Legenda.", hashtags: ["#a1", "#b2"] })).toBe("Legenda.\n\n#a1 #b2");
    expect(captionWithTags({ caption: "Só legenda", hashtags: [] })).toBe("Só legenda");
  });

  it("o prompt leva roteiro, planos e a regra do título da plataforma", () => {
    const base = { niche: "treino", title: "3 erros", hook: "Você erra isso.", blocks: [{ kind: "gancho" as const, label: null, speech: "Você erra isso." }], shots: [{ description: "Close no rosto" }] };
    expect(postPrompt({ ...base, platforms: ["reels"] })).toContain("- reels (Reels):");
    expect(postPrompt({ ...base, platforms: ["reels"] })).toContain("sem título");
    expect(postPrompt({ ...base, platforms: ["youtube"] })).toContain("título de até 70 caracteres");
    expect(postPrompt({ ...base, platforms: ["reels"] })).toContain("1. Close no rosto");
    const both = postPrompt({ ...base, platforms: ["reels", "tiktok"] });
    expect(both).toContain("Onde vai sair: Reels, TikTok");
    expect(both).toContain('"posts":{"reels":{"caption":"","title":"","hashtags":[]},"tiktok":');
  });

  it("um texto por plataforma, com a mesma capa", () => {
    const posts = normalizePosts(
      {
        cover_text: "3 erros",
        cover_idea: "Plano 1",
        posts: { reels: { caption: "Do Reels", hashtags: ["treino"] }, youtube: { caption: "Do YouTube", title: "Título" }, tiktok: { caption: "" } },
      },
      ["reels", "youtube", "tiktok"],
    );
    expect(posts.map((p) => [p.platform, p.caption, p.title])).toEqual([
      ["reels", "Do Reels", ""],
      ["youtube", "Do YouTube", "Título"],
    ]);
    expect(posts.every((p) => p.cover_text === "3 erros")).toBe(true);
  });
});
