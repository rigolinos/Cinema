import { describe, expect, it } from "vitest";
import { captionWithTags, cleanHashtag, cleanHashtags, cutAtSentence, needsTitle, normalizePosts } from "@/lib/publicar";

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

  it("legenda que passa do limite é cortada na última frase completa, nunca no meio", () => {
    const long = `${"Frase um completa. ".repeat(6)}Frase final que estoura o limite do TikTok por muito.`;
    const cut = cutAtSentence(long, 150);
    expect(cut.length).toBeLessThanOrEqual(150);
    expect(cut.endsWith(".")).toBe(true);
    expect(cutAtSentence("curta", 150)).toBe("curta");
    expect(normalizePosts({ posts: { tiktok: { caption: long } } }, ["tiktok"])[0].caption.length).toBeLessThanOrEqual(150);
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
