import { describe, expect, it } from "vitest";
import { installMode, isIos } from "@/lib/instalar";

const ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const INSTAGRAM = `${IPHONE} Instagram 350.0.0`;

describe("instalar o app", () => {
  it("já aberto como app não pede nada", () => {
    expect(installMode({ ua: ANDROID, standalone: true, canPrompt: true })).toBe("instalado");
  });

  it("Android com a janela liberada instala direto; sem ela, vai pelo menu", () => {
    expect(installMode({ ua: ANDROID, standalone: false, canPrompt: true })).toBe("direto");
    expect(installMode({ ua: ANDROID, standalone: false, canPrompt: false })).toBe("menu");
  });

  it("iPhone e iPad mostram o passo a passo do Safari", () => {
    expect(installMode({ ua: IPHONE, standalone: false, canPrompt: false })).toBe("iphone");
    expect(isIos(IPAD, 5)).toBe(true);
    expect(isIos(IPAD, 0)).toBe(false);
  });

  it("dentro do Instagram pede para abrir no navegador", () => {
    expect(installMode({ ua: INSTAGRAM, standalone: false, canPrompt: false })).toBe("outro-app");
  });
});
