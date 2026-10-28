import { describe, expect, it } from "vitest";
import { assetLinks, isTwaReferrer } from "@/lib/android";
import { reportRow } from "@/lib/denuncia";

const FP = "AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89";

describe("app Android (TWA)", () => {
  it("monta o assetlinks com o pacote e as chaves", () => {
    const links = assetLinks("app.gravai.twa", `${FP.toLowerCase()}, ${FP}`);
    expect(links).toHaveLength(1);
    expect(links[0].target.package_name).toBe("app.gravai.twa");
    expect(links[0].target.sha256_cert_fingerprints).toEqual([FP, FP]);
  });

  it("sem pacote ou sem chave válida, não autoriza nenhum app", () => {
    expect(assetLinks(undefined, FP)).toEqual([]);
    expect(assetLinks("app.gravai.twa", undefined)).toEqual([]);
    expect(assetLinks("app.gravai.twa", "não é uma chave")).toEqual([]);
    expect(assetLinks("Gravai", FP)).toEqual([]);
  });

  it("reconhece a abertura pelo app", () => {
    expect(isTwaReferrer("android-app://app.gravai.twa/")).toBe(true);
    expect(isTwaReferrer("https://www.google.com/")).toBe(false);
    expect(isTwaReferrer("")).toBe(false);
  });
});

describe("denunciar resposta da IA", () => {
  it("corta o trecho e a nota nos limites da tabela", () => {
    const row = reportRow({ area: "ideia", reason: "ofensivo", content: "x".repeat(2500), note: "  y  ", refId: null });
    expect(row?.content).toHaveLength(2000);
    expect(row?.note).toBe("y");
  });

  it("'outro motivo' precisa de uma explicação", () => {
    expect(reportRow({ area: "outro", reason: "outro", content: "", note: "   " })).toBeNull();
    expect(reportRow({ area: "outro", reason: "outro", content: "", note: "Achei estranho" })?.note).toBe("Achei estranho");
  });
});
