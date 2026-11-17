import { describe, expect, it } from "vitest";
import { CONSENT_VERSION, consentCode, consentRecordText, consentText, firstNameOf, formatShootDate, inviteMessage, parseNames, rolesAs, rolesYou, shareUrl, sortRoles, validConsentName, whatsappLink } from "@/lib/pessoas";

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

describe("nomes de quem aparece", () => {
  it("separa por vírgula e por 'e', sem repetir", () => {
    expect(parseNames("Ana, João e Bia")).toEqual(["Ana", "João", "Bia"]);
    expect(parseNames(" ana ,, Ana;  João  Silva ")).toEqual(["ana", "João Silva"]);
    expect(parseNames("")).toEqual([]);
  });

  it("não separa nome que tem a letra e no meio nem duplica quem já está", () => {
    expect(parseNames("Rafael, Helena")).toEqual(["Rafael", "Helena"]);
    expect(parseNames("Ana, Bia", ["ANA"])).toEqual(["Bia"]);
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

  it("chama a pessoa pelo primeiro nome com maiúscula, mesmo digitado em minúscula", () => {
    expect(firstNameOf("  kira souza ")).toBe("Kira");
    expect(firstNameOf("joão")).toBe("João");
    expect(firstNameOf("élida")).toBe("Élida");
    expect(firstNameOf("JP")).toBe("JP");
    expect(firstNameOf("   ")).toBe("");
    expect(inviteMessage("kira souza", ["ator"], "3 erros", "https://gravai.app/p/abc")).toContain("Oi, Kira!");
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

describe("comprovante de uso de imagem", () => {
  const registro = { id: "c1", accepted_name: "Bia Costa", accepted_at: "2026-11-17T19:46:00Z", video_title: "Casal fala", creator_name: "Ana Lima", text_version: CONSENT_VERSION, accepted_text: null };

  it("o texto é o mesmo que o banco guarda (consent_text_v1)", () => {
    expect(consentText("Ana Lima", "Casal fala").join("\n")).toBe(
      [
        "Autorizo Ana Lima a usar, sem cobrar nada, a minha imagem e a minha voz gravadas para o vídeo “Casal fala”.",
        "O vídeo pode ser publicado em redes sociais e plataformas de vídeo, inteiro ou em trechos, inclusive em divulgação do próprio vídeo.",
        "Posso pedir a qualquer momento para não aparecer em publicações novas. O que já foi publicado antes do pedido pode continuar no ar.",
        "Declaro que tenho 18 anos ou mais.",
      ].join("\n"),
    );
  });

  it("aceite antigo remonta o texto pela versão; o guardado vale quando existe", () => {
    expect(consentRecordText(registro)?.startsWith("Autorizo Ana Lima")).toBe(true);
    expect(consentRecordText({ ...registro, accepted_text: "Texto guardado" })).toBe("Texto guardado");
    expect(consentRecordText({ ...registro, text_version: "imagem-v9" })).toBeNull();
  });

  it("o código é sempre o mesmo para o mesmo registro e muda com qualquer detalhe", async () => {
    const a = await consentCode(registro);
    expect(a).toMatch(/^GRV-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(await consentCode(registro)).toBe(a);
    expect(await consentCode({ ...registro, accepted_name: "Bia Costas" })).not.toBe(a);
  });
});
