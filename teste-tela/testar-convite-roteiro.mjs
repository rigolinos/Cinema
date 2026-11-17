// Link do convidado: o roteiro para todo o time, Falas só com fala, Planos no lugar de Gravação
// e a nova ordem (abas logo depois do cartão principal). Supabase de mentira.
import path from "node:path";
import { APP, abrir, check, reset } from "./base-mock.mjs";

const out = process.argv[2];
const TOKEN = "11111111-1111-4111-8111-111111111111";
const bloco = (number, speech, action, extra = {}) => ({ number, kind: "conteudo", label: null, speech, on_screen: "", action, mine: false, in_scene: false, cue: null, ...extra });
const plano = (number, block, mine) => ({ number, block, framing: "medio", angle: "altura_olhos", movement: "parado", orientation: "vertical", description: `Plano ${number}`, location: "Sala", wardrobe: "", why: "", recorded: false, good: false, takes: 0, mine, people: [] });
const base = { person: { name: "Natasha Lima", role: "ator", roles: ["ator"], confirmed: true }, video: { title: "Casal fala em 5 apps", shoot_date: null, shoot_place: null, platform: "reels" }, creator: "Rafa Lima", consented: true };
const { b, p, erros } = await abrir();
const abas = async () => (await p.getByRole("tab").allInnerTexts()).map((t) => t.trim());
const ativa = async () => (await p.getByRole("tab", { selected: true }).innerText()).trim();

// ── 1. Aparece sem fala
await reset({ part: { ...base, blocks: [bloco(1, "Rafa: amor, olha isso", "Ele mostra o celular."), bloco(2, "", "Ela revira os olhos.", { in_scene: true }), bloco(3, "Rafa: tá bom", "Ele guarda o celular.")], shots: [plano(1, 1, false), plano(2, 2, true)] } });
await p.goto(`${APP}/p/${TOKEN}`, { waitUntil: "networkidle" });
let t = await abas();
check("sem fala: abas Roteiro e Planos · 2", t.join("|") === "Roteiro|Planos · 2", t.join("|"));
check("sem fala: abre no Roteiro", (await ativa()) === "Roteiro");
const corpo = await p.locator("body").innerText();
check("o roteiro inteiro aparece", corpo.includes("Ele mostra o celular.") && corpo.includes("Ele guarda o celular."));
check("a cena dela vem marcada", /CENA 2 · VOCÊ APARECE/i.test(corpo) && !/CENA 1 · VOCÊ APARECE/i.test(corpo));
const pos = async (texto) => (await p.getByText(texto, { exact: false }).first().boundingBox()).y;
const yAbas = (await p.getByRole("tablist").boundingBox()).y;
check("abas antes de Salvar na sua conta", yAbas < (await pos("Salvar na sua conta")));
check("Fazer o meu no fim", (await pos("Salvar na sua conta")) < (await pos("Fazer o meu")));
check("o cartão principal não tem mais o Fazer o meu", (await pos("Fazer o meu")) > yAbas);
await p.screenshot({ path: path.join(out, "cv-1-sem-fala.png"), fullPage: true });

// ── 2. Aparece com fala
await reset({ part: { ...base, blocks: [bloco(1, "Rafa: amor, olha isso\nNatasha: de novo?", "Ele mostra o celular.", { mine: true, in_scene: true })], shots: [plano(1, 1, true)] } });
await p.goto(`${APP}/p/${TOKEN}`, { waitUntil: "networkidle" });
t = await abas();
check("com fala: Falas · 1, Roteiro e Planos · 1", t.join("|") === "Falas · 1|Roteiro|Planos · 1", t.join("|"));
check("com fala: abre nas Falas", (await ativa()) === "Falas · 1");
await p.screenshot({ path: path.join(out, "cv-2-com-fala.png"), fullPage: true });

check("sem erros", erros.length === 0, erros.join(" | "));
await b.close();
