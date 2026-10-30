import { describe, expect, it } from "vitest";
import { CONSENT_VERSION, consentText, formatShootDate, inviteMessage, rolesAs, rolesYou, shareUrl, sortRoles, validConsentName, whatsappLink } from "@/lib/pessoas";

describe("termo de uso de imagem", () => {
  it("nomeia quem pediu e o vídeo, e a versão bate com o que o banco aceita", () => {
    const text = consentText("Ana", "3 erros no treino").join(" ");
    expect(text).toContain("Autorizo Ana");
    expect(text).toContain("“3 erros no treino”");
    expect(text).toContain("18 anos");
    expect(CONSENT_VERSION).toMatch(/^imagem-v[0-9]+$/);
  });

  it("pede nome e sobrenome", () => {
    expect(validConsentName("Bruno Souza")).toBe(true);
    expect(validConsentName("  Bruno  ")).toBe(false);
    expect(validConsentName("B S")).toBe(false);
  });
});

describe("convite", () => {
  it("monta o link e a mensagem pelo primeiro nome", () => {
    const url = shareUrl("https://gravai.app/", "abc");
    expect(url).toBe("https://gravai.app/p/abc");
    expect(inviteMessage("Bruno Souza", ["ator"], "3 erros", url)).toBe(
      "Oi, Bruno! Vou gravar “3 erros” e você está no time. Aqui estão suas falas e cenas: https://gravai.app/p/abc",
    );
    expect(inviteMessage("Carla", ["filma"], "3 erros", url)).toContain("o roteiro e os planos");
    expect(inviteMessage("Kira", ["ator", "filma"], "3 erros", url)).toContain("suas falas, o roteiro e os planos");
  });

  it("mais de um papel: ordem fixa e frase natural", () => {
    expect(sortRoles(["filma", "ator"])).toEqual(["ator", "filma"]);
    expect(rolesAs(["filma", "ator"])).toBe("para aparecer no vídeo e filmar");
    expect(rolesAs(["equipe"])).toBe("para ajudar no set");
    expect(rolesAs(["ator", "filma", "equipe"])).toBe("para aparecer no vídeo, filmar e ajudar no set");
    expect(rolesYou(["filma", "ator"])).toBe("você aparece e filma");
  });

  it("o WhatsApp recebe a mensagem codificada e sem número", () => {
    expect(whatsappLink("Oi & tchau")).toBe("https://wa.me/?text=Oi%20%26%20tchau");
  });

  it("mostra a data por extenso e ignora data inválida", () => {
    expect(formatShootDate("2026-10-24")).toMatch(/24 de outubro/);
    expect(formatShootDate(null)).toBeNull();
    expect(formatShootDate("amanhã")).toBeNull();
  });
});
