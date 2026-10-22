import { describe, expect, it } from "vitest";
import { COMPANY, LEGAL_VERSIONS, PRIVACY, TERMS, pendingDocuments } from "@/lib/legal";

describe("aceites", () => {
  it("pede só o que falta na versão atual", () => {
    expect(pendingDocuments([])).toEqual(["termos", "privacidade"]);
    expect(pendingDocuments([{ document: "termos", version: LEGAL_VERSIONS.termos }])).toEqual(["privacidade"]);
    expect(pendingDocuments([{ document: "termos", version: "v0" }, { document: "privacidade", version: LEGAL_VERSIONS.privacidade }])).toEqual(["termos"]);
    expect(pendingDocuments([{ document: "termos", version: LEGAL_VERSIONS.termos }, { document: "privacidade", version: LEGAL_VERSIONS.privacidade }])).toEqual([]);
  });

  it("as versões seguem o formato que o banco aceita", () => {
    for (const v of Object.values(LEGAL_VERSIONS)) expect(v).toMatch(/^v[0-9]+$/);
  });
});

describe("conteúdo mínimo da LGPD", () => {
  const privacy = PRIVACY.flatMap((s) => [s.title, ...s.paragraphs]).join(" ");
  const terms = TERMS.flatMap((s) => [s.title, ...s.paragraphs]).join(" ");

  it("a Política identifica o controlador e o canal de contato", () => {
    expect(privacy).toContain(COMPANY.cnpj);
    expect(privacy).toContain(COMPANY.email);
  });

  it("a Política cobre bases legais, compartilhamento, transferência, retenção e direitos", () => {
    expect(privacy).toMatch(/art\. 7º/);
    expect(privacy).toMatch(/Supabase/);
    expect(privacy).toMatch(/Google \(Gemini\)/);
    expect(privacy).toMatch(/Estados Unidos/);
    expect(privacy).toMatch(/Enquanto sua conta existir/);
    expect(privacy).toMatch(/art\. 18/);
    expect(privacy).toMatch(/ANPD/);
    expect(privacy).toMatch(/cookies/i);
  });

  it("a Política explica a memória do criador e como apagá-la", () => {
    expect(privacy).toMatch(/Memória do criador/);
    expect(privacy).toMatch(/Esquecer tudo/);
  });

  it("os Termos avisam sobre a IA e a responsabilidade de quem publica", () => {
    expect(terms).toMatch(/inteligência artificial/);
    expect(terms).toMatch(/Quem publica o vídeo é você/);
    expect(terms).toContain(COMPANY.cnpj);
  });
});
