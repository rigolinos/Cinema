// Editor do roteiro: nomes do roteiro colado como NOME, nova cena depois de qualquer cena, mudar a ordem,
// e o Ajustar como sugestão (nada muda sem escolher). Supabase de mentira, IA simulada.
import path from "node:path";
import { APP, abrir, check, estado, reset } from "./base-mock.mjs";

const out = process.argv[2];
await reset();
const e0 = await estado();
const { b, p, erros } = await abrir();
await p.route("**/api/roteiro", async (route) => {
  const body = route.request().postDataJSON();
  if (body.mode === "bloco" && body.preview) {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ preview: { speech: "Personagem 1: Por que todo mundo tá me olhando?", on_screen: "", action: "Ela anda no corredor." } }) });
  }
  return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "não esperado" }) });
});
const videos = e0.videos.map((v) => (v.id === "v1" ? { ...v, script_reading: { people: ["Personagem 1", "Personagem 2", "Mãe"] } } : v));
const blocks = [
  { id: "c1", video_id: "v1", position: 0, kind: "gancho", label: null, speech: "Personagem 1: Por que que tá todo mundo me olhando?", on_screen: "", action: "Ela andando no corredor.", person_id: null, heading: "INT. CORREDOR – DIA", same_scene: false },
  { id: "c2", video_id: "v1", position: 1, kind: "conteudo", label: null, speech: "", on_screen: "", action: "Personagem 2 ergue o celular.", person_id: null, heading: "INT. CORREDOR – DIA", same_scene: true },
  { id: "c3", video_id: "v1", position: 2, kind: "conteudo", label: null, speech: "", on_screen: "", action: "Ela com a bandeja na mão.", person_id: null, heading: "INT. REFEITÓRIO – DIA", same_scene: false },
  { id: "c4", video_id: "v1", position: 3, kind: "chamada", label: null, speech: "Mãe: Tá tudo bem, filha?", on_screen: "", action: "Entra no carro.", person_id: null, heading: "INT. CARRO – DIA", same_scene: false },
];
await reset({ videos, blocks, shots: [] });
const abrirRoteiro = async () => {
  await p.goto(`${APP}/video/v1/roteiro`, { waitUntil: "networkidle" });
  await p.getByLabel("O que acontece na cena 1").waitFor();
};
await abrirRoteiro();
const cabecalhos = async () => (await p.getByRole("article").locator("h2").allInnerTexts()).join("|");

// ── Nomes do roteiro dela
const nomes = await p.getByRole("article").first().getByRole("combobox").first().inputValue();
check("Personagem 1 aparece como NOME em cima da fala", nomes === "Personagem 1", nomes);
check("a fala fica sem o nome colado", (await p.getByLabel("Fala de Personagem 1 na cena 1").inputValue()) === "Por que que tá todo mundo me olhando?");
check("cenas com a continuação agrupada", (await cabecalhos()) === "1. INT. CORREDOR – DIA|2. INT. REFEITÓRIO – DIA|3. INT. CARRO – DIA", await cabecalhos());

// ── Nova cena depois da cena 1 (que tem duas partes): entra depois da parte que continua
await p.getByRole("button", { name: "Opções da cena 1" }).click();
await p.getByRole("menuitem", { name: "Nova cena depois desta" }).click();
await p.getByLabel("O que acontece na cena 5").waitFor();
let e = await estado();
let ordem = e.blocks.filter((x) => x.video_id === "v1").sort((a, c) => a.position - c.position).map((x) => x.id.startsWith("novo") ? "nova" : x.id);
check("nova cena entra depois da cena inteira", ordem.join(",") === "c1,c2,nova,c3,c4", ordem.join(","));
check("a nova cena aparece como cena 2", (await cabecalhos()) === "1. INT. CORREDOR – DIA|CENA 2|3. INT. REFEITÓRIO – DIA|4. INT. CARRO – DIA", await cabecalhos());
await p.screenshot({ path: path.join(out, "ca-1-nova-cena.png"), fullPage: true });

// ── Mover o refeitório para cima (troca com a cena nova)
await reset({ videos, blocks, shots: [] });
await abrirRoteiro();
await p.getByRole("button", { name: "Opções da cena 3" }).click();
await p.getByRole("menuitem", { name: "Mover para cima" }).click();
await p.waitForTimeout(400);
check("refeitório sobe e a cena do corredor desce inteira", (await cabecalhos()) === "1. INT. REFEITÓRIO – DIA|2. INT. CORREDOR – DIA|3. INT. CARRO – DIA", await cabecalhos());
e = await estado();
ordem = e.blocks.filter((x) => x.video_id === "v1").sort((a, c) => a.position - c.position).map((x) => x.id);
check("no banco, na ordem nova", ordem.join(",") === "c3,c1,c2,c4", ordem.join(","));
await p.getByRole("button", { name: "Opções da cena 1" }).click();
const itens = (await p.getByRole("menuitem").allInnerTexts()).map((x) => x.trim());
check("a primeira cena não tem Mover para cima", !itens.includes("Mover para cima") && itens.includes("Mover para baixo"), itens.join(" | "));
await p.getByRole("button", { name: "Fechar o menu" }).click({ position: { x: 5, y: 5 } });

// ── Ajustar: vira sugestão; Manter o meu não muda; Usar ajuste muda
await reset({ videos, blocks, shots: [] });
await abrirRoteiro();
await p.getByRole("button", { name: "Pedir ajuste na cena 1" }).click();
await p.getByRole("button", { name: "Mais curto" }).click();
await p.getByText("Ajuste · Mais curto").waitFor();
check("o texto não muda antes de escolher", (await p.getByLabel("Fala de Personagem 1 na cena 1").inputValue()) === "Por que que tá todo mundo me olhando?");
e = await estado();
check("e nada foi gravado", e.blocks.find((x) => x.id === "c1").speech === "Personagem 1: Por que que tá todo mundo me olhando?");
await p.screenshot({ path: path.join(out, "ca-2-ajuste.png") });
await p.getByRole("button", { name: "Manter o meu" }).click();
check("Manter o meu deixa como estava", (await p.getByText("Ajuste · Mais curto").count()) === 0 && (await p.getByLabel("Fala de Personagem 1 na cena 1").inputValue()) === "Por que que tá todo mundo me olhando?");
await p.getByRole("button", { name: "Pedir ajuste na cena 1" }).click();
await p.getByRole("button", { name: "Mais curto" }).click();
await p.getByRole("button", { name: "Usar ajuste" }).click();
await p.waitForTimeout(300);
e = await estado();
check("Usar ajuste troca e grava", (await p.getByLabel("Fala de Personagem 1 na cena 1").inputValue()) === "Por que todo mundo tá me olhando?" && e.blocks.find((x) => x.id === "c1").speech === "Personagem 1: Por que todo mundo tá me olhando?");
check("sem erros", erros.length === 0, erros.join(" | "));
await b.close();
