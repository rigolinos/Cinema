import { APP, abrir, check, reset } from "./base-mock.mjs";
await reset();
const { b, p } = await abrir();
await p.goto(`${APP}/video/v1/roteiro`, { waitUntil: "networkidle" });
await p.getByLabel("O que acontece na cena 1").waitFor();
const h = (await p.getByRole("article").first().locator("h2").innerText()).trim();
check("cabeçalho da cena com o número e o lugar dos planos", h === "1. COZINHA", h);
await p.screenshot({ path: process.argv[2] + "/r8-6-cena.png" });
await b.close();
