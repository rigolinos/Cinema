import { describe, expect, it } from "vitest";
import { authCallbackUrl, authErrorMessage, safeNext } from "@/lib/auth-errors";

describe("authErrorMessage", () => {
  it("traduz pelo código do Supabase", () => {
    expect(authErrorMessage({ code: "invalid_credentials", message: "Invalid login credentials" })).toBe("E-mail ou senha incorretos.");
    expect(authErrorMessage({ code: "email_not_confirmed" })).toMatch(/confirmar o seu e-mail/);
  });

  it("cai na mensagem quando não há código conhecido", () => {
    expect(authErrorMessage({ message: "User already registered" })).toMatch(/Já existe uma conta/);
    expect(authErrorMessage({ message: "Failed to fetch" })).toMatch(/Sem conexão/);
    expect(authErrorMessage({ message: "algo estranho" })).toBe("Algo deu errado. Tente de novo.");
    expect(authErrorMessage(null)).toBe("Algo deu errado. Tente de novo.");
  });
});

describe("volta do e-mail", () => {
  it("monta o link de retorno com o destino codificado", () => {
    expect(authCallbackUrl("https://gravai.app/", "/nova-senha")).toBe("https://gravai.app/auth/callback?next=%2Fnova-senha");
  });

  it("só volta para dentro do app", () => {
    expect(safeNext("/nova-senha")).toBe("/nova-senha");
    expect(safeNext("https://golpe.com")).toBe("/inicio");
    expect(safeNext("//golpe.com")).toBe("/inicio");
    expect(safeNext("/\\golpe.com")).toBe("/inicio");
    expect(safeNext(null)).toBe("/inicio");
  });
});
