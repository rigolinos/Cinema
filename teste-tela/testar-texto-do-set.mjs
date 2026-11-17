// Modo set: o mais e o menos aumentam a fala e também o texto na tela, que numa cena sem fala é o que se lê.
import path from "node:path";
import { APP, abrir, check, estado, reset } from "./base-mock.mjs";

const out = process.argv[2];
await reset();
const e0 = await estado();
const { b, p, erros } = await abrir();
const medir = (sel) => p.locator(sel).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
const abrirSet = async (blocks) => {
  await reset({ blocks });
  await p.goto(`${APP}/video/v1/gravar`, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: "Começar a gravar" }).click();
  await p.locator("section[aria-label=Teleprompter]").waitFor();
};
const mais = () => p.getByRole("button", { name: "Aumentar o texto" }).click();

// Cena só com texto na tela
await abrirSet(e0.blocks.map((x) => (x.id === "b1" ? { ...x, speech: "", on_screen: "POV: você lava o arroz errado há 20 anos" } : x)));
const sel = "section[aria-label=Teleprompter] p";
const a0 = await medir(sel);
await mais();
await mais();
const a2 = await medir(sel);
check("sem fala: o texto na tela começa legível", a0 >= 18, `${a0}px`);
check("sem fala: o mais aumenta o texto na tela", a2 > a0, `${a0} → ${a2}px`);
check("sem fala: o rótulo diz Texto na tela", (await p.locator("section[aria-label=Teleprompter]").innerText()).startsWith("TEXTO NA TELA"));
await p.screenshot({ path: path.join(out, "ts-1-sem-fala.png") });

// Cena com fala e texto na tela: os dois crescem
await abrirSet(e0.blocks);
const f0 = await medir(sel);
const t0 = await medir(`${sel} >> nth=1`);
await mais();
const f1 = await medir(sel);
const t1 = await medir(`${sel} >> nth=1`);
check("com fala: a fala cresce", f1 > f0, `${f0} → ${f1}px`);
check("com fala: o texto na tela cresce junto", t1 > t0, `${t0} → ${t1}px`);
await p.getByRole("button", { name: "Diminuir o texto" }).click();
await p.getByRole("button", { name: "Diminuir o texto" }).click();
check("o menos diminui", (await medir(sel)) < f0);
await p.screenshot({ path: path.join(out, "ts-2-com-fala.png") });
check("sem erros", erros.length === 0, erros.join(" | "));
await b.close();
