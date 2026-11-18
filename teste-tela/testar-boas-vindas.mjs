// Boas-vindas: a folha de instalar aparece uma vez no Início, no celular, do jeito de cada aparelho.
import path from "node:path";
import { APP, abrir, check, reset } from "./base-mock.mjs";

const out = process.argv[2];
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const INSTAGRAM = IPHONE + " Instagram 350.0.0";
const titulo = "Coloque o Gravaí na tela do seu celular";
await reset();

// ── iPhone: 2 passos, "Pronto, adicionei" e não volta
let s = await abrir(undefined, { boasVindas: true, ua: IPHONE });
await s.p.goto(`${APP}/inicio`, { waitUntil: "networkidle" });
await s.p.getByRole("dialog").waitFor();
let t = await s.p.getByRole("dialog").innerText();
check("iPhone: título e etiqueta", t.includes(titulo) && /BOAS-VINDAS AO GRAVAÍ/i.test(t));
check("iPhone: os 2 passos do Safari", t.includes("Compartilhar") && t.includes("Adicionar à Tela de Início") && t.includes("Pronto, adicionei"));
await s.p.screenshot({ path: path.join(out, "bv-1-iphone.png") });
await s.p.getByRole("button", { name: "Pronto, adicionei" }).click();
check("fecha ao tocar", (await s.p.getByRole("dialog").count()) === 0);
await s.p.reload({ waitUntil: "networkidle" });
await s.p.waitForTimeout(500);
check("não volta depois de vista", (await s.p.getByRole("dialog").count()) === 0);
check("sem erros (iPhone)", s.erros.length === 0, s.erros.join(" | "));
await s.b.close();

// ── Android com a janela de instalação do Chrome
s = await abrir(undefined, { boasVindas: true, ua: ANDROID });
await s.p.goto(`${APP}/inicio`, { waitUntil: "networkidle" });
await s.p.evaluate(() => {
  const e = new Event("beforeinstallprompt");
  e.prompt = async () => (window.__pediu = true);
  e.userChoice = Promise.resolve({ outcome: "accepted" });
  window.dispatchEvent(e);
});
await s.p.getByRole("button", { name: "Instalar o app" }).waitFor();
await s.p.screenshot({ path: path.join(out, "bv-2-android.png") });
await s.p.getByRole("button", { name: "Instalar o app" }).click();
await s.p.waitForTimeout(300);
check("Android: Instalar o app abre a janela do Chrome", (await s.p.evaluate(() => window.__pediu === true)) && (await s.p.getByRole("dialog").count()) === 0);
await s.b.close();

// ── Dentro do Instagram: copiar o link
s = await abrir(undefined, { boasVindas: true, ua: INSTAGRAM });
await s.p.goto(`${APP}/inicio`, { waitUntil: "networkidle" });
await s.p.getByRole("dialog").waitFor();
t = await s.p.getByRole("dialog").innerText();
check("Instagram: pede para abrir no navegador", t.includes("Copiar o link") && t.includes("Agora não") && !t.includes("Pronto, adicionei"));
await s.p.screenshot({ path: path.join(out, "bv-3-instagram.png") });
await s.p.getByRole("button", { name: "Agora não" }).click();
check("Agora não fecha", (await s.p.getByRole("dialog").count()) === 0);
await s.b.close();

// ── Computador: nada
s = await abrir({ width: 1280, height: 800 }, { boasVindas: true, mesa: true });
await s.p.goto(`${APP}/inicio`, { waitUntil: "networkidle" });
await s.p.waitForTimeout(500);
check("no computador não aparece", (await s.p.getByRole("dialog").count()) === 0);
await s.b.close();
