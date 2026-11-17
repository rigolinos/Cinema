// História em texto corrido e roteiro sem caixas, no Supabase de mentira e com a IA simulada.
import path from "node:path";
import { APP, abrir, check, estado, reset } from "./base-mock.mjs";

const out = process.argv[2];
const DB = "http://localhost:54399";
const { b, p, erros } = await abrir();
const pedidos = [];
await p.route("**/api/roteiro", async (route) => {
  const body = route.request().postDataJSON();
  pedidos.push(body);
  if (body.mode === "bloco") {
    const e = await (await fetch(`${DB}/__state`)).json();
    const atual = e.blocks.find((x) => x.id === body.blockId);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ block: { ...atual, speech: "Fala reescrita." } }) });
  }
  if (body.mode === "rascunho") {
    const blocks = [{ id: "n1", video_id: "v2", position: 0, kind: "gancho", label: null, speech: "Oi, gente.", on_screen: "", action: "Ela olha para a câmera", person_id: null }];
    await fetch(`${DB}/__blocks`, { method: "POST", body: JSON.stringify(blocks) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ blocks }) });
  }
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
});
const texto = () => p.locator("body").innerText();

// ── História
await reset();
await p.goto(`${APP}/video/v2/roteiro`, { waitUntil: "networkidle" });
const historia = p.getByRole("textbox", { name: "A história", exact: true });
await historia.waitFor();
let t = await texto();
check("história sem títulos", !/Como começa|Como termina/.test(t) && !/O QUE ACONTECE/i.test(t));
check("a história aparece no texto corrido", (await historia.inputValue()).startsWith("Gancho antigo"));
await historia.fill("Ela sai de casa feliz.\n\nNa esquina, apalpa os bolsos e volta correndo.\n\nA chave estava na porta.");
await p.getByLabel("Peça uma mudança na história").click();
await p.waitForTimeout(300);
let e = await estado();
const v2 = e.videos.find((v) => v.id === "v2");
check("salva separando começo, meio e fim", v2.hook === "Ela sai de casa feliz." && v2.situation === "Na esquina, apalpa os bolsos e volta correndo." && v2.payoff === "A chave estava na porta.", JSON.stringify([v2.hook, v2.situation, v2.payoff]));
await p.screenshot({ path: path.join(out, "rn-1-historia.png") });
await p.getByRole("button", { name: "Escrever o roteiro" }).click();
await p.getByLabel("Fala de Rafa na cena 1").waitFor();
check("escreve o roteiro a partir da história", pedidos.some((x) => x.mode === "rascunho"));

// ── Roteiro
await reset();
await p.goto(`${APP}/video/v1/roteiro`, { waitUntil: "networkidle" });
await p.getByLabel("Fala de Rafa na cena 1").waitFor();
await p.waitForTimeout(300);
t = await texto();
check("sem os títulos dos campos", !/O que acontece\n/.test(t) && !t.includes("Texto escrito na tela") && !t.includes("Pedir ajuste nesta cena"));
check("a ação e a fala aparecem como texto", (await p.getByLabel("O que acontece na cena 1").inputValue()) === "Mostra a panela");
check("uma cena só com um campo de fala por linha", (await p.getByLabel(/Fala de .* na cena 1/).count()) === 1);
await p.screenshot({ path: path.join(out, "rn-2-roteiro.png") });

// Diálogo: + Fala com a outra pessoa
await p.getByRole("button", { name: "Adicionar fala na cena 1" }).click();
const nova = p.getByLabel("Fala de Bia na cena 1");
await nova.waitFor();
check("a fala nova é da outra pessoa e já recebe o cursor", await nova.evaluate((el) => el === document.activeElement));
await nova.fill("Lavo mesmo, e daí?");
await p.getByLabel("O que acontece na cena 2").click();
await p.waitForTimeout(300);
e = await estado();
check("a conversa vira duas linhas com o nome", e.blocks.find((x) => x.id === "b1").speech === "Você lava o arroz errado.\nBia: Lavo mesmo, e daí?", JSON.stringify(e.blocks.find((x) => x.id === "b1").speech));

