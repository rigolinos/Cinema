// Pessoas volta ao caminho: ao aprovar o roteiro, quem grava com outras pessoas passa por Pessoas antes da folha.
// Supabase de mentira, IA dos planos simulada.
import path from "node:path";
import { APP, abrir, check, estado, reset } from "./base-mock.mjs";

const out = process.argv[2];
const DB = "http://localhost:54399";
const { b, p, erros } = await abrir();
let falhar = false;
await p.route("**/api/planos", async (route) => {
  if (falhar) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "IA fora" }) });
  const shots = [1, 2, 3].map((n) => ({ id: `ns${n}`, video_id: "v1", block_id: "b1", position: n, shoot_order: n, framing: "close", angle: "altura_olhos", movement: "parado", orientation: "vertical", description: `Plano ${n}`, location: "Cozinha", wardrobe: "", why: "", recorded: false, good_take: false, takes: 0 }));
  await fetch(`${DB}/__shots`, { method: "POST", body: JSON.stringify(shots) });
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ shots }) });
});
const inicial = await estado();
const comVideo = (extra) => inicial.videos.map((v) => (v.id === "v1" ? { ...v, ...extra } : v));
const aprovar = async () => {
  await p.goto(`${APP}/video/v1/roteiro`, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: "Roteiro pronto" }).click();
};

// ── 1. Com outra pessoa: aprova, monta os planos e vai para Pessoas
await reset({ videos: comVideo({ stage: "roteiro", resources: ["com_alguem", "em_casa"] }), shots: [] });
await aprovar();
await p.waitForURL("**/video/v1/pessoas");
await p.getByText("3 planos prontos").waitFor();
let e = await estado();
check("com outra pessoa: vai para Pessoas", p.url().endsWith("/video/v1/pessoas"));
check("o vídeo fica no passo Pessoas", e.videos.find((v) => v.id === "v1").stage === "pessoas");
check("mostra os planos prontos", true);
await p.screenshot({ path: path.join(out, "pc-1-pessoas.png") });
await p.getByRole("button", { name: "Pessoas prontas" }).click();
await p.waitForURL((u) => u.pathname === "/video/v1");
e = await estado();
check("Pessoas prontas leva à folha, pronto para gravar", e.videos.find((v) => v.id === "v1").stage === "gravar");
await p.getByRole("link", { name: /Gravar passo a passo/ }).waitFor();
await p.screenshot({ path: path.join(out, "pc-2-folha.png") });

// ── 2. Sozinho: vai direto para a folha
await reset({ videos: comVideo({ stage: "roteiro", resources: ["sozinho", "em_casa"] }), shots: [], people: [{ id: "p0", name: "Rafa Lima", role: "eu", roles: ["ator"], share_token: "00000000-0000-4000-8000-0000000000aa", share_enabled: true, confirmed_at: null }] });
await aprovar();
await p.waitForURL((u) => u.pathname === "/video/v1");
e = await estado();
check("sozinho: direto para a folha", e.videos.find((v) => v.id === "v1").stage === "gravar");

// ── 3. Disse sozinho, mas já tem alguém no vídeo: passa por Pessoas
await reset({ videos: comVideo({ stage: "roteiro", resources: ["sozinho"] }), shots: [] });
await aprovar();
await p.waitForURL("**/video/v1/pessoas");
check("com alguém cadastrado: passa por Pessoas", true);

// ── 4. Volta da folha para mexer no roteiro: retorna à folha
await reset({ videos: comVideo({ stage: "gravar", resources: ["com_alguem"] }) });
await aprovar();
await p.waitForURL((u) => u.pathname === "/video/v1");
check("roteiro mexido depois: volta à folha", true);

// ── 5. A IA falha nos planos: Pessoas e depois a tela dos planos
falhar = true;
await reset({ videos: comVideo({ stage: "roteiro", resources: ["com_alguem"] }), shots: [] });
await aprovar();
await p.waitForURL("**/video/v1/pessoas");
const semLinha = !(await p.locator("body").innerText()).includes("planos prontos");
await p.getByRole("button", { name: "Pessoas prontas" }).click();
await p.waitForURL("**/video/v1/planos");
e = await estado();
check("sem planos: Pessoas, depois a tela dos planos", semLinha && e.videos.find((v) => v.id === "v1").stage === "planos");

check("sem erros", erros.length === 0, erros.join(" | "));
await b.close();
