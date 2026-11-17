// Cabeçalho escrito pela IA: aparece no lugar do número; cena antiga sem cabeçalho usa o lugar dos planos.
import path from "node:path";
import { APP, abrir, check, estado, reset } from "./base-mock.mjs";

const out = process.argv[2];
await reset();
const e0 = await estado();
const { b, c, p, erros } = await abrir();
await c.grantPermissions(["clipboard-read", "clipboard-write"], { origin: APP });
const blocos = e0.blocks.map((x, i) => (i === 0 ? { ...x, heading: "INT. COZINHA – DIA" } : i === 1 ? { ...x, heading: "EXT. QUINTAL – NOITE" } : { ...x, heading: null }));
await reset({ blocks: blocos });
await p.goto(`${APP}/video/v1/roteiro`, { waitUntil: "networkidle" });
await p.getByLabel("O que acontece na cena 1").waitFor();
const cab = await p.getByRole("article").locator("h2").allInnerTexts();
check("cabeçalho da IA e, sem ele, o lugar dos planos", cab.join("|") === "1. INT. COZINHA – DIA|2. EXT. QUINTAL – NOITE|3. SALA", cab.join("|"));
await p.getByRole("button", { name: "Copiar" }).click();
const copiado = (await p.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n");
check("o Copiar leva o cabeçalho", copiado.includes("1. INT. COZINHA – DIA\n") && copiado.includes("2. EXT. QUINTAL – NOITE\n") && copiado.includes("3. SALA\n"));
await p.screenshot({ path: path.join(out, "ci-1-cabecalho.png") });
check("sem erros", erros.length === 0, erros.join(" | "));
await b.close();
