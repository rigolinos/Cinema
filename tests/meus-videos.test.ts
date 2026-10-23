import { describe, expect, it } from "vitest";
import { exportPackage, isEmptyDraft, videoTab } from "@/lib/meus-videos";

describe("rascunho vazio", () => {
  it("só é vazio sem título e sem nenhuma resposta", () => {
    const empty = { title: null, objective: null, platform: null, duration_s: null, resources: [] };
    expect(isEmptyDraft(empty)).toBe(true);
    expect(isEmptyDraft({ ...empty, objective: "crescer" as const })).toBe(false);
    expect(isEmptyDraft({ ...empty, resources: ["sozinho" as const] })).toBe(false);
    expect(isEmptyDraft({ ...empty, title: "Ideia" })).toBe(false);
  });
});

describe("abas", () => {
  it("arquivado vence; pronto vai para Prontos; o resto está em andamento", () => {
    expect(videoTab({ stage: "pronto", archived_at: "2026-10-21" })).toBe("arquivados");
    expect(videoTab({ stage: "pronto" })).toBe("prontos");
    expect(videoTab({ stage: "planos", archived_at: null })).toBe("andamento");
  });
});

describe("pacote do vídeo", () => {
  const blocks = [
    { kind: "gancho" as const, label: null, speech: "Você erra isso.", on_screen: "3 ERROS", action: "" },
    { kind: "chamada" as const, label: null, speech: "Segue para mais.", on_screen: "", action: "Aponta" },
  ];
  const shot = (block_id: string, position: number, location: string, shoot_order: number | null, description: string) => ({
    block_id,
    position,
    shoot_order,
    framing: "close" as const,
    angle: "altura_olhos" as const,
    movement: "parado" as const,
    orientation: "vertical" as const,
    description,
    location,
    wardrobe: "",
    why: "",
  });

  it("junta roteiro, planos na ordem de gravação com o número da edição e a publicação", () => {
    const text = exportPackage({
      video: { title: "3 erros", hook: "Você erra isso.", format_slug: "tres-erros", platform: "reels", duration_s: 30 },
      blocks,
      blockIds: ["b1", "b2"],
      shots: [shot("b1", 0, "Sala", 1, "Rosto"), shot("b2", 1, "Quintal", 0, "Corpo inteiro")],
      posts: [{ title: "", caption: "Legenda boa.", hashtags: ["#treino"], cover_text: "3 erros", cover_idea: "Plano 1" }],
    });
    expect(text.startsWith("GRAVAÍ · 3 ERROS\n\n3 erros que… · Reels · 30 s\n\nGANCHO: “Você erra isso.”")).toBe(true);
    expect(text).toContain("━━ ROTEIRO ━━\n\n[0–2 s] Gancho\nFALA: Você erra isso.\nNA TELA: 3 ERROS");
    expect(text.indexOf("▸ QUINTAL")).toBeLessThan(text.indexOf("▸ SALA"));
    expect(text).toContain("PLANO 02 · Close · Altura dos olhos · Parado · Vertical\n  Corpo inteiro");
    expect(text).toContain("LEGENDA:\nLegenda boa.\n#treino\n\nCAPA: “3 erros” (Plano 1)");
  });

  it("várias plataformas: uma publicação para cada uma e a capa uma vez só", () => {
    const text = exportPackage({
      video: { title: "x", hook: null, format_slug: null, platform: "reels", platforms: ["reels", "tiktok"], duration_s: 30 },
      blocks: [],
      blockIds: [],
      shots: [],
      posts: [
        { platform: "reels", title: "", caption: "Do Reels.", hashtags: [], cover_text: "Capa", cover_idea: "" },
        { platform: "tiktok", title: "", caption: "Do TikTok.", hashtags: [], cover_text: "Capa", cover_idea: "" },
      ],
    });
    expect(text).toContain("Reels e TikTok · 30 s");
    expect(text).toContain("━━ PUBLICAÇÃO · REELS ━━\nLEGENDA:\nDo Reels.");
    expect(text).toContain("━━ PUBLICAÇÃO · TIKTOK ━━\nLEGENDA:\nDo TikTok.");
    expect(text.match(/CAPA:/g)).toHaveLength(1);
  });

  it("sem roteiro, planos ou publicação, fica só o cabeçalho", () => {
    expect(exportPackage({ video: { title: null, hook: null, format_slug: null, platform: null, duration_s: null }, blocks: [], shots: [], blockIds: [] })).toBe("GRAVAÍ · VÍDEO");
  });
});
