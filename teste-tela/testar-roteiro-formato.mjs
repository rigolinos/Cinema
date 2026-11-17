// Roteiro no formato universal: cabeçalho com número e lugar, ação sem rótulo, NOME centralizado
// com a fala embaixo, NA TELA, e o Copiar no mesmo formato. Supabase de mentira.
import path from "node:path";
import { APP, abrir, check, estado, reset } from "./base-mock.mjs";

const out = process.argv[2];
await reset();
const e0 = await estado();
const blocos = e0.blocks.map((x) => (x.id === "b2" ? { ...x, speech: "Rafa: Lava de novo?\nBia: Lavo, e daí?", action: "Ela olha a panela." } : x));
const { b, c, p, erros } = await abrir();
await c.grantPermissions(["clipboard-read", "clipboard-write"], { origin: APP });
await reset({ blocks: blocos });
await p.goto(`${APP}/video/v1/roteiro`, { waitUntil: "networkidle" });
await p.getByLabel("O que acontece na cena 1").waitFor();

const cabecalhos = await p.getByRole("article").locator("h2").allInnerTexts();
check("cabeçalhos com número e lugar; duas partes na cozinha são uma cena", cabecalhos.join("|") === "1. COZINHA|2. SALA", cabecalhos.join("|"));
const t = await p.locator("main, body").first().innerText();
check("sem rótulos nem Escrever por cena", !/O que acontece\n|FALA:|\bEscrever\b(?! o roteiro)/.test(t));
const nome = p.getByRole("article").nth(1).getByRole("combobox").first();
const estilo = await nome.evaluate((el) => ({ tt: getComputedStyle(el).textTransform, ta: getComputedStyle(el).textAlign }));
check("o nome em maiúsculas, centralizado", estilo.tt === "uppercase" && estilo.ta === "center", JSON.stringify(estilo));
const caixas = await p.getByRole("article").evaluateAll((els) => els.map((el) => getComputedStyle(el).borderTopWidth));
check("sem caixa nem linha entre as cenas", caixas.every((w) => w === "0px"), caixas.join(","));
await p.screenshot({ path: path.join(out, "rf-1-roteiro.png"), fullPage: true });

await p.getByRole("button", { name: "Copiar" }).click();
// No Windows, a área de transferência devolve as quebras de linha como \r\n.
const copiado = (await p.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n");
check("Copiar no formato de roteiro", copiado.includes("NA TELA: 3 ERROS\n\nEla olha a panela.\n\nRAFA\nLava de novo?\n\nBIA\nLavo, e daí?\n\n\n2. SALA") && !/FALA:|\[\d/.test(copiado), copiado.slice(0, 400).replace(/\n/g, "⏎"));
check("sem erros", erros.length === 0, erros.join(" | "));
await b.close();
