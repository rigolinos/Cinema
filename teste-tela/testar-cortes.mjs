// Roteiro sem segundos e com "Separar as cenas" para roteiros antigos que têm CORTE dentro de uma cena.
import path from "node:path";
import { APP, abrir, check, estado, reset } from "./base-mock.mjs";

const out = process.argv[2];
await reset();
const e0 = await estado();
const acao = "Natasha sai do carro e trava ele. CORTE. Natasha está na esquina e aperta o controle de novo.";
const { b, p, erros } = await abrir();
await reset({ blocks: e0.blocks.map((x) => (x.id === "b1" ? { ...x, action: acao } : x)) });
await p.goto(`${APP}/video/v1/roteiro`, { waitUntil: "networkidle" });
await p.getByLabel("O que acontece na cena 1").waitFor();
let t = await p.locator("body").innerText();
check("sem a conta de segundos no topo", t.includes("Vídeo de 30 s") && !/\d+ s de 30 s/.test(t) && !t.includes("Está curto"), t.match(/Vídeo de[^\n]*/)?.[0] ?? "");
check("avisa a cena com CORTE", t.includes("A cena 1 tem um CORTE: são duas cenas numa só."));
await p.screenshot({ path: path.join(out, "ct-1-aviso.png") });
await p.getByRole("button", { name: "Separar as cenas" }).click();
await p.getByLabel("O que acontece na cena 4").waitFor();
const acoes = await Promise.all([1, 2, 3, 4].map((n) => p.getByLabel(`O que acontece na cena ${n}`).inputValue()));
check("a cena vira duas, na ordem", acoes[0] === "Natasha sai do carro e trava ele." && acoes[1] === "Natasha está na esquina e aperta o controle de novo." && acoes[2] === "Água entrando na panela".slice(0, 0) + acoes[2], acoes.join(" | "));
const e = await estado();
const ordem = [...e.blocks].filter((x) => x.video_id === "v1").sort((a, c) => a.position - c.position).map((x) => x.action.slice(0, 20));
check("no banco, na ordem certa", ordem.length === 4 && ordem[0].startsWith("Natasha sai") && ordem[1].startsWith("Natasha está"), ordem.join(" | "));
t = await p.locator("body").innerText();
check("o aviso some depois de separar", !t.includes("tem um CORTE"));
await p.screenshot({ path: path.join(out, "ct-2-separado.png"), fullPage: true });
check("sem erros", erros.length === 0, erros.join(" | "));
await b.close();
