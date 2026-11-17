// Rodada 8 da testadora: produto só para quem vende, o tempo com um toque, a história no passo Ideia
// e o roteiro com Escrever e Pedir ajuste à vista. Supabase de mentira, IA simulada.
import path from "node:path";
import { APP, abrir, check, estado, reset } from "./base-mock.mjs";

const out = process.argv[2];
const inicial = await estado();
const { b, p, erros } = await abrir();
const pedidos = [];
await p.route("**/api/roteiro", async (route) => {
  const body = route.request().postDataJSON();
  pedidos.push(body);
  if (body.mode === "historia") {
    await new Promise((r) => setTimeout(r, 200));
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ story: { hook: "Ela tranca o carro.", situation: "Aperta o controle na esquina, na porta e na janela.", payoff: body.request ? "Na cama, aperta de novo." : "Desiste e dorme." } }) });
  }
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
});
const perfil = { display_name: "Lia Souza", niche: "Humor", platforms: [], product: "Aulas de pilates", product_edge: "Profissionais qualificados" };
const draft = (extra) => inicial.videos.map((v) => (v.id === "draft" ? { ...v, objective: "divertir", platforms: ["reels"], platform: "reels", duration_s: 30, resources: ["sozinho", "em_casa"], ...extra } : v));

// ── 1. O produto só aparece para quem vende
await reset({ profile: perfil, videos: draft({}), ideas: [] });
await p.goto(`${APP}/video/draft/ideia`, { waitUntil: "networkidle" });
await p.getByText("Qual o objetivo deste vídeo?").first().waitFor();
await p.waitForTimeout(300);
let t = await p.locator("body").innerText();
check("Divertir: o produto do perfil não aparece", !t.includes("Aulas de pilates") && !t.includes("O que você vende"), t.match(/O que você vende[^\n]*/)?.[0] ?? "");
await p.screenshot({ path: path.join(out, "r8-1-sem-produto.png"), fullPage: true });
await reset({ profile: perfil, videos: draft({ objective: "vender" }), ideas: [] });
await p.goto(`${APP}/video/draft/ideia`, { waitUntil: "networkidle" });
await p.getByText("Qual o objetivo deste vídeo?").first().waitFor();
await p.waitForTimeout(300);
check("Vender: o produto aparece", (await p.locator("body").innerText()).includes("Aulas de pilates"));

// ── 2. O tempo com um toque (o "botão que sumiu")
await reset({ profile: perfil, videos: draft({ duration_s: null }), ideas: [] });
await p.goto(`${APP}/video/draft/ideia`, { waitUntil: "networkidle" });
await p.getByText("E quanto tempo, mais ou menos?").first().waitFor();
await p.waitForTimeout(300);
await p.screenshot({ path: path.join(out, "r8-2-tempo.png"), fullPage: true });
const trinta = p.getByRole("button", { name: "30 s", exact: true });
check("o tempo aparece como opções, sem botão de seguir", (await trinta.count()) === 1 && (await p.getByRole("button", { name: "Pronto, seguir" }).count()) === 0);
check("as opções de tempo não estão travadas", await trinta.isEnabled());
await trinta.click();
await p.waitForTimeout(500);
let e = await estado();
check("um toque no tempo salva e segue", e.videos.find((v) => v.id === "draft").duration_s === 30, String(e.videos.find((v) => v.id === "draft").duration_s));
t = await p.locator("body").innerText();
check("depois do tempo, a pergunta some", !/GRAVAÍ\s+E quanto tempo/.test(t));
await p.screenshot({ path: path.join(out, "r8-3-tempo-depois.png"), fullPage: true });

// ── 3. A história no passo Ideia, com botões que dizem o que fazem
const comHistoria = inicial.videos.map((v) => (v.id === "v2" ? { ...v, start_door: "ideia", brief: "Ativar o alarme do carro e esquecer se ativou, em lugares diferentes", situation: "Ela anda.", payoff: "Volta." } : v));
await reset({ videos: comHistoria });
await p.goto(`${APP}/video/v2/roteiro`, { waitUntil: "networkidle" });
const historia = p.getByRole("textbox", { name: "A história", exact: true });
await historia.waitFor();
const topo = await p.locator("header").first().innerText();
check("a história fica no passo Ideia", /Ideia/.test(topo) && /PASSO 1 DE 5/i.test(topo), topo.replace(/\s+/g, " "));
check("o texto da pessoa fica recolhido", (await p.getByRole("button", { name: "Ver o que eu escrevi" }).count()) === 1 && (await p.getByText("O que você escreveu").count()) === 0);
const mudar = p.getByRole("button", { name: "Mudar a história" });
check("o pedido de mudança tem um botão com nome", (await mudar.count()) === 1 && (await mudar.isDisabled()));
await p.getByLabel("Peça uma mudança na história").fill("troca o final");
check("com texto, o botão libera", await mudar.isEnabled());
await mudar.click();
await p.waitForTimeout(600);
check("Mudar a história pede a mudança", pedidos.at(-1)?.mode === "historia" && pedidos.at(-1)?.request === "troca o final");
check("e a história nova aparece", (await historia.inputValue()).includes("Na cama, aperta de novo."));
await p.getByRole("button", { name: "Ver o que eu escrevi" }).click();
check("Ver o que eu escrevi mostra o texto e o refazer", (await p.getByRole("button", { name: "Refazer a história com o meu texto" }).count()) === 1);
check("Contar de novo virou Outra versão", (await p.getByRole("button", { name: "Outra versão" }).count()) === 1 && (await p.getByRole("button", { name: "Contar de novo" }).count()) === 0);
await p.screenshot({ path: path.join(out, "r8-4-historia.png"), fullPage: true });

// ── 4. Roteiro: Escrever e Pedir ajuste à vista
await reset();
await p.goto(`${APP}/video/v1/roteiro`, { waitUntil: "networkidle" });
await p.getByLabel("O que acontece na cena 1").waitFor();
const topoRot = await p.locator("header").first().innerText();
check("com roteiro, o passo é Roteiro", /Roteiro/.test(topoRot) && /PASSO 2 DE 5/i.test(topoRot));
const cena1 = p.getByRole("article").first();
await cena1.getByRole("button", { name: "Escrever" }).click();
check("Escrever põe o cursor no texto da cena", await p.getByLabel("O que acontece na cena 1").evaluate((el) => el === document.activeElement && el.selectionStart === el.value.length));
await cena1.getByRole("button", { name: "Pedir ajuste" }).click();
check("Pedir ajuste à vista abre o ajuste", (await p.getByLabel("O que mudar na cena 1").count()) === 1);
await p.getByRole("button", { name: "Opções da cena 1" }).click();
const itens = (await p.getByRole("menuitem").allInnerTexts()).map((x) => x.trim());
check("o menu não repete o Pedir ajuste", !itens.includes("Pedir ajuste") && itens.includes("Apagar cena"), itens.join(" | "));
await p.getByRole("button", { name: "Fechar o menu" }).click({ position: { x: 5, y: 5 } });
await p.screenshot({ path: path.join(out, "r8-5-roteiro.png") });
check("sem erros", erros.length === 0, erros.join(" | "));
await b.close();

const s = await abrir({ width: 320, height: 700 });
await reset();
await s.p.goto(`${APP}/video/v1/roteiro`, { waitUntil: "networkidle" });
await s.p.getByLabel("O que acontece na cena 1").waitFor();
check("320px: sem vazar", await s.p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
await s.b.close();
await reset();