// Trocar quem fala
await p.getByLabel("Quem fala").first().selectOption("Bia");
await p.waitForTimeout(300);
e = await estado();
check("tocar no nome troca quem fala", e.blocks.find((x) => x.id === "b1").speech.startsWith("Bia: Você lava"));
await p.screenshot({ path: path.join(out, "rn-3-dialogo.png") });

// Esvaziar uma fala tira a linha
await p.getByLabel("Fala de Bia na cena 1").nth(1).fill("");
await p.getByLabel("O que acontece na cena 2").click();
await p.waitForTimeout(300);
e = await estado();
check("fala vazia sai", e.blocks.find((x) => x.id === "b1").speech === "Bia: Você lava o arroz errado.");

// Menu da cena
await p.getByRole("button", { name: "Opções da cena 2" }).click();
const itens = (await p.getByRole("menuitem").allInnerTexts()).map((x) => x.trim());
check("menu da cena", ["Para que serve esta cena?", "Texto na tela", "Apagar cena"].every((x) => itens.includes(x)) && !itens.includes("Pedir ajuste"), itens.join(" | "));
await p.screenshot({ path: path.join(out, "rn-4-menu.png") });
await p.getByRole("menuitem", { name: "Texto na tela" }).click();
const tela = p.getByLabel("Texto escrito na tela na cena 2");
check("Texto na tela abre o campo com o cursor", await tela.evaluate((el) => el === document.activeElement));
await tela.fill("ERRO 1");
await p.getByLabel("O que acontece na cena 3").click();
await p.waitForTimeout(300);
e = await estado();
check("salva o texto na tela", e.blocks.find((x) => x.id === "b2").on_screen === "ERRO 1");

await p.getByRole("button", { name: "Opções da cena 2" }).click();
await p.getByRole("menuitem", { name: "Para que serve esta cena?" }).click();
check("Para que serve explica só quando pedem", (await texto()).includes("O que você prometeu no gancho"));

await p.getByRole("article").nth(2).getByRole("button", { name: "Pedir ajuste" }).click();
await p.getByLabel("O que mudar na cena 3").waitFor();
await p.getByRole("button", { name: "Mais curto" }).click();
await p.waitForTimeout(400);
check("pedir ajuste reescreve a cena", (await p.getByLabel(/Fala de .* na cena 3/).first().inputValue()) === "Fala reescrita.");

await p.getByRole("button", { name: "Opções da cena 3" }).click();
await p.getByRole("menuitem", { name: "Apagar cena" }).click();
await p.getByRole("button", { name: "Desfazer" }).waitFor();
check("apagar cena oferece desfazer", (await p.getByRole("article").count()) === 2);
await p.getByRole("button", { name: "Desfazer" }).click();
check("desfazer devolve a cena", (await p.getByRole("article").count()) === 3);

// Cena nova
await p.getByRole("button", { name: "Adicionar cena" }).click();
await p.getByLabel(/Fala de .* na cena 4/).waitFor();
check("cena nova já abre com o cursor na fala", await p.getByLabel(/Fala de .* na cena 4/).evaluate((el) => el === document.activeElement));
check("sem erros", erros.length === 0, erros.join(" | "));
await b.close();

// Celular pequeno
await reset();
const s = await abrir({ width: 320, height: 700 });
await s.p.goto(`${APP}/video/v1/roteiro`, { waitUntil: "networkidle" });
await s.p.getByLabel("Fala de Rafa na cena 1").waitFor();
check("320px: sem vazar", await s.p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
await s.p.getByRole("button", { name: "Opções da cena 1" }).click();
const box = await s.p.getByRole("menu").boundingBox();
check("320px: menu cabe", box.x >= 0 && box.x + box.width <= 320, JSON.stringify(box));
await s.p.screenshot({ path: path.join(out, "rn-5-320.png") });
await s.b.close();
await reset();
